-- Allow multiple paper accounts per user (required for POST /api/paper/accounts).
-- Run once in Supabase SQL editor, then reload API schema cache.
--
-- Error this fixes:
--   duplicate key value violates unique constraint "paper_accounts_user_id_key"

alter table public.paper_accounts
  drop constraint if exists paper_accounts_user_id_key;

-- Optional: prevent duplicate account names for the same user
create unique index if not exists uq_paper_accounts_user_name
  on public.paper_accounts (user_id, name);
