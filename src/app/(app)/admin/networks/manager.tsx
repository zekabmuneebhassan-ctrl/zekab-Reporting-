"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveNetwork, saveApp } from "@/lib/actions";
import type { Network } from "@/lib/types";

interface AppLite {
  id: string;
  name: string;
  network_id: string;
  package_name: string | null;
  active: boolean;
}

export function NetworkManager({
  networks,
  apps,
}: {
  networks: Network[];
  apps: AppLite[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(
    fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const res = await fn(new FormData(formEl));
    setMsg(res.ok ? "Saved." : res.error ?? "Error");
    if (res.ok) {
      formEl.reset();
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Add account */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Add account</h2>
        <form
          onSubmit={(e) => submit(saveNetwork, e)}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input w-56" placeholder="e.g. Keystone" />
          </div>
          <div>
            <label className="label">Platform</label>
            <select name="platform" className="input w-32" defaultValue="Android">
              <option>Android</option>
              <option>iOS</option>
            </select>
          </div>
          <input type="hidden" name="active" value="true" />
          <button className="btn-primary">Add account</button>
        </form>
      </div>

      {/* Add app */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Add app</h2>
        <form
          onSubmit={(e) => submit(saveApp, e)}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="label">Account</label>
            <select name="network_id" required className="input w-48">
              <option value="">Select…</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">App name</label>
            <input name="name" required className="input w-56" />
          </div>
          <div>
            <label className="label">Package name (optional)</label>
            <input name="package_name" className="input w-56" placeholder="com.studio.game" />
          </div>
          <input type="hidden" name="active" value="true" />
          <button className="btn-primary">Add app</button>
        </form>
      </div>

      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      {/* List */}
      <div className="space-y-4">
        {networks.map((n) => {
          const netApps = apps.filter((a) => a.network_id === n.id);
          return (
            <div key={n.id} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="font-medium text-gray-800">
                  {n.name}
                  <span className="ml-2 text-xs text-gray-400">
                    {n.platform} · {netApps.length} apps
                  </span>
                  {!n.active && (
                    <span className="ml-2 rounded bg-gray-100 px-1 text-xs text-gray-500">
                      inactive
                    </span>
                  )}
                </div>
              </div>
              <table className="min-w-full">
                <tbody>
                  {netApps.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="td">{a.name}</td>
                      <td className="td text-gray-400">{a.package_name ?? "—"}</td>
                      <td className="td text-right">
                        {a.active ? (
                          <span className="text-xs text-pos">active</span>
                        ) : (
                          <span className="text-xs text-gray-400">inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {netApps.length === 0 && (
                    <tr>
                      <td className="td text-sm text-gray-400" colSpan={3}>
                        No apps yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
