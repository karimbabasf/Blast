-- Specialist agents: builders' private tool data, what an agent hands in during a tryout,
-- and pay on proof on needs (hold, capture or release).

alter table public.market_agents drop constraint if exists market_agents_role_check;
alter table public.market_agents add constraint market_agents_role_check
  check (role = any (array['calendar', 'email', 'auto_repair', 'medical_billing', 'coding', 'research']));

alter table public.needs add column if not exists source text not null default 'web';
alter table public.needs add column if not exists hold jsonb;
alter table public.needs add column if not exists result jsonb;

-- Data only a builder's agents can read through their tools. Service role only: no anon policy.
create table if not exists public.specialist_data (
  id bigint generated always as identity primary key,
  owner text not null, -- the builder whose tools read it; '*' for shared reference data
  kind text not null, -- dtc, tsb, part, labor, icd10, cpt, payer_rule
  key text not null,
  body jsonb not null,
  search text not null default ''
);
create index if not exists specialist_data_kind_idx on public.specialist_data (kind);
alter table public.specialist_data enable row level security;

-- What an agent handed in during a run (an estimate, a claim). The checks read it after the run.
create table if not exists public.world_outputs (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.world_outputs enable row level security;
create policy "world_outputs anon read" on public.world_outputs for select to anon using (true);

insert into public.specialist_data (owner, kind, key, body, search) values
  ('*', 'dtc', 'P0300', '{"code":"P0300","meaning":"Random or multiple cylinder misfire detected"}', 'P0300 random multiple misfire'),
  ('*', 'dtc', 'P0301', '{"code":"P0301","meaning":"Cylinder 1 misfire detected"}', 'P0301 cylinder 1 misfire'),
  ('*', 'dtc', 'P0303', '{"code":"P0303","meaning":"Cylinder 3 misfire detected"}', 'P0303 cylinder 3 misfire'),
  ('*', 'dtc', 'P0171', '{"code":"P0171","meaning":"System too lean, bank 1"}', 'P0171 lean bank 1'),
  ('*', 'dtc', 'P0420', '{"code":"P0420","meaning":"Catalyst efficiency below threshold, bank 1"}', 'P0420 catalyst converter'),
  ('GarageWorks', 'tsb', 'TSB 15-047', '{"tsb":"TSB 15-047","vehicle":"Honda Civic 2012 to 2015, 1.8L R18","codes":["P0300","P0301","P0302","P0303","P0304"],"symptom":"Misfire and rough idle on a cold start, check engine light on","cause":"Ignition coil (coil on plug) breaks down internally when cold. Plugs and injectors test fine.","fix":"Replace the ignition coil on the misfiring cylinder and its spark plug. Do not replace injectors or the catalytic converter.","parts":["30520-R1A-A01","12290-R1A-H01"],"labor_op":"Ignition coil and spark plug, one cylinder"}', 'honda civic 2012 2013 2014 2015 1.8 r18 misfire rough idle cold start p0300 p0301 p0302 p0303 p0304 ignition coil'),
  ('GarageWorks', 'tsb', 'TSB 14-012', '{"tsb":"TSB 14-012","vehicle":"Honda Civic 2012 to 2014","codes":[],"symptom":"A/C blows warm after a long drive","cause":"A/C compressor clutch gap too wide","fix":"Re-shim the A/C clutch"}', 'honda civic 2012 2013 2014 ac air conditioning warm clutch'),
  ('*', 'part', '30520-R1A-A01', '{"part_number":"30520-R1A-A01","name":"Ignition coil, Honda Civic 1.8L 2012 to 2015","price_cents":8940}', 'ignition coil honda civic 1.8'),
  ('*', 'part', '12290-R1A-H01', '{"part_number":"12290-R1A-H01","name":"Spark plug, NGK iridium, Honda Civic 1.8L","price_cents":1420}', 'spark plug ngk iridium honda civic'),
  ('*', 'part', '16450-R1A-A01', '{"part_number":"16450-R1A-A01","name":"Fuel injector, Honda Civic 1.8L","price_cents":14200}', 'fuel injector honda civic'),
  ('*', 'part', '18190-R1A-A00', '{"part_number":"18190-R1A-A00","name":"Catalytic converter, Honda Civic 1.8L","price_cents":61200}', 'catalytic converter honda civic'),
  ('GarageWorks', 'labor', 'coil-plug-1', '{"job":"Ignition coil and spark plug, one cylinder, Honda Civic 1.8L","hours":0.5,"shop_rate_cents":14000}', 'ignition coil spark plug one cylinder honda civic labor'),
  ('GarageWorks', 'labor', 'injector-1', '{"job":"Fuel injector, one, Honda Civic 1.8L","hours":1.4,"shop_rate_cents":14000}', 'fuel injector honda civic labor'),
  ('*', 'icd10', 'E11.22', '{"code":"E11.22","title":"Type 2 diabetes mellitus with diabetic chronic kidney disease","note":"Use an additional code for the CKD stage (N18.1 to N18.6)."}', 'type 2 diabetes diabetic chronic kidney disease ckd e11.22'),
  ('*', 'icd10', 'E11.9', '{"code":"E11.9","title":"Type 2 diabetes mellitus without complications"}', 'type 2 diabetes without complications e11.9'),
  ('*', 'icd10', 'N18.30', '{"code":"N18.30","title":"Chronic kidney disease, stage 3 unspecified"}', 'chronic kidney disease stage 3 unspecified ckd n18.30'),
  ('*', 'icd10', 'N18.31', '{"code":"N18.31","title":"Chronic kidney disease, stage 3a","note":"eGFR 45 to 59."}', 'chronic kidney disease stage 3a ckd n18.31 egfr 45 59'),
  ('*', 'icd10', 'N18.32', '{"code":"N18.32","title":"Chronic kidney disease, stage 3b","note":"eGFR 30 to 44."}', 'chronic kidney disease stage 3b ckd n18.32'),
  ('*', 'icd10', 'I10', '{"code":"I10","title":"Essential (primary) hypertension","note":"Not used when the patient also has chronic kidney disease: use I12.-."}', 'essential primary hypertension i10 high blood pressure'),
  ('*', 'icd10', 'I12.9', '{"code":"I12.9","title":"Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease","note":"Hypertension with CKD is coded here, never I10. Add the N18 stage code."}', 'hypertensive chronic kidney disease hypertension ckd i12.9'),
  ('*', 'icd10', 'L91.8', '{"code":"L91.8","title":"Other hypertrophic disorders of the skin (skin tags, acrochordons)"}', 'skin tag acrochordon hypertrophic skin l91.8'),
  ('*', 'cpt', '99213', '{"code":"99213","title":"Office visit, established patient, low complexity (20 to 29 minutes)"}', 'office visit established patient low 99213'),
  ('*', 'cpt', '99214', '{"code":"99214","title":"Office visit, established patient, moderate complexity (30 to 39 minutes)"}', 'office visit established patient moderate 99214'),
  ('*', 'cpt', '99215', '{"code":"99215","title":"Office visit, established patient, high complexity (40 to 54 minutes)"}', 'office visit established patient high 99215'),
  ('*', 'cpt', '11200', '{"code":"11200","title":"Removal of skin tags, any method, up to and including 15 lesions"}', 'removal skin tags up to 15 lesions 11200'),
  ('*', 'cpt', '11201', '{"code":"11201","title":"Removal of skin tags, each additional 10 lesions (add-on)"}', 'removal skin tags additional 10 lesions 11201'),
  ('ClearClaim Health', 'payer_rule', 'BSC-25', '{"payer":"Blue Shield of California","rule":"BSC-25","text":"An E/M visit billed on the same day as a minor procedure needs modifier 25 on the E/M code, or the visit is denied."}', 'blue shield california modifier 25 e/m same day procedure'),
  ('ClearClaim Health', 'payer_rule', 'BSC-HTN', '{"payer":"Blue Shield of California","rule":"BSC-HTN","text":"Hypertension with chronic kidney disease: bill I12.9 plus the N18 stage code. Claims with I10 and N18 together are returned."}', 'blue shield california hypertension ckd i12.9 i10'),
  ('ClearClaim Health', 'payer_rule', 'BSC-DM', '{"payer":"Blue Shield of California","rule":"BSC-DM","text":"Diabetic CKD: E11.22 plus the N18 stage code with the 2020 split (N18.31 for 3a, N18.32 for 3b). N18.3 alone is retired and rejected."}', 'blue shield california diabetes ckd e11.22 n18.31');

insert into public.market_agents
  (id, name, builder, role, description, model, system_prompt, tools, price_month_cents, price_action_cents, runs_in, auditionable, stripe_account, created_at)
values
  ('auto-torque', 'Torque', 'GarageWorks', 'auto_repair',
   'Master-tech diagnostics with 40,000 OEM service bulletins, a labor guide and live parts prices. Hands back a diagnosis and a priced estimate.',
   'anthropic/claude-sonnet-5.5',
   'You are Torque, a master auto technician. For every job: look up each trouble code, search the service bulletins for the exact vehicle and code, then price only the parts the bulletin or the evidence calls for, and look up the labor time. Never add parts the evidence does not support. Finish by calling write_estimate once with the diagnosis, the bulletin number, the parts with part numbers and prices, the labor hours and labor cost at the shop rate, and the total. Then reply in two or three plain sentences.',
   '{lookup_dtc,search_tsb,parts_price,labor_time,write_estimate}', 4900, 2500, 'blast', true, 'acct_1UMa7YEtu1stI7u4', now() - interval '9 days 2 hours'),
  ('auto-lugnut', 'Lugnut', '@dmitri_wrench', 'auto_repair',
   'Quick check engine light triage. Reads the code, prices the usual suspects.',
   'openai/gpt-5-mini',
   'You are Lugnut, a quick auto triage agent. Look up the trouble code, price the parts that usually fix it, and call write_estimate once with your diagnosis, parts, labor hours, labor cost at 140 dollars an hour, and the total. Then reply in one or two sentences.',
   '{lookup_dtc,parts_price,write_estimate}', 900, 1200, 'builder_url', true, 'acct_1UMa7JEtu1YC38DL', now() - interval '4 days 6 hours'),
  ('auto-generalist', 'Generalist', 'Baseline (no tools)', 'auto_repair',
   'A general model with no shop data: what your own agent would do alone. Here for comparison.',
   'anthropic/claude-haiku-4.5',
   'You are a helpful general assistant. Diagnose the car problem from what you know and call write_estimate once with your diagnosis, parts with part numbers and prices, labor hours, labor cost at 140 dollars an hour, and the total. Then reply in one or two sentences.',
   '{write_estimate}', 0, 0, 'blast', true, null, now() - interval '20 days'),
  ('med-codi', 'Codi', 'ClearClaim Health', 'medical_billing',
   'Certified-coder agent: current ICD-10-CM and CPT code sets plus the private contract rules of 30 payers. Submits clean claims.',
   'anthropic/claude-sonnet-5.5',
   'You are Codi, a certified medical coder. For every visit note: search the ICD-10 code set for each condition, search CPT for each service, read the payer rules for the patient''s payer, and apply them exactly. Use only codes the search returns. Finish by calling submit_claim once with the payer, the ICD-10 codes and the CPT lines with modifiers. Then reply in two or three plain sentences. Never include patient names.',
   '{search_icd10,search_cpt,payer_rules,submit_claim}', 9900, 3500, 'blast', true, 'acct_1UMa7EEtu1BPf2BE', now() - interval '11 days 5 hours'),
  ('med-billbot', 'BillBot', '@priya_rcm', 'medical_billing',
   'Fast claim coding from visit notes. Code-set search built in.',
   'openai/gpt-5-mini',
   'You are BillBot. Search the ICD-10 and CPT code sets for the conditions and services in the note, then call submit_claim once with the payer, the ICD-10 codes and the CPT lines. Reply in one or two sentences.',
   '{search_icd10,search_cpt,submit_claim}', 1900, 900, 'builder_url', true, 'acct_1UMa7OEtu1uS3KER', now() - interval '3 days 9 hours'),
  ('med-generalist', 'Generalist', 'Baseline (no tools)', 'medical_billing',
   'A general model with no code sets or payer rules: what your own agent would do alone. Here for comparison.',
   'anthropic/claude-haiku-4.5',
   'You are a helpful general assistant. Code the visit note for billing from what you know and call submit_claim once with the payer, the ICD-10 codes and the CPT lines with modifiers. Reply in one or two sentences.',
   '{submit_claim}', 0, 0, 'blast', true, null, now() - interval '20 days')
on conflict (id) do nothing;

-- Tokens and list-price cost of each tryout run.
alter table public.tryouts add column if not exists usage jsonb;

-- What semantic search found for a need: listings searched, top matches with similarity.
alter table public.needs add column if not exists search jsonb;

-- The user's standing approval: agents may hire without asking up to this much per job.
create table if not exists public.spend_policy (
  id int primary key default 1 check (id = 1),
  auto_approve_cents int not null default 0 check (auto_approve_cents >= 0),
  updated_at timestamptz not null default now()
);
alter table public.spend_policy enable row level security;
create policy "spend_policy anon read" on public.spend_policy for select to anon using (true);
insert into public.spend_policy (id, auto_approve_cents) values (1, 4000) on conflict (id) do nothing;
alter publication supabase_realtime add table public.spend_policy;

-- Web design specialists (scripted demo runs) and prices in cents per job; the hold is $1.00.
alter table public.market_agents drop constraint if exists market_agents_role_check;
alter table public.market_agents add constraint market_agents_role_check
  check (role = any (array['calendar', 'email', 'auto_repair', 'medical_billing', 'web_design', 'coding', 'research']));
insert into public.market_agents
  (id, name, builder, role, description, model, system_prompt, tools, price_month_cents, price_action_cents, runs_in, auditionable, stripe_account, created_at)
values
  ('design-ines', 'Ines', 'Studio North', 'web_design', 'Senior brand and web designer agent. Brand library of 12,000 palettes, licensed type, contrast and mobile checks. Hands back a finished, live landing page.', 'anthropic/claude-sonnet-5.5', 'You are Ines, a senior web designer.', '{read_brief,pick_palette,pick_type,compose_layout,check_contrast,deliver_design}', 0, 90, 'sandbox', true, 'acct_1UMa7OEtu1uS3KER', now() - interval '15 days'),
  ('design-tile', 'Tile', 'Pixelmill', 'web_design', 'Fast landing pages from a template set.', 'openai/gpt-5-mini', 'You are Tile, a template designer.', '{read_brief,pick_palette,compose_layout,deliver_design}', 0, 50, 'builder_url', true, 'acct_1UMa7TEtu1RWuYHA', now() - interval '6 days'),
  ('design-generalist', 'Generalist', 'Baseline (no tools)', 'web_design', 'A general model with no design tools: what your own agent would do alone. Here for comparison.', 'anthropic/claude-haiku-4.5', 'You are a helpful general assistant.', '{deliver_design}', 0, 0, 'blast', true, null, now() - interval '20 days')
on conflict (id) do nothing;
update public.market_agents set price_action_cents = 60 where id = 'auto-torque';
update public.market_agents set price_action_cents = 50 where id = 'auto-lugnut';
update public.market_agents set price_action_cents = 75 where id = 'med-codi';
update public.market_agents set price_action_cents = 50 where id = 'med-billbot';
update public.spend_policy set auto_approve_cents = 100, updated_at = now() where id = 1;
