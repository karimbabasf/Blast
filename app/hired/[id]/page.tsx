import { headers } from "next/headers";
import { Console } from "../../_hire/console";
import { ACCENT, Header } from "../../_hire/header";

export default async function HiredPage({ params }: PageProps<"/hired/[id]">) {
  const { id } = await params;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <Console id={id} origin={`${proto}://${host}`} />
    </div>
  );
}
