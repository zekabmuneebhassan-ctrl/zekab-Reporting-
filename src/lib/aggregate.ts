import type { MetricJoinRow } from "@/lib/queries";

export interface Totals {
  admob: number;
  inapp: number;
  spend: number;
  net: number;
  installs: number;
  uninstalls: number;
  activeUsers: number;
}

export function emptyTotals(): Totals {
  return {
    admob: 0,
    inapp: 0,
    spend: 0,
    net: 0,
    installs: 0,
    uninstalls: 0,
    activeUsers: 0,
  };
}

export function sum(rows: MetricJoinRow[]): Totals {
  return rows.reduce<Totals>((t, r) => {
    t.admob += r.admob_revenue;
    t.inapp += r.inapp_revenue;
    t.spend += r.campaign_spend;
    t.net += r.net;
    t.installs += r.installs ?? 0;
    t.uninstalls += r.uninstalls ?? 0;
    t.activeUsers += r.active_users ?? 0;
    return t;
  }, emptyTotals());
}

export interface Group<K> {
  key: K;
  label: string;
  totals: Totals;
}

function groupBy<K extends string>(
  rows: MetricJoinRow[],
  keyFn: (r: MetricJoinRow) => { key: K; label: string },
): Group<K>[] {
  const map = new Map<K, Group<K>>();
  for (const r of rows) {
    const { key, label } = keyFn(r);
    let g = map.get(key);
    if (!g) {
      g = { key, label, totals: emptyTotals() };
      map.set(key, g);
    }
    g.totals.admob += r.admob_revenue;
    g.totals.inapp += r.inapp_revenue;
    g.totals.spend += r.campaign_spend;
    g.totals.net += r.net;
    g.totals.installs += r.installs ?? 0;
    g.totals.uninstalls += r.uninstalls ?? 0;
    g.totals.activeUsers += r.active_users ?? 0;
  }
  return [...map.values()].sort((a, b) => b.totals.net - a.totals.net);
}

export function byNetwork(rows: MetricJoinRow[]) {
  return groupBy(rows, (r) => ({
    key: r.network_id,
    label: r.network_name,
  }));
}

export function byApp(rows: MetricJoinRow[]) {
  return groupBy(rows, (r) => ({ key: r.app_id, label: r.app_name }));
}

/** Trend series keyed by date, sorted ascending. */
export function byDate(rows: MetricJoinRow[]) {
  const groups = groupBy(rows, (r) => ({ key: r.date as string, label: r.date }));
  return groups
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((g) => ({
      date: g.key.slice(5), // MM-DD
      admob: round(g.totals.admob),
      spend: round(g.totals.spend),
      net: round(g.totals.net),
    }));
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
