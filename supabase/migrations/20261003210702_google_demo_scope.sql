-- The hired agent only ever touches one secondary calendar and one Gmail label in the connected account.
alter table public.google_accounts add column calendar_id text, add column label_id text;
