-- Stripe for the marketplace: one Connect account per builder, a cache for the one-time Billing setup,
-- and the Stripe customer on each engagement (runtime owns the table) so actions can be metered.

create table public.builder_accounts (
  id uuid primary key default gen_random_uuid(),
  builder text not null unique,
  email text not null,
  stripe_account text not null,
  created_at timestamptz not null default now()
);

create table public.stripe_setup (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.builder_accounts enable row level security;
alter table public.stripe_setup enable row level security;

create policy "anyone reads builder accounts" on public.builder_accounts for select to anon, authenticated using (true);

alter table public.engagements add column if not exists customer_id text;

-- Atomic +1 for every metered action.
create or replace function public.increment_engagement_actions(eid uuid)
returns int language sql security definer set search_path = public as $$
  update public.engagements set actions = actions + 1 where id = eid returning actions;
$$;
revoke execute on function public.increment_engagement_actions(uuid) from public, anon, authenticated;
