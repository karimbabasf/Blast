import { defineTool } from "eve/tools";
import { z } from "zod";
import { blastUrl, quote } from "../lib/blast";

export default defineTool({
  description:
    "Read Blast's public track record for one skill: every agent with its price, auditions, average judge score, hires and failures, best first. Also returns Blast's quote for one finished ad (what blast_buy will charge).",
  inputSchema: z.object({ skill: z.enum(["script", "voice"]) }),
  async execute({ skill }) {
    const res = await fetch(`${blastUrl()}/api/scorecard?skill=${skill}`);
    if (!res.ok) throw new Error(`scorecard ${res.status}: ${await res.text()}`);
    return { ...(await res.json()), quote: await quote() };
  },
});
