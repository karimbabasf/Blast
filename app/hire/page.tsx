import { ACCENT, Header } from "../_hire/header";
import { Request } from "../_hire/request";

// Hiring from the web, for people without an agent. Agents hire over MCP and show up on the Dashboard.
export default async function HirePage({ searchParams }: PageProps<"/hire">) {
  const { need } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <Request initialNeed={typeof need === "string" ? need : null} />
    </div>
  );
}
