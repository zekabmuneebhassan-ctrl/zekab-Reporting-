import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNetworks } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { UserRow } from "./user-row";
import { AddMember } from "./add-member";

export const dynamic = "force-dynamic";

interface AdminUser {
  user_id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  network_scope: string[] | null;
  last_sign_in: string | null;
}

export default async function UsersPage() {
  const me = await requireRole(["admin"]);
  const supabase = createClient();
  const [{ data }, networks] = await Promise.all([
    supabase.rpc("admin_list_users"),
    getNetworks(),
  ]);
  const users = (data as AdminUser[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Users & roles"
        subtitle="Add members and assign roles. Enforced by Postgres RLS."
      />
      <div className="mb-5">
        <AddMember />
      </div>

      {users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Network scope (editors)</th>
                <th className="th">Last sign-in</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.user_id}
                  user={u}
                  networks={networks.map((n) => ({ id: n.id, name: n.name }))}
                  isSelf={u.user_id === me.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
