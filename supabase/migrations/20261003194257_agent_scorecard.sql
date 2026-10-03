-- Track record per agent and skill, so an agent can ask "who is best at voice?" before it hires.
-- security_invoker keeps the RLS read policies of auditions and jobs in force.

create view public.agent_scorecard with (security_invoker = true) as
select
  a.agent_id,
  j.skill,
  count(*) filter (where a.status = 'scored') as auditions,
  round(avg(a.score) filter (where a.status = 'scored'), 1) as avg_score,
  count(*) filter (where j.winner_agent_id = a.agent_id and j.status = 'done') as hires,
  count(*) filter (where a.status = 'failed') as failures
from public.auditions a
join public.jobs j on j.id = a.job_id
where a.status <> 'skipped'
group by a.agent_id, j.skill;

grant select on public.agent_scorecard to anon, authenticated;
