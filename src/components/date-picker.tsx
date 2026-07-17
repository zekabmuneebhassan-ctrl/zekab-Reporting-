"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/** Navigates to ?date=YYYY-MM-DD on the current route. */
export function DatePicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <input
      type="date"
      className="input w-auto"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("date", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
    />
  );
}

/** Navigates to ?month=YYYY-MM. */
export function MonthPicker({
  value,
  options,
}: {
  value: string;
  options: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const opts = options.includes(value) ? options : [value, ...options];

  return (
    <select
      className="input w-auto"
      value={value}
      onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
    >
      {opts.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
