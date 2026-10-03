# How to work in this repo

For every coding agent (Claude Code, Codex, Cursor) and for both of us. Read [SPEC.md](SPEC.md) before you write any code. We have 5 hours, so the rules are short and strict.

## Who owns what

| Path | Owner |
|---|---|
| `app/` (pages, components) | Rakha |
| `app/api/run/` | Rakha |
| `lib/manager/` | Rakha |
| `app/api/audition/`, `app/api/hire/` | Karim |
| `lib/agents/`, `lib/judge/`, `lib/pay/` | Karim |
| `agents/cards/` | Karim |
| `supabase/` (migrations) | Karim |
| `lib/types.ts`, `package.json`, `.env.example`, `SPEC.md` | Shared |

- Only edit files you own. If you need a change in the other person's files, ask them.
- Shared files: tell the other person first, keep the change small, merge it fast.
- No new top-level folders. No refactors of code you did not write.

## Git

- `main` always runs. Never push anything to `main` that breaks `npm run dev`.
- Work on short branches: `rakha/<thing>` or `karim/<thing>`. One branch per piece, under an hour of work.
- Before you start a branch: `git checkout main && git pull --rebase`.
- When the piece works: push the branch, open a PR, squash merge it yourself. No waiting for review. Merge at least every 45 minutes.
- If `main` moved while you worked: `git pull --rebase origin main` on your branch, fix conflicts, check it still runs, then merge.
- Never force push `main`. Never rewrite history someone else has pulled.
- Commit messages: `type: what changed`, lower case, short. Types: `feat`, `fix`, `docs`, `chore`. Example: `feat: audition route writes skipped rows`.

## Keep it clean

- Never commit `.env`, `.env.local`, keys, or `docs/event/` local files. Check `git status` before every commit.
- No dead code, no `console.log` left in, no commented-out blocks.
- Do not add a dependency without saying so in the PR. Prefer what is already installed.
- Data shapes come from `lib/types.ts` only. Do not redefine them.
- The app never calls a model or Stripe directly. It reads tables and calls `/api/*` routes.

## Speed rules

- Hardcode anything listed under "Hardcoded on purpose" in SPEC.md. Do not build settings, auth, or admin screens.
- Every chunk ends with the demo working. If a piece is not ready, keep the fake version in place.
- Stuck for more than 20 minutes: hardcode it and move on. Say so in the PR.
- Feature freeze at T+4:00. After that, only fixes.

## Stack

Next.js (App Router, TypeScript), Tailwind, Supabase (Postgres, Realtime, Storage), Vercel AI SDK through the AI Gateway (Claude, Gemini), Gemini TTS, Stripe test mode. Use npm.
