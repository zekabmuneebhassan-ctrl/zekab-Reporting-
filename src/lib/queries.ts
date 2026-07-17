import { createClient } from "@/lib/supabase/server";
import type { Network, App } from "@/lib/types";

export interface MetricJoinRow {
  id: string;
  date: string;
  app_id: string;
  app_name: string;
  network_id: string;
  network_name: string;
  active_users: number | null;
  installs: number | null;
  uninstalls: number | null;
  gain_loss: number | null;
  admob_revenue: number;
  inapp_revenue: number;
  campaign_spend: number;
  net: number;
  source: string;
  updated_at: string;
  entered_by: string | null;
}

const SELECT =
  "id, date, app_id, active_users, installs, uninstalls, gain_loss, admob_revenue, inapp_revenue, campaign_spend, net, source, updated_at, entered_by, apps!inner(name, network_id, networks!inner(name))";

/* eslint-disable @typescript-eslint/no-explicit-any */
function flatten(rows: any[]): MetricJoinRow[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    app_id: r.app_id,
    app_name: r.apps?.name ?? "",
    network_id: r.apps?.network_id ?? "",
    network_name: r.apps?.networks?.name ?? "",
    active_users: r.active_users,
    installs: r.installs,
    uninstalls: r.uninstalls,
    gain_loss: r.gain_loss,
    admob_revenue: Number(r.admob_revenue),
    inapp_revenue: Number(r.inapp_revenue),
    campaign_spend: Number(r.campaign_spend),
    net: Number(r.net),
    source: r.source,
    updated_at: r.updated_at,
    entered_by: r.entered_by,
  }));
}

/** All daily_metrics rows for an inclusive date range. */
export async function getMetricsRange(
  from: string,
  to: string,
): Promise<MetricJoinRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_metrics")
    .select(SELECT)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) throw error;
  return flatten(data as any[]);
}

export async function getMetricsForDate(date: string): Promise<MetricJoinRow[]> {
  return getMetricsRange(date, date);
}

/** Most recent date that has any metrics (for a sensible default). */
export async function getLatestDate(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("daily_metrics")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.date ?? null;
}

export async function getNetworks(): Promise<Network[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("networks")
    .select("*")
    .order("name");
  return (data as Network[]) ?? [];
}

export async function getApps(): Promise<App[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("apps")
    .select("*")
    .order("name");
  return (data as App[]) ?? [];
}

export async function getAvailableMonths(): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("available_months");
  return ((data as { ym: string }[]) ?? []).map((r) => r.ym);
}

/** Map of user_id -> email, for audit "last edited by" tooltips (admin RPC). */
export async function getUserEmailMap(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.rpc("admin_list_users");
  const map: Record<string, string> = {};
  for (const u of (data as any[]) ?? []) {
    if (u.user_id) map[u.user_id] = u.email ?? u.user_id;
  }
  return map;
}
