import { clarify } from "@/lib/runtime/clarify";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  return Response.json(await clarify(text));
}
