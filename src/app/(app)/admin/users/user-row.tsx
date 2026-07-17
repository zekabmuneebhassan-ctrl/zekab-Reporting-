"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/lib/actions";

interface Props {
  user: {
    user_id: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    network_scope: string[] | null;
    last_sign_in: string | null;
  };
  networks: { id: string; name: string }[];
}

export function UserRow({ user, networks }: Props) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [scope, setScope] = useState<string[]>(user.network_scope ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const scopeEnabled = role === "editor";

  async function save() {
    setBusy(true);
    setSaved(false);
    const fd = new FormData();
    fd.set("user_id", user.user_id);
    fd.set("role", role);
    if (scopeEnabled) scope.forEach((s) => fd.append("network_scope", s));
    const res = await setUserRole(fd);
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <tr className="border-b border-gray-50 align-top">
      <td className="td font-medium">{user.email}</td>
      <td className="td">
        <select
          className="input w-28"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Props["user"]["role"]);
            setSaved(false);
          }}
        >
          <option value="viewer">viewer</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="td">
        {scopeEnabled ? (
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <label key={n.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={scope.includes(n.id)}
                  onChange={(e) => {
                    setScope((s) =>
                      e.target.checked
                        ? [...s, n.id]
                        : s.filter((x) => x !== n.id),
                    );
                    setSaved(false);
                  }}
                />
                {n.name}
              </label>
            ))}
            <span className="text-xs text-gray-400">
              {scope.length === 0 ? "(all networks)" : ""}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">n/a</span>
        )}
      </td>
      <td className="td text-xs text-gray-500">
        {user.last_sign_in
          ? new Date(user.last_sign_in).toLocaleString()
          : "never"}
      </td>
      <td className="td">
        <button className="btn-primary px-2 py-1 text-xs" onClick={save} disabled={busy}>
          {busy ? "…" : saved ? "✓ Saved" : "Save"}
        </button>
      </td>
    </tr>
  );
}
