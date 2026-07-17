-- ============================================================================
-- 0001_init.sql — Core schema for the Gaming Apps Revenue & Ad-Spend Dashboard
-- Mirrors the raw daily sheets; summary sheets are derived and NOT stored.
-- ============================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Networks / publisher accounts.
-- One row here replaces one hardcoded column-block per network per month in the
-- old workbook. Adding a network never requires a schema/column change.
-- ---------------------------------------------------------------------------
create table if not exists public.networks (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  platform text,                       -- 'Android' | 'iOS' | null
  active   boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Apps — each belongs to one network.
-- ---------------------------------------------------------------------------
create table if not exists public.apps (
  id           uuid primary key default gen_random_uuid(),
  network_id   uuid not null references public.networks(id) on delete cascade,
  name         text not null,
  package_name text,                    -- for Play Console / AdMob API matching later
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (network_id, name)
);
create index if not exists apps_network_id_idx on public.apps(network_id);

-- ---------------------------------------------------------------------------
-- Daily metrics — one row per app per date (mirrors the raw sheets).
-- ---------------------------------------------------------------------------
create table if not exists public.daily_metrics (
  id             uuid primary key default gen_random_uuid(),
  app_id         uuid not null references public.apps(id) on delete cascade,
  date           date not null,
  active_users   int,
  installs       int,
  uninstalls     int,
  gain_loss      int generated always as (coalesce(installs,0) - coalesce(uninstalls,0)) stored,
  admob_revenue  numeric(12,2) not null default 0,
  inapp_revenue  numeric(12,2) not null default 0,
  campaign_spend numeric(12,2) not null default 0,
  net            numeric(12,2) generated always as
                   (admob_revenue + inapp_revenue - campaign_spend) stored,
  source         text not null default 'manual'
                   check (source in ('manual','admob_api','play_console','google_ads_api')),
  entered_by     uuid references auth.users(id),
  updated_at     timestamptz not null default now(),
  unique (app_id, date)
);
create index if not exists daily_metrics_date_idx on public.daily_metrics(date);
create index if not exists daily_metrics_app_id_idx on public.daily_metrics(app_id);

-- ---------------------------------------------------------------------------
-- 12-hour reporting cycle (new requirement).
-- The "compared to yesterday's 12-hour report" view is a self-join on app_id.
-- ---------------------------------------------------------------------------
create table if not exists public.twelve_hour_reports (
  id               uuid primary key default gen_random_uuid(),
  app_id           uuid not null references public.apps(id) on delete cascade,
  report_date      date not null,
  cutoff_time      time not null default '12:00',
  admob_revenue    numeric(12,2) not null default 0,
  google_ads_spend numeric(12,2) not null default 0,
  net              numeric(12,2) generated always as
                     (admob_revenue - google_ads_spend) stored,
  entered_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (app_id, report_date)
);
create index if not exists twelve_hour_reports_date_idx
  on public.twelve_hour_reports(report_date);

-- ---------------------------------------------------------------------------
-- Roles.
-- network_scope is kept for future per-network editors; blanket editors leave it null.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin','editor','viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  role          public.user_role not null default 'viewer',
  network_scope uuid[],                 -- null = all networks
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_daily_metrics_touch on public.daily_metrics;
create trigger trg_daily_metrics_touch before update on public.daily_metrics
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_twelve_hour_touch on public.twelve_hour_reports;
create trigger trg_twelve_hour_touch before update on public.twelve_hour_reports
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_user_roles_touch on public.user_roles;
create trigger trg_user_roles_touch before update on public.user_roles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a default 'viewer' role row when a new auth user is created,
-- so every signed-in user has a role without manual seeding.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
