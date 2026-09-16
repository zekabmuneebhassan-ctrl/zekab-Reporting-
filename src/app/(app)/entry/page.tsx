import { requireRole } from "@/lib/auth";
import { getApps, getNetworks, getMetricsForDate } from "@/lib/queries";
import { isoDate, fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DatePicker } from "@/components/date-picker";
import { EntryGrid, type EntryRow } from "./grid";

export const dynamic = "force-dynamic";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requireRole(["admin", "editor"]);
  const date = searchParams.date ?? isoDate(new Date());

  const [apps, networks, existing] = await Promise.all([
    getApps(),
    getNetworks(),
    getMetricsForDate(date),
  ]);

  const networkName = new Map(networks.map((n) => [n.id, n.name]));
  const byApp = new Map(existing.map((m) => [m.app_id, m]));

  const rows: EntryRow[] = apps
    .filter((a) => a.active)
    .map((a) => {
      const m = byApp.get(a.id);
      return {
        app_id: a.id,
        app_name: a.name,
        network_name: networkName.get(a.network_id) ?? "",
        admob_revenue: m?.admob_revenue ?? 0,
        inapp_revenue: m?.inapp_revenue ?? 0,
        campaign_spend: m?.campaign_spend ?? 0,
        installs: m?.installs ?? null,
        uninstalls: m?.uninstalls ?? null,
        active_users: m?.active_users ?? null,
        exists: !!m,
      };
    })
    .sort((a, b) =>
      a.network_name === b.network_name
        ? a.app_name.localeCompare(b.app_name)
        : a.network_name.localeCompare(b.network_name),
    );

  return (
    <div>
      <PageHeader
        title="Data entry"
        subtitle={`Type figures inline, then Save — ${fmtDate(date)}`}
      >
        <DatePicker value={date} />
      </PageHeader>
      <EntryGrid key={date} date={date} rows={rows} />
    </div>
  );
}
