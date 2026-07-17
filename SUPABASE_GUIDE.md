# Supabase setup — step by step

Everything you do inside Supabase to get the dashboard live. Plain-English, in
order. You do **not** need Docker or the CLI — the web dashboard is enough.

Total time: ~15 minutes. Do the steps in order; each depends on the last.

---

## 0. What you'll end up with

- A Postgres database with the schema, security rules, and your existing
  workbook data loaded.
- A login for yourself as **admin**.
- Three keys copied into the app's `.env` file so Next.js can talk to Supabase.

Keep a scratch note open — you'll copy **3 values** and **1 password** along the way.

---

## 1. Create the project

1. Go to **https://supabase.com** → sign in → **New project**.
2. Fill in:
   - **Name:** `gaming-apps-dashboard` (anything).
   - **Database Password:** click **Generate**, then **save it** somewhere safe.
     (You rarely need it, but you can't see it again later.)
   - **Region:** pick the one closest to you / your team.
3. Click **Create new project** and wait ~2 minutes for it to finish
   provisioning (the status dot goes green).

---

## 2. Copy your 3 keys into `.env`

1. In the project, open **Project Settings** (gear, bottom-left) → **API**.
2. Copy these three values into the app's `.env` file (make it from
   `.env.example` if you haven't):

   | Supabase field | `.env` variable |
   |---|---|
   | **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
   | **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | **Project API keys → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ The **service_role** key bypasses all security. Never put it in frontend
> code or commit it. It lives only in `.env` (already git-ignored) and is used
> by the import script and the automation cron jobs.

---

## 3. Run the migrations (creates the tables + security)

The **SQL Editor** (left sidebar, `</>` icon) is where you paste and run SQL.
Run these **three files in order**, one at a time. For each: open the file from
this repo, copy its entire contents, paste into a new query, click **Run**
(or Ctrl/Cmd+Enter). You should see "Success. No rows returned".

1. `supabase/migrations/0001_init.sql` — tables, generated columns, triggers.
2. `supabase/migrations/0002_rls.sql` — Row-Level Security policies.
3. `supabase/migrations/0003_functions.sql` — helper functions the app calls.

> Order matters — `0002` and `0003` reference things `0001` creates. If you run
> one out of order you'll get a "relation does not exist" error; just run the
> earlier file first, then re-run.

**Check it worked:** left sidebar → **Table Editor**. You should see empty
tables: `networks`, `apps`, `daily_metrics`, `twelve_hour_reports`,
`user_roles`.

---

## 4. Load your workbook data (the seed)

1. SQL Editor → new query.
2. Open `supabase/seed.sql` from this repo, copy **all** of it, paste, **Run**.
   (It's ~1,400 lines — 3 networks, 55 apps, 1,331 daily rows. Takes a few seconds.)
3. It's wrapped in `begin; … commit;` and uses "upsert", so it's **safe to
   re-run** — running twice won't create duplicates.

**Check it worked** — SQL Editor, run:
```sql
select n.name, count(*) rows, round(sum(d.admob_revenue),2) admob
from daily_metrics d
join apps a on a.id = d.app_id
join networks n on n.id = a.network_id
group by n.name order by n.name;
```
You should get: **Alpha Games** 80 / 11.39 · **GamesLobby** 684 / 61.37 ·
**JoinTech** 567 / 17.86. These match the workbook.

> Prefer not to paste SQL? Instead run
> `python scripts/import_workbook.py --push` from your machine (needs the two
> env vars from step 2 set, plus `pip install requests`). Same result.

---

## 5. Create your login and make yourself admin

1. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter **your email + a password**, and tick **Auto Confirm User** (so you can
   log in immediately without an email link). Click **Create user**.
3. Because of a trigger in the schema, you now have a `user_roles` row set to
   **viewer**. Promote yourself to **admin** — SQL Editor, run (use your email):
   ```sql
   update public.user_roles set role = 'admin'
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```
4. **Check:** `select * from user_roles;` → your row should say `admin`.

---

## 6. (Optional) Turn off public sign-ups

So only people you add can get in:

- **Authentication** → **Providers** → **Email** → turn **off** "Enable Sign
  ups" (or under **Authentication → Sign In / Providers**, depending on the
  dashboard version). Then you invite staff via **Add user** in step 5, and they
  land as `viewer` until you change their role in the app's **Users & roles**
  screen.

Confirm-email settings live in **Authentication → Emails**; with a small team,
using **Auto Confirm** when you add each user is simplest.

---

## 7. Run the app and log in

On a machine with **Node 18.17+**:
```bash
npm install
npm run dev
```
Open http://localhost:3000, sign in with the email/password from step 5. You'll
land on the daily dashboard with your imported data.

---

## 8. Later: automation credentials (phase 7)

When you're ready to automate pulls, you'll add more keys to `.env`
(`ADMOB_*`, `PLAY_*`, `GOOGLE_ADS_*`, `CRON_SECRET`) and, if deploying on Vercel,
set the same variables in **Vercel → Project → Settings → Environment
Variables**. Set `CRON_SECRET` there too — Vercel Cron sends it automatically to
protect `/api/cron/pull`. Details in `src/lib/integrations/README.md`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "relation ... does not exist" running a migration | You ran files out of order — run `0001` first, then `0002`, `0003`. |
| Logged in but every screen is empty / read-only | Your `user_roles.role` is still `viewer`. Re-run the step-5 promote query. |
| "new row violates row-level security policy" when saving | You're an `editor` scoped to a network and tried to edit another network's app, or your role row is missing. Check `select * from user_roles`. |
| Seed says success but dashboard is empty | The app defaults to the **latest date with data**. Use the date picker, or confirm step 4's check query returns rows. |
| Import totals don't match the workbook | Run `python scripts/import_workbook.py --verify-only` and compare to the summary sheet before pushing. |
