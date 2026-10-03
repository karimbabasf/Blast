# Blast: build spec

What Blast is: [docs/plans/blast.md](docs/plans/blast.md). How to work in this repo: [AGENTS.md](AGENTS.md).

We have 5 hours. Every chunk ends with the demo working start to finish. Each chunk swaps something fake for something real. If time runs out, we demo the last chunk that works.

**Owners.** Rakha: the app and the manager (Person A). Karim: the agents, the judge and the money (Person B).

## The demo

The goal box already holds: **"Make me a 15 second radio ad for Xochitl Coffee."**

1. The manager splits it into two jobs: `script` and `voice`.
2. The board fills with agent cards. Most are skipped ("wrong skill"). Three script agents and three voice agents audition.
3. Scores appear live. One voice agent says "Xochitl" wrong and drops to the bottom.
4. The owner taps approve.
5. Stripe (test mode) pays the winners. The ad plays.
6. The receipt shows: what the owner paid, what each hire cost, who won and why, and our margin.

## The pieces

| Piece | What it is | Owner |
|---|---|---|
| App | The Next.js page: goal box, board, approve button, receipt | Rakha |
| Manager | Claude. Splits the goal into jobs, picks candidates | Rakha |
| Agent cards | One JSON file per specialist: name, skill, price | Karim |
| Specialist agents | A model plus its own prompt, voice or model choice | Karim |
| Audition room | Sends the same sample to every candidate at once, saves results | Karim |
| Judge | Gemini. Scores each sample 0 to 10 with a one-line reason. Never hires | Karim |
| Dial | `approve` mode (owner taps) or `auto` mode (spends inside the budget) | Rakha |
| Payments | Stripe test mode. Pays each winner on hire | Karim |
| Receipt | Reads `runs` and `payments`, shows the numbers | Rakha |
| Live view | Supabase Realtime on `jobs` and `auditions` | Rakha |

## The contract

Agree on this first. Change it only after you tell the other person. All shapes live in `lib/types.ts`.

### Tables (Supabase, one project)

```
runs       id, goal, mode ('approve' | 'auto'), budget_cents, price_cents,
           status ('splitting' | 'auditioning' | 'waiting' | 'hiring' | 'done'), created_at
jobs       id, run_id, skill ('script' | 'voice'), brief, order (int),
           status ('auditioning' | 'waiting' | 'hired' | 'done'),
           winner_agent_id, output_text, audio_url
auditions  id, job_id, agent_id,
           status ('skipped' | 'running' | 'scored' | 'failed'),
           skip_reason, output_text, audio_url, score (0-10), reason
payments   id, run_id, job_id, agent_id, amount_cents, stripe_id, status
```

`price_cents` on a run is what the owner pays (hardcode 2000, so $20). Margin = `price_cents` minus the sum of `payments.amount_cents`.

### Agent card (`agents/cards/<id>.json`)

```json
{
  "id": "voice-aria",
  "name": "Aria",
  "skills": ["voice"],
  "description": "Warm, upbeat radio voice.",
  "price_cents": 300,
  "real": true
}
```

`real: false` means card only. It shows on the board and gets skipped, never called.

### The handshake (what a specialist gets and returns)

```ts
type JobRequest = {
  job_id: string
  skill: 'script' | 'voice'
  brief: string            // what to make
  sample: boolean          // true = audition sample, false = the full job
  input_text?: string      // voice jobs: the text to read
}

type JobResult = {
  agent_id: string
  kind: 'text' | 'audio'
  text?: string
  audio_url?: string       // Supabase Storage public URL
}
```

Same shape for the sample and the full job.

### API routes (the seam between us)

| Route | Body | Does | Owner |
|---|---|---|---|
| `POST /api/run` | `{ goal, mode }` | Creates the run, splits it into jobs, starts auditions | Rakha |
| `POST /api/audition` | `{ job_id }` | Writes one `auditions` row per card, runs the real ones, judges them | Karim |
| `POST /api/hire` | `{ job_id }` | Picks the top score, runs the full job, pays, saves the output | Karim |

The app only reads tables and calls these routes. It never calls a model or Stripe directly.

Order: hire `script` first. The `voice` full job reads the winning script. Voice auditions all read the same fixed line: "Wake up at Xochitl Coffee."

## The chunks

Times count from when we start (T+0).

### Chunk 0: contract (together, T+0 to T+0:30)

- Rakha: scaffold Next.js at the repo root, push it.
- Karim: create the Supabase project and the 4 tables, turn on Realtime for `jobs` and `auditions`, write `lib/types.ts` and `.env.example`.
- Together: write the 12 agent cards (6 real, 6 card only).

**Done when** `npm run dev` loads, the tables exist, and both of us have `.env.local`.

### Chunk 1: skeleton, all fake (T+0:30 to T+1:30)

- Rakha: the page. Goal box, board with a column per job, a card per audition with its score, approve button, receipt. Realtime updates the board with no refresh.
- Karim: `/api/audition` and `/api/hire` return fake data. They write real rows with made-up scores, with a short delay so it looks live.

**Done when** the whole demo clicks through on fake data.

### Chunk 2: real auditions (T+1:30 to T+2:45). The core.

- Karim: 3 real script agents (different models or personas through the AI Gateway). 3 real voice agents (Gemini TTS, 3 different voices). One voice gets no pronunciation help so it really says "Xochitl" wrong. Audio goes to Supabase Storage. The Gemini judge scores text and listens to audio.
- Rakha: the board shows real samples (text preview, an audio play button), the judge's reason on each card, and the winning ad playing at the end.

**Done when** real scores appear live and the finished ad plays. If we stop here, we still have a pitch.

### Chunk 3: real money, real manager (T+2:45 to T+4:00)

- Karim: `/api/hire` makes a Stripe test-mode payment per winner and saves the `stripe_id`. The receipt numbers are real.
- Rakha: Claude does the split and picks candidates from the cards. Keep the hardcoded split as a fallback if Claude takes over 8 seconds. Add `auto` mode: no approve tap, hire while the total stays under `budget_cents`.

**Done when** one live run goes goal to receipt with nothing fake except the agents being ours.

### Chunk 4: ship (together, T+4:00 to T+5:00)

Feature freeze at T+4:00. No new features after that.

- Deploy to Vercel. Run the demo 5 times on the deployed URL.
- Record the demo video. Fill in the submission form.
- Pitch: who says what. Say plainly that we built the specialists.
- Sponsor extras (eve, Supabase Compute, Link Agent Wallet, Lyria music) only if one is already almost working.

## Hardcoded on purpose

- The goal text and the shop name.
- The 12 agent cards and their prices.
- The run price ($20) and the budget ($10).
- One user, no sign in.
- The split for the demo goal (fallback when Claude is slow).

## Env

`.env.local`, never committed. `.env.example` lists the names:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_GATEWAY_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
STRIPE_SECRET_KEY=
```

Share keys in DMs, never in the repo, an issue or a PR.
