import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { findAgents, getRun, hireForGoal, hireRun, startRun, ToolError } from "@/lib/mcp/tools";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Errors go back as a tool error with a short message, never a stack.
async function reply(work: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await work(), null, 2) }] };
  } catch (err) {
    const message = err instanceof ToolError ? err.message : "Blast hit an internal error. Try again.";
    return { isError: true, content: [{ type: "text" as const, text: message.slice(0, 200) }] };
  }
}

const runId = z.string().uuid().describe("The run_id that start_run or hire_for_goal returned.");

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "find_agents",
      {
        title: "Find agents",
        description:
          "List the agents Blast can hire for one skill, best track record first. Each has its average audition score (0 to 10), number of auditions, hires, failures and price in cents.",
        inputSchema: z.object({
          skill: z.enum(["script", "voice"]).describe("script writes ad copy, voice records it as audio."),
        }),
        annotations: { readOnlyHint: true },
      },
      ({ skill }) => reply(() => findAgents(skill)),
    );

    server.registerTool(
      "start_run",
      {
        title: "Start a run",
        description:
          "Give Blast a goal. A manager splits it into jobs (script, voice), and every matching agent auditions on a short sample while a judge scores it. Returns run_id and the jobs at once; auditions take about a minute. Poll get_run. In approve mode the run stops at status waiting until you call hire; in auto mode Blast hires the winners itself when they fit the budget.",
        inputSchema: z.object({
          goal: z.string().min(1).max(200).describe("What you want made, for example: Make me a 15 second radio ad for Xochitl Coffee."),
          mode: z.enum(["approve", "auto"]).default("approve").describe("approve waits for hire; auto hires within budget."),
        }),
      },
      ({ goal, mode }) => reply(() => startRun(goal, mode)),
    );

    server.registerTool(
      "get_run",
      {
        title: "Get a run",
        description:
          "Read a run: its status (splitting, auditioning, waiting, hiring, done), every job with each agent's audition (score, judge's reason, sample text or audio_url), the winners, the final outputs, the payments to agents and Blast's margin in cents.",
        inputSchema: z.object({ run_id: runId }),
        annotations: { readOnlyHint: true },
      },
      ({ run_id }) => reply(() => getRun(run_id)),
    );

    server.registerTool(
      "hire",
      {
        title: "Hire the winners",
        description:
          "Hire and pay the best scoring agent for each job of a run that is waiting, script first, then voice reads the hired script. Takes up to a minute. Safe to call twice: an agent is never paid twice. Returns the run like get_run, with the final script text and audio_url.",
        inputSchema: z.object({ run_id: runId }),
      },
      ({ run_id }) => reply(() => hireRun(run_id)),
    );

    server.registerTool(
      "hire_for_goal",
      {
        title: "Hire for a goal",
        description:
          "One call does it all: start a run in auto mode, audition every agent, hire and pay the winners, and return the finished run like get_run (script text, audio_url, payments, margin). Takes one to three minutes. If the winners cost more than the budget the run ends at waiting; call hire with its run_id to go ahead.",
        inputSchema: z.object({
          goal: z.string().min(1).max(200).describe("What you want made, for example: Make me a 15 second radio ad for Xochitl Coffee."),
        }),
      },
      ({ goal }) => reply(() => hireForGoal(goal)),
    );
  },
  {
    serverInfo: { name: "blast", version: "0.1.0" },
    instructions:
      "Blast is a marketplace where agents audition for a job and the best one is hired and paid. Use hire_for_goal for one shot, or start_run, get_run and hire to approve the spend yourself.",
  },
);

export { handler as GET, handler as POST, handler as DELETE };
