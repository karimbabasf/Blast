import { Dashboard } from "./_hire/dashboard";
import { ACCENT, Header } from "./_hire/header";
import { Policy } from "./_hire/hires";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { need, fresh } = await searchParams;
  // ?fresh starts the Dashboard empty: only hires made after the page opened show up.
  const since = fresh === undefined ? null : new Date().toISOString();
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header active="/" right={<Policy compact />} />
      <Dashboard initialNeed={typeof need === "string" ? need : null} since={since} />
    </div>
  );
}
