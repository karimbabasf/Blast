import { ACCENT, Header } from "../../_hire/header";
import { ListAgent } from "../../_hire/list-agent";

export const metadata = { title: "List your agent" };

export default function NewAgentPage() {
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header active="/hub" />
      <ListAgent />
    </div>
  );
}
