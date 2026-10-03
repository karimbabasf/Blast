# Rakha: what changed and what to do (2026-10-03, 14:10 PT)

Blast is now an agent marketplace, not the radio-ad demo. Live: https://blast-kbkotes-projects.vercel.app (every push to main deploys).

## The product

A business types the agent it needs ("an agent that manages my calendar, can talk and book meetings"). Blast picks the role, takes the 5 best agents for it from Blast Hub, and runs a tryout: each candidate does the same test task on a private copy of the business's calendar or inbox. Every tool call streams live. Score = checks on what actually changed (no double booking, right length, nothing else moved) plus judges from two labs. The business hires the winner through Stripe Checkout (monthly plan plus a per-action meter; builder agents get paid through Stripe Connect, Blast keeps 20 percent). The hired agent comes back working: chat and voice on the page, acting on Google Calendar and Gmail (scoped to a "Blast demo" calendar and label, drafts only), every action streamed onto the screen and metered in Stripe.

## Pages

| Page | What |
|---|---|
| `/hub` | Blast Hub: 23 agents from 7 builders, search (pgvector), role filters |
| `/` | Ask for an agent, watch the tryouts, hire |
| `/hired/[id]` | The hired agent console: chat, push-to-talk, live calendar and inbox, actions with Stripe meter, endpoints for other agents |
| `/post` | Post your agent |
| `/classic` | Your original board (radio ad), untouched. Fix it later if you want; nothing depends on it |

## Run it locally

1. `git pull`, then `npm install` (new packages since your last pull: mppx, stripe, mcp-handler, @modelcontextprotocol/server, zod, @vercel/sandbox).
2. Use the env file Karim sent (`blast-env-for-rakha.txt` saved as `.env.local`). Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Karim only if you need to run the Google connect locally; everything else works without them.
3. `npm run dev`, open http://localhost:3000/hub.

## Code map (read before editing)

- Contract and tables: `docs/plans/market-contract.md`, types in `lib/market/types.ts`.
- Tryouts and the agent loop: `lib/runtime/` (agent.ts, tryout.ts, catalog.ts, live.ts), roles and test tasks: `lib/roles/`.
- Google: `lib/google/` (backend.ts has a Supabase fallback when Google is not connected).
- Stripe: `lib/pay/stripe-market.ts` (Checkout, meter, Connect), routes `app/api/needs/[id]/checkout`, `app/api/checkout/return`.
- UI: `app/_hire/` (components), `app/hub`, `app/hired/[id]`, `app/post`, `app/page.tsx`.
- Still there and working: MCP server `/api/mcp`, Stripe MPP pay-per-call `/api/agent/hire`, eve buyer `agents/eve-buyer`, the radio-ad routes.

## What would help most from you (UI only, keep the APIs)

1. Polish `/` and `/hired/[id]` for the stage: big readable type on the tryout board, the losing check (red cross on "overlaps nothing") impossible to miss, the winner obvious.
2. Make sure push-to-talk works in Chrome on the demo laptop (it uses the browser SpeechRecognition API).
3. Do not change API shapes or tables without telling Karim; the contract file is the source of truth.

## Demo (3 minutes)

Hub (15 s), ask for a calendar agent (5 candidates, Pip double-books and loses, 45 s), hire Ada through Stripe Checkout with card 4242 4242 4242 4242 (20 s), talk to Ada: "book a sync with Rakha Tuesday afternoon" and watch it land on the calendar and tick the meter (45 s), Claude Code hiring through MCP (20 s), sponsor slide (15 s). Say plainly that the Hub listings are seeded by us today.
