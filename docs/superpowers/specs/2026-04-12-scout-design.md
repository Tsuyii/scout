# SCOUT — AI Internship Outreach · Design Spec

**Date:** 2026-04-12  
**Status:** Approved  

---

## Overview

SCOUT is a web app that automates internship hunting end-to-end. The user uploads their CV, specifies a location and field, and SCOUT autonomously discovers companies, finds the right contacts, and drafts personalized emails and LinkedIn DMs. The user reviews drafts in a single interface and sends with one click.

**Target users:** CS / ML students seeking SWE or data science internships.  
**Core value prop:** Go from "I need an internship in Paris" to 20 ready-to-send, personalized outreach messages in minutes.

---

## Architecture

### Approach: Hybrid Discovery

Two parallel discovery paths feed into a single contact-finding and drafting pipeline:

1. **Active path** — Queries Adzuna API (job boards) for companies with open intern positions matching the user's location + field. High conversion because these companies are actively hiring.
2. **Cold path** — AI agent (Claude + Tavily/web search tools) searches the web for relevant companies not actively posting — startups, research labs, scale-ups. Enables cold outreach that competitors won't attempt.

Both paths feed into:
- **Contact Finder** — LinkedIn search for recruiter/HR first; falls back to relevant engineer or team lead. Email address resolved via Hunter.io API.
- **Draft Generator** — Claude generates a personalized email (subject + body) and LinkedIn DM per contact, grounded in the user's CV profile and the company's context.

### Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components, streaming, easy Vercel deploy |
| AI | Vercel AI SDK + Claude claude-sonnet-4-6 | Streaming, tool use, agent loops |
| Database | Supabase (PostgreSQL) | Auth, storage, real-time |
| UI | Tailwind CSS + shadcn/ui | Fast iteration, consistent components |
| Email send | Gmail OAuth (Nodemailer) | Actually sends emails without SMTP setup |
| Email find | Hunter.io API | Reliable email finder by domain + name |
| Job boards | Adzuna API | Free tier, good coverage |
| Web search | Tavily API | Optimized for AI agent use |
| Visual style | Dark terminal — Design 1 (Stitch) | Approved by user |

---

## Data Model

### `users`
- `id`, `email`, `created_at`
- `name`, `skills[]`, `education`, `experience`, `availability`
- `cv_url` (Supabase Storage)
- `gmail_token` (encrypted OAuth token)

### `campaigns`
- `id`, `user_id`, `created_at`
- `location` (string, e.g. "Paris, France")
- `fields[]` (e.g. ["SWE", "DS/ML"])
- `mode` ("active" | "hybrid")
- `target_count` (int)
- `status` ("running" | "complete" | "paused")

### `companies`
- `id`, `campaign_id`
- `name`, `website`, `description`, `location`
- `source` ("job_board" | "cold_search")
- `job_posting_url` (nullable)

### `contacts`
- `id`, `company_id`
- `name`, `role`, `email` (nullable)
- `linkedin_url` (nullable)
- `confidence_score` (0–100, from Hunter.io)
- `type` ("recruiter" | "engineer" | "founder")

### `messages`
- `id`, `campaign_id`, `contact_id`
- `platform` ("email" | "linkedin")
- `subject` (email only)
- `body`
- `status` ("draft" | "sent" | "skipped" | "failed")
- `sent_at` (nullable)

---

## UI Flow

### Screen 1 — Profile (one-time setup)
- Drag-and-drop CV upload (PDF/DOC/DOCX) → stored in Supabase Storage
- AI extracts: name, email, skills, education, experience, availability
- User can edit extracted fields and add/remove skill tags
- Connect Gmail via OAuth and enable LinkedIn (copy-to-clipboard mode)
- Persists across sessions — no re-upload needed

### Screen 2 — New Campaign
- Location input (free text: city, country, "Remote")
- Field chips: SWE, DS/ML, Backend, Frontend, Research, DevOps (multi-select)
- Discovery mode toggle: Active Only vs Hybrid (recommended)
- Company count slider: 5–50
- Optional manual company list (paste names)
- "Launch Campaign" button → navigates to Discovery screen

### Screen 3 — Discovery (real-time streaming)
- AI SDK `streamText` streams progress to the UI via Server-Sent Events
- Terminal-style log: each step (searching job boards, finding contact, drafting) appears as a new line
- Company cards animate in below the terminal as they're found
- Progress bar: found / target count
- Elapsed timer, draft count
- Discovery and drafting run in parallel — first contact found → first draft generated immediately

### Screen 4 — Review & Send (main screen)
- **Left panel:** Scrollable company list with status badges (Draft Ready ✅ / Pending ⏳ / Sent ✉️ / Skipped), checkboxes for bulk selection
- **Right panel:**
  - Contact card: avatar initials, name, role, email, LinkedIn link
  - Platform tabs: Email | LinkedIn DM
  - Email: subject line + editable body (contenteditable), Edit / Regenerate / Send buttons
  - LinkedIn DM: editable body, "Copy & Open Profile" button (copies to clipboard, opens LinkedIn URL)
  - Regenerate calls AI with same context to produce a new draft
- **Bottom send bar:** Selected count, "Select All Ready", "Send Selected (N)" button
- Email sending: POST to `/api/send-email` → Nodemailer with Gmail OAuth token
- LinkedIn: clipboard copy + window.open to profile URL (manual paste, LinkedIn blocks automation)

---

## AI Agent Design

### Discovery Agent (Cold Path)
Uses Vercel AI SDK `streamText` with tools:
- `webSearch(query)` — Tavily API
- `extractCompanies(searchResults)` — parses company names + websites from results
- `findLinkedInProfile(name, company)` — Google search for LinkedIn URL
- `findEmail(domain, firstName, lastName)` — Hunter.io API

Agent loop runs until `target_count` companies found or max iterations (50) hit.

### Draft Generator
Single `generateText` call per contact with:
- System prompt: user's CV profile (skills, experience, education, availability)
- User prompt: company name, website description, contact name, role, platform (email vs LinkedIn)
- Output: structured JSON `{ subject, body }` for email or `{ body }` for LinkedIn
- Temperature: 0.7 for natural variation

---

## Key Technical Decisions

### LinkedIn sending
LinkedIn's API does not allow programmatic DM sending without a paid partnership. Solution: "Copy & Open" button copies the drafted DM to clipboard and opens the contact's LinkedIn profile in a new tab. User pastes and sends manually. This is clearly communicated in the UI.

### Email discovery rate
Hunter.io free tier = 25 requests/month. For higher volume, user needs to provide their own Hunter.io API key (stored encrypted in user settings). Apollo.io is the fallback for contacts without a found email.

### Streaming architecture
Discovery is a long-running operation (can take 30–120 seconds for 20 companies). Uses Next.js Route Handler with streaming response (`ReadableStream`) feeding the Vercel AI SDK's `StreamingTextResponse`. Client uses `useChat` hook or custom SSE reader to display real-time progress.

### CV storage
CV PDF stored in Supabase Storage (private bucket). Parsed profile stored as JSON in `users` table. CV is re-parseable on demand if user uploads a new version.

### Rate limiting
Adzuna and Hunter.io have rate limits. Discovery pipeline adds 500ms delay between Hunter.io requests. Job board queries are batched (1 request per field per location).

---

## Error Handling

- **Contact not found:** Company still added to campaign with "No contact found" status. User can manually add a contact name/email.
- **Draft generation fails:** Retry once automatically. If still fails, show "Draft failed — click to retry" in the UI.
- **Email send fails:** Show error message with reason (invalid token, bounce, etc.). Token refresh handled automatically via OAuth refresh token.
- **Discovery timeout:** If agent exceeds 50 iterations, stop and return what was found. Show "Found X/N companies — search ended" message.

---

## Out of Scope (v1)

- Follow-up email sequences (scheduled reminders)
- Response tracking / inbox integration
- LinkedIn Easy Apply automation
- Multi-user / team features
- Mobile app
- Twitter/X or GitHub outreach

---

## Visual Design

- **Theme:** Dark terminal — Design 1 (Stitch "Neon Protocol")
- **Background:** `#06060b` with animated 48px grid overlay
- **Accent:** Electric green `#00ff88` with glow effects
- **Fonts:** Syne (headings, 800 weight) + JetBrains Mono (data, status, terminal output)
- **Components:** Sharp 0px border-radius on interactive elements, luminescent frames at 10–20% opacity, ambient green glow on primary CTAs
- **Animations:** Grid drift (30s loop), card slide-in on discovery, screen fade-in on tab switch, pulse dot on active discovery tab, blink cursor in terminal

---

## Success Criteria

- User can go from CV upload to 20 ready-to-send drafts in under 5 minutes
- Email drafts are personalized enough that user rarely needs to edit (< 20% edit rate target)
- Gmail send works reliably with no manual SMTP configuration
- LinkedIn DM copy-paste flow takes < 10 seconds per message
- App works for any city/country input in SWE or DS/ML fields
