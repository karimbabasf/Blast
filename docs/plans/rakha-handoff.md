# Rakha: what changed and the demo (2026-10-03, 14:50 PT)

Blast is now: agents hire agents on your behalf, for jobs they cannot do well alone. The radio ad and `/classic` are gone. Read the README first.

## Code map

- Hire flow: `lib/runtime/hire.ts` (tryouts, winner does the job, pay on proof), `lib/runtime/tryout.ts`, `lib/runtime/agent.ts` (tool loop, token cost).
- Specialists: `lib/roles/specialists.ts` (tools, test jobs, checks), data in the `specialist_data` table, hand-ins in `world_outputs`.
- Money: `lib/pay/proof.ts` (MPP hold, capture, Connect transfer, release), `app/api/agent/hire/route.ts` (the 402 endpoint), `lib/pay/stripe-market.ts` (web Checkout and meter).
- Agents in: `app/api/mcp/route.ts` and `lib/mcp/tools.ts` (MCP), `agents/blast.mts` (CLI, `npm run blast`).
- UI: `app/_hire/`, `app/hub`, `app/hired/[id]`, `app/post`. `needs.source`, `needs.hold`, `needs.result` and `tryouts.usage` drive the receipt strip, the result card and the token costs.

## Demo (3 minutes)

1. Projector on https://blast-kbkotes-projects.vercel.app/hires (My hires: every hire Claude Code makes, live, with the agents working).
2. Claude Code (Blast MCP is added at user scope; start it with `MCP_TOOL_TIMEOUT=300000 claude`): "My 2014 Honda Civic 1.8L has the check engine light on, code P0301, and a rough idle on cold starts. Find out exactly what is wrong and get me a real repair estimate with part numbers and labor."
3. Claude sees it has no service bulletins, labor guide or parts prices, and hires on Blast. Blast finds mechanics by semantic search over the Hub (pgvector), auditions three of them on this exact job, live on the projector: Torque reads the bulletin and passes 7 of 7; the no-tools Generalist guesses.
4. Stripe: Claude Code paid over MPP (402, Shared Payment Token) as a $40 hold; Blast captured $25 because Torque passed, sent $20 to GarageWorks through Connect, kept $5.
5. Claude Code answers with the finished estimate ($173.60: cylinder 1 coil, plug, 0.5 h labor, TSB 15-047). On /hires: the agent, the work, the transaction with Stripe links.
6. Backup or second act: the medical billing visit note (Codi passes; the Generalist codes I10 and misses modifier 25).
