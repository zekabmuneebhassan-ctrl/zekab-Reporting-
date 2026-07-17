import { requireUser } from "@/lib/auth";
import {
  getMetricsForDate,
  getMetricsRange,
  getLatestDate,
  getUserEmailMap,
} from "@/lib/queries";
import { sum, byNetwork, byApp, byDate } from "@/lib/aggregate";
import { isoDate, fmtDate, money, int } from "@/lib/format";
import { pctChange } from "@/lib/format";
import { PageHeader, StatCard, MoneyCell, EmptyState } from "@/components/ui";
import { TrendChart, NetworkBarChart } from "@/components/charts";
import { DatePicker } from "@/components/date-picker";

export const dynamic = "force-dynamic";

function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}
function prevMonthRange(d: string): { from: string; to: string } {
  const dt = new Date(d + "T00:00:00");
  const first = new Date(dt.getFullYear(), dt.getMonth() - 1, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth(), 0);
  return { from: isoDate(first), to: isoDate(last) };
}
function prevDay(d: string): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() - 1);
  return isoDate(dt);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requireUser();
  const date = searchParams.date ?? (await getLatestDate()) ?? isoDate(new Date());

  const [today, yesterday, mtd, prevMonth, emails] = await Promise.all([
    getMetricsForDate(date),
    getMetricsForDate(prevDay(date)),
    getMetricsRange(monthStart(date), date),
    (async () => {
      const { from, to } = prevMonthRange(date);
      return getMetricsRange(from, to);
    })(),
    getUserEmailMap().catch(() => ({}) as Record<string, string>),
  ]);

  const t = sum(today);
  const y = sum(yesterday);
  const mtdTot = sum(mtd);
  const pmTot = sum(prevMonth);

  const networks = byNetwork(today);
  const apps = byApp(today);
  const trend = byDate(mtd);

  return (
    <div>
      <PageHeader
        title="Daily dashboard"
        subtitle={`${fmtDate(date)} · day-over-day vs ${fmtDate(prevDay(date))}`}
      >
        <DatePicker value={date} />
      </PageHeader>

      {today.length === 0 ? (
        <EmptyState message={`No data recorded for ${fmtDate(date)}.`} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="AdMob revenue"
              value={money(t.admob)}
              delta={pctChange(t.admob, y.admob)}
              sub={`MTD ${money(mtdTot.admob)}`}
            />
            <StatCard
              label="In-app revenue"
              value={money(t.inapp)}
              delta={pctChange(t.inapp, y.inapp)}
              sub={`MTD ${money(mtdTot.inapp)}`}
              accent="slate"
            />
            <StatCard
              label="Campaign spend"
              value={money(t.spend)}
              delta={pctChange(t.spend, y.spend)}
              sub={`MTD ${money(mtdTot.spend)}`}
              accent="neg"
            />
            <StatCard
              label="Net profit"
              value={money(t.net)}
              delta={pctChange(t.net, y.net)}
              sub={`MTD ${money(mtdTot.net)} · prev month ${money(pmTot.net)}`}
              accent={t.net < 0 ? "neg" : "pos"}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Month-to-date trend
              </h2>
              <TrendChart data={trend} />
            </div>
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Net by network (today)
              </h2>
              <NetworkBarChart
                data={networks.map((n) => ({
                  name: n.label,
                  net: Math.round(n.totals.net * 100) / 100,
                }))}
              />
            </div>
          </div>

          {/* Per-network table */}
          <div className="card mt-4 overflow-x-auto">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
              By network — {fmtDate(date)}
            </div>
            <table className="min-w-full">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="th">Network</th>
                  <th className="th text-right">AdMob</th>
                  <th className="th text-right">In-app</th>
                  <th className="th text-right">Spend</th>
                  <th className="th text-right">Net</th>
                  <th className="th text-right">Installs</th>
                  <th className="th text-right">Active users</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.key} className="border-b border-gray-50">
                    <td className="td font-medium">{n.label}</td>
                    <td className="td text-right">
                      <MoneyCell v={n.totals.admob} />
                    </td>
                    <td className="td text-right">
                      <MoneyCell v={n.totals.inapp} />
                    </td>
                    <td className="td text-right">
                      <MoneyCell v={n.totals.spend} />
                    </td>
                    <td className="td text-right font-medium">
                      <MoneyCell v={n.totals.net} />
                    </td>
                    <td className="td text-right">{int(n.totals.installs)}</td>
                    <td className="td text-right">{int(n.totals.activeUsers)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="td">Grand total</td>
                  <td className="td text-right"><MoneyCell v={t.admob} /></td>
                  <td className="td text-right"><MoneyCell v={t.inapp} /></td>
                  <td className="td text-right"><MoneyCell v={t.spend} /></td>
                  <td className="td text-right"><MoneyCell v={t.net} /></td>
                  <td className="td text-right">{int(t.installs)}</td>
                  <td className="td text-right">{int(t.activeUsers)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Per-app table with audit tooltip */}
          <div className="card mt-4 overflow-x-auto">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
              By app — {fmtDate(date)}
            </div>
            <table className="min-w-full">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="th">App</th>
                  <th className="th">Network</th>
                  <th className="th text-right">AdMob</th>
                  <th className="th text-right">Spend</th>
                  <th className="th text-right">Net</th>
                  <th className="th text-right">Installs</th>
                  <th className="th">Source</th>
                </tr>
              </thead>
              <tbody>
                {today
                  .slice()
                  .sort((a, b) => b.net - a.net)
                  .map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-50"
                      title={`Last edited by ${
                        r.entered_by ? emails[r.entered_by] ?? "unknown" : "import"
                      } at ${new Date(r.updated_at).toLocaleString()}`}
                    >
                      <td className="td font-medium">{r.app_name}</td>
                      <td className="td text-gray-500">{r.network_name}</td>
                      <td className="td text-right"><MoneyCell v={r.admob_revenue} /></td>
                      <td className="td text-right"><MoneyCell v={r.campaign_spend} /></td>
                      <td className="td text-right"><MoneyCell v={r.net} /></td>
                      <td className="td text-right">{int(r.installs)}</td>
                      <td className="td">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {r.source}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
