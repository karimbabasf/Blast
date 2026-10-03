import { admin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// The site a design specialist delivered, served live.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { data } = await admin().from("needs").select("result").eq("id", id).maybeSingle();
  const html = (data?.result as { output?: { html?: string } } | null)?.output?.html;
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
