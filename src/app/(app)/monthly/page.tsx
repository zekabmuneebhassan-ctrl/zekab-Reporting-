import { requireUser } from "@/lib/auth";
import { getMetricsRange, getAvailableMonths, getLatestDate } from "@/lib/queries";
import type { MetricJoinRow } from "@/lib/queries";
import { money, monthLabel, isoDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";
import { MonthPicker } from "@/components/date-picker";

export const dynamic = "force-dynamic";

interface Cell {
  admob: number;
  inapp: number;
  spend: number;
  net: number;
}
const zero = (): Cell => ({ admob: 0, inapp: 0, spend: 0, net: 0 });
function add(c: Cell, r: MetricJoinRow) {
  c.admob += r.admob_revenue;
  c.inapp += r.inapp_revenue;
  c.spend += r.campaign_spend;
  c.net += r.net;
}

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { from: `${ym}-01`, to: isoDate(new Date(y, m, 0)) };
}

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  await requireUser();
  const months = await getAvailableMonths();
  const latest = await getLatestDate();
  const ym =
    searchParams.month ??
    months[0] ??
    (latest ? latest.slice(0, 7) : isoDate(new Date()).slice(0, 7));

  const { from, to } = monthBounds(ym);
  const rows = await getMetricsRange(from, to);

  // Networks present this month — dynamic, no hardcoded column set.
  const networkNames = Array.from(
    new Map(rows.map((r) => [r.network_id, r.network_name])).values(),
  ).sort();

  // date -> network -> Cell, plus grand total per date.
  const byDate = new Map<string, { nets: Map<string, Cell>; grand: Cell }>();
  for (const r of rows) {
    let d = byDate.get(r.date);
    if (!d) {
      d = { nets: new Map(), grand: zero() };
      byDate.set(r.date, d);
    }
    let c = d.nets.get(r.network_name);
    if (!c) {
      c = zero();
      d.nets.set(r.network_name, c);
    }
    add(c, r);
    add(d.grand, r);
  }

  const dates = [...byDate.keys()].sort();
  const monthGrand = zero();
  const netTotals = new Map<string, Cell>(networkNames.map((n) => [n, zero()]));
  for (const [, d] of byDate) {
    add2(monthGrand, d.grand);
    for (const n of networkNames) {
      const c = d.nets.get(n);
      if (c) add2(netTotals.get(n)!, c);
    }
  }

  return (
    <div>
      <PageHeader
        title="Monthly summary"
        subtitle={`${monthLabel(ym)} · ${networkNames.length} networks · computed live from daily metrics`}
      >
        <MonthPicker value={ym} options={months} />
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState message={`No data for ${monthLabel(ym)}.`} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th sticky left-0 bg-white">Date</th>
                {networkNames.map((n) => (
                  <th
                    key={n}
                    colSpan={4}
                    className="th border-l border-gray-200 text-center"
                  >
                    {n}
                  </th>
                ))}
                <th
                  colSpan={4}
                  className="th border-l-2 border-gray-300 bg-gray-50 text-center"
                >
                  Grand total
                </th>
              </tr>
              <tr className="border-b border-gray-200 text-[11px]">
                <th className="th sticky left-0 bg-white"></th>
                {networkNames.flatMap((n) =>
                  ["AdMob", "InApp", "Camp", "Net"].map((c, i) => (
                    <th
                      key={n + c}
                      className={`th text-right ${i === 0 ? "border-l border-gray-200" : ""}`}
                    >
                      {c}
                    </th>
                  )),
                )}
                {["AdMob", "InApp", "Camp", "Net"].map((c, i) => (
                  <th
                    key={"g" + c}
                    className={`th bg-gray-50 text-right ${i === 0 ? "border-l-2 border-gray-300" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => {
                const d = byDate.get(date)!;
                return (
                  <tr key={date} className="border-b border-gray-50">
                    <td className="td sticky left-0 bg-white font-medium">
                      {date.slice(5)}
                    </td>
                    {networkNames.map((n) => {
                      const c = d.nets.get(n) ?? zero();
                      return (
                        <CellBlock key={n} c={c} borderStart />
                      );
                    })}
                    <CellBlock c={d.grand} grand />
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="td sticky left-0 bg-gray-100">Total</td>
                {networkNames.map((n) => (
                  <CellBlock key={n} c={netTotals.get(n)!} borderStart />
                ))}
                <CellBlock c={monthGrand} grand />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function add2(a: Cell, b: Cell) {
  a.admob += b.admob;
  a.inapp += b.inapp;
  a.spend += b.spend;
  a.net += b.net;
}

function m(v: number) {
  return v === 0 ? "–" : money(v).replace("$", "");
}

function CellBlock({
  c,
  borderStart,
  grand,
}: {
  c: Cell;
  borderStart?: boolean;
  grand?: boolean;
}) {
  const base = grand ? "td bg-gray-50 text-right" : "td text-right";
  const first = grand
    ? "border-l-2 border-gray-300"
    : borderStart
      ? "border-l border-gray-100"
      : "";
  return (
    <>
      <td className={`${base} ${first}`}>{m(c.admob)}</td>
      <td className={base}>{m(c.inapp)}</td>
      <td className={base}>{m(c.spend)}</td>
      <td className={`${base} font-medium`}>{m(c.net)}</td>
    </>
  );
}
