import { NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: rawContact }, { data: userProfile }, { data: campaign }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, companies!inner(campaign_id, name, website, description, campaigns!inner(location, fields, languages))")
      .eq("id", contactId)
      .single(),
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("campaigns").select("profile_id").eq("id", campaignId).single(),
  ]);

  // Use the campaign's linked profile if set, otherwise fall back to the user row
  let profile = userProfile;
  if (campaign?.profile_id) {
    const { data: linkedProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", campaign.profile_id)
      .single();
    if (linkedProfile) profile = linkedProfile as typeof userProfile;
  }

  if (!rawContact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  const contact = rawContact as unknown as ContactWithJoin;

  const company   = contact.companies;
  const campaign  = company?.campaigns;
  const lang      = campaign?.languages?.[0] ?? "en";
  const langLabel = lang === "fr" ? "French" : lang === "es" ? "Spanish" : "English";

  let subject: string | null = null;
  let body: string;

  if (platform === "email") {
    const { text } = await generateText({
      model:  groq("llama-3.3-70b-versatile"),
      prompt: `Write a cold internship email in ${langLabel}. Max 150 words. Sound human, not template-like.

From: ${profile?.name ?? "CS student"}, skills: ${profile?.skills?.join(", ") ?? ""}, available: ${profile?.availability ?? "open"}
To: ${contact.name ?? "the team"} (${contact.role ?? contact.type}) at ${company?.name ?? "the company"}
Context: ${company?.description?.slice(0, 100) ?? "tech company"}
${regenerate ? "\nThis is a regeneration — vary the angle and opening." : ""}

Return ONLY a JSON object: {"subject": "...", "body": "..."}`,
    });
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { subject: string; body: string } : null;
    subject = parsed?.subject ?? null;
    body    = parsed?.body ?? "Draft generation failed.";
  } else {
    const { text } = await generateText({
      model:  groq("llama-3.3-70b-versatile"),
      prompt: `Write a LinkedIn DM in ${langLabel}. Max 300 chars, 3 sentences: compliment / intro / ask.

From: ${profile?.name ?? "CS student"} looking for ${campaign?.fields?.join("/") ?? "SWE"} internship
To: ${contact.name ?? "someone"} at ${company?.name ?? "the company"}
${regenerate ? "\nThis is a regeneration — vary the tone." : ""}

Return ONLY a JSON object: {"body": "..."}`,
    });
    const match = text.match(/\{[\s\S]*\}/);
    body = (match ? JSON.parse(match[0]) as { body: string } : null)?.body ?? "Draft generation failed.";
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
