"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole, deleteMember } from "@/lib/actions";

interface Props {
  user: {
    user_id: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    network_scope: string[] | null;
    last_sign_in: string | null;
  };
  networks: { id: string; name: string }[];
  isSelf: boolean;
}

function sameScope(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((v, i) => v === sortedB[i]);
}

export function UserRow({ user, networks, isSelf }: Props) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [scope, setScope] = useState<string[]>(user.network_scope ?? []);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Compares against the props (the last-saved server state), so the button
  // reflects reality across reloads instead of resetting to "unsaved" every render.
  const dirty =
    role !== user.role || !sameScope(scope, user.network_scope ?? []);

  async function remove() {
    if (!confirm(`Remove ${user.email}? They will lose access immediately.`)) {
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    const res = await deleteMember(user.user_id);
    setRemoving(false);
    if (res.ok) {
      router.refresh();
    } else {
      setRemoveError(res.error ?? "Could not remove member.");
    }
  }

  const scopeEnabled = role === "editor";

  async function save() {
    setBusy(true);
    const fd = new FormData();
    fd.set("user_id", user.user_id);
    fd.set("role", role);
    if (scopeEnabled) scope.forEach((s) => fd.append("network_scope", s));
    const res = await setUserRole(fd);
    setBusy(false);
    if (res.ok) {
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
          onChange={(e) => setRole(e.target.value as Props["user"]["role"])}
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
                  onChange={(e) =>
                    setScope((s) =>
                      e.target.checked
                        ? [...s, n.id]
                        : s.filter((x) => x !== n.id),
                    )
                  }
                />
                {n.name}
              </label>
            ))}
            <span className="text-xs text-gray-400">
              {scope.length === 0 ? "(all accounts)" : ""}
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
        <div className="flex items-center gap-2">
          <button
            className={dirty ? "btn-primary px-2 py-1 text-xs" : "btn-ghost px-2 py-1 text-xs"}
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? "…" : dirty ? "Save" : "✓ Saved"}
          </button>
          {!isSelf && (
            <button
              className="btn-ghost px-2 py-1 text-xs text-neg"
              onClick={remove}
              disabled={removing}
              title="Remove this user"
            >
              {removing ? "…" : "Remove"}
            </button>
          )}
        </div>
        {removeError && (
          <p className="mt-1 text-xs text-neg">{removeError}</p>
        )}
      </td>
    </tr>
  );
}
