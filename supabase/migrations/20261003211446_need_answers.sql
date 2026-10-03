-- What the business answered before the search: [{id, question, answer}]. The hired agent reads them as standing instructions.
alter table public.needs add column answers jsonb not null default '[]';
