-- SCOUT — Multi-profile support
-- Run via `supabase db push` or paste into the Supabase SQL editor

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  label        text not null default 'Default',
  name         text,
  skills       text[]   not null default '{}',
  education    text,
  experience   text,
  availability text,
  cv_url       text,
  is_default   boolean  not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can manage own profiles"
  on public.profiles for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── campaigns — add profile reference ───────────────────────────────────────
alter table public.campaigns
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;
