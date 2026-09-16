"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportSmart } from "@/lib/actions";

interface AppOpt {
  id: string;
  name: string;
  network: string;
}
interface ParsedRow {
  app: string;
  app_id: string | null;
  date: string;
  dateRaw: string;
  admob_revenue: number;
  inapp_revenue: number;
  campaign_spend: number;
  installs?: number;
  uninstalls?: number;
  active_users?: number;
}

const STRICT_HEADERS =
  "app,date,admob_revenue,inapp_revenue,campaign_spend,installs,uninstalls,active_users";

type Field =
  | "admob_revenue"
  | "inapp_revenue"
  | "campaign_spend"
  | "installs"
  | "uninstalls"
  | "active_users";

// Recognizes both the strict column names above AND the loose names used in
// the original per-account worksheets (e.g. "Revenue", "Install", "Unistall" —
// yes, that's a typo in the source data we mirror on purpose).
const FIELD_SYNONYMS: Record<string, Field | "ignore"> = {
  admob_revenue: "admob_revenue",
  revenue: "admob_revenue",
  inapp_revenue: "inapp_revenue",
  inapp: "inapp_revenue",
  campaign_spend: "campaign_spend",
  campaign: "campaign_spend",
  installs: "installs",
  install: "installs",
  uninstalls: "uninstalls",
  uninstall: "uninstalls",
  unistall: "uninstalls",
  active_users: "active_users",
  "active users": "active_users",
  "gain/loss": "ignore",
  gain_loss: "ignore",
  net: "ignore",
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toIso(y: number, monthZeroBased: number, d: number): string | null {
  if (monthZeroBased < 0 || monthZeroBased > 11 || d < 1 || d > 31) return null;
  const mm = String(monthZeroBased + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Accepts ISO, "1-Feb-26" / "15-Feb-2026", and "M/D/YYYY" — the formats
 * that actually show up when people paste out of a spreadsheet. */
function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon === undefined) return null;
    const year = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
    return toIso(year, mon, day);
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
    return toIso(year, Number(m[1]) - 1, Number(m[2]));
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}

function cleanNumber(raw?: string): number | undefined {
  if (raw === undefined) return undefined;
  const s = raw.replace(/[$,\s]/g, "");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
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

interface ParseResult {
  rows: ParsedRow[];
  detectedAccount: string | null;
}

function parseCsv(text: string, apps: AppOpt[]): ParseResult {
  const byName = new Map(apps.map((a) => [a.name.trim().toLowerCase(), a.id]));
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], detectedAccount: null };

  const rawHeader = splitCsvLine(lines[0]).map((h) => h.trim());
  const header = rawHeader.map((h) => h.toLowerCase());

  let appColIdx: number;
  let dateColIdx: number;
  let detectedAccount: string | null = null;
  const colField: Record<number, Field> = {};

  if (header.includes("app")) {
    // Strict format: app,date,admob_revenue,inapp_revenue,campaign_spend,installs,uninstalls,active_users
    appColIdx = header.indexOf("app");
    dateColIdx = header.indexOf("date");
    header.forEach((h, i) => {
      if (i === appColIdx || i === dateColIdx) return;
      const f = FIELD_SYNONYMS[h];
      if (f && f !== "ignore") colField[i] = f;
    });
  } else {
    // Worksheet format: col 0 = date, col 1 = app (its header is the account name).
    dateColIdx = 0;
    appColIdx = 1;
    detectedAccount = rawHeader[1] || null;
    header.forEach((h, i) => {
      if (i === dateColIdx || i === appColIdx) return;
      const f = FIELD_SYNONYMS[h];
      if (f && f !== "ignore") colField[i] = f;
    });
  }

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const app = (cols[appColIdx] ?? "").trim();
    if (!app) continue;
    const dateRaw = (cols[dateColIdx] ?? "").trim();

    const row: ParsedRow = {
      app,
      app_id: byName.get(app.toLowerCase()) ?? null,
      date: parseFlexibleDate(dateRaw) ?? "",
      dateRaw,
      admob_revenue: 0,
      inapp_revenue: 0,
      campaign_spend: 0,
    };
    for (const [idxStr, field] of Object.entries(colField)) {
      const value = cleanNumber(cols[Number(idxStr)]);
      if (field === "admob_revenue" || field === "inapp_revenue" || field === "campaign_spend") {
        row[field] = value ?? 0;
      } else {
        row[field] = value;
      }
    }
    rows.push(row);
  }
  return { rows, detectedAccount };
}

export function CsvImporter({
  apps,
  accounts,
  isAdmin,
}: {
  apps: AppOpt[];
  accounts: string[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [account, setAccount] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountKnown = accounts.some(
    (a) => a.trim().toLowerCase() === account.trim().toLowerCase(),
  );
  const ready = parsed.filter(
    (r) => r.date && r.app && (r.app_id || isAdmin),
  );
  const notReady = parsed.filter((r) => !(r.date && r.app && (r.app_id || isAdmin)));

  function onParse() {
    setResult(null);
    const res = parseCsv(text, apps);
    setParsed(res.rows);
    if (res.detectedAccount && !account) setAccount(res.detectedAccount);
  }

  async function onImport() {
    setBusy(true);
    const res = await bulkImportSmart(
      account,
      ready.map((r) => ({
        app: r.app,
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
    if (!res.ok) {
      setResult(`Error: ${res.error}`);
      return;
    }
    const bits = [`Imported ${res.inserted} rows`];
    if (res.createdAccount) bits.push(`created account "${account}"`);
    if (res.createdApps) bits.push(`created ${res.createdApps} app(s)`);
    setResult(bits.join(" · ") + ".");
    router.refresh();
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
          Either the strict format —{" "}
          <code className="rounded bg-gray-100 px-1">{STRICT_HEADERS}</code> —
          or a raw worksheet export (Date, then an app-name column headed with
          the account name, then any of Active Users/Install/Unistall/Revenue/
          InApp/Campaign in any order). Missing numeric columns default to 0;
          unrecognized columns are ignored.
        </p>
        <textarea
          className="input h-40 font-mono text-xs"
          placeholder={STRICT_HEADERS + "\nWild Duck Hunting 3D,2026-07-13,5.12,0,0,,,"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Account</label>
            <input
              className="input w-56"
              list="known-accounts"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g. Infotronix"
            />
            <datalist id="known-accounts">
              {accounts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          {account && (
            <span className="pb-2 text-xs text-gray-500">
              {accountKnown
                ? "matches an existing account"
                : isAdmin
                  ? "new — will be created"
                  : "unknown — ask an admin to add it first"}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button className="btn-ghost" onClick={onParse} disabled={!text.trim()}>
            Preview
          </button>
          <button
            className="btn-primary"
            onClick={onImport}
            disabled={busy || ready.length === 0 || !account.trim()}
          >
            {busy ? "Importing…" : `Import ${ready.length} rows`}
          </button>
          {result && <span className="self-center text-sm text-gray-600">{result}</span>}
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-4 py-2 text-sm">
            <span className="font-semibold text-gray-700">{ready.length} ready</span>
            {notReady.length > 0 && (
              <span className="ml-3 text-neg">
                {notReady.length} skipped (unrecognized date, or app not found and
                you're not an admin)
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
                    ) : isAdmin ? (
                      <span className="text-xs text-brand-600">will create</span>
                    ) : (
                      <span className="text-neg">unknown</span>
                    )}
                  </td>
                  <td className="td">
                    {r.date || (
                      <span className="text-neg" title={r.dateRaw}>
                        unparsed: {r.dateRaw || "—"}
                      </span>
                    )}
                  </td>
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
