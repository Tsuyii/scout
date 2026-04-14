import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.object({ subject: z.string(), body: z.string() });
const dmSchema    = z.object({ body: z.string().max(300) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId, contactId, platform, regenerate } = await request.json() as {
    campaignId: string;
    contactId:  string;
    platform:   "email" | "linkedin";
    regenerate?: boolean;
  };

  // Load contact + company + user profile
  type ContactWithJoin = {
    id: string; name: string | null; role: string | null;
    type: "founder" | "cto" | "engineer" | "recruiter";
    companies: { name: string; website: string | null; description: string | null; campaigns: { location: string; fields: string[]; languages: string[] } | null } | null;
  };

  const [{ data: rawContact }, { data: profile }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, companies!inner(campaign_id, name, website, description, campaigns!inner(location, fields, languages))")
      .eq("id", contactId)
      .single(),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ]);

  if (!rawContact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const contact = rawContact as unknown as ContactWithJoin;

  const company   = contact.companies;
  const campaign  = company?.campaigns;
  const lang      = campaign?.languages?.[0] ?? "en";
  const langLabel = lang === "fr" ? "French" : lang === "es" ? "Spanish" : "English";

  let subject: string | null = null;
  let body: string;

  if (platform === "email") {
    const { output } = await generateText({
      model:  groq("llama-3.3-70b-versatile"),
      output: Output.object({ schema: emailSchema }),
      prompt: `Write a cold internship email in ${langLabel}. Max 150 words. Sound human, not template-like.

From: ${profile?.name ?? "CS student"}, skills: ${profile?.skills?.join(", ") ?? ""}, available: ${profile?.availability ?? "open"}
To: ${contact.name ?? "the team"} (${contact.role ?? contact.type}) at ${company?.name ?? "the company"}
Context: ${company?.description?.slice(0, 100) ?? "tech company"}
${regenerate ? "\nThis is a regeneration — vary the angle and opening." : ""}

Return JSON: {"subject": "...", "body": "..."}`,
    });
    subject = output?.subject ?? null;
    body    = output?.body ?? "Draft generation failed.";
  } else {
    const { output } = await generateText({
      model:  groq("llama-3.3-70b-versatile"),
      output: Output.object({ schema: dmSchema }),
      prompt: `Write a LinkedIn DM in ${langLabel}. Max 300 chars, 3 sentences: compliment / intro / ask.

From: ${profile?.name ?? "CS student"} looking for ${campaign?.fields?.join("/") ?? "SWE"} internship
To: ${contact.name ?? "someone"} at ${company?.name ?? "the company"}
${regenerate ? "\nThis is a regeneration — vary the tone." : ""}

Return JSON: {"body": "..."}`,
    });
    body = output?.body ?? "Draft generation failed.";
  }

  // Upsert message
  const existing = regenerate
    ? (await supabase.from("messages").select("id").eq("contact_id", contactId).eq("platform", platform).single()).data
    : null;

  if (existing) {
    await supabase
      .from("messages")
      .update({ subject, body, status: "draft", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return NextResponse.json({ messageId: existing.id, subject, body });
  }

  const { data: message } = await supabase
    .from("messages")
    .insert({ campaign_id: campaignId, contact_id: contactId, platform, language: lang, subject, body, status: "draft" })
    .select()
    .single();

  return NextResponse.json({ messageId: message?.id, subject, body });
}
