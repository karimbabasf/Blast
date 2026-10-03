import { DashboardA } from "../_hire/dashboard-a";
import { ACCENT, Header } from "../_hire/header";

export default async function VariantA({ searchParams }: PageProps<"/a">) {
  const { need } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <DashboardA initialNeed={typeof need === "string" ? need : null} />
    </div>
  );
}
