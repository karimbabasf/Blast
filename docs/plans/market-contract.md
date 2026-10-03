# Blast marketplace: build contract (2026-10-03, 14:00 PT)

Types live in `lib/market/types.ts`. Read this file before writing code. Deadline for every teammate: 14:50 PT.

## The product in one paragraph

A business types the agent it needs ("an agent that manages my calendar, can talk and book meetings"). Blast finds every listed agent for that role, has each one try the same test task on a private copy of the business's account, and scores them on what they actually did (checks on the resulting state) plus a cross-lab judge. The business approves the winner and pays through Stripe Checkout. Blast hands back the hired agent working on the real Google account: chat and voice on the page, every action streamed live onto the screen, every action metered in Stripe, the builder paid through Stripe Connect. Builders post agents on a page. Other agents hire through Blast's MCP server.

Roles that work end to end: `calendar` (secretary) and `email` (manager: read, label, archive, draft only, never send). `coding` and `research` agents are listed but not auditionable.

## Tables (Supabase, project gqpsujsmjuuqfkvfklmr). RLS on every table: anon read unless noted, service role writes.

| Table | Columns | Owner |
|---|---|---|
| market_agents | MarketAgent fields + embedding vector(768) + created_at | runtime |
| needs | Need fields | runtime |
| tryouts | Tryout fields (checks jsonb) | runtime |
| tryout_steps | TryoutStep fields (input, output jsonb) | runtime |
| worlds | id, tryout_id, created_at | runtime |
| world_events | world_id + CalEvent fields | runtime |
| world_mail | world_id + MailThread fields + body | runtime |
| world_drafts | world_id + Draft fields | runtime |
| engagements | Engagement fields | runtime (stripe fills checkout_session_id, subscription_id, status) |
| engagement_messages | EngagementMessage fields | runtime |
| live_events | CalEvent fields + synced_at (mirror of the real Google Calendar) | google |
| live_mail | MailThread fields + synced_at (mirror of the real Gmail, no bodies) | google |
| live_drafts | Draft fields + created_at (drafts the hired agent made) | google |
| google_accounts | id, email, refresh_token, access_token, expires_at. Service role only, no anon read. | google |
| builder_accounts | id, builder, email, stripe_account, created_at | stripe |

Realtime on: tryouts, tryout_steps, engagement_messages, live_events, live_mail, live_drafts, needs, engagements.

## Seed state for auditions (runtime owns, `lib/roles/seed.ts`)

Every tryout gets a fresh world copied from one fixed seed: a realistic week for "Xochitl Coffee" (the demo business), the same week as the demo Gmail's real calendar. Calendar seed: about 8 events across the coming Mon to Fri, including Tuesday 14:00 to 15:00 "Supplier call". Mail seed: about 10 threads: 3 newsletters, 1 from an investor (Grace, asking to meet Thursday 15:00), 1 customer complaint, 1 invoice, the rest ordinary.

## Test tasks (runtime owns, `lib/roles/`)

- calendar: "Book a 30 minute call titled 'Rakha sync' with rakha@xochitl.coffee next Tuesday afternoon. Do not double book." Checks: an event titled like "Rakha sync" exists; it is 30 minutes; it is Tuesday between 12:00 and 18:00; it overlaps nothing; Rakha is an attendee; no existing event was moved or cancelled.
- email: "Clean up the inbox: archive the newsletters, label the investor email 'Important', and draft a reply to Grace confirming Thursday at 3pm." Checks: 3 newsletters archived; nothing else archived; Grace's thread labeled Important; a draft to Grace exists that confirms Thursday 3pm; nothing was sent (there is no send tool).
- Score = 7 x (checks passed / checks) + 3 x (cross-lab judge 0 to 10 / 10), one decimal. The judge reads the steps and the agent's final reply (reuse lib/judge/panel.ts style: two labs, not the candidate's lab).

## Agent runtime (runtime owns, `lib/runtime/`)

`runAgent(agent, task, backends, onStep)`: AI Gateway chat completions with OpenAI-style tools (POST https://ai-gateway.vercel.sh/v1/chat/completions, AI_GATEWAY_API_KEY), at most 10 steps, 60 s total. Tool names: calendar: list_events, create_event, move_event, cancel_event; email: list_threads, read_thread, label_thread, archive_thread, create_draft. Every tool call is written to tryout_steps (audition) or engagement_messages with from "action" (hired), live, so the screen shows it as it happens.

## Routes

| Route | Does | Owner |
|---|---|---|
| GET /api/market/agents?role=&q= | list agents (pgvector search on q), with track record from tryouts | runtime |
| POST /api/market/agents | builder posts an agent {name, builder, email, role, description, model, system_prompt, tools, price_month_cents, price_action_cents}; creates the Connect account through stripe's helper | runtime (calls stripe lib) |
| POST /api/needs {text, capabilities} | manager (Claude via gateway) maps text to a role; creates the need; starts tryouts for every auditionable agent of that role with after(); returns {need, agents} | runtime |
| GET /api/needs/[id] | need, tryouts with steps, agents | runtime |
| POST /api/needs/[id]/checkout {agent_id} | creates engagement (pending_payment) and a Stripe Checkout session; returns {url} | stripe |
| GET /api/checkout/return?session_id= | verifies the session with Stripe, activates the engagement, redirects to /hired/[engagement_id] | stripe |
| POST /api/engagements/[id]/chat {text, voice?: boolean} | runs the hired agent on the LIVE backend, writes messages and actions, meters each action in Stripe, returns {reply, audio_url?, actions} | runtime (uses google backend, stripe meter, lib/agents voice TTS) |
| GET /api/google/connect, GET /api/google/callback | OAuth for the demo account | google |
| POST /api/google/sync | pulls Google Calendar and Gmail into live_* tables | google |

## Library seams

- `lib/google/backend.ts` exports `liveCalendar(): Promise<CalendarBackend>` and `liveMail(): Promise<MailBackend>`. Without a connected Google account they fall back to a Supabase "demo account" world so the demo never breaks. Every write also refreshes the live_* mirror rows. (google)
- `lib/roles/world.ts` exports `worldCalendar(worldId)`, `worldMail(worldId)` on world_* tables. (runtime)
- `lib/pay/stripe-market.ts` exports `createCheckout(engagement, agent, customerEmail)`, `verifyCheckout(sessionId)`, `meterAction(engagementId)`, `ensureBuilderAccount(builder, email)`. (stripe)

## Pages (ui owns, under app/(market)/ or app/hire, app/post, app/hired/[id])

- `/` request: one box "Describe the agent you need" plus capability toggles (Can talk, Can act). Then the candidates and their live tryouts: each candidate shows its model, builder, where it runs, and its steps as they stream (list_events, create_event Tue 15:30, ...), checks as ticks, score. Approve the winner: goes to Stripe Checkout.
- `/hired/[id]`: the hired agent console: chat with push-to-talk (browser speech recognition) and spoken replies, a live calendar week view and inbox list streamed from live_* tables, an action log with the Stripe meter count, the agent's API and MCP endpoints.
- `/post`: post your agent form.
- Keep `/classic` and the old routes working.

## Rules

Every teammate: tsc and eslint clean on its files, no console.log, no git (the lead commits), no new top-level folders, dev server is the lead's at :3100 (never start another next dev in the repo), Supabase migrations through `supabase migration new` plus the Supabase MCP apply_migration tool. Report with real output.
