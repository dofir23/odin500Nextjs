-- AI-managed portfolios: structured engine/index/direction/criteria/cadence tags
-- (replaces text-heuristic tagging for accounts created via the AI portfolio creator)
-- plus an audit log for autonomous rebalance runs.
-- Run in Supabase SQL editor.

alter table public.paper_accounts
  add column if not exists ai_engine text null,
  add column if not exists ai_index_focus text null,
  add column if not exists ai_direction text null,
  add column if not exists ai_criteria text null,
  add column if not exists ai_rebalance_cadence text null,
  add column if not exists ai_managed boolean not null default false,
  add column if not exists ai_last_rebalanced_at timestamptz null;

-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`; guard manually so this file stays re-runnable.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_paper_accounts_ai_direction') then
    alter table public.paper_accounts
      add constraint chk_paper_accounts_ai_direction
      check (ai_direction is null or ai_direction in ('long', 'short', 'long_short'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_paper_accounts_ai_cadence') then
    alter table public.paper_accounts
      add constraint chk_paper_accounts_ai_cadence
      check (ai_rebalance_cadence is null or ai_rebalance_cadence in ('daily', 'weekly', 'monthly'));
  end if;
end $$;

create index if not exists idx_paper_accounts_ai_managed
  on public.paper_accounts (ai_managed, ai_rebalance_cadence, ai_last_rebalanced_at)
  where ai_managed = true;

create table if not exists public.paper_ai_rebalance_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  engine text not null,
  ran_at timestamptz not null default now(),
  added jsonb not null default '[]'::jsonb,
  dropped jsonb not null default '[]'::jsonb,
  raw_output text null,
  status text not null default 'ok',
  error text null
);

create index if not exists idx_paper_ai_rebalance_log_account
  on public.paper_ai_rebalance_log (account_id, ran_at desc);
