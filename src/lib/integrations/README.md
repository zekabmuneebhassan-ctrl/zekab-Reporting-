# Phase 7 — Automated data pulls

These modules are **scaffolds**, wired into cron routes but returning "not
configured" until you supply credentials in `.env` and implement the marked
`TODO` calls. Ship phases 1–6 (manual entry) first; layer these in one at a
time, each verified against a few days of manual numbers before you trust it.

> Google changes these programs. Re-check the current docs before wiring the
> real calls — the notes below were accurate mid-2026.

| Source | Fills | Auth model | Gate |
|---|---|---|---|
| AdMob | `admob_revenue` | User-consent OAuth2 (no service accounts). Store & refresh one user's refresh token. Scope `admob.readonly`. | None — just OAuth consent |
| Play Console | `installs`, `uninstalls`, `active_users` | GCS export bucket + service account (service accounts OK here) | One-time export setup |
| Google Ads | `campaign_spend` | Developer token + OAuth2, MCC account | Basic Access review (days–weeks) |

## Order of wiring
1. **AdMob** — least gated. `accounts.networkReport.generate`, dimensions
   `DATE`+`APP`, metric `ESTIMATED_EARNINGS`.
2. **Play Console** — enable daily CSV export to a GCS bucket (Play Console →
   Download reports / API access), then read those CSVs on a schedule. The Play
   *Developer Reporting API* covers vitals (crashes/ANRs), **not** installs — do
   not build against it for install counts.
3. **Google Ads** — apply for Basic Access in parallel; wire last. Reporting-only
   use (`GoogleAdsService.SearchStream`, `metrics.cost_micros`).

## How they run
`/api/cron/pull?source=admob|play|google_ads` — protected by `CRON_SECRET`.
Schedule via `vercel.json` crons (included) or Supabase scheduled Edge Functions.
Each integration upserts into the same tables with `source` set to
`admob_api` / `play_console` / `google_ads_api`, so the dashboard shows
provenance and manual rows are never silently overwritten by a different source
without you seeing the badge.
