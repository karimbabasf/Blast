import { APIError, Sandbox } from "@vercel/sandbox";
import type { JobRequest, JobResult } from "@/lib/types";
import { withRetry } from "./retry";

// A builder's agent listed as code runs in a Vercel Sandbox (Firecracker microVM), never on Blast.
// The module exports `default async function (req) { return result }`; the harness feeds it the
// JobRequest and prints the result after a marker, so the agent's own logs cannot break parsing.
// The only reachable host is the AI Gateway, and the sandbox proxy adds its auth header there:
// the key never enters the VM.

const RUN_LIMIT_MS = 60_000;
const MARK = "__BLAST_RESULT__";
const DIR = "/vercel/sandbox";

const HARNESS = `import { readFile } from "node:fs/promises";
import agent from "./agent.mjs";
const req = JSON.parse(await readFile(new URL("./req.json", import.meta.url), "utf8"));
const result = await agent(req);
process.stdout.write("\\n${MARK}" + JSON.stringify(result) + "\\n");
`;

export type SandboxTimings = { create_ms: number; run_ms: number; total_ms: number };
export type SandboxRun = { result: JobResult; sandbox_id: string; timings: SandboxTimings };

// Start failures carry "Sandbox <status>: " so withRetry retries 429 and 5xx once, like any provider.
async function start(): Promise<Sandbox> {
  return withRetry(async () => {
    try {
      return await Sandbox.create({
        runtime: "node24",
        timeout: RUN_LIMIT_MS + 30_000,
        networkPolicy: {
          allow: {
            "ai-gateway.vercel.sh": [
              { transform: [{ headers: { authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY ?? ""}` } }] },
            ],
          },
        },
      });
    } catch (err) {
      if (err instanceof APIError) throw new Error(`Sandbox ${err.response.status}: ${err.message}`);
      throw err;
    }
  });
}

function validate(agentId: string, req: JobRequest, reply: unknown): JobResult {
  const r = (reply ?? {}) as Partial<JobResult>;
  if (req.skill === "script") {
    const text = typeof r.text === "string" ? r.text.trim() : "";
    if (!text) throw new Error(`${agentId} sent no script text`);
    return { agent_id: agentId, kind: "text", text: text.slice(0, 2000) };
  }
  const audio = typeof r.audio_url === "string" ? r.audio_url : "";
  if (!/^https:\/\//.test(audio)) throw new Error(`${agentId} sent no https audio_url`);
  return { agent_id: agentId, kind: "audio", audio_url: audio };
}

export async function runInSandbox(agentId: string, code: string, req: JobRequest): Promise<SandboxRun> {
  const t0 = Date.now();
  const sandbox = await start();
  const t1 = Date.now();
  try {
    await sandbox.writeFiles([
      { path: `${DIR}/agent.mjs`, content: code },
      { path: `${DIR}/harness.mjs`, content: HARNESS },
      { path: `${DIR}/req.json`, content: JSON.stringify(req) },
    ]);
    const done = await sandbox.runCommand({
      cmd: "node",
      args: [`${DIR}/harness.mjs`],
      signal: AbortSignal.timeout(RUN_LIMIT_MS),
    });
    const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()]);
    const t2 = Date.now();
    if (done.exitCode !== 0) {
      throw new Error(`${agentId} crashed in its sandbox (exit ${done.exitCode}): ${stderr.slice(-300)}`);
    }
    const line = stdout.split("\n").findLast((l) => l.startsWith(MARK));
    if (!line) throw new Error(`${agentId} returned nothing from its sandbox`);
    let reply: unknown;
    try {
      reply = JSON.parse(line.slice(MARK.length));
    } catch {
      throw new Error(`${agentId} returned something that is not JSON`);
    }
    return {
      result: validate(agentId, req, reply),
      sandbox_id: sandbox.name,
      timings: { create_ms: t1 - t0, run_ms: t2 - t1, total_ms: t2 - t0 },
    };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}
