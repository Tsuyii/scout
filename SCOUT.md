# SCOUT — AI Internship Outreach

> **Self-updating project log.** After every session or completed feature, update this file with: what was built, what decisions were made, what's next, and any blockers. This keeps every future conversation instantly up to speed without re-explaining the project.

---

## What is SCOUT?

A webapp that automates internship hunting end-to-end. Upload your CV, specify a location and field — SCOUT autonomously discovers companies, finds the right contacts, drafts personalized emails and LinkedIn DMs, and lets you review + send everything from one interface.

**Target user:** CS / ML student hunting SWE or DS/ML internships.  
**Core flow:** CV upload → Campaign config → AI discovers companies → AI drafts messages → Review + Send.

---

## Current Status

**Phase:** Design complete — ready to implement  
**Last updated:** 2026-04-13  

---

## What's Been Done

### Session 1 — 2026-04-13

#### Decisions Made
- **App name:** SCOUT
- **Visual design:** Dark terminal aesthetic (Design 1 — "Neon Protocol" from Stitch). Black `#06060b` background, electric green `#00ff88` accent, Syne + JetBrains Mono fonts, animated grid, neon glows.
- **Architecture:** Hybrid discovery — Adzuna job boards (active hiring) + Claude AI agent with Tavily search (cold outreach)
- **Stack:** Next.js 15 (App Router) + Vercel AI SDK + Claude claude-sonnet-4-6 + Supabase + Tailwind + shadcn/ui
- **Email sending:** Gmail OAuth via Nodemailer (no manual SMTP)
- **LinkedIn:** Copy-to-clipboard + open profile (LinkedIn blocks API automation)
- **Contact finding:** Hunter.io for emails, LinkedIn search for profiles
- **Fields targeted:** Software Engineering + Data Science / ML
- **Platforms:** Email + LinkedIn DM

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
         New Campaign (location + field + count)
              ↓
    ┌─── Active Path ────┐    ┌─── Cold Path ─────┐
    │  Adzuna Job Boards  │    │  Claude AI Agent   │
    │  (actively hiring)  │    │  + Tavily Search   │
    └────────┬────────────┘    └────────┬───────────┘
             └──────────┬──────────────┘
                        ↓
              Contact Finder
         (LinkedIn search → Hunter.io email)
                        ↓
              Draft Generator
         (Claude: email subject+body, LinkedIn DM)
                        ↓
              Review & Send UI
         (per-company, edit/regen/send, bulk send)
```

---

## Data Model

| Table | Key Fields |
|---|---|
| `users` | id, email, name, skills[], education, experience, availability, cv_url, gmail_token |
| `campaigns` | id, user_id, location, fields[], mode, target_count, status |
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
Next.js 15 (App Router)
Vercel AI SDK + Claude claude-sonnet-4-6
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
| Email finding | Hunter.io | Best free-tier option, 25 req/month free |
| Cold discovery | Claude agent + Tavily | Flexible, adapts to any location/field |
| Auth | Supabase Auth | Handles Gmail OAuth refresh tokens cleanly |

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

- [ ] Write implementation plan (phased, with tasks)
- [ ] Phase 1: Project scaffold + auth + profile/CV upload
- [ ] Phase 2: Campaign creation + Adzuna job board integration
- [ ] Phase 3: Cold discovery AI agent (Claude + Tavily)
- [ ] Phase 4: Contact finder (LinkedIn search + Hunter.io)
- [ ] Phase 5: Draft generator (Claude, email + LinkedIn)
- [ ] Phase 6: Review & Send UI (Design 1 applied)
- [ ] Phase 7: Gmail OAuth send integration
- [ ] Phase 8: Polish, error handling, deploy to Vercel

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
