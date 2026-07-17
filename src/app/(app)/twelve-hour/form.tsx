"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTwelveHourBulk } from "@/lib/actions";
import type { TwelveHourSlot } from "@/lib/types";

interface AppOpt {
  id: string;
  name: string;
  network: string;
}

interface Entry {
  key: number;
  app_id: string;
  admob_revenue: string;
  google_ads_spend: string;
}

let counter = 0;
const blank = (): Entry => ({
  key: counter++,
  app_id: "",
  admob_revenue: "",
  google_ads_spend: "",
});

export function TwelveHourForm({
  date,
  slot,
  apps,
}: {
  date: string;
  slot: TwelveHourSlot;
  apps: AppOpt[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([blank()]);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(key: number, patch: Partial<Entry>) {
    setEntries((e) => e.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setMsg(null);
  }
  function addRow() {
    setEntries((e) => [...e, blank()]);
  }
  function removeRow(key: number) {
    setEntries((e) => (e.length === 1 ? e : e.filter((r) => r.key !== key)));
  }

  const filled = entries.filter((r) => r.app_id);

  async function saveAll() {
    if (filled.length === 0) {
      setMsg("Pick at least one app.");
      return;
    }
    setPending(true);
    setMsg(null);
    const res = await saveTwelveHourBulk(
      filled.map((r) => ({
        app_id: r.app_id,
        admob_revenue: Number(r.admob_revenue) || 0,
        google_ads_spend: Number(r.google_ads_spend) || 0,
      })),
      { report_date: date, slot },
    );
    setPending(false);
    if (res.ok) {
      setMsg(`Saved ${res.saved} ${res.saved === 1 ? "app" : "apps"}.`);
      setEntries([blank()]);
      router.refresh();
    } else {
      setMsg(res.error ?? "Error");
    }
  }

  // Apps already chosen in other rows (to avoid duplicate selection).
  const chosen = new Set(filled.map((r) => r.app_id));

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Enter 12-hour figures
        <span className="ml-2 font-normal text-gray-400">
          for the{" "}
          {slot === "first"
            ? "first half (12 AM–12 PM)"
            : "second half (12 PM–12 AM)"}{" "}
          · add as many apps as you like
        </span>
      </h2>

      <div className="space-y-2">
        {/* header labels */}
        <div className="hidden gap-3 px-1 text-xs font-medium text-gray-500 md:grid md:grid-cols-[1fr_140px_140px_36px]">
          <span>App</span>
          <span className="text-right">AdMob revenue</span>
          <span className="text-right">Google Ads spend</span>
          <span />
        </div>

        {entries.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_140px_36px] md:items-center"
          >
            <select
              className="input"
              value={r.app_id}
              onChange={(e) => update(r.key, { app_id: e.target.value })}
            >
              <option value="">Select app…</option>
              {apps.map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                  disabled={chosen.has(a.id) && a.id !== r.app_id}
                >
                  {a.name} · {a.network}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className="input text-right tabular-nums"
              placeholder="0.00"
              value={r.admob_revenue}
              onChange={(e) => update(r.key, { admob_revenue: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className="input text-right tabular-nums"
              placeholder="0.00"
              value={r.google_ads_spend}
              onChange={(e) =>
                update(r.key, { google_ads_spend: e.target.value })
              }
            />
            <button
              type="button"
              onClick={() => removeRow(r.key)}
              disabled={entries.length === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-neg disabled:opacity-30"
              title="Remove row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={addRow}>
          + Add app
        </button>
        <button
          type="button"
          className="btn-primary min-w-[120px]"
          onClick={saveAll}
          disabled={pending || filled.length === 0}
        >
          {pending
            ? "Saving…"
            : `Save ${filled.length || ""} ${filled.length === 1 ? "app" : "apps"}`.trim()}
        </button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
