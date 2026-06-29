-- Add optional watchlist binding to paper strategies (run once in Supabase SQL editor).
alter table public.paper_strategies
  add column if not exists watchlist_key text null;

comment on column public.paper_strategies.watchlist_key is
  'Optional watchlist reference: usr:<uuid> or def:<market_group_name>';
