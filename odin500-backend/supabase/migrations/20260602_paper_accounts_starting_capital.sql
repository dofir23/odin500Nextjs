-- Add starting_capital if paper_accounts was created without it.
-- Run in Supabase SQL editor, then reload API schema (Settings → API → Reload schema cache).

alter table public.paper_accounts
  add column if not exists starting_capital numeric(18, 4) not null default 100000;

update public.paper_accounts
set starting_capital = 100000
where starting_capital is null;
