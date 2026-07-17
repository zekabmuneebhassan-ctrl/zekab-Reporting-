"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { TwelveHourSlot } from "@/lib/types";

const OPTIONS: { value: TwelveHourSlot; label: string }[] = [
  { value: "first", label: "First half" },
  { value: "second", label: "Second half" },
];

/** Segmented control that switches ?slot= while preserving the date. */
export function SlotToggle({ value }: { value: TwelveHourSlot }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("slot", o.value);
              router.push(`${pathname}?${next.toString()}`);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
