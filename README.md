# Gaming Apps Revenue & Ad-Spend Dashboard

Web dashboard that replaces the manually-maintained `Summary Gaming Apps.xlsx`
workbook: tracks AdMob revenue, in-app revenue, campaign spend, net profit,
installs/uninstalls and active users **per app and per network**, rolled up
daily and monthly — plus a same-day 12-hour reporting cycle, multi-user roles,
and (later) automated pulls from AdMob, Google Play Console and Google Ads.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase
(Postgres + Auth + Row-Level Security) · Recharts.

> **Node 18.17+ required.** This machine has Node 16 — `npm run dev` will not
> start until Node is upgraded. Everything deploys to Vercel regardless, and the
> Python import script runs fine on the current setup.

---

## 1. Project layout

```
supabase/migrations/     0001 schema · 0002 RLS · 0003 RPCs   ← run these in order
scripts/import_workbook.py   one-time Excel → Postgres import (+ verifier)
src/lib/                 supabase clients, auth, queries, aggregation, actions
src/lib/integrations/    phase-7 automation scaffolds (AdMob/Play/Google Ads)
src/components/          nav, charts, tables, pickers
src/app/(app)/           dashboard · monthly · twelve-hour · entry · import · admin
src/app/api/cron/pull/   scheduled data-pull endpoint (CRON_SECRET-protected)
```

## 2. Setup

1. **Create a Supabase project** → copy Project URL + anon key + service-role key.
2. `cp .env.example .env` and fill in the three Supabase values.
3. **Run the migrations** in the Supabase SQL editor (or `supabase db push`), in
   order: `0001_init.sql`, `0002_rls.sql`, `0003_functions.sql`.
4. **Create your admin user** in Supabase → Authentication → Users. Every new
   user is auto-assigned `viewer`; promote yourself to `admin`:
   ```sql
   update public.user_roles set role='admin'
   where user_id = (select id from auth.users where email='you@example.com');
   ```
5. **Install & run** (Node 18+): `npm install && npm run dev` → http://localhost:3000

## 3. Import the existing workbook

```bash
# Verify parsed totals first (no DB needed) — should match the old summary sheets:
python scripts/import_workbook.py --verify-only

# Option A: emit SQL, then paste seed_generated.sql into the Supabase SQL editor
python scripts/import_workbook.py --emit-sql

# Option B: push straight to Supabase (needs NEXT_PUBLIC_SUPABASE_URL +
#           SUPABASE_SERVICE_ROLE_KEY in the environment, and `pip install requests`)
python scripts/import_workbook.py --push
```

Only the **raw** sheets are imported; the `Summary - <Month>` sheets are derived
and the dashboard recomputes them. Verified parity: June AdMob grand total
**$71.61** matches the workbook's own summary column to the cent.

## 4. Roles (enforced in Postgres, not just the UI)

| Role | Can |
|---|---|
| **admin** | everything: manage users/roles, add/remove networks & apps, edit all data |
| **editor** | enter/edit daily metrics & 12-hour reports (optionally scoped to specific networks via `network_scope`) |
| **viewer** | read-only dashboards & reports; no data-entry screens |

RLS policies (`0002_rls.sql`) check every `select`/`insert`/`update` against
`user_roles` server-side. An editor scoped to one network **cannot read or write
another network's rows even by calling the REST API directly** — the UI hiding a
button is not the security boundary.

Default is **blanket editors** (every editor edits all networks). To scope an
editor, set their networks in Admin → Users & roles; the same RLS already
enforces it.

## 5. Screens

- **Daily dashboard** — date picker, KPI cards with day-over-day + MTD, trend
  chart, net-by-network bar, per-network and per-app tables with "last edited
  by" audit tooltips.
- **Monthly summary** — replaces the `Summary - <Month>` sheets; network columns
  are generated **dynamically** from whatever's in the `networks` table.
- **12-hour report** — entry form + today-vs-yesterday comparison. Shows
  "no data yet" (never a false 0%) when yesterday's slot is missing.
- **Data entry** — editable daily grid per app, prefilled from existing rows.
- **Bulk import** — CSV paste/upload with preview and app-name matching.
- **Admin: Users & roles** — assign role + network scope.
- **Admin: Networks & apps** — add networks/apps with zero code changes.

## 6. Phase 7 automation

Scaffolded in `src/lib/integrations/` and wired to `/api/cron/pull` +
`vercel.json` crons — see that folder's README. Ship manual entry first; add
AdMob → Play Console → Google Ads one at a time, each verified against a few days
of manual numbers before trusting it.

## 7. Acceptance checks

- [ ] Monthly summary matches the old `Summary - <Month>` sheet for a full month,
      to the cent. *(Import verified June = $71.61.)*
- [ ] Adding a brand-new network needs **zero code** — just Admin → Networks.
- [ ] A test editor scoped to one network cannot see/edit another network's data,
      verified by hitting the Supabase REST API directly, not just the UI.
- [ ] The 12-hour comparison shows "no data yet" (not 0%) when yesterday's
      same-slot report is missing.
