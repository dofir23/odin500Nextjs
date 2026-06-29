-- Rollback for paper_multi_account_strategy.sql
-- Run in Supabase SQL editor ONLY if you want to undo the multi-account / lot-ledger migration.
--
-- WARNING:
-- - Drops all data in tables created by the forward script (lots, closed trades, strategies, etc.).
-- - Removes new columns from paper_orders / paper_fills / paper_accounts.
-- - Does NOT delete paper_accounts, paper_orders, paper_fills, paper_positions, paper_portfolio_snapshots.
-- - After rollback, deploy the PRE-migration app code or paper APIs will fail (they expect lot tables).
--
-- Recommended: take a backup or export new tables before running.

-- ---------------------------------------------------------------------------
-- 1) Triggers on new tables (safe if tables still exist)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_touch_paper_strategy_rules on public.paper_strategy_rules;
drop trigger if exists trg_touch_paper_strategies on public.paper_strategies;
drop trigger if exists trg_touch_paper_position_lots on public.paper_position_lots;

-- ---------------------------------------------------------------------------
-- 2) New tables (children first)
-- ---------------------------------------------------------------------------
drop table if exists public.paper_strategy_execution_log cascade;
drop table if exists public.paper_strategy_account_bindings cascade;
drop table if exists public.paper_strategy_rules cascade;
drop table if exists public.paper_strategies cascade;

drop table if exists public.paper_lot_closures cascade;
drop table if exists public.paper_trades_closed cascade;
drop table if exists public.paper_position_lots cascade;
drop table if exists public.paper_account_daily_snapshots cascade;

-- ---------------------------------------------------------------------------
-- 3) Columns added to existing tables
-- ---------------------------------------------------------------------------
alter table public.paper_fills
  drop column if exists action,
  drop column if exists commission,
  drop column if exists exchange_fee,
  drop column if exists regulatory_fee,
  drop column if exists slippage_amount,
  drop column if exists total_fees;

alter table public.paper_orders
  drop column if exists action,
  drop column if exists source,
  drop column if exists commission,
  drop column if exists exchange_fee,
  drop column if exists regulatory_fee,
  drop column if exists slippage_amount,
  drop column if exists total_fees,
  drop column if exists metadata;

alter table public.paper_accounts
  drop column if exists is_active,
  drop column if exists archived_at,
  drop column if exists strategy_mode;

-- ---------------------------------------------------------------------------
-- 4) Enum type (only after columns using it are dropped)
-- ---------------------------------------------------------------------------
drop type if exists public.paper_trade_action;

-- ---------------------------------------------------------------------------
-- touch_updated_at() is left in place — other tables may use it.
-- To remove it only if nothing else depends on it:
--   drop function if exists public.touch_updated_at() cascade;
-- ---------------------------------------------------------------------------

-- Reload Supabase API schema cache after running this script.
