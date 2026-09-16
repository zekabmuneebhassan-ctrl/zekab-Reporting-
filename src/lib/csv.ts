/** Minimal RFC-4180 CSV encoder — quotes a field only when it needs it. */
function csvField(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends object>(
  columns: readonly { key: keyof T & string; label: string }[],
  rows: T[],
): string {
  const header = columns.map((c) => csvField(c.label)).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => csvField(r[c.key])).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}
