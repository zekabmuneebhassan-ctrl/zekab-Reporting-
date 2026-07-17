import { requireUser, canEdit } from "@/lib/auth";
import { getApps, getNetworks } from "@/lib/queries";
import { getTwelveHour, SLOT_LABEL, type TwelveRow } from "@/lib/twelve";
import type { TwelveHourSlot } from "@/lib/types";
import { isoDate, fmtDate, pctChange } from "@/lib/format";
import { PageHeader, Delta, MoneyCell, EmptyState } from "@/components/ui";
import { DatePicker } from "@/components/date-picker";
import { SlotToggle } from "./slot-toggle";
import { TwelveHourForm } from "./form";

export const dynamic = "force-dynamic";

function prevDay(d: string): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() - 1);
  return isoDate(dt);
}

export default async function TwelveHourPage({
  searchParams,
}: {
  searchParams: { date?: string; slot?: string };
}) {
  const user = await requireUser();
  const date = searchParams.date ?? isoDate(new Date());
  const slot: TwelveHourSlot = searchParams.slot === "second" ? "second" : "first";
  const yday = prevDay(date);

  const [today, yesterday, apps, networks] = await Promise.all([
    getTwelveHour(date, slot),
    getTwelveHour(yday, slot),
    getApps(),
    getNetworks(),
  ]);

  const yMap = new Map(yesterday.map((r) => [r.app_id, r]));
  const networkName = new Map(networks.map((n) => [n.id, n.name]));
  const appById = new Map(apps.map((a) => [a.id, a]));

  const appIds = new Set<string>([
    ...today.map((r) => r.app_id),
    ...yesterday.map((r) => r.app_id),
  ]);
  const tMap = new Map(today.map((r) => [r.app_id, r]));

  const rows = [...appIds].map((id) => {
    const t = tMap.get(id);
    const y = yMap.get(id);
    const a = appById.get(id);
    return {
      app_id: id,
      app_name: t?.app_name ?? y?.app_name ?? a?.name ?? id,
      network_name:
        t?.network_name ??
        y?.network_name ??
        (a ? networkName.get(a.network_id) ?? "" : ""),
      today: t ?? null,
      yesterday: y ?? null,
    };
  });
  rows.sort((a, b) => (b.today?.net ?? -Infinity) - (a.today?.net ?? -Infinity));

  const canWrite = canEdit(user.role);

  return (
    <div>
      <PageHeader
        title="12-hour report"
        subtitle={`${SLOT_LABEL[slot]} · ${fmtDate(date)} vs ${fmtDate(yday)} (same slot)`}
      >
        <SlotToggle value={slot} />
        <DatePicker value={date} />
      </PageHeader>

      {canWrite && (
        <TwelveHourForm
          date={date}
          slot={slot}
          apps={apps.map((a) => ({
            id: a.id,
            name: a.name,
            network: networkName.get(a.network_id) ?? "",
          }))}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          message={`No ${SLOT_LABEL[slot].split(" ·")[0].toLowerCase()} reports for ${fmtDate(date)} or ${fmtDate(yday)} yet.`}
        />
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="th">App</th>
                <th className="th">Network</th>
                <th className="th text-right">AdMob (today)</th>
                <th className="th text-right">AdMob (yday)</th>
                <th className="th text-right">Δ AdMob</th>
                <th className="th text-right">Spend (today)</th>
                <th className="th text-right">Spend (yday)</th>
                <th className="th text-right">Net (today)</th>
                <th className="th text-right">Net (yday)</th>
                <th className="th text-right">Δ Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ComparisonRow key={r.app_id} {...r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  app_name,
  network_name,
  today,
  yesterday,
}: {
  app_name: string;
  network_name: string;
  today: TwelveRow | null;
  yesterday: TwelveRow | null;
}) {
  // pctChange returns null when yesterday's same slot is missing -> "no data yet",
  // never a false 0% (acceptance check #4).
  const admobDelta = yesterday ? pctChange(today?.admob_revenue, yesterday.admob_revenue) : null;
  const netDelta = yesterday ? pctChange(today?.net, yesterday.net) : null;
  const noBaseline = !yesterday;

  return (
    <tr className="border-b border-gray-50 hover:bg-brand-50/40">
      <td className="td font-medium">{app_name}</td>
      <td className="td text-gray-500">{network_name}</td>
      <td className="td text-right">
        {today ? <MoneyCell v={today.admob_revenue} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {yesterday ? <MoneyCell v={yesterday.admob_revenue} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {noBaseline ? <span className="text-xs text-gray-400">no data yet</span> : <Delta pct={admobDelta} />}
      </td>
      <td className="td text-right">
        {today ? <MoneyCell v={today.google_ads_spend} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {yesterday ? <MoneyCell v={yesterday.google_ads_spend} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {today ? <MoneyCell v={today.net} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {yesterday ? <MoneyCell v={yesterday.net} /> : <span className="text-gray-300">—</span>}
      </td>
      <td className="td text-right">
        {noBaseline ? <span className="text-xs text-gray-400">no data yet</span> : <Delta pct={netDelta} />}
      </td>
    </tr>
  );
}
