import { requireUser } from "@/lib/auth";
import { getNetworks, getLatestDate } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { Exporter } from "./exporter";

export const dynamic = "force-dynamic";

function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}

export default async function ExportPage() {
  await requireUser();
  const [networks, latest] = await Promise.all([
    getNetworks(),
    getLatestDate(),
  ]);
  const to = latest ?? isoDate(new Date());
  const from = monthStart(to);

  return (
    <div>
      <PageHeader
        title="Export report"
        subtitle="Download daily metrics for any date range as a CSV file."
      />
      <Exporter
        networks={networks.map((n) => ({ id: n.id, name: n.name }))}
        defaultFrom={from}
        defaultTo={to}
      />
    </div>
  );
}
