"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMember } from "@/lib/actions";

export function AddMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const res = await createMember(new FormData(form));
    setBusy(false);
    if (res.ok && res.tempPassword && res.email) {
      setCreated({ email: res.email, password: res.tempPassword });
      form.reset();
      router.refresh();
    } else {
      setError(res.error ?? "Could not create member.");
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Add member
      </button>
    );
  }

  return (
    <div className="card w-full max-w-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Add a member</h2>
        <button
          className="text-sm text-gray-400 hover:text-gray-600"
          onClick={() => {
            setOpen(false);
            setCreated(null);
            setError(null);
          }}
        >
          ✕
        </button>
      </div>

      {created ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Member created — share these sign-in details:
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="w-20 text-gray-500">Email</dt>
              <dd className="font-mono">{created.email}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-20 text-gray-500">Password</dt>
              <dd className="rounded bg-white px-2 py-1 font-mono text-gray-900 ring-1 ring-gray-200">
                {created.password}
              </dd>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `Email: ${created.email}\nPassword: ${created.password}`,
                  )
                }
              >
                Copy
              </button>
            </div>
          </dl>
          <p className="mt-3 text-xs text-green-800">
            They can sign in immediately and should change this password after
            first login. This is the only time it&apos;s shown.
          </p>
          <button
            className="btn-ghost mt-4"
            onClick={() => setCreated(null)}
          >
            Add another
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Email</label>
              <input
                name="email"
                type="email"
                required
                className="input"
                placeholder="teammate@company.com"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select name="role" className="input" defaultValue="viewer">
                <option value="viewer">Viewer — read only</option>
                <option value="editor">Editor — can enter data</option>
              </select>
            </div>
            <div>
              <label className="label">Temporary password (optional)</label>
              <input
                name="password"
                type="text"
                className="input"
                placeholder="Auto-generated if blank"
                minLength={8}
              />
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-neg">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create member"}
            </button>
            <span className="text-xs text-gray-400">
              Admins can&apos;t be created here — promote an existing user for that.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
