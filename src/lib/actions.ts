"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth";

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
    return { ok: false, error: "Network and app name are required." };
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
