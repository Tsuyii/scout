import { NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  name: z.string().describe("Full name of the candidate"),
  skills: z.array(z.string()).describe("Technical skills, programming languages, frameworks"),
  education: z.string().describe("Education background — degree, university, year"),
  experience: z.string().describe("Work experience and notable projects as a concise summary"),
  availability: z.string().describe("Internship availability period if mentioned, e.g. 'Summer 2026'"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}/cv-${Date.now()}.${fileExt}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(fileName, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("cvs").getPublicUrl(fileName);

  // Extract text: use Jina Reader for PDFs (no native deps), plain text otherwise
  let cvText = "";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    try {
      // Bucket is private — must use a signed URL so Jina can actually fetch the file
      const { data: signedData } = await supabase.storage.from("cvs").createSignedUrl(fileName, 120);
      const jinaUrl = signedData?.signedUrl;
      if (jinaUrl) {
        const jinaRes = await fetch(`https://r.jina.ai/${jinaUrl}`, {
          headers: { Accept: "text/plain" },
          signal: AbortSignal.timeout(15000),
        });
        if (jinaRes.ok) cvText = (await jinaRes.text()).slice(0, 8000);
      }
    } catch { cvText = ""; }
  } else {
    try { cvText = (await file.text()).slice(0, 8000); } catch { cvText = ""; }
  }

  if (!cvText.trim()) {
    return NextResponse.json({ error: "Could not extract text from file." }, { status: 422 });
  }

  let profile;
  try {
    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: `You are a CV parser. Extract information from the CV text below and return a single JSON object. No markdown, no code fences, no explanation — just the raw JSON object.

Required fields:
- name: full name of the candidate (string)
- skills: list of technical skills, languages, frameworks (array of strings)
- education: degree, university, year (1-2 sentences)
- experience: work experience and projects (2-3 sentences)
- availability: internship availability period if mentioned, otherwise ""

CV text:
${cvText}`,
    });
    // Strip markdown code fences if model ignored instructions
    const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    profile = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (err) {
    return NextResponse.json({ error: `AI extraction failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl, profile });
}
