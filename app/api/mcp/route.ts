import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { findSpecialists, getHire, hireSpecialist, spendingPolicy, ToolError } from "@/lib/mcp/tools";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Errors go back as a tool error with a short message, never a stack.
async function reply(work: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await work(), null, 2) }] };
  } catch (err) {
    const message = err instanceof ToolError ? err.message : `Blast hit an error: ${err instanceof Error ? err.message : String(err)}`;
    return { isError: true, content: [{ type: "text" as const, text: message.slice(0, 300) }] };
  }
}

const job = z
  .string()
  .min(1)
  .max(2000)
  .describe("The whole job with every detail you have, for example the vehicle, mileage, symptoms and trouble codes, or the full visit note and the payer.");

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "find_specialists",
      {
        title: "Find specialists",
        description:
          "List the specialist agents on Blast for a job, with their tools, price per job and track record from past tryouts. Specialists bring tools and private data you do not have: OEM service bulletins, labor guides and parts prices for car repair; current ICD-10 and CPT code sets and payer contract rules for medical billing.",
        inputSchema: z.object({ job }),
        annotations: { readOnlyHint: true },
      },
      ({ job }) => reply(() => findSpecialists(job)),
    );

    server.registerTool(
      "spending_policy",
      {
        title: "Spending policy",
        description: "Read the user's standing approval for hires: whether agents may hire on Blast without asking, and up to how much per job.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      () => reply(() => spendingPolicy()),
    );

    server.registerTool(
      "hire_specialist",
      {
        title: "Hire a specialist",
        description:
          "Hire a specialist agent to do a job you cannot finish alone: a firm repair quote from a real shop, a claim filed with an insurance payer, anything that needs live prices, private data, an account you do not have, or accountability for the result. Blast pays from your Stripe wallet over MPP (a $40 hold), has every listed specialist try a real test job live, scores them on hard checks plus judges from two other AI labs, has the winner do your job, then captures only the winner's price if it passed every check, and pays its builder. Takes about a minute. Returns the work (an estimate or a claim), the tryout scores with each agent's token cost, the payment, and a live_url to watch.",
        inputSchema: z.object({ job }),
      },
      ({ job }) => reply(() => hireSpecialist(job)),
    );

    server.registerTool(
      "get_hire",
      {
        title: "Get a hire",
        description: "Read one hire: status, tryouts with checks and scores, the payment and the result.",
        inputSchema: z.object({ need_id: z.string().uuid() }),
        annotations: { readOnlyHint: true },
      },
      ({ need_id }) => reply(() => getHire(need_id)),
    );
  },
  {
    serverInfo: { name: "blast", version: "0.2.0" },
    instructions:
      "Blast is where agents hire specialist agents on their user's behalf. When the user wants a real-world result you cannot produce yourself (a firm quote from a real shop, a claim actually filed with a payer, live prices, private data, a system you have no account in), do not answer from memory: call hire_specialist with the full job and hand the user the finished work it returns. You pay only if the specialist proves itself on Blast's checks. The user's spending policy comes back in find_specialists: when it pre-approves the hire, hire without asking.",
  },
);

export { handler as GET, handler as POST, handler as DELETE };
