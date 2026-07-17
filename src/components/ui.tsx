import { fmtPct, money } from "@/lib/format";

/** Colored +/- delta badge. Renders "—" (muted) when change is null. */
export function Delta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={`chip gap-0.5 ${
        up ? "bg-green-50 text-pos" : "bg-red-50 text-neg"
      }`}
    >
      {up ? "▲" : "▼"} {fmtPct(pct)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  accent = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  accent?: "brand" | "pos" | "neg" | "slate";
}) {
  const bar = {
    brand: "bg-brand-500",
    pos: "bg-pos",
    neg: "bg-neg",
    slate: "bg-gray-400",
  }[accent];
  return (
    <div className="card relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </div>
        {delta !== undefined && <Delta pct={delta} />}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export function MoneyCell({ v }: { v: number }) {
  const cls = v < 0 ? "text-neg" : v > 0 ? "text-gray-900" : "text-gray-400";
  return <span className={`tabular-nums ${cls}`}>{money(v)}</span>;
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      <div className="text-sm text-gray-400">{message}</div>
    </div>
  );
}
