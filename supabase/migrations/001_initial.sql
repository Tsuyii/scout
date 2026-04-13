-- SCOUT — Initial Schema
-- Run this in your Supabase SQL editor or via `supabase db push`

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── users ───────────────────────────────────────────────────────────────────
-- Mirrors auth.users. Created on first profile save.
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  name          text,
  skills        text[]   not null default '{}',
  education     text,
  experience    text,
  availability  text,
  cv_url        text,
  gmail_token   text,          -- encrypted OAuth token stored server-side
  languages     text[]   not null default '{"en"}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can insert own row"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

-- ─── campaigns ───────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  location      text not null,
  fields        text[]   not null default '{}',
  languages     text[]   not null default '{"en"}',
  mode          text not null check (mode in ('active', 'hybrid')) default 'hybrid',
  target_count  int  not null default 20,
  status        text not null check (status in ('running', 'complete', 'paused')) default 'running',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "Users can manage own campaigns"
  on public.campaigns for all
  using (auth.uid() = user_id);

-- ─── companies ───────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  name             text not null,
  website          text,
  description      text,
  location         text,
  source           text not null check (source in ('job_board', 'cold_search')),
  source_url       text,
  job_posting_url  text,
  discovered_at    timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "Users can manage companies via campaign"
  on public.companies for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

-- ─── contacts ────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  name             text,
  role             text,
  email            text,
  linkedin_url     text,
  confidence_score int check (confidence_score between 0 and 100),
  type             text not null check (type in ('founder', 'cto', 'engineer', 'recruiter')),
  created_at       timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "Users can manage contacts via company"
  on public.contacts for all
  using (
    exists (
      select 1 from public.companies co
      join public.campaigns ca on ca.id = co.campaign_id
      where co.id = company_id and ca.user_id = auth.uid()
    )
  );

-- ─── messages ────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  platform     text not null check (platform in ('email', 'linkedin')),
  language     text not null default 'en',
  subject      text,
  body         text not null,
  status       text not null check (status in ('draft', 'sent', 'skipped', 'failed')) default 'draft',
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can manage messages via campaign"
  on public.messages for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

-- ─── Storage bucket for CVs ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create policy "Users can upload own CV"
  on storage.objects for insert
  with check (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read own CV"
  on storage.objects for select
  using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own CV"
  on storage.objects for update
  using (bucket_id = 'cvs' and auth.uid()::text = (storage.foldername(name))[1]);
