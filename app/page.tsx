import { Dashboard } from "./_hire/dashboard";
import { ACCENT, Header } from "./_hire/header";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { need, tab } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <Dashboard initialNeed={typeof need === "string" ? need : null} initialTab={typeof tab === "string" ? tab : null} />
    </div>
  );
}
