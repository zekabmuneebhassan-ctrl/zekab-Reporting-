-- ============================================================================
-- 0003_functions.sql — RPCs used by the app.
-- ============================================================================

-- Admin-only: list users with their email + role + scope.
-- auth.users isn't directly selectable under RLS, so we expose exactly what the
-- admin screen needs through a SECURITY DEFINER function guarded by is_admin().
create or replace function public.admin_list_users()
returns table (
  user_id       uuid,
  email         text,
  role          public.user_role,
  network_scope uuid[],
  last_sign_in  timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select u.id, u.email::text, coalesce(r.role,'viewer'::public.user_role),
           r.network_scope, u.last_sign_in_at
    from auth.users u
    left join public.user_roles r on r.user_id = u.id
    order by u.email;
end $$;

-- Monthly summary: one row per (date, network) with rolled-up figures.
-- The app pivots networks into columns dynamically — no hardcoded network set.
create or replace function public.monthly_summary(p_year int, p_month int)
returns table (
  date           date,
  network_id     uuid,
  network_name   text,
  admob_revenue  numeric,
  inapp_revenue  numeric,
  campaign_spend numeric,
  net            numeric
)
language sql stable set search_path = public as $$
  select d.date,
         n.id,
         n.name,
         sum(d.admob_revenue),
         sum(d.inapp_revenue),
         sum(d.campaign_spend),
         sum(d.net)
  from public.daily_metrics d
  join public.apps a     on a.id = d.app_id
  join public.networks n on n.id = a.network_id
  where extract(year  from d.date) = p_year
    and extract(month from d.date) = p_month
  group by d.date, n.id, n.name
  order by d.date, n.name;
$$;

-- Convenience: distinct months that have data, for month pickers.
create or replace function public.available_months()
returns table (ym text)
language sql stable set search_path = public as $$
  select distinct to_char(date, 'YYYY-MM') as ym
  from public.daily_metrics
  order by ym desc;
$$;
