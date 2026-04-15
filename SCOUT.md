# SCOUT — AI Internship Outreach

> **Self-updating project log.** After every session or completed feature, update this file with: what was built, what decisions were made, what's next, and any blockers. This keeps every future conversation instantly up to speed without re-explaining the project.

---

## What is SCOUT?

A webapp that automates internship hunting end-to-end. Upload your CV, specify a location and field — SCOUT autonomously discovers companies, finds the right contacts, drafts personalized emails and LinkedIn DMs, and lets you review + send everything from one interface.

**Target user:** CS / ML student hunting SWE or DS/ML internships.  
**Core flow:** CV upload → Campaign config → AI discovers companies → AI drafts messages → Review + Send.

---

## Current Status

**Phase:** Deployed and fully working — CV upload, extraction, and discovery all unblocked  
**Last updated:** 2026-04-15  
**Repo:** https://github.com/Tsuyii/scout  
**Launch command:** `scout` (from any terminal)

---

## What's Been Done

### Session 5 — 2026-04-15 (Groq swap + CV extraction fixed + UX improvements)

#### Done
- Swapped Gemini → Groq (`llama-3.3-70b-versatile`) across all 3 routes: extract-cv, discover, draft
- Replaced `pdf-parse` and `unpdf` (both fail in Vercel serverless due to `@napi-rs/canvas`) with Jina Reader — PDF is uploaded to Supabase first, then Jina fetches text from the public URL (no native deps)
- Fixed `Output.object` / `json_schema` incompatibility with Groq — switched to plain `generateText` + JSON-in-prompt + regex extraction, works with any model
- Fixed stale `ANTHROPIC_API_KEY` guards → `GROQ_API_KEY` in discover route
- Fixed hybrid mode: cold search agent now always runs (was gated on `found < target`, so job boards filling quota skipped agent entirely → no contacts → no drafts)
- Sidebar: campaigns expand into sub-items (location · field, colored status dot) when on campaigns pages, linking to discover or review
- Profile: AI auto-fill toggle on CV upload section — ON fills all profile fields from CV, OFF just stores the file

- Fixed CV auto-fill: Groq was wrapping JSON in markdown code fences (` ```json ``` `) despite instructions — strip them before `JSON.parse`. Also removed `!name` guard so auto-fill always overwrites all fields when toggled on.

#### Key technical discoveries (Session 5)
- `pdf-parse` and `unpdf` both import `@napi-rs/canvas` which requires native binaries — breaks in Vercel serverless. Use Jina Reader on a public URL instead.
- Groq `llama-3.3-70b-versatile` does not support `json_schema` response format (used by `Output.object` in AI SDK v6). Use plain text generation + `text.match(/\{[\s\S]*\}/)` + `JSON.parse`.
- `generateObject` was removed in AI SDK v6 — only `generateText + Output.object` exists, but that hits the json_schema issue above with Groq.
- Hybrid discovery bug: job boards can fill the company quota, causing `found < target` to be false and skipping the cold search agent. Fix: always run agent in hybrid mode with `Math.max(target - found, 5)`.
- Groq models often return JSON wrapped in markdown code fences even when explicitly told not to. Always strip ` ```json ``` ` before parsing.

---

### Session 4 — 2026-04-14 (Deploy + Fixes)

#### Done
- Fixed PDF parser: `file.text()` → `FilePart` passed directly to AI model (native PDF support)
- Fixed Gmail: replaced missing OAuth flow with App Password SMTP — added section 05 in Profile form
- Fixed model slug: `claude-sonnet-4-6` → `claude-sonnet-4.6` (then swapped to Gemini)
- Added 3 no-key job boards: Remotive, Arbeitnow, The Muse (run in parallel with Adzuna)
- Added Serper.dev as Tavily fallback in webSearch tool
- Added Jina Reader for website enrichment in saveCompany (free, no key needed)
- Swapped Anthropic → Google Gemini (`@ai-sdk/google`, `gemini-2.0-flash`)
- Created Supabase project `scout` (id: `ygtgqnrwtxtxmbroazes`, region: eu-west-1)
- Ran full DB migration via MCP (all 5 tables + RLS + CVs storage bucket)
- Added all env vars to Vercel: Supabase URL, publishable key, anon key, service role key, Gemini key, Serper key
- Deployed to production: https://internship-hunter-three.vercel.app

#### Blocker
- Gemini free tier quota = 0 (`limit: 0`) — likely a regional restriction (Morocco)
- Both AI Studio keys tried, both fail with same error
- **Still deciding on fix** — options discussed:
  1. Link card to Google Cloud gen-lang-client project → unlocks Gemini free tier (1500 req/day, no charges under normal use) — **recommended**
  2. Anthropic API — native PDF support, clean swap back to original code, but no free credits anymore
  3. OpenAI GPT-4o — free credits on new accounts, but PDF upload flow is more complex
  4. Groq — genuinely free, no regional issues, but no native PDF support (user prefers to keep PDF quality)
  - **Decision pending next session**

#### Key technical discoveries (Session 4)
- Gemini free tier not available in all regions — `limit: 0` means regional block, not just quota exhaustion
- New Supabase publishable key format: `sb_publishable_...` (works with `@supabase/ssr@0.10.2`)
- New Supabase secret key format: `sb_secret_...` (use as `SUPABASE_SERVICE_ROLE_KEY`)
- Vercel CLI non-interactive env add: `echo "value" | vercel env add KEY production --yes`

---

### Session 3 — 2026-04-13 (Phases 2–7: Full App)

#### Built
- **Supabase migration** — `supabase/migrations/001_initial.sql`: all 5 tables, RLS policies, storage bucket (paste into Supabase SQL editor to set up)
- **Campaigns list page** — `/campaigns`: lists all campaigns with status badges (running/complete/paused), links to discover or review
- **New campaign page** — `/campaigns/new` + `CampaignForm` component: location, field chips, language chips, mode toggle (active/hybrid), count slider, manual companies textarea
- **Campaign redirect** — `/campaigns/[id]` redirects to `/discover` if running, `/review` if complete
- **Discovery page** — `/campaigns/[id]/discover` + `DiscoveryTerminal` component: SSE streaming terminal log, company cards animate in, progress bar, stats (found/drafts/elapsed/%), done CTA
- **Review & Send page** — `/campaigns/[id]/review` + `ReviewPanel` component: company list (left) with checkboxes + status, contact card + Email/LinkedIn tabs + editable draft (right), save/regenerate/send buttons, bulk send bar
- **API: `POST /api/campaigns`** — create campaign, pre-populate manual companies
- **API: `GET+PATCH /api/campaigns/[id]`** — fetch full campaign tree, update status
- **API: `POST /api/discover`** — full SSE streaming discovery agent: Adzuna job boards (active path) + Claude `streamText` agent loop with `webSearch`/`findContact`/`saveCompany` tools (cold path) + Hunter.io email finder + `generateText + Output.object()` draft generation for all contacts
- **API: `POST /api/draft`** — regenerate a single draft on demand (email or LinkedIn DM)
- **API: `POST /api/contacts/find`** — Hunter.io email lookup for a specific contact
- **API: `POST /api/send-email`** — Gmail OAuth send via Nodemailer with access token auto-refresh
- **API: `PATCH /api/messages/[id]`** — save edited subject/body

#### Key technical discoveries (Session 3)
- AI SDK v6: `tool()` uses `inputSchema` not `parameters` — must define zod schemas at **module level** (not inline) for TypeScript to infer execute param types
- AI SDK v6: `streamText` fullStream chunk is `chunk.text` not `chunk.textDelta`
- AI SDK v6: `stopWhen: stepCountIs(N)` replaces removed `maxSteps`
- Supabase nested joins (`.select("*, table!inner(*)")`) return `never` type in TS — cast with `as unknown as YourType[]`
- Claude model slug: use dots not hyphens — `claude-sonnet-4.6` not `claude-sonnet-4-6`
- lucide-react: no `Linkedin` icon — use `Link2` instead
- Don't call `setState` during render body — use `useEffect` with dependency on message ID

---

### Session 2 — 2026-04-13 (Research + Plan + Phase 1 Implementation)

#### Researched
- Web-searched internship hunting strategies for Moroccan SWE students (Reddit, LinkedIn, job boards)
- **Key insight:** Remote internships at French startups (Welcome to the Jungle, LinkedIn cold DM to founders) are highest-conversion path — timezone aligned, language advantage, no visa needed
- **Ultraplan approved:** Multi-tier scraper architecture (LinkedIn, WTTJ, YC Jobs, Adzuna, Glassdoor, Bayt, Reddit, HN, GitHub lists, Twitter/X) + multi-language queries (EN/FR/ES) + founder-first contact strategy

#### Built
- **Next.js 16 scaffold** with TypeScript, Tailwind v4, App Router, shadcn/ui
- **Neon Protocol theme** — `#06060b` bg, `#00ff88` accent, Syne + JetBrains Mono, animated grid overlay, glow utilities, terminal cursor CSS
- **Supabase auth** — browser/server/proxy clients with `@supabase/ssr`, `src/proxy.ts` (Next.js 16 renamed middleware)
- **Auth pages** — `/login`, `/signup` with dark terminal styling
- **App layout** — sidebar nav with SCOUT logo, profile + campaigns links, sign out
- **Profile page** — CV drag-and-drop upload (PDF/DOC/DOCX), AI extraction via Claude + AI SDK v6, skill tags, editable form, Supabase upsert
- **CV extraction API** — `POST /api/extract-cv`, uploads to Supabase Storage, extracts structured profile via `generateText + Output.object()` (AI SDK v6 pattern)
- **Database types** — full TypeScript types for all 5 tables with `Relationships[]` for Supabase compat
- **`.env.local.example`** — all required keys documented

#### Key technical discoveries
- Next.js 16: `middleware.ts` renamed to `proxy.ts`, export `proxy()` not `middleware()`
- AI SDK v6: `generateObject` removed — use `generateText` with `output: Output.object({ schema })`
- Supabase Database types require `Relationships: GenericRelationship[]` on each table
- Supabase env var: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not anon key)

### Session 1 — 2026-04-13

#### Decisions Made
- **App name:** SCOUT
- **Visual design:** Dark terminal aesthetic (Design 1 — "Neon Protocol" from Stitch). Black `#06060b` background, electric green `#00ff88` accent, Syne + JetBrains Mono fonts, animated grid, neon glows.
- **Architecture:** Hybrid discovery — Adzuna job boards (active hiring) + Claude AI agent with Tavily search (cold outreach)
- **Stack:** Next.js 16 (App Router) + Vercel AI SDK v6 + Claude claude-sonnet-4-6 + Supabase + Tailwind v4 + shadcn/ui
- **Email sending:** Gmail OAuth via Nodemailer (no manual SMTP)
- **LinkedIn:** Copy-to-clipboard + open profile (LinkedIn blocks API automation)
- **Contact finding:** Hunter.io for emails, LinkedIn search for profiles
- **Fields targeted:** Software Engineering + Data Science / ML
- **Platforms:** Email + LinkedIn DM

#### Infrastructure Set Up
- GitHub repo created: https://github.com/Tsuyii/scout (public)
- `scout` alias added to `~/.bashrc` — type `scout` in any terminal to launch Claude Code in this project with auto-permissions
- `.gitignore` configured (node_modules, .env, .next, .vercel, brainstorm state)

#### Artifacts Created
- `docs/superpowers/specs/2026-04-12-scout-design.md` — Full design spec (architecture, data model, UI flow, technical decisions, success criteria)
- `scout-design-1-dark-terminal.html` — Stitch-generated dark terminal design (on Windows Desktop)
- `scout-design-2-glass-light.html` — Stitch-generated glassmorphism light design (on Windows Desktop, not chosen)
- `scout-design-3-brutalist.html` — Stitch-generated brutalist editorial design (on Windows Desktop, not chosen)
- `scout-preview.html` — Custom interactive prototype with all 4 screens (on Windows Desktop)
- Stitch project: `projects/12478331534947996645` — "SCOUT — AI Internship Outreach"

#### Existing Projects Reviewed
- GitHub: LinkedIn_AIHawk, JobHuntAutomation, Internship-finder-automation-tool, jobs-tools, OpenOutreach — all CLI/scripts or n8n workflows. Nothing matches SCOUT's webapp + autonomous discovery approach.

---

## Architecture Summary

```
CV Upload → Profile (extracted by AI)
              ↓
         New Campaign (location + field + languages + count)
              ↓
    ┌──── Tier 1: High-Yield ────┐
    │  LinkedIn Jobs + Profiles   │
    │  Welcome to the Jungle      │  ← best for French startups
    │  YC Jobs (workatastartup)   │
    └────────────┬────────────────┘
    ┌──── Tier 2: Volume ────────┐
    │  Adzuna API (job boards)    │
    │  Glassdoor scraper          │
    │  Bayt (MENA coverage)       │
    │  Claude + Tavily (cold AI)  │
    └────────────┬────────────────┘
    ┌──── Tier 3: Community ─────┐
    │  Reddit (r/internships etc) │
    │  Hacker News "Who's Hiring" │
    │  GitHub curated lists       │
    │  Twitter/X search           │
    └────────────┬────────────────┘
                 ↓
         Dedup + Rank (by source count + recency)
                 ↓
    Contact Finder — founder/CTO first strategy
    (LinkedIn search → Hunter.io → Apollo.io fallback)
                 ↓
    Draft Generator (Claude)
    Email: <150 words, name-drop product, link GitHub, ask for 15-min call
    LinkedIn DM: 3 lines max — compliment / intro / ask
    Multi-language: EN for global, FR for French startups, ES for Spanish
                 ↓
    Review & Send UI
    (per-company, edit/regen/send, bulk send)
```

---

## Data Model

| Table | Key Fields |
|---|---|
| `users` | id, email, name, skills[], education, experience, availability, cv_url, gmail_token, languages[] |
| `campaigns` | id, user_id, location, fields[], languages[], mode, target_count, status |
| `companies` | id, campaign_id, name, website, source (job_board/cold_search) |
| `contacts` | id, company_id, name, role, email, linkedin_url, confidence_score, type |
| `messages` | id, campaign_id, contact_id, platform, subject, body, status, sent_at |

---

## UI Screens

1. **Profile** — CV upload, AI extraction, skill tags, Gmail + LinkedIn connection
2. **Campaign** — Location, field chips, mode toggle, count slider, manual companies
3. **Discovery** — Real-time terminal log stream, company cards animate in, progress bar
4. **Review & Send** — Company list (left), contact + drafts (right), Email/LinkedIn tabs, edit/regen/send, bulk send bar

---

## Tech Stack

```
Next.js 16 (App Router)
Vercel AI SDK v6 + Claude claude-sonnet-4-6
Supabase (PostgreSQL + Storage + Auth)
Tailwind CSS + shadcn/ui
Gmail OAuth / Nodemailer
Hunter.io API (email finder)
Adzuna API (job boards)
Tavily API (AI web search)
```

---

## Key Technical Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| LinkedIn sending | Copy + open profile | LinkedIn API bans programmatic DM sending |
| Discovery streaming | Next.js Route Handler + SSE | Long-running (30–120s), needs real-time UI |
| Email finding | Hunter.io → Apollo.io fallback | Hunter free tier (25/mo), Apollo as fallback |
| Cold discovery | Claude agent + Tavily | Flexible, adapts to any location/field |
| Auth | Supabase Auth | Handles Gmail OAuth refresh tokens cleanly |
| Contact priority | Founder > CTO > Engineer > Recruiter | Startups 10–100 employees → reach decision-maker directly |
| Draft language | Match company's primary language | FR for French startups = higher response rate |
| Next.js proxy | `src/proxy.ts` (not middleware.ts) | Next.js 16 renamed middleware to proxy |
| AI SDK structured output | `generateText + Output.object()` | `generateObject` removed in AI SDK v6 |

---

## Out of Scope (v1)

- Follow-up email sequences
- Response tracking / inbox integration
- LinkedIn Easy Apply automation
- Multi-user / team features
- Mobile app
- Twitter/X or GitHub outreach

---

## What's Next

- [x] Phase 1: Project scaffold + auth + profile/CV upload
- [x] Supabase migration SQL (`supabase/migrations/001_initial.sql`) — run in Supabase SQL editor
- [x] Phase 2: Campaign creation UI + Adzuna job board integration (`/api/campaigns`, `/campaigns/new`)
- [x] Phase 3: Cold discovery AI agent — `streamText` + tools (webSearch, findContact, saveCompany) in `/api/discover`
- [x] Phase 4: Contact finder — Hunter.io in `/api/contacts/find` + embedded in discovery agent
- [x] Phase 5: Draft generator — `generateText + Output.object()` for email + LinkedIn DM in `/api/draft`
- [x] Phase 6: Review & Send UI — full left/right layout, edit/regen/send, bulk send bar
- [x] Phase 7: Gmail OAuth send integration — Nodemailer + token refresh in `/api/send-email`
- [x] Phase 8: Wire up API keys + deploy to Vercel (https://internship-hunter-three.vercel.app)
- [ ] Phase 9: Fix AI provider — still deciding (see blocker notes in Session 4)

#### Key technical discoveries (Session 2)
- AI SDK v6: `tool()` uses `inputSchema` not `parameters` — must define schemas at module level for TS inference
- AI SDK v6: `streamText` fullStream chunk is `chunk.text` not `chunk.textDelta`
- AI SDK v6: `stopWhen: stepCountIs(N)` replaces removed `maxSteps`
- Supabase nested joins (`.select("*, table!inner(*)")`) return `never` in TS — cast with `as unknown as TypedArray`
- lucide-react: no `Linkedin` icon — use `Link2` instead

---

## Success Criteria

- CV upload → 20 ready-to-send drafts in < 5 minutes
- Email drafts personalized enough that < 20% need editing
- Gmail send works with no manual SMTP config
- LinkedIn copy-paste flow < 10 seconds per message
- Works for any city/country + SWE or DS/ML fields

---

## Update Instructions

**After every session or completed feature, update this file:**

1. Add a new entry under "What's Been Done" with the date
2. List what was built or decided
3. Update "Current Status" (phase + last updated date)
4. Move completed items from "What's Next" to "What's Been Done"
5. Add any new blockers, decisions, or scope changes
6. Commit: `git commit -m "docs: update SCOUT.md after [feature/session]"`

---

## Environment & Services

| Service | Notes |
|---|---|
| Supabase | Project not yet created |
| Hunter.io | API key needed (free: 25 req/mo) |
| Adzuna | API key needed (free tier available) |
| Tavily | API key needed (free tier available) |
| Gmail OAuth | Client ID + secret needed (Google Cloud Console) |
| Vercel | Deploy target — project not yet created |
| Anthropic | API key needed for Claude claude-sonnet-4-6 |
