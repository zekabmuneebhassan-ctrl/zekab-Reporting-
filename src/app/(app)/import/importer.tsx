"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportRows } from "@/lib/actions";

interface AppOpt {
  id: string;
  name: string;
  network: string;
}
interface ParsedRow {
  app: string;
  app_id: string | null;
  date: string;
  admob_revenue: number;
  inapp_revenue: number;
  campaign_spend: number;
  installs?: number;
  uninstalls?: number;
  active_users?: number;
}

const HEADERS =
  "app,date,admob_revenue,inapp_revenue,campaign_spend,installs,uninstalls,active_users";

function parseCsv(text: string, apps: AppOpt[]): ParsedRow[] {
  const byName = new Map(apps.map((a) => [a.name.trim().toLowerCase(), a.id]));
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const app = (cols[idx("app")] ?? "").trim();
    out.push({
      app,
      app_id: byName.get(app.toLowerCase()) ?? null,
      date: (cols[idx("date")] ?? "").trim(),
      admob_revenue: num(cols[idx("admob_revenue")]),
      inapp_revenue: num(cols[idx("inapp_revenue")]),
      campaign_spend: num(cols[idx("campaign_spend")]),
      installs: optNum(cols[idx("installs")]),
      uninstalls: optNum(cols[idx("uninstalls")]),
      active_users: optNum(cols[idx("active_users")]),
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      result.push(cur);
      cur = "";
    } else cur += ch;
  }
  result.push(cur);
  return result;
}
const num = (v?: string) => (v ? Number(v) || 0 : 0);
const optNum = (v?: string) =>
  v && v.trim() !== "" ? Number(v) || 0 : undefined;

export function CsvImporter({ apps }: { apps: AppOpt[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = parsed.filter((r) => r.app_id && r.date);
  const invalid = parsed.filter((r) => !r.app_id || !r.date);

  function onParse() {
    setResult(null);
    setParsed(parseCsv(text, apps));
  }

  async function onImport() {
    setBusy(true);
    const res = await bulkImportRows(
      valid.map((r) => ({
        app_id: r.app_id!,
        date: r.date,
        admob_revenue: r.admob_revenue,
        inapp_revenue: r.inapp_revenue,
        campaign_spend: r.campaign_spend,
        installs: r.installs,
        uninstalls: r.uninstalls,
        active_users: r.active_users,
      })),
    );
    setBusy(false);
    setResult(
      res.ok ? `Imported ${res.inserted} rows.` : `Error: ${res.error}`,
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">CSV data</label>
          <label className="btn-ghost cursor-pointer text-xs">
            Upload file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
              }}
            />
          </label>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          Header row required. Columns:{" "}
          <code className="rounded bg-gray-100 px-1">{HEADERS}</code>. App names
          must match existing apps exactly; missing numeric columns default to 0.
        </p>
        <textarea
          className="input h-40 font-mono text-xs"
          placeholder={HEADERS + "\nWild Duck Hunting 3D,2026-07-13,5.12,0,0,,,"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost" onClick={onParse}>
            Preview
          </button>
          <button
            className="btn-primary"
            onClick={onImport}
            disabled={busy || valid.length === 0}
          >
            {busy ? "Importing…" : `Import ${valid.length} rows`}
          </button>
          {result && <span className="self-center text-sm text-gray-600">{result}</span>}
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-4 py-2 text-sm">
            <span className="font-semibold text-gray-700">{valid.length} ready</span>
            {invalid.length > 0 && (
              <span className="ml-3 text-neg">
                {invalid.length} skipped (unknown app or missing date)
              </span>
            )}
          </div>
          <table className="min-w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="th">App</th>
                <th className="th">Matched</th>
                <th className="th">Date</th>
                <th className="th text-right">AdMob</th>
                <th className="th text-right">In-app</th>
                <th className="th text-right">Spend</th>
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 200).map((r, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="td">{r.app}</td>
                  <td className="td">
                    {r.app_id ? (
                      <span className="text-pos">✓</span>
                    ) : (
                      <span className="text-neg">unknown</span>
                    )}
                  </td>
                  <td className="td">{r.date || <span className="text-neg">—</span>}</td>
                  <td className="td text-right">{r.admob_revenue.toFixed(2)}</td>
                  <td className="td text-right">{r.inapp_revenue.toFixed(2)}</td>
                  <td className="td text-right">{r.campaign_spend.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
