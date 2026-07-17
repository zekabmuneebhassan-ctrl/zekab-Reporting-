#!/usr/bin/env python3
"""
One-time importer: reads the raw daily sheets from `Summary Gaming Apps.xlsx`
and loads them into the Supabase schema (networks, apps, daily_metrics).

Summary sheets are IGNORED on purpose — they are derived data the dashboard
recomputes (see brief §4 "Import plan").

Two modes:
  --emit-sql   Write an idempotent seed_generated.sql you can run in the
               Supabase SQL editor. (Default, needs no network access.)
  --push       Insert directly into Supabase via the REST API using
               SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Requires `requests`
               and env vars NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

Always prints a verification report: per-network and grand totals, so you can
confirm the numbers match the old workbook to the cent before trusting the DB.

Usage:
  python scripts/import_workbook.py                 # verify + emit SQL
  python scripts/import_workbook.py --verify-only   # just print totals
  python scripts/import_workbook.py --push          # verify + insert to Supabase
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

import openpyxl

# Sheets that are summaries (derived) — never imported.
SUMMARY_PREFIX = "Summary"

# Canonical header -> our field. We match by header text (positions vary between
# sheets, e.g. "Alpha Games" has an extra "Active Devices" column).
HEADER_MAP = {
    "active users": "active_users",
    "install": "installs",
    "unistall": "uninstalls",   # sic — the workbook misspells "Uninstall"
    "uninstall": "uninstalls",
    "revenue": "admob_revenue",
    "inapp": "inapp_revenue",
    "campaign": "campaign_spend",
    # "gain/loss" and "net" are generated columns in Postgres — skip.
    # "active devices" — not modeled — skip.
}

INT_FIELDS = {"active_users", "installs", "uninstalls"}
MONEY_FIELDS = {"admob_revenue", "inapp_revenue", "campaign_spend"}


@dataclass
class MetricRow:
    network: str
    app: str
    date: date
    active_users: int | None = None
    installs: int | None = None
    uninstalls: int | None = None
    admob_revenue: Decimal = Decimal(0)
    inapp_revenue: Decimal = Decimal(0)
    campaign_spend: Decimal = Decimal(0)

    @property
    def net(self) -> Decimal:
        return self.admob_revenue + self.inapp_revenue - self.campaign_spend


def to_int(v):
    if v is None or v == "":
        return None
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        return None


def to_money(v) -> Decimal:
    if v is None or v == "":
        return Decimal(0)
    try:
        return Decimal(str(v)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def parse_workbook(path: str) -> list[MetricRow]:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows: list[MetricRow] = []

    for ws in wb.worksheets:
        if ws.title.strip().lower().startswith(SUMMARY_PREFIX.lower()):
            continue

        network = ws.title.strip()
        data = list(ws.iter_rows(values_only=True))
        if not data:
            continue

        # Build a header index by lowercased header text.
        header = data[0]
        col_field: dict[int, str] = {}
        for idx, h in enumerate(header):
            if h is None:
                continue
            key = str(h).strip().lower()
            if key in HEADER_MAP:
                col_field[idx] = HEADER_MAP[key]
        # Column 0 = Date, column 1 = App name (the network name is the header).
        for raw in data[1:]:
            if not raw or raw[0] is None:
                continue
            d = raw[0]
            if not isinstance(d, datetime):
                continue
            app_name = raw[1]
            if not app_name or str(app_name).strip() == "":
                continue

            row = MetricRow(network=network, app=str(app_name).strip(), date=d.date())
            for idx, field in col_field.items():
                if idx >= len(raw):
                    continue
                val = raw[idx]
                if field in INT_FIELDS:
                    setattr(row, field, to_int(val))
                elif field in MONEY_FIELDS:
                    setattr(row, field, to_money(val))
            rows.append(row)

    return rows


def verify(rows: list[MetricRow]) -> None:
    by_net = defaultdict(lambda: {"admob": Decimal(0), "inapp": Decimal(0),
                                  "camp": Decimal(0), "net": Decimal(0), "rows": 0,
                                  "apps": set()})
    for r in rows:
        b = by_net[r.network]
        b["admob"] += r.admob_revenue
        b["inapp"] += r.inapp_revenue
        b["camp"] += r.campaign_spend
        b["net"] += r.net
        b["rows"] += 1
        b["apps"].add(r.app)

    print("\n================ IMPORT VERIFICATION ================")
    print(f"{'Network':<16}{'Apps':>6}{'Rows':>7}{'AdMob':>12}{'InApp':>10}"
          f"{'Campaign':>12}{'Net':>12}")
    print("-" * 75)
    tot = {"admob": Decimal(0), "inapp": Decimal(0), "camp": Decimal(0),
           "net": Decimal(0), "rows": 0}
    for net in sorted(by_net):
        b = by_net[net]
        print(f"{net:<16}{len(b['apps']):>6}{b['rows']:>7}"
              f"{float(b['admob']):>12.2f}{float(b['inapp']):>10.2f}"
              f"{float(b['camp']):>12.2f}{float(b['net']):>12.2f}")
        for k in ("admob", "inapp", "camp", "net"):
            tot[k] += b[k]
        tot["rows"] += b["rows"]
    print("-" * 75)
    print(f"{'GRAND TOTAL':<16}{'':>6}{tot['rows']:>7}"
          f"{float(tot['admob']):>12.2f}{float(tot['inapp']):>10.2f}"
          f"{float(tot['camp']):>12.2f}{float(tot['net']):>12.2f}")
    dates = [r.date for r in rows]
    print(f"\nDate range: {min(dates)} -> {max(dates)}   total rows: {len(rows)}")
    print("Compare these grand totals against the workbook's summary sheets.")
    print("====================================================\n")


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def emit_sql(rows: list[MetricRow], out_path: str) -> None:
    networks = sorted({r.network for r in rows})
    apps = sorted({(r.network, r.app) for r in rows})

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("-- Generated by scripts/import_workbook.py — safe to re-run.\n")
        f.write("begin;\n\n")

        f.write("-- Networks\n")
        for n in networks:
            f.write(
                f"insert into public.networks (name, platform) values "
                f"({sql_str(n)}, 'Android') on conflict (name) do nothing;\n"
            )

        f.write("\n-- Apps\n")
        for net, app in apps:
            f.write(
                "insert into public.apps (network_id, name) select n.id, "
                f"{sql_str(app)} from public.networks n where n.name = {sql_str(net)} "
                "on conflict (network_id, name) do nothing;\n"
            )

        f.write("\n-- Daily metrics\n")
        for r in rows:
            au = "null" if r.active_users is None else r.active_users
            ins = "null" if r.installs is None else r.installs
            un = "null" if r.uninstalls is None else r.uninstalls
            f.write(
                "insert into public.daily_metrics "
                "(app_id, date, active_users, installs, uninstalls, "
                "admob_revenue, inapp_revenue, campaign_spend, source) "
                "select a.id, "
                f"'{r.date.isoformat()}', {au}, {ins}, {un}, "
                f"{r.admob_revenue}, {r.inapp_revenue}, {r.campaign_spend}, 'manual' "
                "from public.apps a join public.networks n on n.id = a.network_id "
                f"where n.name = {sql_str(r.network)} and a.name = {sql_str(r.app)} "
                "on conflict (app_id, date) do update set "
                "active_users = excluded.active_users, installs = excluded.installs, "
                "uninstalls = excluded.uninstalls, admob_revenue = excluded.admob_revenue, "
                "inapp_revenue = excluded.inapp_revenue, "
                "campaign_spend = excluded.campaign_spend;\n"
            )
        f.write("\ncommit;\n")
    print(f"Wrote {out_path}  ({len(rows)} daily_metrics upserts, "
          f"{len(networks)} networks, {len(apps)} apps).")


def push(rows: list[MetricRow]) -> None:
    try:
        import requests  # noqa
    except ImportError:
        sys.exit("`requests` not installed. Run: pip install requests")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to --push.")

    import requests
    base = url.rstrip("/") + "/rest/v1"
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}

    # 1) Networks
    networks = sorted({r.network for r in rows})
    requests.post(f"{base}/networks?on_conflict=name",
                  headers=hdr, json=[{"name": n, "platform": "Android"} for n in networks]
                  ).raise_for_status()
    net_ids = {n["name"]: n["id"] for n in
               requests.get(f"{base}/networks?select=id,name", headers=hdr).json()}

    # 2) Apps
    apps = sorted({(r.network, r.app) for r in rows})
    requests.post(f"{base}/apps?on_conflict=network_id,name", headers=hdr,
                  json=[{"network_id": net_ids[net], "name": app} for net, app in apps]
                  ).raise_for_status()
    app_ids = {(a["network_id"], a["name"]): a["id"] for a in
               requests.get(f"{base}/apps?select=id,network_id,name", headers=hdr).json()}

    # 3) Daily metrics (chunked)
    payload = []
    for r in rows:
        aid = app_ids[(net_ids[r.network], r.app)]
        payload.append({
            "app_id": aid, "date": r.date.isoformat(),
            "active_users": r.active_users, "installs": r.installs,
            "uninstalls": r.uninstalls, "admob_revenue": float(r.admob_revenue),
            "inapp_revenue": float(r.inapp_revenue),
            "campaign_spend": float(r.campaign_spend), "source": "manual",
        })
    for i in range(0, len(payload), 500):
        chunk = payload[i:i + 500]
        resp = requests.post(f"{base}/daily_metrics?on_conflict=app_id,date",
                             headers=hdr, json=chunk)
        resp.raise_for_status()
        print(f"  pushed rows {i}..{i + len(chunk)}")
    print(f"Pushed {len(payload)} daily_metrics to Supabase.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workbook", default=os.environ.get(
        "IMPORT_WORKBOOK_PATH", "Summary Gaming Apps.xlsx"))
    ap.add_argument("--emit-sql", action="store_true")
    ap.add_argument("--out", default="seed_generated.sql")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(args.workbook):
        sys.exit(f"Workbook not found: {args.workbook}")

    rows = parse_workbook(args.workbook)
    verify(rows)

    if args.verify_only:
        return
    if args.push:
        push(rows)
    else:
        emit_sql(rows, args.out)  # default action


if __name__ == "__main__":
    main()
