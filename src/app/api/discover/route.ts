import { createClient } from "@/lib/supabase/server";
import { streamText, generateText, tool, stepCountIs } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

export const maxDuration = 300; // 5 min — long-running discovery

// ─── Tool parameter schemas ───────────────────────────────────────────────────
const webSearchParams   = z.object({ query: z.string() });
const findContactParams = z.object({ companyName: z.string(), website: z.string().optional() });
const saveCompanyParams = z.object({
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

type JobResult = { name: string; website: string | null; jobUrl: string; description: string };

// ─── Jina Reader — free website scraper ───────────────────────────────────────
async function jinaFetch(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 600);
  } catch { return ""; }
}

// ─── Location → Adzuna country code ──────────────────────────────────────────
function adzunaCountry(location: string): string {
  const l = location.toLowerCase();
  if (l.includes("france") || l.includes("paris") || l.includes("lyon") || l.includes("bordeaux") || l.includes("marseille")) return "fr";
  if (l.includes("germany") || l.includes("berlin") || l.includes("munich") || l.includes("hamburg") || l.includes("deutschland")) return "de";
  if (l.includes("netherlands") || l.includes("amsterdam") || l.includes("rotterdam")) return "nl";
  if (l.includes("canada") || l.includes("toronto") || l.includes("montreal") || l.includes("vancouver")) return "ca";
  if (l.includes("australia") || l.includes("sydney") || l.includes("melbourne") || l.includes("brisbane")) return "au";
  if (l.includes("new zealand") || l.includes("auckland")) return "nz";
  if (l.includes("brazil") || l.includes("são paulo") || l.includes("sao paulo")) return "br";
  if (l.includes("india") || l.includes("bangalore") || l.includes("mumbai") || l.includes("delhi")) return "in";
  if (l.includes("singapore")) return "sg";
  if (l.includes("south africa") || l.includes("cape town") || l.includes("johannesburg")) return "za";
  if (l.includes("poland") || l.includes("warsaw") || l.includes("krakow")) return "pl";
  if (l.includes("usa") || l.includes("united states") || l.includes("new york") || l.includes("san francisco") || l.includes("seattle") || l.includes("chicago") || l.includes("austin")) return "us";
  if (l.includes("uk") || l.includes("london") || l.includes("manchester") || l.includes("united kingdom")) return "gb";
  return "gb"; // default
}

// ─── Field → Remotive category ────────────────────────────────────────────────
function remotiveCategory(field: string): string {
  const f = field.toLowerCase();
  if (f.includes("ml") || f.includes("data") || f.includes("ds") || f.includes("research")) return "data";
  if (f.includes("devops")) return "devops";
  if (f.includes("frontend")) return "frontend";
  if (f.includes("backend")) return "backend";
  return "software-dev";
}

// ─── Field → The Muse category ────────────────────────────────────────────────
function museCategory(field: string): string {
  const f = field.toLowerCase();
  if (f.includes("ml") || f.includes("data") || f.includes("ds") || f.includes("research")) return "Data+Science";
  if (f.includes("devops")) return "Infrastructure+%26+Storage";
  if (f.includes("frontend")) return "Software+Engineer"; // Muse has no frontend category
  return "Software+Engineer";
}

// ─── Adzuna job board (requires API key) ─────────────────────────────────────
async function searchAdzuna(location: string, field: string): Promise<JobResult[]> {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const country = adzunaCountry(location);
  const query   = encodeURIComponent(`${field} intern`);
  const loc     = encodeURIComponent(location);
  const url     = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${query}&where=${loc}&results_per_page=20&content-type=application/json`;

  try {
    const res  = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as {
      results?: Array<{ company: { display_name: string }; redirect_url: string; description: string }>;
    };
    const seen = new Set<string>();
    return (json.results ?? []).reduce<JobResult[]>((acc, job) => {
      const name = job.company?.display_name;
      if (!name || seen.has(name)) return acc;
      seen.add(name);
      acc.push({ name, website: null, jobUrl: job.redirect_url, description: job.description?.slice(0, 200) ?? "" });
      return acc;
    }, []);
  } catch { return []; }
}

// ─── Remotive — remote tech jobs, no key ─────────────────────────────────────
async function searchRemotive(field: string): Promise<JobResult[]> {
  try {
    const category = remotiveCategory(field);
    const res = await fetch(`https://remotive.com/api/remote-jobs?category=${category}&limit=30&search=intern`);
    if (!res.ok) return [];
    const json = await res.json() as { jobs?: Array<{ company_name: string; url: string; description: string }> };
    const seen = new Set<string>();
    return (json.jobs ?? []).reduce<JobResult[]>((acc, job) => {
      if (!job.company_name || seen.has(job.company_name.toLowerCase())) return acc;
      seen.add(job.company_name.toLowerCase());
      acc.push({ name: job.company_name, website: null, jobUrl: job.url, description: job.description?.slice(0, 200) ?? "" });
      return acc;
    }, []);
  } catch { return []; }
}

// ─── Arbeitnow — European jobs, no key ───────────────────────────────────────
async function searchArbeitnow(field: string): Promise<JobResult[]> {
  try {
    // Use search param — more reliable than tags for "intern"
    const query = encodeURIComponent(`intern ${field}`);
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${query}`);
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ company_name: string; url: string; description: string }> };
    const seen = new Set<string>();
    return (json.data ?? []).reduce<JobResult[]>((acc, job) => {
      if (!job.company_name || seen.has(job.company_name.toLowerCase())) return acc;
      seen.add(job.company_name.toLowerCase());
      acc.push({ name: job.company_name, website: null, jobUrl: job.url, description: job.description?.slice(0, 200) ?? "" });
      return acc;
    }, []);
  } catch { return []; }
}

// ─── The Muse — tech job listings, no key ────────────────────────────────────
async function searchTheMuse(field: string): Promise<JobResult[]> {
  try {
    const category = museCategory(field);
    const res = await fetch(`https://www.themuse.com/api/public/jobs?category=${category}&level=Internship&page=0&descending=true`);
    if (!res.ok) return [];
    const json = await res.json() as {
      results?: Array<{ company: { name: string }; refs: { landing_page: string }; contents: string }>;
    };
    const seen = new Set<string>();
    return (json.results ?? []).reduce<JobResult[]>((acc, job) => {
      const name = job.company?.name;
      if (!name || seen.has(name.toLowerCase())) return acc;
      seen.add(name.toLowerCase());
      acc.push({ name, website: null, jobUrl: job.refs?.landing_page ?? "", description: job.contents?.replace(/<[^>]+>/g, "").slice(0, 200) ?? "" });
      return acc;
    }, []);
  } catch { return []; }
}

// ─── Remoteok — remote jobs, no key ──────────────────────────────────────────
async function searchRemoteok(field: string): Promise<JobResult[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "internship-hunter/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json() as Array<{
      company?: string; position?: string; url?: string;
      description?: string; tags?: string[];
    }>;
    const fieldLower = field.toLowerCase();
    const seen = new Set<string>();
    return json
      .filter((job) => {
        if (!job.company || !job.position) return false;
        const pos  = job.position.toLowerCase();
        const tags = job.tags?.join(" ").toLowerCase() ?? "";
        return pos.includes("intern") || tags.includes("intern") || tags.includes(fieldLower);
      })
      .slice(0, 20)
      .reduce<JobResult[]>((acc, job) => {
        if (!job.company || seen.has(job.company.toLowerCase())) return acc;
        seen.add(job.company.toLowerCase());
        acc.push({ name: job.company, website: null, jobUrl: job.url ?? "", description: job.description?.replace(/<[^>]+>/g, "").slice(0, 200) ?? "" });
        return acc;
      }, []);
  } catch { return []; }
}

// ─── Jobicy — remote jobs, no key ────────────────────────────────────────────
async function searchJobicy(field: string): Promise<JobResult[]> {
  try {
    const tagMap: Record<string, string> = {
      swe: "engineering", backend: "engineering", frontend: "engineering",
      "ds/ml": "data-science", research: "data-science", devops: "devops",
    };
    const tag = tagMap[field.toLowerCase()] ?? "engineering";
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=20&tag=${tag}&search=intern`);
    if (!res.ok) return [];
    const json = await res.json() as {
      jobs?: Array<{ companyName: string; jobSlug: string; jobDescription: string; companyUrl?: string }>;
    };
    const seen = new Set<string>();
    return (json.jobs ?? []).reduce<JobResult[]>((acc, job) => {
      if (!job.companyName || seen.has(job.companyName.toLowerCase())) return acc;
      seen.add(job.companyName.toLowerCase());
      acc.push({
        name: job.companyName,
        website: job.companyUrl ?? null,
        jobUrl: `https://jobicy.com/jobs/${job.jobSlug}`,
        description: job.jobDescription?.replace(/<[^>]+>/g, "").slice(0, 200) ?? "",
      });
      return acc;
    }, []);
  } catch { return []; }
}

// ─── Hunter.io email finder ───────────────────────────────────────────────────
async function findEmail(domain: string, firstName: string, lastName: string): Promise<{ email: string | null; confidence: number }> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return { email: null, confidence: 0 };
  try {
    const url = `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return { email: null, confidence: 0 };
    const json = await res.json() as { data?: { email: string; score: number } };
    return { email: json.data?.email ?? null, confidence: json.data?.score ?? 0 };
  } catch { return { email: null, confidence: 0 }; }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { campaignId } = await request.json() as { campaignId: string };

  const [{ data: campaign }, { data: userProfile }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).single(),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ]);

  if (!campaign) return new Response("Campaign not found", { status: 404 });

  // Use the campaign's linked profile if set, else fall back to user row
  let profile = userProfile;
  if (campaign.profile_id) {
    const { data: linkedProfile } = await supabase
      .from("profiles").select("*").eq("id", campaign.profile_id).single();
    if (linkedProfile) profile = linkedProfile as typeof userProfile;
  }

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

        // ── Tier 1: Job boards ────────────────────────────────────────────
        if (found < target) {
          log("Searching job boards (Adzuna · Remotive · Arbeitnow · The Muse · Remoteok · Jobicy)...", "info");

          for (const field of campaign.fields) {
            if (found >= target) break;

            const [adzuna, remotive, arbeitnow, muse, remoteok, jobicy] = await Promise.all([
              searchAdzuna(campaign.location, field),
              searchRemotive(field),
              searchArbeitnow(field),
              searchTheMuse(field),
              searchRemoteok(field),
              searchJobicy(field),
            ]);

            const results = [...adzuna, ...remotive, ...arbeitnow, ...muse, ...remoteok, ...jobicy];
            log(
              `"${field}" — Adzuna:${adzuna.length} Remotive:${remotive.length} Arbeitnow:${arbeitnow.length} Muse:${muse.length} Remoteok:${remoteok.length} Jobicy:${jobicy.length}`,
              "info",
            );

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

        // ── Tier 2: AI cold search ────────────────────────────────────────
        if (campaign.mode === "hybrid" && process.env.GROQ_API_KEY) {
          log("Switching to AI cold search...", "info");
          const remaining = Math.max(target - found, 5);

          const profileContext = profile
            ? `Candidate: ${profile.name ?? "CS/ML student"}, skills: ${profile.skills?.join(", ") ?? "programming"}, available: ${profile.availability ?? "open"}`
            : "Candidate: CS/ML student looking for internship";

          const { fullStream } = streamText({
            model: groq("llama-3.3-70b-versatile"),
            stopWhen: stepCountIs(50),
            system: `You are an internship discovery agent. Find ${remaining} companies in ${campaign.location} that would be good targets for a ${campaign.fields.join("/")} internship.
${profileContext}

Strategy:
1. Search for startups and scale-ups in relevant sectors
2. Search LinkedIn, AngelList, Crunchbase-style queries
3. Search local tech communities and news ("top startups ${campaign.location} 2024")
4. For each company: get website, extract contact, save
5. Stop after saving ${remaining} companies.`,
            prompt: `Find ${remaining} companies in ${campaign.location} for ${campaign.fields.join("/")} internship positions. Prioritize startups, scale-ups, and innovative tech companies. Search in multiple languages if relevant (${campaign.languages.join(", ")}).`,
            tools: {
              webSearch: tool({
                description: "Search the web for companies",
                inputSchema: webSearchParams,
                execute: async ({ query }) => {
                  log(`Searching: "${query}"`, "info");
                  const tavilyKey = process.env.TAVILY_API_KEY;
                  if (tavilyKey) {
                    try {
                      const res = await fetch("https://api.tavily.com/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ api_key: tavilyKey, query, max_results: 10 }),
                      });
                      if (res.ok) return res.json();
                    } catch { /* fall through */ }
                  }
                  const serperKey = process.env.SERPER_API_KEY;
                  if (serperKey) {
                    try {
                      const res = await fetch("https://google.serper.dev/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
                        body: JSON.stringify({ q: query, num: 10 }),
                      });
                      if (res.ok) {
                        const data = await res.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
                        return { results: (data.organic ?? []).map((r) => ({ title: r.title, url: r.link, content: r.snippet })) };
                      }
                    } catch { /* give up */ }
                  }
                  log("No search API key set (TAVILY_API_KEY or SERPER_API_KEY)", "warn");
                  return { results: [] };
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

                  let enrichedDescription = description ?? null;
                  if (!enrichedDescription && website) {
                    const scraped = await jinaFetch(website);
                    if (scraped) enrichedDescription = scraped;
                  }

                  const { data: company } = await supabase
                    .from("companies")
                    .insert({ campaign_id: campaignId, name, website: website ?? null, description: enrichedDescription, location: campaign.location, source: "cold_search" })
                    .select()
                    .single();

                  if (!company) return { saved: false, reason: "db error" };
                  found++;

                  let savedContact = null;
                  if (contactData) {
                    let email: string | null = null;
                    let confidence = 0;
                    if (website && contactData.name) {
                      const domain  = website.replace(/^https?:\/\//, "").split("/")[0];
                      const parts   = contactData.name.trim().split(" ");
                      const result  = await findEmail(domain, parts[0] ?? "", parts[parts.length - 1] ?? "");
                      email         = result.email;
                      confidence    = result.confidence;
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

        // ── Draft generation ──────────────────────────────────────────────
        if (profile && process.env.GROQ_API_KEY) {
          log("Generating outreach drafts...", "info");

          type ContactRow = {
            id: string; name: string | null; role: string | null;
            type: "founder" | "cto" | "engineer" | "recruiter";
            companies: { name: string; website: string | null; description: string | null } | null;
          };
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

              try {
                const { text: emailText } = await generateText({
                  model:  groq("llama-3.3-70b-versatile"),
                  prompt: `Write a cold internship email in ${langLabel}. Max 150 words. Sound human, not template-like.

From: ${profile.name ?? "CS student"}, skills: ${profile.skills?.join(", ") ?? ""}, available: ${profile.availability ?? "open"}
To: ${contact.name ?? "the team"} (${contact.role ?? contact.type}) at ${company.name}
Context: ${company.description?.slice(0, 100) ?? "tech company"}

Return ONLY a JSON object: {"subject": "...", "body": "..."}`,
                });
                const emailMatch = emailText.match(/\{[\s\S]*\}/);
                const emailDraft = emailMatch ? JSON.parse(emailMatch[0]) as { subject: string; body: string } : null;
                if (emailDraft) {
                  const { data: message } = await supabase
                    .from("messages")
                    .insert({ campaign_id: campaignId, contact_id: contact.id, platform: "email", language: lang, subject: emailDraft.subject, body: emailDraft.body, status: "draft" })
                    .select().single();
                  if (message) send({ type: "draft", companyId: company.name, messageId: message.id });
                }
              } catch { log(`Email draft failed for ${company.name}`, "warn"); }

              try {
                const { text: dmText } = await generateText({
                  model:  groq("llama-3.3-70b-versatile"),
                  prompt: `Write a LinkedIn DM in ${langLabel}. Max 300 chars, 3 sentences. Compliment / intro / ask.

From: ${profile.name ?? "CS student"} looking for ${campaign.fields.join("/")} internship
To: ${contact.name ?? "someone"} at ${company.name}

Return ONLY a JSON object: {"body": "..."}`,
                });
                const dmMatch = dmText.match(/\{[\s\S]*\}/);
                const dmDraft = dmMatch ? JSON.parse(dmMatch[0]) as { body: string } : null;
                if (dmDraft) {
                  const { data: message } = await supabase
                    .from("messages")
                    .insert({ campaign_id: campaignId, contact_id: contact.id, platform: "linkedin", language: lang, body: dmDraft.body, status: "draft" })
                    .select().single();
                  if (message) send({ type: "draft", companyId: company.name, messageId: message.id });
                }
              } catch { log(`LinkedIn draft failed for ${company.name}`, "warn"); }
            }
          }
        } else if (!process.env.GROQ_API_KEY) {
          log("GROQ_API_KEY not set — skipping draft generation", "warn");
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
