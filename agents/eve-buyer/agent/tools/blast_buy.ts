import { defineTool } from "eve/tools";
import { z } from "zod";
import { buyAd } from "../lib/blast";

export default defineTool({
  description:
    "Buy one finished 15 second radio ad from Blast. Pays over Stripe MPP (HTTP 402, then pay and retry) and waits about 30 s for the work. Returns the script, audio_url, winners and the receipt.",
  inputSchema: z.object({
    goal: z.string().min(1).max(200),
    price: z.string().describe('The quoted price you stated from blast_track_record, for example "$20.00 USD". The buy refuses to pay if Blast now asks a different price.'),
  }),
  async execute({ goal, price }) {
    return buyAd(goal, price);
  },
});
