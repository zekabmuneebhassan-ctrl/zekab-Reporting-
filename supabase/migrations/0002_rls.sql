-- ============================================================================
-- 0002_rls.sql — Row-Level Security.
-- Enforcement lives in Postgres, not just the UI: an editor scoped to one network
-- cannot select/insert/update another network's rows even via the raw API.
-- ============================================================================

-- Helper functions run as SECURITY DEFINER so they can read user_roles without
-- tripping that table's own RLS (which would otherwise recurse).

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'viewer'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin';
$$;

create or replace function public.can_edit()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin','editor');
$$;

-- True if the current user may edit data for the given network.
-- Admins: always. Editors: if their network_scope is null (blanket) or contains it.
create or replace function public.can_edit_network(target_network uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    case
      when public.current_role() = 'admin' then true
      when public.current_role() = 'editor' then (
        select scope is null or target_network = any(scope)
        from (
          select network_scope as scope
          from public.user_roles where user_id = auth.uid()
        ) s
      )
      else false
    end;
$$;

-- Network that owns a given app (used by metric policies).
create or replace function public.network_of_app(target_app uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select network_id from public.apps where id = target_app;
$$;

-- ---------------------------------------------------------------------------
alter table public.networks           enable row level security;
alter table public.apps               enable row level security;
alter table public.daily_metrics      enable row level security;
alter table public.twelve_hour_reports enable row level security;
alter table public.user_roles         enable row level security;

-- ---- networks -------------------------------------------------------------
-- Everyone signed in can read networks (needed to render dashboards).
drop policy if exists networks_select on public.networks;
create policy networks_select on public.networks
  for select to authenticated using (true);

-- Only admins add/edit/remove networks.
drop policy if exists networks_write on public.networks;
create policy networks_write on public.networks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- apps -----------------------------------------------------------------
drop policy if exists apps_select on public.apps;
create policy apps_select on public.apps
  for select to authenticated using (true);

drop policy if exists apps_write on public.apps;
create policy apps_write on public.apps
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- daily_metrics --------------------------------------------------------
-- Read: viewers/editors/admins can all read (scoping applies to writes; if you
-- later want read-scoping too, swap `true` for can_edit_network(network_of_app(app_id))).
drop policy if exists daily_metrics_select on public.daily_metrics;
create policy daily_metrics_select on public.daily_metrics
  for select to authenticated using (true);

drop policy if exists daily_metrics_insert on public.daily_metrics;
create policy daily_metrics_insert on public.daily_metrics
  for insert to authenticated
  with check (public.can_edit_network(public.network_of_app(app_id)));

drop policy if exists daily_metrics_update on public.daily_metrics;
create policy daily_metrics_update on public.daily_metrics
  for update to authenticated
  using (public.can_edit_network(public.network_of_app(app_id)))
  with check (public.can_edit_network(public.network_of_app(app_id)));

drop policy if exists daily_metrics_delete on public.daily_metrics;
create policy daily_metrics_delete on public.daily_metrics
  for delete to authenticated
  using (public.is_admin());

-- ---- twelve_hour_reports --------------------------------------------------
drop policy if exists twelve_select on public.twelve_hour_reports;
create policy twelve_select on public.twelve_hour_reports
  for select to authenticated using (true);

drop policy if exists twelve_insert on public.twelve_hour_reports;
create policy twelve_insert on public.twelve_hour_reports
  for insert to authenticated
  with check (public.can_edit_network(public.network_of_app(app_id)));

drop policy if exists twelve_update on public.twelve_hour_reports;
create policy twelve_update on public.twelve_hour_reports
  for update to authenticated
  using (public.can_edit_network(public.network_of_app(app_id)))
  with check (public.can_edit_network(public.network_of_app(app_id)));

drop policy if exists twelve_delete on public.twelve_hour_reports;
create policy twelve_delete on public.twelve_hour_reports
  for delete to authenticated
  using (public.is_admin());

-- ---- user_roles -----------------------------------------------------------
-- A user can read their OWN role; admins can read all.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Only admins can change roles / scope.
drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
