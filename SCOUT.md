# SCOUT — AI Internship Outreach

> **Self-updating project log.** After every session or completed feature, update this file with: what was built, what decisions were made, what's next, and any blockers. This keeps every future conversation instantly up to speed without re-explaining the project.

---

## What is SCOUT?

A webapp that automates internship hunting end-to-end. Upload your CV, specify a location and field — SCOUT autonomously discovers companies, finds the right contacts, drafts personalized emails and LinkedIn DMs, and lets you review + send everything from one interface.

**Target user:** CS / ML student hunting SWE or DS/ML internships.  
**Core flow:** CV upload → Profile setup → Campaign config → AI discovers companies → AI drafts messages → Review + Send.

---

## Current Status

**Phase:** Fully deployed — multi-profile system live, 6 job boards active, AI auto-fill fixed  
**Last updated:** 2026-04-15  
**Repo:** https://github.com/Tsuyii/scout  
**Deployed:** https://internship-hunter-three.vercel.app  
**Launch command:** `scout` (from any terminal)

---

## What's Been Done

### Session 6 — 2026-04-15 (Multi-profile + Scraper overhaul + Auto-fill fix)

#### Done

**AI Auto-fill fix:**
- Root cause: `cvs` Supabase Storage bucket is private (`public: false`), so `getPublicUrl()` returned an inaccessible URL → Jina Reader got 403 → no text → no AI extraction
- Fix: use `createSignedUrl(fileName, 120)` for Jina, keep public URL as the stored reference in DB

**Multi-profile system:**
- New `profiles` table — each user can have multiple named profiles (label, name, skills, education, experience, availability, cv_url, is_default)
- Migration: `supabase/migrations/002_profiles.sql` — **already run in Supabase SQL editor**
- `campaigns.profile_id` FK added (nullable, SET NULL on delete)
- Profile page replaced with `ProfileManager` component:
  - Gmail settings global (saves to `users` table)
  - Profiles section: accordion cards, expand to edit inline, create/delete
  - Auto-opens new profile form if none exist
- `ProfileForm` rewritten to save to `profiles` table (label field, default toggle, delete, no gmail)
- Campaign form: profile selector pill chips at top (★ = default), sends `profile_id` in POST body
- `discover` + `draft` routes: load campaign's linked profile from `profiles` table; fall back to `users` row

**Scraper overhaul:**
- Fixed Adzuna hardcoded to `gb` — now maps location string to correct country code (France→`fr`, Germany→`de`, USA→`us`, etc.)
- Fixed Arbeitnow: switched from broken tags to `search` param
- Fixed Remotive: proper field→category mapping (frontend, backend, devops, data)
- Fixed The Muse: better category mapping per field
- Added **Remoteok** (no key, filters by intern tag/position)
- Added **Jobicy** (no key, field-based tag filtering)
- Total: 6 job boards running in parallel per field

**Search keys:**
- `TAVILY_API_KEY` added to Vercel (production + development)
- `SERPER_API_KEY` added to Vercel (production + development)
- Both saved in `.env.local`
- Cold search agent: Tavily primary → Serper fallback

**Docs:**
- Design spec (`docs/superpowers/specs/2026-04-12-scout-design.md`) updated: profiles table, campaign profile_id, scraper sources, auto-fill fix
- SCOUT.md updated

#### Key technical discoveries (Session 6)
- Supabase Storage: `getPublicUrl()` constructs URL without checking bucket visibility — if bucket is private, URL is inaccessible externally. Always use `createSignedUrl()` for private buckets when passing URL to external services.
- Vercel CLI v51: `vercel env add KEY preview` now requires specifying a git branch — use `vercel env add KEY production` and `vercel env add KEY development` instead for non-branch-specific vars.

---

### Session 5 — 2026-04-15 (Groq swap + CV extraction fixed + UX improvements)

#### Done
- Swapped Gemini → Groq (`llama-3.3-70b-versatile`) across all 3 routes: extract-cv, discover, draft
- Replaced `pdf-parse` and `unpdf` with Jina Reader — PDF uploaded to Supabase, Jina fetches text from URL
- Fixed `Output.object` / `json_schema` incompatibility with Groq — switched to `generateText` + JSON-in-prompt + regex
- Fixed stale `ANTHROPIC_API_KEY` guards → `GROQ_API_KEY`
- Fixed hybrid mode: cold search agent now always runs in hybrid
- Sidebar: campaigns expand into sub-items with status dots
- Profile: AI auto-fill toggle on CV upload section
- Fixed CV auto-fill: strip markdown code fences before `JSON.parse`

#### Key technical discoveries (Session 5)
- `pdf-parse` and `unpdf` break in Vercel serverless — use Jina Reader on a URL instead
- Groq doesn't support `json_schema` response format — use plain `generateText` + regex
- `generateObject` removed in AI SDK v6 — use `generateText + Output.object()` (but that also fails with Groq — use plain text)
- Groq models often return JSON in markdown fences despite instructions — always strip before parsing

---

### Session 4 — 2026-04-14 (Deploy + Fixes)

#### Done
- Fixed PDF parser, Gmail (App Password SMTP), model slug
- Added Remotive, Arbeitnow, The Muse job boards
- Added Serper.dev as Tavily fallback, Jina for website enrichment
- Swapped to Google Gemini (then swapped to Groq in Session 5)
- Created Supabase project (id: `ygtgqnrwtxtxmbroazes`, region: eu-west-1)
- Ran full DB migration (001_initial.sql — 5 tables + RLS + storage)
- Deployed to Vercel: https://internship-hunter-three.vercel.app

---

### Session 3 — 2026-04-13 (Phases 2–7: Full App)

#### Built
- Campaigns list, new campaign, discovery terminal, review & send — full app flow
- All API routes: `/api/campaigns`, `/api/discover`, `/api/draft`, `/api/contacts/find`, `/api/send-email`, `/api/messages/[id]`
- SSE streaming discovery agent with Adzuna + cold AI path + Hunter.io

---

### Session 2 — 2026-04-13 (Research + Phase 1)

#### Built
- Next.js scaffold, Neon Protocol theme, Supabase auth, profile page, CV upload + AI extraction

---

### Session 1 — 2026-04-13 (Decisions + Setup)

#### Decisions
- App name: SCOUT. Visual: Dark terminal (Neon Protocol). Stack: Next.js + Vercel AI SDK + Supabase + Tailwind + shadcn/ui
- GitHub repo: https://github.com/Tsuyii/scout
- `scout` alias in `~/.bashrc`

---

## Architecture Summary

```
CV Upload → Profile (AI extracts: name, skills, education, experience, availability)
              ↓
         New Campaign (location + field + profile selector + languages + count)
              ↓
    ┌──── Tier 1: Job Boards (parallel) ────┐
    │  Adzuna (country-mapped, API key)      │
    │  Remotive (remote, no key)             │
    │  Arbeitnow (Europe, no key)            │
    │  The Muse (US, no key)                 │
    │  Remoteok (remote, no key)             │
    │  Jobicy (remote, no key)               │
    └────────────┬───────────────────────────┘
    ┌──── Tier 2: AI Cold Search (hybrid) ──┐
    │  Groq agent + Tavily → Serper fallback │
    │  webSearch / findContact / saveCompany │
    └────────────┬───────────────────────────┘
                 ↓
         Contact Finder (Hunter.io for email, LinkedIn via Tavily)
                 ↓
         Draft Generator (Groq llama-3.3-70b-versatile)
         Email: <150 words, personalized per company/contact
         LinkedIn DM: 3 sentences max
         Multi-language: EN/FR/ES per campaign setting
                 ↓
         Review & Send UI (edit/regen/send, bulk send bar)
```

---

## Data Model

| Table | Key Fields |
|---|---|
| `users` | id, email, name, skills[], education, experience, availability, cv_url, gmail_token (global), languages[] |
| `profiles` | id, user_id, label, name, skills[], education, experience, availability, cv_url, is_default |
| `campaigns` | id, user_id, profile_id (FK→profiles, nullable), location, fields[], languages[], mode, target_count, status |
| `companies` | id, campaign_id, name, website, source (job_board/cold_search), job_posting_url |
| `contacts` | id, company_id, name, role, email, linkedin_url, confidence_score, type |
| `messages` | id, campaign_id, contact_id, platform, subject, body, status, sent_at |

---

## UI Screens

1. **Profile** — Gmail settings (global) + multi-profile manager (create/edit/delete named profiles, each with CV upload + AI auto-fill)
2. **New Campaign** — Profile selector chips + location + field chips + mode toggle + count slider + manual companies
3. **Discovery** — Real-time SSE terminal log, company cards animate in, progress bar
4. **Review & Send** — Company list (left), contact + Email/LinkedIn draft tabs (right), edit/regen/send, bulk send bar

---

## Tech Stack

```
Next.js 15 (App Router)
Vercel AI SDK + Groq llama-3.3-70b-versatile
Supabase (PostgreSQL + Storage + Auth)
Tailwind CSS + shadcn/ui
Gmail App Password / Nodemailer
Hunter.io API (email finder)
Job boards: Adzuna · Remotive · Arbeitnow · The Muse · Remoteok · Jobicy
Web search: Tavily (primary) + Serper (fallback)
Jina Reader (PDF text extraction + website enrichment, free)
```

---

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Fill from Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Fill from Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Fill from Supabase dashboard |
| `GROQ_API_KEY` | `.env.local` + Vercel | groq.com — free |
| `TAVILY_API_KEY` | `.env.local` + Vercel ✅ | Set — `tvly-dev-rfpZA...` |
| `SERPER_API_KEY` | `.env.local` + Vercel ✅ | Set — `94cb67ef...` |
| `ADZUNA_APP_ID` | `.env.local` | Optional — adzuna.com free tier |
| `ADZUNA_APP_KEY` | `.env.local` | Optional |
| `HUNTER_API_KEY` | `.env.local` | Optional — hunter.io (25 req/mo free) |

---

## Key Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| LinkedIn sending | Copy + open profile | LinkedIn API blocks programmatic DM |
| Discovery streaming | Route Handler + SSE ReadableStream | Long-running (30–120s), real-time UI |
| Email finding | Hunter.io | Free tier, reliable |
| Cold discovery | Groq agent + Tavily → Serper | Flexible, any location/field |
| PDF extraction | Jina Reader via signed URL | No native deps, works in Vercel serverless |
| AI model | Groq llama-3.3-70b-versatile | Genuinely free, fast, no regional issues |
| Structured output | `generateText` + regex JSON parse | Groq doesn't support json_schema format |
| Multi-profile | Separate `profiles` table | Users can have SWE vs ML vs Research profiles |
| CV bucket | Private + signed URL for Jina | Public URL inaccessible externally on private bucket |
| Adzuna country | Location string → country code map | Was hardcoded to `gb`, now auto-detects |

---

## What's Next

- [ ] Fill in real Supabase credentials in `.env.local` (still has placeholder values)
- [ ] Add GROQ_API_KEY to Vercel env vars (not yet set)
- [ ] Test full flow end-to-end: create profile → launch campaign → verify auto-fill + profile selector
- [ ] Consider WelcomeToTheJungle scraper (France-focused, high-value for French startups)
- [ ] Consider Thesys.dev C1 for richer review panel UI (generative UI components from LLM output)
- [ ] Follow-up email sequences (v2)
- [ ] Response tracking / inbox integration (v2)

---

## Migrations Status

| Migration | File | Status |
|---|---|---|
| 001_initial | `supabase/migrations/001_initial.sql` | ✅ Run |
| 002_profiles | `supabase/migrations/002_profiles.sql` | ✅ Run |
