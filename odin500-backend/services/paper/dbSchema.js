/**
 * Maps application fields to the live Supabase paper-trading schema.
 *
 * paper_fills: qty, fill_price, market_price_at_fill (not fill_qty / slippage)
 * paper_portfolio_snapshots: cash (not cash_balance)
 * paper_accounts: name required; starting_capital optional
 * paper_positions: realized_pnl, opened_at, updated_at; avg_cost NOT NULL
 * paper_orders: enum types paper_order_side, paper_order_type, paper_order_status
 */

const DEFAULT_ACCOUNT_NAME = 'My Paper Portfolio';

module.exports = {
  DEFAULT_ACCOUNT_NAME,
  STARTING_CAPITAL: 100000
};
