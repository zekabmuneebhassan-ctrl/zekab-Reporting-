import type { PullResult, DateRange } from "./types";
import { defaultRange } from "./types";

/**
 * Google Play Console installs/uninstalls/active users.
 *
 * There is NO REST reporting endpoint for install counts. Enable the daily CSV
 * export (Play Console → Download reports / API access) into a GCS bucket you
 * own; a service account CAN read that bucket (unlike AdMob). This job reads the
 * install/uninstall CSVs for the range and upserts daily_metrics
 * (installs, uninstalls, active_users), source='play_console'.
 *
 * Do NOT use the Play Developer Reporting API for installs — it only covers
 * vitals (crashes/ANRs/ratings).
 */
export async function pullPlayConsole(
  range: DateRange = defaultRange(),
): Promise<PullResult> {
  const { PLAY_GCS_BUCKET, GOOGLE_APPLICATION_CREDENTIALS_JSON } = process.env;

  if (!PLAY_GCS_BUCKET || !GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return {
      source: "play_console",
      configured: false,
      rowsUpserted: 0,
      message:
        "Play Console not configured — set PLAY_GCS_BUCKET and GOOGLE_APPLICATION_CREDENTIALS_JSON.",
    };
  }

  // TODO:
  // 1) Auth to GCS with the service-account JSON.
  // 2) List/read objects under stats/installs/ for the month(s) in range,
  //    e.g. installs_<package>_<YYYYMM>_overview.csv.
  // 3) Parse rows (Date, Daily Device Installs, Daily Device Uninstalls,
  //    Active Device Installs) and upsert daily_metrics matched by package_name.
  return {
    source: "play_console",
    configured: true,
    rowsUpserted: 0,
    message: "Play Console configured but pull not yet implemented (TODO in playConsole.ts).",
    from: range.from,
    to: range.to,
  };
}
