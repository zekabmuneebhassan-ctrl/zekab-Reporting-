import type { PullResult, DateRange } from "./types";
import { defaultRange } from "./types";

/**
 * Google Ads campaign spend -> daily_metrics.campaign_spend (source='google_ads_api').
 * Secondary. Requires: MCC (manager) account, developer token (API Center),
 * OAuth2. New tokens start at Test Access; apply for Basic Access (15k ops/day)
 * for production reporting — enough for a reporting-only dashboard.
 *
 * Query via GoogleAdsService.SearchStream:
 *   SELECT segments.date, campaign.name, metrics.cost_micros
 *   FROM campaign WHERE segments.date BETWEEN '<from>' AND '<to>'
 * cost = cost_micros / 1_000_000. Map campaigns to apps by a label/naming
 * convention you control.
 */
export async function pullGoogleAds(
  range: DateRange = defaultRange(),
): Promise<PullResult> {
  const {
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  } = process.env;

  if (
    !GOOGLE_ADS_DEVELOPER_TOKEN ||
    !GOOGLE_ADS_CLIENT_ID ||
    !GOOGLE_ADS_CLIENT_SECRET ||
    !GOOGLE_ADS_REFRESH_TOKEN ||
    !GOOGLE_ADS_LOGIN_CUSTOMER_ID
  ) {
    return {
      source: "google_ads",
      configured: false,
      rowsUpserted: 0,
      message: "Google Ads not configured — set GOOGLE_ADS_* env vars.",
    };
  }

  // TODO: implement SearchStream query + cost_micros mapping.
  return {
    source: "google_ads",
    configured: true,
    rowsUpserted: 0,
    message: "Google Ads configured but pull not yet implemented (TODO in googleAds.ts).",
    from: range.from,
    to: range.to,
  };
}
