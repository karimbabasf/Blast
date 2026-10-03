-- The contract from SPEC.md. The app reads with the anon key; only the API routes write, with the service role.

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  mode text not null default 'approve' check (mode in ('approve', 'auto')),
  budget_cents int not null default 1000,
  price_cents int not null default 2000,
  status text not null default 'splitting'
    check (status in ('splitting', 'auditioning', 'waiting', 'hiring', 'done')),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  skill text not null check (skill in ('script', 'voice')),
  brief text not null,
  "order" int not null default 0,
  status text not null default 'auditioning'
    check (status in ('auditioning', 'waiting', 'hired', 'done')),
  winner_agent_id text,
  output_text text,
  audio_url text
);

create table public.auditions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  agent_id text not null,
  status text not null default 'running'
    check (status in ('skipped', 'running', 'scored', 'failed')),
  skip_reason text,
  output_text text,
  audio_url text,
  score numeric(3, 1) check (score between 0 and 10),
  reason text,
  unique (job_id, agent_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  agent_id text not null,
  amount_cents int not null check (amount_cents >= 0),
  stripe_id text,
  status text not null default 'pending'
);

create index on public.jobs (run_id);
create index on public.auditions (job_id);
create index on public.payments (run_id);
create index on public.payments (job_id);

alter table public.runs enable row level security;
alter table public.jobs enable row level security;
alter table public.auditions enable row level security;
alter table public.payments enable row level security;

grant select on public.runs, public.jobs, public.auditions, public.payments to anon, authenticated;

create policy "anyone reads runs" on public.runs for select to anon, authenticated using (true);
create policy "anyone reads jobs" on public.jobs for select to anon, authenticated using (true);
create policy "anyone reads auditions" on public.auditions for select to anon, authenticated using (true);
create policy "anyone reads payments" on public.payments for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.jobs, public.auditions;

insert into storage.buckets (id, name, public) values ('audio', 'audio', true)
on conflict (id) do nothing;
