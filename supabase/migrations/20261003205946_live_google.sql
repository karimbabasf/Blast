-- The live account the hired agent works on: a mirror of the real Google Calendar and Gmail, and the
-- drafts the agent made. Anon reads the mirror; google_accounts holds tokens and is service role only.
-- live_mail.body stays null for real Gmail rows; only the fallback demo account fills it.

create table public.live_events (
  id text primary key,
  title text not null,
  "start" timestamptz not null,
  "end" timestamptz not null,
  attendees text[] not null default '{}',
  synced_at timestamptz not null default now()
);

create table public.live_mail (
  id text primary key,
  "from" text not null,
  subject text not null,
  snippet text not null default '',
  labels text[] not null default '{}',
  archived boolean not null default false,
  received_at timestamptz not null,
  body text,
  synced_at timestamptz not null default now()
);

create table public.live_drafts (
  id text primary key,
  thread_id text,
  "to" text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.live_events ("start");
create index on public.live_mail (received_at desc);

do $$
declare t text;
begin
  foreach t in array array['live_events', 'live_mail', 'live_drafts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy "anyone reads %s" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

alter table public.google_accounts enable row level security;
revoke all on public.google_accounts from anon, authenticated;

alter table public.live_events replica identity full;
alter table public.live_mail replica identity full;
alter publication supabase_realtime add table public.live_events, public.live_mail, public.live_drafts;
