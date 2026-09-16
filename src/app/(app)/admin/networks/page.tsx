import { requireRole } from "@/lib/auth";
import { getNetworks, getApps } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { NetworkManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  await requireRole(["admin"]);
  const [networks, apps] = await Promise.all([getNetworks(), getApps()]);

  return (
    <div>
      <PageHeader
        title="Accounts & apps"
        subtitle="Add accounts and apps without touching code — a new account needs zero schema changes."
      />
      <NetworkManager
        networks={networks}
        apps={apps.map((a) => ({
          id: a.id,
          name: a.name,
          network_id: a.network_id,
          package_name: a.package_name,
          active: a.active,
        }))}
      />
    </div>
  );
}
