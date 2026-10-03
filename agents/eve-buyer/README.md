# eve-buyer

A purchasing agent built on eve. It checks Blast's track record, states the price, then buys a finished radio ad from Blast and pays for it over Stripe MPP (sandbox).

Tools: `blast_track_record { skill }` reads `/api/scorecard` plus Blast's 402 quote. `blast_buy { goal, price }` pays the MPP challenge and returns the script, audio_url, winners and receipt; it refuses to pay if Blast's price differs from `price`.

## Run

1. `npm install`
2. Create `.env` with `AI_GATEWAY_API_KEY`, `STRIPE_SECRET_KEY` (an `sk_test_` key) and optionally `BLAST_URL` (defaults to production).
3. `npm run serve` starts the agent on http://127.0.0.1:3200.
4. In a second terminal: `npm run --silent ask -- "We are Xochitl Coffee. Get us a 15 second radio ad. Check who is best at voice first."` prints each tool call, its result and the final answer.

For the interactive terminal UI instead: `set -a; . ./.env; set +a; npx eve dev`.

## Test

`npx tsc` typechecks. Step 4 is the end to end check: it charges the Stripe sandbox $20 and returns a playable audio_url.
