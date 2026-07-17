"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDailyMetric } from "@/lib/actions";
import { money } from "@/lib/format";

export interface EntryRow {
  app_id: string;
  app_name: string;
  network_name: string;
  admob_revenue: number;
  inapp_revenue: number;
  campaign_spend: number;
  installs: number | null;
  uninstalls: number | null;
  active_users: number | null;
  exists: boolean;
}

type Vals = Pick<
  EntryRow,
  | "admob_revenue"
  | "inapp_revenue"
  | "campaign_spend"
  | "installs"
  | "uninstalls"
  | "active_users"
>;

const FIELDS: (keyof Vals)[] = [
  "admob_revenue",
  "inapp_revenue",
  "campaign_spend",
  "installs",
  "uninstalls",
  "active_users",
];

function valsOf(r: EntryRow): Vals {
  return {
    admob_revenue: r.admob_revenue,
    inapp_revenue: r.inapp_revenue,
    campaign_spend: r.campaign_spend,
    installs: r.installs,
    uninstalls: r.uninstalls,
    active_users: r.active_users,
  };
}

function isDirty(a: Vals, b: Vals): boolean {
  return FIELDS.some((f) => (a[f] ?? null) !== (b[f] ?? null));
}

export function EntryGrid({ date, rows }: { date: string; rows: EntryRow[] }) {
  const router = useRouter();
  const [state, setState] = useState<EntryRow[]>(rows);
  // Baseline = last-saved values, keyed by app. Anything differing is "unsaved".
  const [baseline, setBaseline] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(rows.map((r) => [r.app_id, valsOf(r)])),
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [flash, setFlash] = useState<string | null>(null);

  const dirtyIdx = useMemo(
    () =>
      state
        .map((r, i) => (isDirty(valsOf(r), baseline[r.app_id]) ? i : -1))
        .filter((i) => i >= 0),
    [state, baseline],
  );

  function update(i: number, patch: Partial<EntryRow>) {
    setState((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setFlash(null);
  }

  async function saveAll() {
    if (dirtyIdx.length === 0) return;
    setSaving(true);
    setProgress({ done: 0, total: dirtyIdx.length });
    const savedIds: string[] = [];
    let failed = 0;

    for (const i of dirtyIdx) {
      const r = state[i];
      const fd = new FormData();
      fd.set("app_id", r.app_id);
      fd.set("date", date);
      fd.set("admob_revenue", String(r.admob_revenue ?? 0));
      fd.set("inapp_revenue", String(r.inapp_revenue ?? 0));
      fd.set("campaign_spend", String(r.campaign_spend ?? 0));
      if (r.installs != null) fd.set("installs", String(r.installs));
      if (r.uninstalls != null) fd.set("uninstalls", String(r.uninstalls));
      if (r.active_users != null) fd.set("active_users", String(r.active_users));

      const res = await saveDailyMetric(fd);
      if (res.ok) savedIds.push(r.app_id);
      else failed++;
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    // Advance baseline for everything that saved -> those rows are clean again.
    setBaseline((b) => {
      const next = { ...b };
      for (const r of state) if (savedIds.includes(r.app_id)) next[r.app_id] = valsOf(r);
      return next;
    });
    setState((s) =>
      s.map((r) => (savedIds.includes(r.app_id) ? { ...r, exists: true } : r)),
    );
    setSaving(false);
    setFlash(
      failed === 0
        ? `Saved ${savedIds.length} ${savedIds.length === 1 ? "app" : "apps"}.`
        : `Saved ${savedIds.length}, ${failed} failed — check highlighted rows.`,
    );
    router.refresh();
  }

  function discard() {
    setState((s) => s.map((r) => ({ ...r, ...baseline[r.app_id] })));
    setFlash(null);
  }

  // Group rows by network (category), preserving index into `state`.
  const groups = useMemo(() => {
    const g: { name: string; indices: number[] }[] = [];
    state.forEach((r, i) => {
      let grp = g.find((x) => x.name === r.network_name);
      if (!grp) g.push((grp = { name: r.network_name, indices: [] }));
      grp.indices.push(i);
    });
    return g;
  }, [state]);

  return (
    <div className="pb-24">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-gray-50">
                <th className="th sticky left-0 z-20 bg-gray-50">App</th>
                <NumTh>AdMob $</NumTh>
                <NumTh>In-app $</NumTh>
                <NumTh>Spend $</NumTh>
                <NumTh>Installs</NumTh>
                <NumTh>Uninstalls</NumTh>
                <NumTh>Active</NumTh>
                <NumTh>Net</NumTh>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const sub = group.indices.reduce(
                  (a, i) => {
                    const r = state[i];
                    a.net +=
                      (Number(r.admob_revenue) || 0) +
                      (Number(r.inapp_revenue) || 0) -
                      (Number(r.campaign_spend) || 0);
                    return a;
                  },
                  { net: 0 },
                );
                const edited = group.indices.filter((i) =>
                  isDirty(valsOf(state[i]), baseline[state[i].app_id]),
                ).length;
                return (
                  <Fragment key={group.name}>
                    <tr>
                      <td
                        colSpan={7}
                        className="sticky left-0 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        {group.name}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {group.indices.length} apps
                        </span>
                        {edited > 0 && (
                          <span className="ml-2 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-medium text-gray-900">
                            {edited} edited
                          </span>
                        )}
                      </td>
                      <td className="bg-gray-900 px-3 py-2 text-right text-sm font-semibold text-white">
                        {money(sub.net)}
                      </td>
                    </tr>
                    {group.indices.map((i) => {
                      const r = state[i];
                      const dirty = isDirty(valsOf(r), baseline[r.app_id]);
                      const net =
                        (Number(r.admob_revenue) || 0) +
                        (Number(r.inapp_revenue) || 0) -
                        (Number(r.campaign_spend) || 0);
                      return (
                        <tr
                          key={r.app_id}
                          className={`group border-b border-gray-100 ${
                            dirty ? "bg-amber-50/60" : "hover:bg-brand-50/40"
                          }`}
                        >
                          <td
                            className={`td sticky left-0 max-w-[220px] truncate bg-white pl-6 font-medium group-hover:bg-brand-50/40 ${
                              dirty ? "!bg-amber-50/60" : ""
                            }`}
                          >
                            <span
                              className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                                dirty ? "bg-amber-500" : "bg-transparent"
                              }`}
                            />
                            {r.app_name}
                            {!r.exists && (
                              <span className="ml-2 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                                no entry
                              </span>
                            )}
                          </td>
                          <NumCell v={r.admob_revenue} money onChange={(v) => update(i, { admob_revenue: v ?? 0 })} />
                          <NumCell v={r.inapp_revenue} money onChange={(v) => update(i, { inapp_revenue: v ?? 0 })} />
                          <NumCell v={r.campaign_spend} money onChange={(v) => update(i, { campaign_spend: v ?? 0 })} />
                          <NumCell v={r.installs} onChange={(v) => update(i, { installs: v })} />
                          <NumCell v={r.uninstalls} onChange={(v) => update(i, { uninstalls: v })} />
                          <NumCell v={r.active_users} onChange={(v) => update(i, { active_users: v })} />
                          <td
                            className={`td text-right font-semibold ${
                              net < 0 ? "text-neg" : "text-gray-900"
                            }`}
                          >
                            {net.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single sticky action bar */}
      <div className="fixed bottom-0 left-60 right-0 z-30 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            {saving ? (
              <span>
                Saving… {progress.done}/{progress.total}
              </span>
            ) : dirtyIdx.length > 0 ? (
              <span className="font-medium text-amber-700">
                {dirtyIdx.length} unsaved {dirtyIdx.length === 1 ? "change" : "changes"}
              </span>
            ) : flash ? (
              <span className="font-medium text-pos">{flash}</span>
            ) : (
              <span className="text-gray-400">No unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost"
              onClick={discard}
              disabled={saving || dirtyIdx.length === 0}
            >
              Discard
            </button>
            <button
              className="btn-primary min-w-[140px]"
              onClick={saveAll}
              disabled={saving || dirtyIdx.length === 0}
            >
              {saving
                ? "Saving…"
                : dirtyIdx.length > 0
                  ? `Save ${dirtyIdx.length} ${dirtyIdx.length === 1 ? "change" : "changes"}`
                  : "Save all changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumTh({ children }: { children: React.ReactNode }) {
  return <th className="th text-right">{children}</th>;
}

function NumCell({
  v,
  onChange,
  money,
}: {
  v: number | null | undefined;
  onChange: (v: number | null) => void;
  money?: boolean;
}) {
  return (
    <td className="td p-1 text-right">
      <input
        type="number"
        step={money ? "0.01" : "1"}
        inputMode="decimal"
        className="w-24 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right tabular-nums outline-none hover:border-gray-200 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        value={v ?? ""}
        placeholder={money ? "0.00" : "—"}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </td>
  );
}
