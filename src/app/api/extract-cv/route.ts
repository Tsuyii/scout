import { NextResponse } from "next/server";
import { generateText, Output, type FilePart, type TextPart } from "ai";
import { google } from "@ai-sdk/google";
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

  // Pass PDFs directly to Claude (native PDF support); fall back to text for other formats.
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  let userContent: Array<TextPart | FilePart>;

  if (isPdf) {
    userContent = [
      { type: "file", data: fileBuffer, mediaType: "application/pdf" } satisfies FilePart,
      { type: "text", text: "Extract the candidate's profile from this CV/resume. Be concise — skills as a list of keywords, education and experience as 1-3 sentence summaries." } satisfies TextPart,
    ];
  } else {
    let cvText = "";
    try { cvText = await file.text(); } catch { cvText = `File: ${file.name}`; }
    userContent = [
      { type: "text", text: `Extract the candidate's profile from this CV/resume text.\nBe concise — skills as a list of keywords, education and experience as 1-3 sentence summaries.\n\nCV content:\n${cvText.slice(0, 8000)}` } satisfies TextPart,
    ];
  }

  let profile;
  try {
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      output: Output.object({ schema: profileSchema }),
      messages: [{ role: "user", content: userContent }],
    });
    profile = result.output;
  } catch (err) {
    return NextResponse.json({ error: `AI extraction failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl, profile });
}
