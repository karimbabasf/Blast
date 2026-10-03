-- The marketplace: every agent a business can hire, with a meaning vector for plain-word search.
-- Embeddings are gemini-embedding-001 at 768 dimensions; GET /api/agents fills any that are missing.

create extension if not exists vector with schema extensions;

create table public.agents (
  id text primary key,
  name text not null,
  skills text[] not null,
  description text not null,
  price_cents int not null check (price_cents >= 0),
  real boolean not null default true,
  endpoint text,
  builder text not null default 'Blast',
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;

grant select on public.agents to anon, authenticated;

create policy "anyone reads agents" on public.agents for select to anon, authenticated using (true);

-- Closest meaning first. security invoker keeps the read policy in force.
create function public.match_agents(
  query_embedding extensions.vector(768),
  match_count int,
  skill text default null
)
returns table (
  id text,
  name text,
  skills text[],
  description text,
  price_cents int,
  builder text,
  similarity float
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.name, a.skills, a.description, a.price_cents, a.builder,
    1 - (a.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.agents a
  where a.embedding is not null
    and (match_agents.skill is null or match_agents.skill = any (a.skills))
  order by a.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

grant execute on function public.match_agents(extensions.vector, int, text) to anon, authenticated;

insert into public.agents (id, name, skills, description, price_cents, real) values
  ('script-quill', 'Quill', '{script}', 'Punchy ad copy. Short lines, one clear hook.', 250, true),
  ('script-mara', 'Mara', '{script}', 'Warm storyteller. Builds a tiny scene in 15 seconds.', 300, true),
  ('script-dex', 'Dex', '{script}', 'Cheap and fast. Plain copy, no frills.', 150, true),
  ('script-lex', 'Lex', '{script}', 'Long form copywriter. Blog posts and landing pages.', 400, false),
  ('voice-aria', 'Aria', '{voice}', 'Warm, upbeat radio voice.', 300, true),
  ('voice-bram', 'Bram', '{voice}', 'Deep, calm voice. Late night FM.', 350, true),
  ('voice-kit', 'Kit', '{voice}', 'Bright, fast voice. Morning show energy.', 200, true),
  ('voice-nova', 'Nova', '{voice}', 'Studio voice with a full music bed.', 900, false),
  ('music-tempo', 'Tempo', '{music}', 'Jingles and background music.', 500, false),
  ('image-pixel', 'Pixel', '{image}', 'Product photos and social posts.', 350, false),
  ('video-reel', 'Reel', '{video}', 'Short vertical video ads.', 1200, false),
  ('translate-polyglot', 'Polyglot', '{translate}', 'Translates copy into 30 languages.', 200, false)
on conflict (id) do nothing;
