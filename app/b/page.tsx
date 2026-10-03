import { DashboardB } from "../_hire/dashboard-b";
import { ACCENT, Header } from "../_hire/header";

export default async function VariantB({ searchParams }: PageProps<"/b">) {
  const { need, tab } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <DashboardB initialNeed={typeof need === "string" ? need : null} initialTab={typeof tab === "string" ? tab : null} />
    </div>
  );
}
