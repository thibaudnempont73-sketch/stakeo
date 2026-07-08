-- Stakeo — database schema
-- Run this once in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent).

-- ─────────────────────────────────────────────────────────────
-- Profiles: one row per auth user, with trial / subscription state
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  subscription_status text not null default 'trialing',   -- trialing | active | past_due | canceled | expired
  stripe_customer_id text,
  stripe_subscription_id text
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- Auto-create the profile row when a new auth user signs up (starts the 14-day trial)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- User data: bankrolls, bets, transactions (string ids = app uids)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.bankrolls (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'EUR',
  starting_capital numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.bankrolls enable row level security;
drop policy if exists bankrolls_own on public.bankrolls;
create policy bankrolls_own on public.bankrolls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.bets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bankroll_id text not null,
  date text not null,
  sport text,
  event text,
  market text,
  type text not null default 'single',
  is_live boolean not null default false,
  legs jsonb not null default '[]'::jsonb,
  odds numeric not null default 0,
  stake numeric not null default 0,
  status text not null default 'pending',
  cashout_amount numeric,
  bookmaker text,
  tipster text,
  notes text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.bets enable row level security;
drop policy if exists bets_own on public.bets;
create policy bets_own on public.bets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists bets_user_idx on public.bets(user_id);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bankroll_id text not null,
  type text not null,             -- deposit | withdrawal
  amount numeric not null,
  date text not null,
  note text
);
alter table public.transactions enable row level security;
drop policy if exists transactions_own on public.transactions;
create policy transactions_own on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Shared results cache (Phase 2 — filled by the server settlement job).
-- Readable by any signed-in user; writes happen only via service_role (the cron).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.fixtures (
  id text primary key,
  sport text,
  home text,
  away text,
  event text,
  starts_at timestamptz,
  source text,
  created_at timestamptz not null default now()
);
alter table public.fixtures enable row level security;
drop policy if exists fixtures_read on public.fixtures;
create policy fixtures_read on public.fixtures
  for select using (auth.role() = 'authenticated');

create table if not exists public.results (
  fixture_id text primary key references public.fixtures(id) on delete cascade,
  status text,                    -- finished | pending | void
  home_score int,
  away_score int,
  data jsonb,                     -- normalized stats for market settlement
  source text,
  fetched_at timestamptz not null default now()
);
alter table public.results enable row level security;
drop policy if exists results_read on public.results;
create policy results_read on public.results
  for select using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- Scan usage guard: a generous per-user daily counter for the scan-bet
-- Edge Function (abuse guard on the paid Gemini key, NOT a usage limit).
-- Only the SECURITY DEFINER rpc below may write it, so it can't be reset.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.scan_usage enable row level security;
drop policy if exists scan_usage_read on public.scan_usage;
create policy scan_usage_read on public.scan_usage
  for select using (auth.uid() = user_id);

-- Atomically increment today's scan count for the caller; returns the new count.
create or replace function public.bump_scan_usage()
returns int
language plpgsql
security definer set search_path = public
as $$
declare c int;
begin
  insert into public.scan_usage (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.scan_usage.count + 1
  returning count into c;
  return c;
end;
$$;

revoke all on function public.bump_scan_usage() from public, anon;
grant execute on function public.bump_scan_usage() to authenticated;
