# Rakha: what changed and the demo (2026-10-03, 14:50 PT)

Blast is now: agents hire agents on your behalf, for jobs they cannot do well alone. The radio ad and `/classic` are gone. Read the README first.

## Code map

- Hire flow: `lib/runtime/hire.ts` (tryouts, winner does the job, pay on proof), `lib/runtime/tryout.ts`, `lib/runtime/agent.ts` (tool loop, token cost).
- Specialists: `lib/roles/specialists.ts` (tools, test jobs, checks), data in the `specialist_data` table, hand-ins in `world_outputs`.
- Money: `lib/pay/proof.ts` (MPP hold, capture, Connect transfer, release), `app/api/agent/hire/route.ts` (the 402 endpoint), `lib/pay/stripe-market.ts` (web Checkout and meter).
- Agents in: `app/api/mcp/route.ts` and `lib/mcp/tools.ts` (MCP), `agents/blast.mts` (CLI, `npm run blast`).
- UI: `app/_hire/`, `app/hub`, `app/hired/[id]`, `app/post`. `needs.source`, `needs.hold`, `needs.result` and `tryouts.usage` drive the receipt strip, the result card and the token costs.

## Demo (3 minutes)

1. Projector on https://blast-kbkotes-projects.vercel.app/?watch=1 (it jumps to the hire the moment Claude Code makes it).
2. Claude Code (Blast MCP added, started with `MCP_TOOL_TIMEOUT=300000 claude`): "My 2014 Honda Civic 1.8L, 98,000 miles: check engine light, rough idle on cold starts, code P0301. What's wrong and what will it cost? Hire a specialist on Blast."
3. The page shows three mechanics trying out live: Torque reads the service bulletin and passes 7 of 7, Lugnut misses the bulletin and the labor guide, the no-tools Generalist guesses and gets 2 of 7 for under a cent of tokens.
4. Stripe strip: $40 held over MPP, $25 captured because Torque passed, $20 to GarageWorks through Connect, $5 to Blast.
5. Back in Claude Code: the estimate ($173.60: coil, plug, 0.5 h labor, TSB 15-047), and it tells you what to do.
6. Second hire if time: the medical billing visit note (Codi passes, the Generalist codes I10 and misses modifier 25).
