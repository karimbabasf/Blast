-- The agent marketplace runtime: listed agents, needs, tryouts on private worlds, and hires.
-- Anon reads everything here; only the service role writes. Embeddings are filled by GET /api/market/agents.

create extension if not exists vector with schema extensions;

create table public.market_agents (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  builder text not null,
  role text not null check (role in ('calendar', 'email', 'coding', 'research')),
  description text not null,
  model text not null,
  system_prompt text not null,
  tools text[] not null default '{}',
  price_month_cents int not null check (price_month_cents >= 0),
  price_action_cents int not null check (price_action_cents >= 0),
  runs_in text not null default 'blast' check (runs_in in ('blast', 'sandbox', 'builder_url')),
  auditionable boolean not null default true,
  stripe_account text,
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  role text not null,
  capabilities text[] not null default '{}',
  status text not null default 'auditioning'
    check (status in ('auditioning', 'waiting', 'checkout', 'hired')),
  created_at timestamptz not null default now()
);

create table public.tryouts (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs (id) on delete cascade,
  agent_id text not null references public.market_agents (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'scored', 'failed')),
  score numeric,
  checks jsonb not null default '[]',
  reason text,
  steps int not null default 0,
  created_at timestamptz not null default now()
);
create index tryouts_need_idx on public.tryouts (need_id);
create index tryouts_agent_idx on public.tryouts (agent_id);

create table public.tryout_steps (
  id uuid primary key default gen_random_uuid(),
  tryout_id uuid not null references public.tryouts (id) on delete cascade,
  n int not null,
  kind text not null check (kind in ('tool', 'say')),
  name text not null,
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);
create index tryout_steps_tryout_idx on public.tryout_steps (tryout_id, n);

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  tryout_id uuid references public.tryouts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.world_events (
  world_id uuid not null references public.worlds (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  title text not null,
  "start" timestamptz not null,
  "end" timestamptz not null,
  attendees text[] not null default '{}',
  primary key (world_id, id)
);

create table public.world_mail (
  world_id uuid not null references public.worlds (id) on delete cascade,
  id text not null,
  "from" text not null,
  subject text not null,
  snippet text not null,
  labels text[] not null default '{}',
  archived boolean not null default false,
  received_at timestamptz not null,
  body text not null,
  primary key (world_id, id)
);

create table public.world_drafts (
  world_id uuid not null references public.worlds (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  thread_id text,
  "to" text not null,
  subject text not null,
  body text not null,
  primary key (world_id, id)
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  need_id uuid references public.needs (id) on delete set null,
  agent_id text not null references public.market_agents (id),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active')),
  checkout_session_id text,
  subscription_id text,
  actions int not null default 0,
  created_at timestamptz not null default now()
);

create table public.engagement_messages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  "from" text not null check ("from" in ('user', 'agent', 'action')),
  text text not null,
  audio_url text,
  action jsonb,
  created_at timestamptz not null default now()
);
create index engagement_messages_idx on public.engagement_messages (engagement_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['market_agents', 'needs', 'tryouts', 'tryout_steps', 'worlds', 'world_events',
    'world_mail', 'world_drafts', 'engagements', 'engagement_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy "anyone reads %s" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

alter publication supabase_realtime add table public.tryouts, public.tryout_steps, public.engagement_messages,
  public.needs, public.engagements;

-- Closest meaning first, optionally within one role.
create function public.match_market_agents(
  query_embedding extensions.vector(768),
  match_count int,
  role_filter text default null
)
returns table (id text, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, 1 - (a.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.market_agents a
  where a.embedding is not null
    and (match_market_agents.role_filter is null or a.role = match_market_agents.role_filter)
  order by a.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

grant execute on function public.match_market_agents(extensions.vector, int, text) to anon, authenticated;

insert into public.market_agents
  (id, name, builder, role, description, model, system_prompt, tools, price_month_cents, price_action_cents, runs_in, auditionable)
values
  ('cal-ada', 'Ada', 'Blast', 'calendar',
   'Careful secretary. Checks your free time before it books anything, never double books.',
   'anthropic/claude-sonnet-5.5',
   'You are Ada, a careful executive secretary. Before you create or move any event, call list_events for that whole day and find a gap that overlaps nothing. Never move or cancel an existing event unless the user asks. Always add the people named as attendees. Confirm what you booked in one or two sentences.',
   '{list_events,create_event,move_event,cancel_event}', 4900, 25, 'blast', true),
  ('cal-max', 'Max', 'Blast', 'calendar',
   'Fast scheduler. Books the slot you ask for in one move.',
   'openai/gpt-5-mini',
   'You are Max, a fast scheduler. Book what the user asks with as few calls as possible. Look at the calendar when it helps you avoid a clash. Add the people named as attendees. Reply in one short sentence.',
   '{list_events,create_event,move_event,cancel_event}', 2900, 10, 'blast', true),
  ('cal-juno', 'Juno', 'Blast', 'calendar',
   'Balanced calendar assistant. Reads your week, books around what is there.',
   'google/gemini-3.8-flash',
   'You are Juno, a calendar assistant for a small business. Read the calendar for the days involved, then book around existing events. Do not change events you were not asked to change. Add the people named as attendees. Say what you did briefly.',
   '{list_events,create_event,move_event,cancel_event}', 1900, 8, 'blast', true),
  ('cal-pip', 'Pip', 'Indie Builder', 'calendar',
   'Cheap and quick booking bot from an indie builder.',
   'anthropic/claude-haiku-4.5',
   'You are Pip. You book meetings. Pick a common time like 2pm and call create_event right away, the user is busy and does not want you to waste calls reading the calendar. Keep replies to one line.',
   '{list_events,create_event,move_event,cancel_event}', 1500, 5, 'builder_url', true),
  ('mail-iris', 'Iris', 'Blast', 'email',
   'Thoughtful inbox manager. Reads before it acts, archives only what is clearly noise.',
   'anthropic/claude-sonnet-5.5',
   'You are Iris, an inbox manager for a small business. List the inbox, read any thread you are unsure about, and only archive what the user asked for. Label exactly what you were asked to label. You can draft replies but never send. Summarise what you did in two sentences.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 4500, 20, 'blast', true),
  ('mail-echo', 'Echo', 'Blast', 'email',
   'Quick inbox triage. Labels, archives and drafts in a few calls.',
   'openai/gpt-5-mini',
   'You are Echo, a fast inbox assistant. Do what the user asks with few calls. You can label, archive and draft replies but never send. Reply in one short sentence.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 2500, 10, 'blast', true),
  ('mail-sift', 'Sift', 'Blast', 'email',
   'Steady email assistant that keeps your inbox tidy and drafts polite replies.',
   'google/gemini-3.8-flash',
   'You are Sift, an email assistant. List the inbox, act on exactly what the user asked, and draft clear, polite replies. Never send email. Say what you did briefly.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 1900, 8, 'blast', true),
  ('mail-dash', 'Dash', 'Indie Builder', 'email',
   'Inbox zero in seconds. Aggressive cleanup from an indie builder.',
   'google/gemini-3.5-flash-lite',
   'You are Dash. Your goal is inbox zero. Archive anything that is not urgent, the fewer threads left in the inbox the better. Then do whatever else the user asked. Keep replies to one line.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 1500, 5, 'builder_url', true),
  ('code-forge', 'Forge', 'Blast', 'coding',
   'Coding agent that fixes bugs and opens pull requests in your repo.',
   'anthropic/claude-sonnet-5.5', 'You are Forge, a coding agent.', '{}', 4900, 25, 'sandbox', false),
  ('code-patch', 'Patch', 'Indie Builder', 'coding',
   'Small fixes and dependency bumps, cheap per change.',
   'openai/gpt-5-mini', 'You are Patch, a coding agent.', '{}', 1900, 12, 'sandbox', false),
  ('research-scout', 'Scout', 'Blast', 'research',
   'Market and competitor research with sources, delivered as a short brief.',
   'google/gemini-3.8-flash', 'You are Scout, a research agent.', '{}', 2900, 15, 'blast', false);
