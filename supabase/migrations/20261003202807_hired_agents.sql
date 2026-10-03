-- A hire hands the business a ready agent: one row per done job, callable at /api/hired/<id>.
-- Every live call is billed and scored in hire_calls, and those scores join the track record.

create table public.hires (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  agent_id text not null,
  skill text not null check (skill in ('script', 'voice')),
  price_cents int check (price_cents >= 0),
  calls int not null default 0,
  created_at timestamptz not null default now()
);

create table public.hire_calls (
  id uuid primary key default gen_random_uuid(),
  hire_id uuid not null references public.hires (id) on delete cascade,
  input_text text not null,
  output_text text,
  audio_url text,
  score numeric(3, 1) check (score between 0 and 10),
  reason text,
  amount_cents int not null default 0 check (amount_cents >= 0),
  stripe_id text,
  status text not null,
  created_at timestamptz not null default now()
);

create index on public.hires (run_id);
create index on public.hire_calls (hire_id);

alter table public.hires enable row level security;
alter table public.hire_calls enable row level security;

grant select on public.hires, public.hire_calls to anon, authenticated;

create policy "anyone reads hires" on public.hires for select to anon, authenticated using (true);
create policy "anyone reads hire calls" on public.hire_calls for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.hires, public.hire_calls;

-- Hiring stays in the database: a job turning done with a winner becomes a hire.
-- The pipeline writes the payment before it marks the job done, so its price is already there.
create function public.hire_on_job_done()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.hires (run_id, job_id, agent_id, skill, price_cents)
  values (
    new.run_id,
    new.id,
    new.winner_agent_id,
    new.skill,
    (select p.amount_cents from public.payments p
      where p.job_id = new.id and p.agent_id = new.winner_agent_id
      limit 1)
  )
  on conflict (job_id) do nothing;
  return new;
end;
$$;

create trigger hire_on_job_done
after update of status on public.jobs
for each row
when (new.status = 'done' and new.winner_agent_id is not null and old.status is distinct from 'done')
execute function public.hire_on_job_done();

-- Each recorded call bumps the counter in the same transaction, so two calls never race it.
create function public.count_hire_call()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.hires set calls = calls + 1 where id = new.hire_id;
  return new;
end;
$$;

create trigger count_hire_call
after insert on public.hire_calls
for each row
execute function public.count_hire_call();

-- Runs hired before this migration get their hires too.
insert into public.hires (run_id, job_id, agent_id, skill, price_cents)
select j.run_id, j.id, j.winner_agent_id, j.skill,
  (select p.amount_cents from public.payments p
    where p.job_id = j.id and p.agent_id = j.winner_agent_id
    limit 1)
from public.jobs j
where j.status = 'done' and j.winner_agent_id is not null
on conflict (job_id) do nothing;

revoke execute on function public.hire_on_job_done() from public, anon, authenticated;
revoke execute on function public.count_hire_call() from public, anon, authenticated;

-- The track record now counts live calls: avg_score blends audition and live scores,
-- failures include live calls the agent could not finish, and live_calls is new at the end.
create or replace view public.agent_scorecard with (security_invoker = true) as
with work as (
  select a.agent_id, j.skill, a.status, a.score,
    'audition' as kind,
    (j.winner_agent_id = a.agent_id and j.status = 'done') as won
  from public.auditions a
  join public.jobs j on j.id = a.job_id
  where a.status <> 'skipped'
  union all
  select h.agent_id, h.skill,
    case when c.status = 'agent_failed' then 'failed' when c.score is null then 'unscored' else 'scored' end,
    c.score,
    'call',
    false
  from public.hire_calls c
  join public.hires h on h.id = c.hire_id
)
select
  agent_id,
  skill,
  count(*) filter (where kind = 'audition' and status = 'scored') as auditions,
  round(avg(score) filter (where status = 'scored'), 1) as avg_score,
  count(*) filter (where won) as hires,
  count(*) filter (where status = 'failed') as failures,
  count(*) filter (where kind = 'call' and status = 'scored') as live_calls
from work
group by agent_id, skill;

grant select on public.agent_scorecard to anon, authenticated;
