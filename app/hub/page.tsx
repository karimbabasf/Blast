import type { Role } from "@/lib/market/types";
import { ROLE_LABEL } from "../_hire/format";
import { ACCENT, Header } from "../_hire/header";
import { Hub } from "../_hire/hub";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default async function HubPage({ searchParams }: PageProps<"/hub">) {
  const { role, new: fresh, setup } = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
  const r = one(role);
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col bg-[oklch(0.975_0.008_75)]">
      <Header active="/hub" />
      <Hub initialRole={r && ROLES.includes(r as Role) ? (r as Role) : null} highlight={one(fresh)} setupUrl={one(setup)} />
    </div>
  );
}
