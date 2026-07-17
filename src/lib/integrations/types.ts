export interface PullResult {
  source: string;
  configured: boolean;
  rowsUpserted: number;
  message: string;
  from?: string;
  to?: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

/** Default: yesterday through today (AdMob estimates settle over a day or two). */
export function defaultRange(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 2);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(today) };
}
