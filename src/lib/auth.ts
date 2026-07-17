import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
  role: UserRole;
  networkScope: string[] | null;
}

/**
 * Returns the current authenticated user together with their role row, or null.
 * Cached per-request so multiple components don't re-query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, network_scope")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    // Default to the least-privileged role if no row exists yet.
    role: (roleRow?.role as UserRole) ?? "viewer",
    networkScope: roleRow?.network_scope ?? null,
  };
});

/** Redirects to /login if not authenticated. Returns the user otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects to /dashboard if the user lacks one of the allowed roles. */
export async function requireRole(
  allowed: UserRole[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/dashboard");
  return user;
}

export function canEdit(role: UserRole): boolean {
  return role === "admin" || role === "editor";
}
