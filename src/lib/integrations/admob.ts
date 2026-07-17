import { createServiceClient } from "@/lib/supabase/server";
import type { PullResult, DateRange } from "./types";
import { defaultRange } from "./types";

/**
 * AdMob revenue pull. Fills daily_metrics.admob_revenue (source='admob_api').
 *
 * Auth: user-consent OAuth2 only — NO service accounts. One team member
 * authorizes once; we store their refresh token (ADMOB_REFRESH_TOKEN, a secret)
 * and exchange it for access tokens here.
 *
 * Report: POST accounts/{publisherId}/networkReport:generate with
 *   dimensions: ["DATE","APP"], metrics: ["ESTIMATED_EARNINGS"],
 *   dateRange from/to. Hourly granularity is available up to 28 days back if
 *   you later want to feed the 12-hour report.
 */
export async function pullAdMob(range: DateRange = defaultRange()): Promise<PullResult> {
  const { ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET, ADMOB_REFRESH_TOKEN, ADMOB_PUBLISHER_ID } =
    process.env;

  if (!ADMOB_CLIENT_ID || !ADMOB_CLIENT_SECRET || !ADMOB_REFRESH_TOKEN || !ADMOB_PUBLISHER_ID) {
    return {
      source: "admob",
      configured: false,
      rowsUpserted: 0,
      message: "AdMob not configured — set ADMOB_* env vars.",
    };
  }

  // 1) Exchange refresh token -> access token.
  // const accessToken = await refreshAccessToken(ADMOB_CLIENT_ID, ADMOB_CLIENT_SECRET, ADMOB_REFRESH_TOKEN);

  // 2) Call the AdMob networkReport endpoint.
  //    const report = await fetch(
  //      `https://admob.googleapis.com/v1/accounts/${ADMOB_PUBLISHER_ID}/networkReport:generate`,
  //      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
  //        body: JSON.stringify({ reportSpec: {
  //          dateRange: toGoogleDateRange(range),
  //          dimensions: ["DATE","APP"], metrics: ["ESTIMATED_EARNINGS"],
  //        }})});

  // 3) Map each (date, app) row -> daily_metrics upsert, matching apps by
  //    package_name. Use createServiceClient() (bypasses RLS) for the write.
  const _supabase = createServiceClient();
  void _supabase;

  // TODO: implement the fetch + mapping above.
  return {
    source: "admob",
    configured: true,
    rowsUpserted: 0,
    message: "AdMob configured but pull not yet implemented (TODO in admob.ts).",
    from: range.from,
    to: range.to,
  };
}
