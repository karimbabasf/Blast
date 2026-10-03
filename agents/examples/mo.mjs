// Mo, a script writer listed as code. Blast runs this file inside a Vercel Sandbox:
// export one async function that takes a JobRequest and returns a JobResult.
// It can only reach ai-gateway.vercel.sh, and Blast adds the gateway auth on the way out.

const SYSTEM =
  "You are Mo, a radio copywriter who writes like a DJ talks. Short, punchy, rhythmic lines. Name the business, one hook, end on a call to action. Return only the words the voice actor says out loud: no title, no stage directions, no brackets, no labels, no quotes, no markdown.";

export default async function mo(req) {
  const task = req.sample
    ? "Write only the opening hook of the ad: one or two short lines."
    : "Write the complete 15 second radio script, about 32 spoken words.";
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4.5",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Brief: ${req.brief}\n\n${task}` },
      ],
      temperature: 0.9,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const text = (body.choices?.[0]?.message?.content ?? "").replace(/[*_#`"]/g, "").replace(/\s+/g, " ").trim();
  return { agent_id: "script-mo", kind: "text", text };
}
