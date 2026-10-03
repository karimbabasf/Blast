-- The hub as people post to it: listings from several builders, posted over the last two weeks.

update public.market_agents set created_at = now() - interval '13 days 4 hours' where id = 'cal-ada';
update public.market_agents set created_at = now() - interval '12 days 9 hours' where id = 'cal-max';
update public.market_agents set created_at = now() - interval '11 days 2 hours' where id = 'cal-juno';
update public.market_agents set created_at = now() - interval '3 days 7 hours' where id = 'cal-pip';
update public.market_agents set created_at = now() - interval '13 days 1 hour' where id = 'mail-iris';
update public.market_agents set created_at = now() - interval '10 days 5 hours' where id = 'mail-echo';
update public.market_agents set created_at = now() - interval '9 days 8 hours' where id = 'mail-sift';
update public.market_agents set created_at = now() - interval '2 days 3 hours' where id = 'mail-dash';
update public.market_agents set created_at = now() - interval '12 days 6 hours' where id = 'code-forge';
update public.market_agents set created_at = now() - interval '6 days 2 hours' where id = 'code-patch';
update public.market_agents set created_at = now() - interval '8 days 11 hours' where id = 'research-scout';

insert into public.market_agents
  (id, name, builder, role, description, model, system_prompt, tools, price_month_cents, price_action_cents, runs_in, auditionable, created_at)
values
  ('cal-tempo', 'Tempo', '@sofia_builds', 'calendar',
   'Books meetings around your focus blocks. Built for owners who hate back-to-back days.',
   'openai/gpt-5-mini',
   'You are Tempo, a scheduling assistant. Read the day before booking anything and leave breathing room between meetings when you can. Never touch events you were not asked to change. Add the people named as attendees. Reply in one or two sentences.',
   '{list_events,create_event,move_event,cancel_event}', 2400, 9, 'builder_url', true, now() - interval '7 days 3 hours'),
  ('cal-slotter', 'Slotter', 'Northwind Labs', 'calendar',
   'Lightweight booking agent for shops and studios. Finds the first open slot and takes it.',
   'google/gemini-3.5-flash-lite',
   'You are Slotter. Find the first open slot in the window the user asked for and book it. Check existing events for that day first. Add the people named as attendees. One line replies.',
   '{list_events,create_event,move_event,cancel_event}', 1500, 6, 'builder_url', true, now() - interval '5 days 10 hours'),
  ('cal-concierge', 'Concierge', 'Calla AI', 'calendar',
   'Front desk for your calendar: books, reschedules and keeps your week tidy.',
   'anthropic/claude-haiku-4.5',
   'You are Concierge, a front desk assistant for a small business calendar. Check the calendar for the day before you book or move anything, never double book, and add the people named as attendees. Confirm what you did politely in one or two sentences.',
   '{list_events,create_event,move_event,cancel_event}', 3200, 12, 'builder_url', true, now() - interval '1 day 6 hours'),
  ('mail-zen', 'Inbox Zen', 'Calla AI', 'email',
   'Calm inbox triage: labels what matters, archives the noise, drafts replies for you to send.',
   'anthropic/claude-haiku-4.5',
   'You are Inbox Zen, an inbox assistant. List the inbox, act only on what the user asked, label exactly what you were asked to label, and draft replies without sending. Summarise in two sentences.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 2900, 11, 'builder_url', true, now() - interval '6 days 4 hours'),
  ('mail-triage', 'Triage', '@mkt_ops', 'email',
   'Ops-minded email agent. Sorts invoices, customer issues and investor mail in one pass.',
   'openai/gpt-5-mini',
   'You are Triage, an operations email assistant. Sort the inbox by what needs action. Do what the user asked: label, archive and draft replies. Never send email. Reply briefly.',
   '{list_threads,read_thread,label_thread,archive_thread,create_draft}', 1900, 7, 'builder_url', true, now() - interval '4 days 1 hour'),
  ('code-rex', 'Refactor Rex', '@devraj', 'coding',
   'Untangles legacy code into small reviewed pull requests. TypeScript and Python.',
   'anthropic/claude-sonnet-5.5', 'You are Refactor Rex, a coding agent.', '{}', 3900, 20, 'sandbox', false, now() - interval '10 days 2 hours'),
  ('code-testwright', 'Testwright', 'Northwind Labs', 'coding',
   'Writes the missing tests for your repo and keeps CI green.',
   'openai/gpt-5-mini', 'You are Testwright, a coding agent.', '{}', 2900, 15, 'sandbox', false, now() - interval '8 days 6 hours'),
  ('code-shipit', 'Shipit', 'Calla AI', 'coding',
   'Turns a feature request into a working branch with a preview deploy.',
   'anthropic/claude-sonnet-5.5', 'You are Shipit, a coding agent.', '{}', 4900, 25, 'sandbox', false, now() - interval '2 days 9 hours'),
  ('research-lens', 'Lens', '@sofia_builds', 'research',
   'Customer and competitor research for local businesses, with sources and a one page brief.',
   'google/gemini-3.8-flash', 'You are Lens, a research agent.', '{}', 1900, 10, 'blast', false, now() - interval '9 days 1 hour'),
  ('research-ledger', 'Ledger Scout', '@mkt_ops', 'research',
   'Pricing and supplier research: finds cheaper suppliers and compares quotes.',
   'openai/gpt-5-mini', 'You are Ledger Scout, a research agent.', '{}', 2200, 12, 'blast', false, now() - interval '5 days 4 hours'),
  ('research-brief', 'Brief', 'Calla AI', 'research',
   'Morning brief on your market: news, competitors and reviews, every weekday at 7am.',
   'anthropic/claude-haiku-4.5', 'You are Brief, a research agent.', '{}', 1500, 5, 'blast', false, now() - interval '3 days 2 hours'),
  ('research-compete', 'Compete', '@devraj', 'research',
   'Tracks what your competitors ship and charge, with a weekly change log.',
   'google/gemini-3.8-flash', 'You are Compete, a research agent.', '{}', 2500, 14, 'blast', false, now() - interval '20 hours');
