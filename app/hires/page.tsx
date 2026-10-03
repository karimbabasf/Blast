import { ACCENT, Header } from "../_hire/header";
import { Hires } from "../_hire/hires";

export default function HiresPage() {
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header active="/hires" />
      <Hires />
    </div>
  );
}
