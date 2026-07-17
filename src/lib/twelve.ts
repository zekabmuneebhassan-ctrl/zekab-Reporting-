import { createClient } from "@/lib/supabase/server";
import type { TwelveHourSlot } from "@/lib/types";

export interface TwelveRow {
  app_id: string;
  app_name: string;
  network_name: string;
  report_date: string;
  slot: TwelveHourSlot;
  cutoff_time: string;
  admob_revenue: number;
  google_ads_spend: number;
  net: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** All 12-hour reports for a given date and slot (first/second half). */
export async function getTwelveHour(
  date: string,
  slot: TwelveHourSlot,
): Promise<TwelveRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("twelve_hour_reports")
    .select(
      "app_id, report_date, slot, cutoff_time, admob_revenue, google_ads_spend, net, apps!inner(name, networks!inner(name))",
    )
    .eq("report_date", date)
    .eq("slot", slot);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    app_id: r.app_id,
    app_name: r.apps?.name ?? "",
    network_name: r.apps?.networks?.name ?? "",
    report_date: r.report_date,
    slot: r.slot,
    cutoff_time: r.cutoff_time,
    admob_revenue: Number(r.admob_revenue),
    google_ads_spend: Number(r.google_ads_spend),
    net: Number(r.net),
  }));
}

export const SLOT_LABEL: Record<TwelveHourSlot, string> = {
  first: "First half · 12 AM–12 PM",
  second: "Second half · 12 PM–12 AM",
};
