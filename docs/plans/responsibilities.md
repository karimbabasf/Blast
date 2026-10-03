# Blast: who owns what

Two people, two halves. The split follows the product: one side buys, the other side sells and gets paid.

What Blast is: [blast.md](blast.md).

## Person A: the buying side

Owner: ______

Everything the person and the manager agent see and decide.

- **The app.** Where the goal is typed, the live audition board, the approve button, the receipt.
- **The manager agent.** Splitting a goal into jobs, finding candidates, deciding who to hire.
- **Human in the loop.** The dial, the approval step, the budget.
- **The live view.** Scores and hires appearing as they happen.
- **Sign in.**

Sponsor tools on this side: Vercel eve, Claude, Next.js on Vercel, Supabase Auth and Realtime.

## Person B: the selling side and the money

Owner: ______

Everything that gets hired, judged and paid.

- **The specialist agents.** The candidates the manager can hire, each with a card that lists its skills.
- **The audition room.** Where every candidate runs the sample task.
- **The judge.** The second model that scores each audition.
- **Payments.** Agents getting paid per use, the person funding the budget, the receipt numbers.
- **Audio.** Voice and music produced by the specialists.

Sponsor tools on this side: Stripe MPP, Link Agent Wallet and Checkout, Supabase Compute, Gemini, Lyria.

## Shared

Agree on these together before splitting up, because both halves depend on them.

- **The handshake.** What the manager sends a specialist, and what comes back. Same shape for a sample and for the full job.
- **The scorecard.** What a score looks like and where it is stored.
- **The data.** One Supabase project, one set of tables.

Do these together at the end.

- **The demo story.** One goal, run start to finish.
- **The demo video and the submission form.**
- **The pitch.** Who says what on stage.

## Access each person needs

| Access | Person A | Person B |
|---|---|---|
| This GitHub repo | Yes | Yes |
| Supabase project | Yes | Yes |
| Vercel team (credits redeemed once per team) | Yes | Yes |
| Stripe test account | | Yes |
| Google AI Studio key | | Yes |
| Supabase Compute (ask Matt) | | Yes |

## If one half gets stuck

- **No Supabase Compute:** Person B moves the audition room to Vercel Sandbox.
- **No Link Agent Wallet:** Person A builds the approve step in the app, Person B keeps payments in Stripe test mode.
- **No Google credits:** use Gemini through the Vercel AI Gateway key.
