-- Manual SQL pack: Multi-account paper trading + strategy automation.
-- Run in Supabase SQL editor. This script is additive and keeps existing data.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'paper_trade_action') then
    create type public.paper_trade_action as enum ('BTO', 'STO', 'BTC', 'STC');
  end if;
end $$;

alter table public.paper_accounts
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists strategy_mode text not null default 'manual';

-- One account per user was the original schema; multi-account needs this dropped.
alter table public.paper_accounts
  drop constraint if exists paper_accounts_user_id_key;

create unique index if not exists uq_paper_accounts_user_name
  on public.paper_accounts (user_id, name);

create table if not exists public.paper_position_lots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  ticker text not null,
  side text not null check (side in ('long', 'short')),
  opened_qty numeric(18,6) not null,
  remaining_qty numeric(18,6) not null,
  entry_price numeric(18,6) not null,
  entry_fees numeric(18,6) not null default 0,
  source_order_id uuid null references public.paper_orders(id) on delete set null,
  source_fill_id uuid null references public.paper_fills(id) on delete set null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create index if not exists idx_paper_position_lots_account_ticker
  on public.paper_position_lots(account_id, ticker, side, opened_at);

create table if not exists public.paper_lot_closures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  ticker text not null,
  close_order_id uuid null references public.paper_orders(id) on delete set null,
  close_fill_id uuid null references public.paper_fills(id) on delete set null,
  open_lot_id uuid not null references public.paper_position_lots(id) on delete cascade,
  close_action public.paper_trade_action not null,
  qty numeric(18,6) not null,
  open_price numeric(18,6) not null,
  close_price numeric(18,6) not null,
  gross_realized_pnl numeric(18,6) not null,
  fees_allocated numeric(18,6) not null default 0,
  net_realized_pnl numeric(18,6) not null,
  closed_at timestamptz not null default now()
);

create index if not exists idx_paper_lot_closures_account_ticker
  on public.paper_lot_closures(account_id, ticker, closed_at desc);

create table if not exists public.paper_trades_closed (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  ticker text not null,
  close_order_id uuid null references public.paper_orders(id) on delete set null,
  close_fill_id uuid null references public.paper_fills(id) on delete set null,
  action public.paper_trade_action not null,
  qty_closed numeric(18,6) not null,
  avg_entry_price numeric(18,6) not null,
  avg_exit_price numeric(18,6) not null,
  gross_realized_pnl numeric(18,6) not null,
  total_fees numeric(18,6) not null default 0,
  net_realized_pnl numeric(18,6) not null,
  closed_at timestamptz not null default now()
);

create index if not exists idx_paper_trades_closed_account_closed_at
  on public.paper_trades_closed(account_id, closed_at desc);

create table if not exists public.paper_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  strategy_key text not null,
  description text null,
  watchlist_key text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_paper_strategies_user_name
  on public.paper_strategies(user_id, name);

create table if not exists public.paper_strategy_rules (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.paper_strategies(id) on delete cascade,
  rule_type text not null,
  ticker text not null,
  action public.paper_trade_action not null,
  qty numeric(18,6) not null,
  threshold_value numeric(18,6) null,
  params jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_paper_strategy_rules_strategy
  on public.paper_strategy_rules(strategy_id, is_active, ticker);

create table if not exists public.paper_strategy_account_bindings (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.paper_strategies(id) on delete cascade,
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  is_active boolean not null default true,
  last_run_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  unique(strategy_id, account_id)
);

create table if not exists public.paper_strategy_execution_log (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.paper_strategies(id) on delete cascade,
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  rule_id uuid null references public.paper_strategy_rules(id) on delete set null,
  status text not null check (status in ('triggered', 'skipped', 'failed')),
  message text null,
  order_id uuid null references public.paper_orders(id) on delete set null,
  ran_at timestamptz not null default now()
);

create table if not exists public.paper_account_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  cash_balance numeric(18,6) not null,
  equity numeric(18,6) not null,
  buying_power numeric(18,6) not null,
  unrealized_pnl numeric(18,6) not null default 0,
  realized_pnl numeric(18,6) not null default 0
);

create index if not exists idx_paper_account_daily_snapshots_account_time
  on public.paper_account_daily_snapshots(account_id, snapshot_at desc);

alter table public.paper_orders
  add column if not exists action public.paper_trade_action,
  add column if not exists source text not null default 'manual',
  add column if not exists commission numeric(18,6) not null default 0,
  add column if not exists exchange_fee numeric(18,6) not null default 0,
  add column if not exists regulatory_fee numeric(18,6) not null default 0,
  add column if not exists slippage_amount numeric(18,6) not null default 0,
  add column if not exists total_fees numeric(18,6) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.paper_fills
  add column if not exists action public.paper_trade_action,
  add column if not exists commission numeric(18,6) not null default 0,
  add column if not exists exchange_fee numeric(18,6) not null default 0,
  add column if not exists regulatory_fee numeric(18,6) not null default 0,
  add column if not exists slippage_amount numeric(18,6) not null default 0,
  add column if not exists total_fees numeric(18,6) not null default 0;

update public.paper_orders
set action = case
  when lower(coalesce(side::text, 'buy')) = 'buy' then 'BTO'::public.paper_trade_action
  else 'STC'::public.paper_trade_action
end
where action is null;

update public.paper_fills f
set action = o.action
from public.paper_orders o
where f.order_id = o.id
  and f.action is null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_paper_position_lots on public.paper_position_lots;
create trigger trg_touch_paper_position_lots
before update on public.paper_position_lots
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_paper_strategies on public.paper_strategies;
create trigger trg_touch_paper_strategies
before update on public.paper_strategies
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_paper_strategy_rules on public.paper_strategy_rules;
create trigger trg_touch_paper_strategy_rules
before update on public.paper_strategy_rules
for each row execute function public.touch_updated_at();

