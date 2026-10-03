import { ACCENT, Header } from "./_hire/header";
import { Request } from "./_hire/request";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { need, watch } = await searchParams;
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header active="/" />
      <Request initialNeed={typeof need === "string" ? need : null} watch={watch === "1"} />
    </div>
  );
}
