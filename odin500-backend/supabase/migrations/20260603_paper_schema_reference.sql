-- Reference: canonical paper-trading schema used by odin500-backend services/paper/*
-- If you created tables manually, ensure columns match this (no fill_qty, slippage, or snapshot.cash_balance).

-- paper_fills columns:
--   order_id, account_id, ticker, side, qty, fill_price, market_price_at_fill, filled_at

-- paper_portfolio_snapshots columns:
--   account_id, equity, cash, snapshot_at

-- Optional: only run if you previously added wrong columns from an old migration
-- alter table public.paper_fills drop column if exists fill_qty;
-- alter table public.paper_fills drop column if exists slippage;
-- alter table public.paper_portfolio_snapshots drop column if exists cash_balance;
