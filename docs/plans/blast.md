# Blast

Supabase Select 2026 hackathon. Theme: "Build something agents want."

## What it is

**A manager agent that auditions and hires other agents for you.**

You say what you want. One agent finds specialist agents, test-drives each of them on a small sample of your task, hires the best one, and pays it. You can approve each hire, or let it run on a budget.

## The problem

Agents for hire are starting to appear, and they can be paid per use. But nobody can tell which one is good.

- An agent's description says almost nothing about the quality of its work.
- Two agents that claim the same skill can give very different results.
- Today a person picks by guessing, or a router picks by price and popularity.

So people either do not delegate, or they pay for work that turns out bad.

## How it works

1. **You state a goal.** One sentence, plain English.
2. **The manager splits it into jobs.** It does what it can do itself. It only hires for what it cannot do alone.
3. **It finds candidates.** Specialist agents that list the skill each job needs.
4. **It holds an audition.** Every candidate gets the same small sample of your real task. A separate judge scores the results.
5. **It hires the winner** and pays it for the full job.
6. **It delivers the finished work** with a receipt: who was hired, what each one cost, and why they won.

## Human in the loop

A dial, not a wall.

| Setting | What happens |
|---|---|
| Off | The manager spends freely inside a budget you set |
| On | You see the audition scores and approve each hire before any money moves |

## What is new

Tools that route an agent to a paid service already exist. They choose from a listing: keyword match, uptime, price, sales volume.

Blast chooses from evidence. It runs your actual task on several candidates and hires on the graded result. We found nobody doing that.

Every audition also adds to a scorecard of which agent is good at what. That record is measured, not guessed, and no model can produce it by thinking harder.

## Why agents want it

- **The manager agent** gets a way to delegate without gambling.
- **Specialist agents** get hired on the quality of their work, not on their marketing.
- **The person** pays for a finished result, not for attempts.

## How it answers the Anthropic talk

- **Sell outcomes, not process:** the person pays one price for the finished goal. Blast keeps the difference between that price and what the hires cost.
- **How does the value scale with intelligence?** Better models make better specialists and a sharper judge. The auditions get more accurate and the work gets cheaper to deliver, with no change to the product.

## The stack

| What happens | Tool | Sponsor |
|---|---|---|
| Find specialist agents | A2A agent cards, plus Stripe directory search | Google, Stripe |
| Pay an agent per use | Stripe MPP | Stripe |
| Budget and approvals | Stripe Link Agent Wallet. Its spend requests already have an "approve" step, so the human-in-the-loop dial is built in | Stripe |
| The person funds the budget | Stripe Checkout | Stripe |
| Run the auditions | Supabase Compute, or Vercel Sandbox as the fallback | Supabase, Vercel |
| Where specialist agents live | Supabase Compute, long-running, next to the database | Supabase |
| The manager agent | Vercel eve, with Claude as the brain | Vercel, Anthropic |
| Model access | Vercel AI Gateway, one key for Claude and Gemini | Vercel |
| Judging the auditions | A second model, so the hirer does not mark its own homework. Gemini for audio, images or video | Google |
| Audio work by specialists | Gemini TTS for voice, Lyria for music | Google |
| Scores, receipts, live view | Supabase Postgres and Realtime | Supabase |
| Sign in | Supabase Auth | Supabase |
| Finished files | Supabase Storage | Supabase |
| The app people see | Next.js on Vercel | Vercel |

## The demo story

A coffee shop owner types: "Make me a 15 second radio ad."

1. The manager splits it into two jobs: write the script, record the voice.
2. Three script agents and three voice agents show up on the board.
3. Each one does a one-line sample. Scores appear live. One voice agent mispronounces the shop name and drops to the bottom.
4. The owner sees the scores and taps approve.
5. Money moves to the two winners. The ad plays.
6. The receipt shows the price the owner paid, what the hires cost, and the margin.

## What it is not

- Not a workflow builder. Nobody drags boxes.
- Not a marketplace we have to fill. It hires agents wherever they already are.
- Not a router. It does not pick from a list, it tests.

## Open questions

- **Supply.** Few agents can be hired by API today. For the demo the specialist agents are ours. That should be said plainly on stage.
- **Supabase Compute access.** It is private alpha. Without it, Vercel Sandbox does the same job.
- **Link Agent Wallet.** US and Canada accounts only. Without it, approvals happen in our own screen and payments use Stripe test mode.
- **Is it new?** Two searches found routers, not auditions. That is likely, not certain.
- **Why hire at all?** A specialist is only worth hiring if it has something the manager lacks: private data, logged-in accounts, a license, or a proven specialty. General helpers are not worth paying for.

Who owns which part: [responsibilities.md](responsibilities.md).
