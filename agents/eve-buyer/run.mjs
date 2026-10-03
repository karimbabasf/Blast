// Sends one task to a running eve dev server and prints the tool calls and the final answer.
// Run: node run.mjs "<task>" [eve_url]
const task = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:3200";
if (!task) throw new Error('usage: node run.mjs "<task>" [eve_url]');

const created = await fetch(`${base}/eve/v1/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: task }),
});
const { sessionId } = await created.json();
if (!created.ok || !sessionId) throw new Error(`session create failed: ${created.status}`);
console.log(`> ${task}\n`);

const stream = await fetch(`${base}/eve/v1/session/${sessionId}/stream`);
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of stream.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const { type, data } = JSON.parse(line);
    if (type === "actions.requested") {
      for (const action of data.actions ?? []) {
        console.log(`[tool call] ${action.toolName ?? action.name} ${JSON.stringify(action.input)}`);
      }
    } else if (type === "action.result") {
      const result = data.result ?? data;
      console.log(`[tool result] ${result.toolName}\n${JSON.stringify(result.output, null, 2)}\n`);
    } else if (type === "message.completed") {
      console.log(`${data.finishReason === "stop" ? "[final answer]" : "[agent]"} ${data.message}\n`);
    } else if (type.endsWith(".failed")) {
      console.log(`[${type}] ${JSON.stringify(data)}`);
      process.exit(1);
    } else if (type === "turn.completed") {
      process.exit(0);
    }
  }
}
