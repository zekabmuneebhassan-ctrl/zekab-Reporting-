export function money(n: number | null | undefined): string {
  const v = n ?? 0;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function int(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

/**
 * Percentage change from `prev` to `curr`.
 * Returns null when there is no valid baseline (prev missing) so callers can show
 * "no data yet" instead of a misleading 0% — see acceptance check #4.
 */
export function pctChange(
  curr: number | null | undefined,
  prev: number | null | undefined,
): number | null {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return curr && curr !== 0 ? null : 0;
  return (((curr ?? 0) - prev) / Math.abs(prev)) * 100;
}

export function fmtPct(p: number | null): string {
  if (p === null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** YYYY-MM-DD in local time (avoids UTC off-by-one from toISOString). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
