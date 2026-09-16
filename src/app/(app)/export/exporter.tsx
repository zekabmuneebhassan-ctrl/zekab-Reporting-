"use client";

import { useState } from "react";
import { exportMetricsCsv } from "@/lib/actions";

interface Props {
  networks: { id: string; name: string }[];
  defaultFrom: string;
  defaultTo: string;
}

export function Exporter({ networks, defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [networkId, setNetworkId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: number } | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await exportMetricsCsv(from, to, networkId || undefined);
    setBusy(false);

    if (!res.ok || !res.csv || !res.filename) {
      setError(res.error ?? "Could not export.");
      return;
    }
    if (res.rows === 0) {
      setError("No data in that range — nothing to export.");
      return;
    }

    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setResult({ rows: res.rows ?? 0 });
  }

  return (
    <div className="card max-w-xl p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              setResult(null);
            }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value);
              setResult(null);
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Account (optional)</label>
          <select
            className="input"
            value={networkId}
            onChange={(e) => {
              setNetworkId(e.target.value);
              setResult(null);
            }}
          >
            <option value="">All accounts</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-neg">
          {error}
        </p>
      )}
      {result && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
          Downloaded {result.rows} row{result.rows === 1 ? "" : "s"}.
        </p>
      )}

      <button
        className="btn-primary mt-4"
        onClick={download}
        disabled={busy || !from || !to}
      >
        {busy ? "Preparing…" : "Download CSV"}
      </button>
    </div>
  );
}
