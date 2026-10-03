import { Dashboard } from "./_hire/dashboard";
import { ACCENT, Header } from "./_hire/header";
import { Policy } from "./_hire/hires";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { need } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col bg-[oklch(0.975_0.008_75)]">
      <Header active="/" right={<Policy compact />} />
      <Dashboard initialNeed={typeof need === "string" ? need : null} />
    </div>
  );
}
