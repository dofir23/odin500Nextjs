-- AI-managed portfolios: user-chosen position count and share sizing.
--
-- Before this, the creator hard-coded 5 names (long/short), 10 (long-short), equal-dollar
-- weighted. Now the wizard asks "how many positions?" and "how big is each?", where sizing is
-- one of:
--   equal_split    same share count for every name, as large as the capital covers
--   equal_capital  capital split evenly across names, floored to whole shares (the old behaviour)
--   fixed_qty      an explicit share count, reduced if it would overspend
--
-- ai_position_qty stores the RESOLVED per-position share count (what was actually bought), so
-- rebalances open replacement names at the same size. It is NULL under equal_capital (share
-- counts differ by price) and on accounts created before this migration; both of those resize
-- new names by dollar slice instead.
--
-- Run in Supabase SQL editor. Safe to re-run.

alter table public.paper_accounts
  add column if not exists ai_position_count integer null,
  add column if not exists ai_position_sizing text null,
  add column if not exists ai_position_qty integer null;

-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`. Dropping first (rather than guarding on
-- existence) keeps this re-runnable AND lets the allowed-value list change: an earlier draft of
-- this file only permitted equal_split/fixed_qty, so an "if not exists" guard would silently
-- leave that stale constraint in place and reject every equal_capital account.
alter table public.paper_accounts
  drop constraint if exists chk_paper_accounts_ai_position_count,
  drop constraint if exists chk_paper_accounts_ai_position_sizing,
  drop constraint if exists chk_paper_accounts_ai_position_qty;

alter table public.paper_accounts
  add constraint chk_paper_accounts_ai_position_count
    check (ai_position_count is null or (ai_position_count >= 1 and ai_position_count <= 30)),
  add constraint chk_paper_accounts_ai_position_sizing
    check (ai_position_sizing is null or ai_position_sizing in ('equal_split', 'equal_capital', 'fixed_qty')),
  add constraint chk_paper_accounts_ai_position_qty
    check (ai_position_qty is null or ai_position_qty >= 1);
