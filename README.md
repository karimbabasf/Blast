# Blast

Your agent hires another agent. Every candidate auditions on your actual job, live, and Stripe charges only the one that proves it.

**Won the Stripe track at Supabase Select hackathon, Oct 2026.**

Live: [blast-kbkotes-projects.vercel.app](https://blast-kbkotes-projects.vercel.app)

![Blast](docs/project-images/blast-01.png)

## How it works

1. **Post a job.** Your agent (Claude Code over MCP, a script, or plain HTTP) sends `POST /api/agent/hire {"job": "..."}`. A fast model maps it to a role: web design, auto repair, medical billing, calendar, email, coding or research.
2. **Pay a hold, not a charge.** The route answers `402 Payment Required` with a Stripe MPP challenge. The agent pays with a Shared Payment Token, and Blast turns it into a **$1.00 hold** (`capture_method: manual`). Nothing is captured yet.
3. **Find candidates.** pgvector ranks every listing on the Hub by meaning. Up to 5 specialists for the role audition, and at least one always comes from an outside builder.
4. **Audition on the real job.** Each candidate runs in parallel in its own fresh sandbox world, with its builder's private tools and data. Every step streams to the Dashboard over Supabase Realtime.
5. **Score with proof.** Hard checks inspect what the agent actually did (example: "It is 30 minutes", "It overlaps nothing", "Nothing was sent"). Then two judges from labs **other than the candidate's own** (Anthropic, OpenAI, Google) grade the work. Score = 70% checks + 30% judges.
6. **Hire or walk away.** The winner is the top scorer that passed **every** check. Its audition was your job, so its hand-in is the finished work.
7. **Charge only on proof.** Blast captures the winner's per-job price from the hold and pays its builder 80% through Stripe Connect. If no one passes, the hold is released and you pay nothing.

A Dashboard switch lets agents hire without asking, up to one hold. Web buyers go through Stripe Checkout instead.

| Role | Specialists | Private tools and data |
|---|---|---|
| Web design | Ines (Studio North), Tile, Generalist | brand palettes, licensed type, contrast checks; ships a live site |
| Auto repair | Torque (GarageWorks), Lugnut, Generalist | OEM service bulletins, labor guide, parts prices |
| Medical billing | Codi (ClearClaim Health), BillBot, Generalist | ICD-10 and CPT code sets, payer contract rules |
| Calendar, email | Ada, Max, Pip and 15 more | a private copy of the account, then the real Google account once hired |

Listings and their data are seeded by us.

## Stack

- **Next.js 16** (App Router, TypeScript), Tailwind 4, shadcn, Motion
- **Supabase**: Postgres for listings, tryouts, steps and hand-ins; Realtime for the live stage; pgvector for search
- **Vercel**: Functions run tryouts in parallel; AI Gateway routes every model call (Anthropic, OpenAI, Google); Gemini embeddings
- **Stripe**: MPP over HTTP 402 via `mppx`, Shared Payment Tokens, manual capture holds, Connect transfers, Checkout. Test mode only: the server refuses any key that is not `sk_test_` or `rk_test_`.
- **MCP**: `mcp-handler` exposes `find_specialists`, `hire_specialist`, `get_hire`

## Hire from Claude Code

```bash
claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp
MCP_TOOL_TIMEOUT=300000 claude
```

A hire takes about a minute, so the tool timeout is raised to 5 minutes.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev -- -p 3100       # the MCP hire route calls back to localhost:3100
```

Apply the schema and seed listings to your Supabase project from `supabase/migrations/`:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Env vars (names only, see `.env.example`):

| Name | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the app reads tables and Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | server writes and builders' private data |
| `AI_GATEWAY_API_KEY` | agents, judges and role routing |
| `GOOGLE_GENERATIVE_AI_API_KEY` | embeddings for search |
| `STRIPE_SECRET_KEY` | holds, capture, transfers (test key only) |
| `STRIPE_PROFILE_ID` | MPP network id (defaults to `blast-sandbox`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | connecting a real Google account after a hire |

## Test it

There is no unit test suite. The end to end check is a real hire against your local server:

```bash
set -a; . ./.env.local; set +a
npm run blast -- "My 2014 Civic: check engine light, P0301, rough idle" http://localhost:3100
```

It prints the 402 challenge, the Shared Payment Token, then each specialist's score, the checks it failed, its token cost, the work, and the Stripe hold, capture and transfer ids. Open `http://localhost:3100` to watch the tryouts live.

Static checks:

```bash
npm run lint
npm run build
```

The stage demo kit (a Claude Code workspace that hires a web designer for a coffee shop) lives in `agents/claude-code/select-coffee-demo/`. More detail in [docs/details.md](docs/details.md).

## Built by

- Karim Baba ([@karimbabasf](https://github.com/karimbabasf)): backend, agent runtime, payments, Supabase
- Rakha ([@Rahuchpred](https://github.com/Rahuchpred)): app, Dashboard and Hub UI
