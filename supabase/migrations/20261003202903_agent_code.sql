-- Agents a builder lists as code: Blast runs the source in a Vercel Sandbox. Only the service role
-- reads it, so the table grant becomes a column grant that leaves code out.

alter table public.agents add column if not exists code text;

revoke select on public.agents from anon, authenticated;

grant select (id, name, skills, description, price_cents, real, endpoint, builder, embedding, created_at)
  on public.agents to anon, authenticated;
