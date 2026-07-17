import { requireRole } from "@/lib/auth";
import { getApps, getNetworks } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { CsvImporter } from "./importer";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireRole(["admin", "editor"]);
  const [apps, networks] = await Promise.all([getApps(), getNetworks()]);
  const networkName = new Map(networks.map((n) => [n.id, n.name]));

  return (
    <div>
      <PageHeader
        title="Bulk import"
        subtitle="Paste or upload a CSV to backfill daily metrics"
      />
      <CsvImporter
        apps={apps.map((a) => ({
          id: a.id,
          name: a.name,
          network: networkName.get(a.network_id) ?? "",
        }))}
      />
    </div>
  );
}
