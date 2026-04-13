import { createClient } from "@/lib/supabase/server";
import { streamText, generateText, Output, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const maxDuration = 300; // 5 min — long-running discovery

// ─── Tool parameter schemas (module-level for TS inference) ───────────────────
const webSearchParams    = z.object({ query: z.string() });
const findContactParams  = z.object({ companyName: z.string(), website: z.string().optional() });
const saveCompanyParams  = z.object({
  name:        z.string(),
  website:     z.string().optional(),
  description: z.string().optional(),
  contact: z.object({
    name:         z.string().nullable(),
    role:         z.string().nullable(),
    linkedin_url: z.string().nullable(),
    type:         z.enum(["founder", "cto", "engineer", "recruiter"]),
  }).optional(),
});

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Adzuna job board search ──────────────────────────────────────────────────

async function searchAdzuna(
  location: string,
  field: string
): Promise<Array<{ name: string; website: string | null; jobUrl: string; description: string }>> {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const query = encodeURIComponent(`${field} intern`);
  const loc   = encodeURIComponent(location);
  const url   = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${appId}&app_key=${appKey}&what=${query}&where=${loc}&results_per_page=20&content-type=application/json`;

  try {
    const res  = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as {
      results?: Array<{ company: { display_name: string }; redirect_url: string; description: string }>;
    };

    const seen = new Set<string>();
    return (json.results ?? []).reduce<Array<{ name: string; website: string | null; jobUrl: string; description: string }>>((acc, job) => {
      const name = job.company?.display_name;
      if (!name || seen.has(name)) return acc;
      seen.add(name);
      acc.push({
        name,
        website: null,
        jobUrl: job.redirect_url,
        description: job.description?.slice(0, 200) ?? "",
      });
      return acc;
    }, []);
  } catch {
    return [];
  }
}

// ─── Hunter.io email finder ───────────────────────────────────────────────────

async function findEmail(
  domain: string,
  firstName: string,
  lastName: string
): Promise<{ email: string | null; confidence: number }> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return { email: null, confidence: 0 };

  try {
    const url = `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return { email: null, confidence: 0 };
    const json = await res.json() as { data?: { email: string; score: number } };
    return {
      email:      json.data?.email ?? null,
      confidence: json.data?.score ?? 0,
    };
  } catch {
    return { email: null, confidence: 0 };
  }
}

// ─── Draft schema ─────────────────────────────────────────────────────────────

const emailDraftSchema = z.object({
  subject: z.string(),
  body:    z.string(),
});

const dmDraftSchema = z.object({
  body: z.string().max(300),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { campaignId } = await request.json() as { campaignId: string };

  const [{ data: campaign }, { data: profile }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).single(),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ]);

  if (!campaign) return new Response("Campaign not found", { status: 404 });

  const encoder   = new TextEncoder();
  let   found     = 0;
  const target    = campaign.target_count;
  const seenNames = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sseEvent(data)));
      const log  = (text: string, level: "info" | "success" | "warn" | "error" = "info") =>
        send({ type: "log", text, level });

      try {
        log(`Starting discovery for ${campaign.location} · ${campaign.fields.join(", ")}`, "info");
        log(`Mode: ${campaign.mode} · Target: ${target} companies`, "info");

        // ── Tier 1: Active path — Adzuna job boards ────────────────────────
        if (found < target) {
          log("Searching job boards (Adzuna)...", "info");
          for (const field of campaign.fields) {
            if (found >= target) break;
            const results = await searchAdzuna(campaign.location, field);
            log(`Adzuna: ${results.length} results for "${field}"`, "info");

            for (const job of results) {
              if (found >= target) break;
              if (seenNames.has(job.name.toLowerCase())) continue;
              seenNames.add(job.name.toLowerCase());

              const { data: company } = await supabase
                .from("companies")
                .insert({
                  campaign_id:     campaignId,
                  name:            job.name,
                  website:         job.website,
                  description:     job.description,
                  location:        campaign.location,
                  source:          "job_board",
                  job_posting_url: job.jobUrl,
                })
                .select()
                .single();

              if (!company) continue;
              found++;
              log(`[+] ${job.name} (job board)`, "success");
              send({ type: "company", company: { ...company, contact: null, draftReady: false } });
            }
          }
        }

        // ── Tier 2: Cold path — Claude AI agent with Tavily ────────────────
        if (campaign.mode === "hybrid" && found < target && process.env.ANTHROPIC_API_KEY) {
          log("Switching to AI cold search (Claude + Tavily)...", "info");
          const remaining = target - found;

          const profileContext = profile
            ? `Candidate: ${profile.name ?? "CS/ML student"}, skills: ${profile.skills?.join(", ") ?? "programming"}`
            : "Candidate: CS/ML student looking for internship";

          const { fullStream } = streamText({
            model: anthropic("claude-sonnet-4.6"),
            stopWhen: stepCountIs(50),
            system: `You are an internship discovery agent. Your job is to find ${remaining} companies in ${campaign.location} that would be good targets for a ${campaign.fields.join("/")} internship.
${profileContext}

For each company found: search → extract → find contact → save. Stop after saving ${remaining} companies.`,
            prompt: `Find ${remaining} companies in ${campaign.location} for ${campaign.fields.join("/")} internship positions. Focus on startups, scale-ups, and tech companies. Search in multiple languages if relevant (${campaign.languages.join(", ")}).`,
            tools: {
              webSearch: tool({
                description: "Search the web for companies",
                inputSchema: webSearchParams,
                execute: async ({ query }) => {
                  const key = process.env.TAVILY_API_KEY;
                  if (!key) { log("Tavily API key not set — skipping web search", "warn"); return { results: [] }; }
                  log(`Searching: "${query}"`, "info");
                  try {
                    const res = await fetch("https://api.tavily.com/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ api_key: key, query, max_results: 10 }),
                    });
                    if (!res.ok) return { results: [] };
                    return res.json();
                  } catch { return { results: [] }; }
                },
              }),

              findContact: tool({
                description: "Find a founder/CTO/engineer at a company via LinkedIn search",
                inputSchema: findContactParams,
                execute: async ({ companyName, website }) => {
                  log(`Finding contact at ${companyName}...`, "info");
                  const key = process.env.TAVILY_API_KEY;
                  if (!key) return { contact: null };
                  try {
                    const res = await fetch("https://api.tavily.com/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        api_key: key,
                        query:   `site:linkedin.com/in founder OR CTO OR engineer "${companyName}"`,
                        max_results: 3,
                      }),
                    });
                    if (!res.ok) return { contact: null };
                    const data = await res.json() as { results?: Array<{ title: string; url: string }> };
                    const first = data.results?.[0];
                    if (!first) return { contact: null };
                    const name = first.title.split(" - ")[0]?.trim() ?? null;
                    return { contact: { name, linkedin_url: first.url, website } };
                  } catch { return { contact: null }; }
                },
              }),

              saveCompany: tool({
                description: "Save a discovered company and contact to the database",
                inputSchema: saveCompanyParams,
                execute: async ({ name, website, description, contact: contactData }) => {
                  if (found >= target) return { saved: false, reason: "target reached" };
                  if (seenNames.has(name.toLowerCase())) return { saved: false, reason: "duplicate" };
                  seenNames.add(name.toLowerCase());

                  const { data: company } = await supabase
                    .from("companies")
                    .insert({ campaign_id: campaignId, name, website: website ?? null, description: description ?? null, location: campaign.location, source: "cold_search" })
                    .select()
                    .single();

                  if (!company) return { saved: false, reason: "db error" };
                  found++;

                  let savedContact = null;
                  if (contactData) {
                    let email: string | null = null;
                    let confidence = 0;
                    if (website && contactData.name) {
                      const domain = website.replace(/^https?:\/\//, "").split("/")[0];
                      const parts  = contactData.name.trim().split(" ");
                      const result = await findEmail(domain, parts[0] ?? "", parts[parts.length - 1] ?? "");
                      email      = result.email;
                      confidence = result.confidence;
                      await new Promise((r) => setTimeout(r, 500)); // Hunter.io rate limit
                    }

                    const { data: contact } = await supabase
                      .from("contacts")
                      .insert({ company_id: company.id, name: contactData.name, role: contactData.role, email, linkedin_url: contactData.linkedin_url, confidence_score: confidence, type: contactData.type })
                      .select()
                      .single();

                    savedContact = contact;
                    if (email) log(`Email found for ${contactData.name ?? name}: ${email}`, "success");
                  }

                  log(`[+] ${name} (cold)`, "success");
                  send({ type: "company", company: { ...company, contact: savedContact ?? null, draftReady: false } });
                  return { saved: true, companyId: company.id };
                },
              }),
            },
          });

          for await (const chunk of fullStream) {
            if (chunk.type === "text-delta" && chunk.text.trim()) {
              log(chunk.text.trim(), "info");
            }
          }
        }

        // ── Generate drafts for all contacts ──────────────────────────────
        if (profile && process.env.ANTHROPIC_API_KEY) {
          log("Generating outreach drafts...", "info");

          type ContactRow = { id: string; name: string | null; role: string | null; type: "founder" | "cto" | "engineer" | "recruiter"; companies: { name: string; website: string | null; description: string | null } | null };
          const { data: rawContacts } = await supabase
            .from("contacts")
            .select("*, companies!inner(campaign_id, name, website, description)")
            .eq("companies.campaign_id", campaignId);
          const contacts = (rawContacts ?? []) as unknown as ContactRow[];

          for (const contact of contacts) {
            const company = contact.companies;
            if (!company) continue;

            for (const lang of campaign.languages) {
              const langLabel = lang === "fr" ? "French" : lang === "es" ? "Spanish" : "English";

              // Email draft
              try {
                const { output: emailDraft } = await generateText({
                  model:  anthropic("claude-sonnet-4.6"),
                  output: Output.object({ schema: emailDraftSchema }),
                  prompt: `Write a cold internship email in ${langLabel}. Max 150 words. Sound human, not template-like.

From: ${profile.name ?? "CS student"}, skills: ${profile.skills?.join(", ") ?? ""}, available: ${profile.availability ?? "open"}
To: ${contact.name ?? "the team"} (${contact.role ?? contact.type}) at ${company.name}
Context: ${company.description?.slice(0, 100) ?? "tech company"}

Return JSON: {"subject": "...", "body": "..."}`,
                });

                if (emailDraft) {
                  const { data: message } = await supabase
                    .from("messages")
                    .insert({ campaign_id: campaignId, contact_id: contact.id, platform: "email", language: lang, subject: emailDraft.subject, body: emailDraft.body, status: "draft" })
                    .select()
                    .single();
                  if (message) send({ type: "draft", companyId: company.name, messageId: message.id });
                }
              } catch { log(`Email draft failed for ${company.name}`, "warn"); }

              // LinkedIn DM
              try {
                const { output: dmDraft } = await generateText({
                  model:  anthropic("claude-sonnet-4.6"),
                  output: Output.object({ schema: dmDraftSchema }),
                  prompt: `Write a LinkedIn DM in ${langLabel}. Max 300 chars, 3 sentences. Compliment / intro / ask.

From: ${profile.name ?? "CS student"} looking for ${campaign.fields.join("/")} internship
To: ${contact.name ?? "someone"} at ${company.name}

Return JSON: {"body": "..."}`,
                });

                if (dmDraft) {
                  const { data: message } = await supabase
                    .from("messages")
                    .insert({ campaign_id: campaignId, contact_id: contact.id, platform: "linkedin", language: lang, body: dmDraft.body, status: "draft" })
                    .select()
                    .single();
                  if (message) send({ type: "draft", companyId: company.name, messageId: message.id });
                }
              } catch { log(`LinkedIn draft failed for ${company.name}`, "warn"); }
            }
          }
        } else if (!process.env.ANTHROPIC_API_KEY) {
          log("ANTHROPIC_API_KEY not set — skipping draft generation", "warn");
        }

        await supabase
          .from("campaigns")
          .update({ status: "complete", updated_at: new Date().toISOString() })
          .eq("id", campaignId);

        log(`Done — ${found} companies discovered.`, "success");
        send({ type: "done" });
      } catch (err) {
        send({ type: "log", text: `Fatal: ${err instanceof Error ? err.message : String(err)}`, level: "error" });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
