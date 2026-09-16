"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";
import { getMetricsRange } from "@/lib/queries";
import { toCsv } from "@/lib/csv";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Upsert one daily_metrics row. Editors+admins only (RLS also enforces scope). */
export async function saveDailyMetric(
  form: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "editor"]);
  const supabase = createClient();

  const payload = {
    app_id: String(form.get("app_id")),
    date: String(form.get("date")),
    active_users: numOrNull(form.get("active_users")),
    installs: numOrNull(form.get("installs")),
    uninstalls: numOrNull(form.get("uninstalls")),
    admob_revenue: num(form.get("admob_revenue")),
    inapp_revenue: num(form.get("inapp_revenue")),
    campaign_spend: num(form.get("campaign_spend")),
    source: "manual" as const,
    entered_by: user.id,
  };

  if (!payload.app_id || !payload.date) {
    return { ok: false, error: "App and date are required." };
  }

  const { error } = await supabase
    .from("daily_metrics")
    .upsert(payload, { onConflict: "app_id,date" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/monthly");
  return { ok: true };
}

/** Upsert one 12-hour report row. */
export async function saveTwelveHour(form: FormData): Promise<ActionResult> {
  const user = await requireRole(["admin", "editor"]);
  const supabase = createClient();

  const slot = String(form.get("slot") || "first") === "second" ? "second" : "first";
  const payload = {
    app_id: String(form.get("app_id")),
    report_date: String(form.get("report_date")),
    slot,
    // First half ends at noon, second half ends at midnight.
    cutoff_time: slot === "first" ? "12:00" : "00:00",
    admob_revenue: num(form.get("admob_revenue")),
    google_ads_spend: num(form.get("google_ads_spend")),
    entered_by: user.id,
  };
  if (!payload.app_id || !payload.report_date) {
    return { ok: false, error: "App and date are required." };
  }

  const { error } = await supabase
    .from("twelve_hour_reports")
    .upsert(payload, { onConflict: "app_id,report_date,slot" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/twelve-hour");
  return { ok: true };
}

/** Editor+admin: save 12-hour figures for MANY apps at once (one slot/date). */
export async function saveTwelveHourBulk(
  rows: { app_id: string; admob_revenue: number; google_ads_spend: number }[],
  meta: { report_date: string; slot: "first" | "second" },
): Promise<ActionResult & { saved?: number }> {
  const user = await requireRole(["admin", "editor"]);
  const supabase = createClient();
  const slot = meta.slot === "second" ? "second" : "first";

  const payload = rows
    .filter((r) => r.app_id)
    .map((r) => ({
      app_id: r.app_id,
      report_date: meta.report_date,
      slot,
      cutoff_time: slot === "first" ? "12:00" : "00:00",
      admob_revenue: Number(r.admob_revenue) || 0,
      google_ads_spend: Number(r.google_ads_spend) || 0,
      entered_by: user.id,
    }));

  if (payload.length === 0) {
    return { ok: false, error: "Add at least one app." };
  }
  const { error } = await supabase
    .from("twelve_hour_reports")
    .upsert(payload, { onConflict: "app_id,report_date,slot" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/twelve-hour");
  return { ok: true, saved: payload.length };
}

/** Admin: create/rename a network. */
export async function saveNetwork(form: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = createClient();
  const id = form.get("id") ? String(form.get("id")) : null;
  const row = {
    name: String(form.get("name")).trim(),
    platform: String(form.get("platform") || "Android"),
    active: form.get("active") === "on" || form.get("active") === "true",
  };
  if (!row.name) return { ok: false, error: "Name is required." };

  const q = id
    ? supabase.from("networks").update(row).eq("id", id)
    : supabase.from("networks").insert(row);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/networks");
  return { ok: true };
}

/** Admin: create/rename an app under a network. */
export async function saveApp(form: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = createClient();
  const id = form.get("id") ? String(form.get("id")) : null;
  const row = {
    network_id: String(form.get("network_id")),
    name: String(form.get("name")).trim(),
    package_name: String(form.get("package_name") || "") || null,
    active: form.get("active") === "on" || form.get("active") === "true",
  };
  if (!row.network_id || !row.name) {
    return { ok: false, error: "Account and app name are required." };
  }
  const q = id
    ? supabase.from("apps").update(row).eq("id", id)
    : supabase.from("apps").insert(row);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/networks");
  return { ok: true };
}

/** Admin: set a user's role and optional network scope. */
export async function setUserRole(form: FormData): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = createClient();
  const user_id = String(form.get("user_id"));
  const role = String(form.get("role")) as "admin" | "editor" | "viewer";
  const scopeRaw = form.getAll("network_scope").map(String).filter(Boolean);
  const network_scope = scopeRaw.length ? scopeRaw : null;

  if (!user_id) return { ok: false, error: "Missing user." };
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id, role, network_scope }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Admin-only: create a new member (auth user) with an editor/viewer role.
 * Uses the service-role client (required to create auth users). The new user
 * can sign in immediately with the temporary password, which is returned so the
 * admin can share it. Admins are intentionally NOT creatable here — promote an
 * existing user via setUserRole if you need another admin.
 */
export async function createMember(
  form: FormData,
): Promise<ActionResult & { tempPassword?: string; email?: string }> {
  await requireRole(["admin"]);

  const email = String(form.get("email") || "").trim().toLowerCase();
  const role = String(form.get("role") || "viewer");
  const provided = String(form.get("password") || "");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (role !== "editor" && role !== "viewer") {
    return { ok: false, error: "Role must be editor or viewer." };
  }
  const password =
    provided.length >= 8 ? provided : generatePassword();

  const admin = createServiceClient();

  // 1) Create the auth user (email pre-confirmed so they can log in now).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message ?? "Could not create the user.",
    };
  }

  // 2) Set their role. A trigger already inserted a 'viewer' row; upsert the
  //    chosen role over it.
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert(
      { user_id: data.user.id, role, network_scope: null },
      { onConflict: "user_id" },
    );
  if (roleErr) return { ok: false, error: roleErr.message };

  revalidatePath("/admin/users");
  return { ok: true, tempPassword: password, email };
}

const EXPORT_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "network_name", label: "Account" },
  { key: "app_name", label: "App" },
  { key: "active_users", label: "Active users" },
  { key: "installs", label: "Installs" },
  { key: "uninstalls", label: "Uninstalls" },
  { key: "admob_revenue", label: "AdMob revenue" },
  { key: "inapp_revenue", label: "In-app revenue" },
  { key: "campaign_spend", label: "Campaign spend" },
  { key: "net", label: "Net" },
  { key: "source", label: "Source" },
] as const;

/**
 * Any signed-in role: export daily_metrics for an inclusive custom date range
 * as a CSV string, optionally narrowed to one network. Read-only, so it uses
 * the caller's own session (RLS already allows all authenticated roles to
 * read daily_metrics).
 */
export async function exportMetricsCsv(
  from: string,
  to: string,
  networkId?: string,
): Promise<ActionResult & { csv?: string; filename?: string; rows?: number }> {
  await requireUser();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "Enter valid start and end dates." };
  }
  if (from > to) {
    return { ok: false, error: "Start date must be on or before the end date." };
  }

  let rows = await getMetricsRange(from, to);
  if (networkId) rows = rows.filter((r) => r.network_id === networkId);

  const csv = toCsv(EXPORT_COLUMNS, rows);
  const filename = `metrics_${from}_to_${to}.csv`;
  return { ok: true, csv, filename, rows: rows.length };
}

/**
 * Admin-only: permanently remove a member (auth user). Deleting the auth user
 * cascades to their user_roles row (see 0001_init.sql). Admins can't remove
 * their own account, to avoid locking everyone out.
 */
export async function deleteMember(user_id: string): Promise<ActionResult> {
  const me = await requireRole(["admin"]);
  if (!user_id) return { ok: false, error: "Missing user." };
  if (user_id === me.id) {
    return { ok: false, error: "You can't remove your own account." };
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

function generatePassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%";
  let out = "";
  for (let i = 0; i < 14; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Bulk upsert daily metrics from a parsed CSV (editor+admin). */
export async function bulkImportRows(
  rows: {
    app_id: string;
    date: string;
    admob_revenue?: number;
    inapp_revenue?: number;
    campaign_spend?: number;
    installs?: number;
    uninstalls?: number;
    active_users?: number;
  }[],
): Promise<ActionResult & { inserted?: number }> {
  const user = await requireRole(["admin", "editor"]);
  const supabase = createClient();
  const payload = rows.map((r) => ({
    ...r,
    admob_revenue: r.admob_revenue ?? 0,
    inapp_revenue: r.inapp_revenue ?? 0,
    campaign_spend: r.campaign_spend ?? 0,
    source: "manual" as const,
    entered_by: user.id,
  }));
  const { error } = await supabase
    .from("daily_metrics")
    .upsert(payload, { onConflict: "app_id,date" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/monthly");
  return { ok: true, inserted: payload.length };
}

/**
 * Bulk import for a raw worksheet-style CSV (date, app under an account-name
 * header, loosely-named metric columns). Matches apps by name under the given
 * account; admins may also auto-create the account and/or any apps that don't
 * exist yet (editors get a clear error naming what's missing instead).
 */
export async function bulkImportSmart(
  accountName: string,
  rows: {
    app: string;
    date: string;
    admob_revenue: number;
    inapp_revenue: number;
    campaign_spend: number;
    installs?: number;
    uninstalls?: number;
    active_users?: number;
  }[],
): Promise<
  ActionResult & { inserted?: number; createdApps?: number; createdAccount?: boolean }
> {
  const user = await requireRole(["admin", "editor"]);
  const name = accountName.trim();
  if (!name) return { ok: false, error: "Missing account name." };
  if (rows.length === 0) return { ok: false, error: "No rows to import." };

  const supabase = createClient();
  const isAdmin = user.role === "admin";

  let { data: net } = await supabase
    .from("networks")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  let createdAccount = false;
  if (!net) {
    if (!isAdmin) {
      return {
        ok: false,
        error: `Account "${name}" doesn't exist yet — ask an admin to add it first.`,
      };
    }
    const { data: inserted, error } = await supabase
      .from("networks")
      .insert({ name, platform: "Android" })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    net = inserted;
    createdAccount = true;
  }
  const networkId = net!.id;

  const uniqueAppNames = Array.from(
    new Set(rows.map((r) => r.app.trim()).filter(Boolean)),
  );
  const { data: existingApps } = await supabase
    .from("apps")
    .select("id, name")
    .eq("network_id", networkId);
  const appIdByName = new Map(
    (existingApps ?? []).map((a) => [a.name.trim().toLowerCase(), a.id as string]),
  );
  const missing = uniqueAppNames.filter((n) => !appIdByName.has(n.toLowerCase()));

  let createdApps = 0;
  if (missing.length > 0) {
    if (!isAdmin) {
      return {
        ok: false,
        error: `${missing.length} app(s) under "${name}" don't exist yet — ask an admin to add them first: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      };
    }
    const { data: insertedApps, error } = await supabase
      .from("apps")
      .insert(missing.map((n) => ({ network_id: networkId, name: n })))
      .select("id, name");
    if (error) return { ok: false, error: error.message };
    for (const a of insertedApps ?? []) {
      appIdByName.set(a.name.trim().toLowerCase(), a.id);
    }
    createdApps = insertedApps?.length ?? 0;
  }

  const payload = rows
    .filter((r) => r.date && appIdByName.has(r.app.trim().toLowerCase()))
    .map((r) => ({
      app_id: appIdByName.get(r.app.trim().toLowerCase())!,
      date: r.date,
      admob_revenue: r.admob_revenue ?? 0,
      inapp_revenue: r.inapp_revenue ?? 0,
      campaign_spend: r.campaign_spend ?? 0,
      installs: r.installs,
      uninstalls: r.uninstalls,
      active_users: r.active_users,
      source: "manual" as const,
      entered_by: user.id,
    }));
  if (payload.length === 0) {
    return { ok: false, error: "No valid rows (each needs an app name and a date)." };
  }

  const { error } = await supabase
    .from("daily_metrics")
    .upsert(payload, { onConflict: "app_id,date" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/monthly");
  revalidatePath("/admin/networks");
  return { ok: true, inserted: payload.length, createdApps, createdAccount };
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export { requireUser };
