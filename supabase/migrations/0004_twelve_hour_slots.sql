-- ============================================================================
-- 0004_twelve_hour_slots.sql
-- The 12-hour cycle runs TWICE a day. Add a `slot` so we can distinguish the
-- first half (12 AM–12 PM) from the second half (12 PM–12 AM) and compare the
-- SAME slot day-over-day (today's first half vs yesterday's first half).
-- ============================================================================

alter table public.twelve_hour_reports
  add column if not exists slot text not null default 'first'
  check (slot in ('first', 'second'));

-- Replace the old "one row per app per day" uniqueness with a slot-aware one,
-- so an app can have both a first-half and a second-half report on the same day.
alter table public.twelve_hour_reports
  drop constraint if exists twelve_hour_reports_app_id_report_date_key;

create unique index if not exists twelve_hour_reports_app_date_slot_key
  on public.twelve_hour_reports (app_id, report_date, slot);
