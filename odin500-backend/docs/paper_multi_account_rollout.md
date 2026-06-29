# Paper Trading Multi-Account Rollout Guide

## 1) Supabase manual SQL

Run:

- `odin500-backend/supabase/manual/paper_multi_account_strategy.sql`

If **New account** fails with `paper_accounts_user_id_key`, also run (or re-run the strategy script after pulling latest — it includes this fix):

- `odin500-backend/supabase/manual/paper_accounts_allow_multi_per_user.sql`

Then reload Supabase API schema cache.

### Rollback (undo migration)

If you need to revert the database schema to pre-migration state:

1. **Export or backup** new tables first if you care about lot/strategy data (`paper_position_lots`, `paper_trades_closed`, `paper_strategies`, etc.).
2. Run `odin500-backend/supabase/manual/paper_multi_account_rollback.sql`.
3. Reload Supabase API schema cache.
4. **Revert application code** to the commit before multi-account paper trading (new backend reads lot tables; old `paper_positions` rows are unchanged but new trades after migration live only in dropped tables).

Core legacy tables (`paper_accounts`, `paper_orders`, `paper_fills`, `paper_positions`, `paper_portfolio_snapshots`) are not dropped by either script.

## 2) Backfill existing orders/fills

The SQL script backfills `paper_orders.action` and `paper_fills.action` for legacy rows.

## 3) Delete account

- UI: **Delete account** (next to Reset portfolio) removes the selected paper account and all related rows.
- API: `DELETE /api/paper/accounts/:id` (auth required; must own the account).

## 4) Smoke checks

1. Create two accounts from UI.
2. Place these actions on same symbol in one account:
   - `BTO` 10
   - `STO` 5
   - `STC` 4
   - `BTC` 2
3. Verify:
   - open positions show both long/short quantities,
   - closed trades table updates realized P&L,
   - account summary updates open/closed accumulated P&L.

## 5) Strategy API (per portfolio)

All routes require auth (`requireAuthStrict`). Pass `account_id` on query or body where noted.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/paper/strategies` | List user strategies with rules and bindings |
| GET | `/api/paper/strategies/by-account?account_id=` | Strategy + rules + binding for one portfolio |
| GET | `/api/paper/strategies/execution-log?account_id=&limit=50` | Execution log for UI |
| POST | `/api/paper/strategies` | Create strategy `{ name, description?, is_active? }` |
| POST | `/api/paper/strategies/:id/rules` | Add rule (see rule types below) |
| PATCH | `/api/paper/strategies/:id` | Update name, description, `is_active` |
| PATCH | `/api/paper/strategies/:id/rules/:ruleId` | Update rule fields |
| DELETE | `/api/paper/strategies/:id/rules/:ruleId` | Remove rule |
| POST | `/api/paper/strategies/:id/bindings` | Bind — **requires** `account_id` in body; rejects second active strategy on same account |
| PATCH | `/api/paper/strategies/:id/bindings` | Toggle binding `is_active` — requires `account_id` |
| POST | `/api/paper/strategies/run-once` | Body/query `account_id` — evaluate rules for that portfolio now |

### Rule types (v1)

| `rule_type` | Fields | Behavior |
|-------------|--------|----------|
| `price_above` | `threshold_value`, `ticker`, `action`, `qty` | Market order when last close ≥ threshold |
| `price_below` | `threshold_value`, … | Fire when price ≤ threshold |
| `always` | `ticker`, `action`, `qty` | Fire each run (cooldown applies — see below) |
| `signal_side` | `params.side`: `long` \| `short` \| `neutral` | Latest Odin bucket side matches |
| `signal_bucket` | `params.bucket`: `L1`…`S3` \| `N` | Exact latest bucket match |

Odin examples:

```json
{ "rule_type": "signal_side", "ticker": "AAPL", "action": "BTO", "qty": 1, "params": { "side": "long" } }
```

```json
{ "rule_type": "signal_bucket", "ticker": "MSFT", "action": "BTO", "qty": 5, "params": { "bucket": "L2" } }
```

Background runner: `strategyRunner` every ~1 hour by default when `ENABLE_PAPER_JOBS` is not `0` (override with `PAPER_STRATEGY_INTERVAL_MS`; use `86400000` for once per day).

**Position-aware execution (one cycle per trade):**

| Action | When rule condition is true |
|--------|----------------------------|
| `BTO` | Submit only if **no open long** on that ticker |
| `STO` | Submit only if **no open short** on that ticker |
| `STC` | Submit only if **open long** exists (qty = min(rule qty, open long)) |
| `BTC` | Submit only if **open short** exists (qty = min(rule qty, open short)) |

While a signal stays long, a `BTO` rule does **not** stack new buys. Add a second rule (e.g. `STC` when signal short/neutral) to exit, then a new entry can fire when flat and the entry condition matches again.

Example pair: `BTO` + `signal_side` long qty 1; `STC` + `signal_side` short qty 1 (or neutral) to flatten before the next long entry.

## 6) Strategy smoke checklist (UI + API)

1. **Manual account** — create via **New account**; trading unchanged.
2. **Wizard** — **New strategy account** → name + strategy + rule `signal_side` long on AAPL, BTO qty 1 → account shows `(Auto)` in dropdown.
3. **Run now** — Strategy tab → **Run now** → order in Orders with `source: strategy`; log row `triggered`.
4. **Pause** — Pause strategy → next run does not place orders.
5. **Manual + warning** — BTO on same account succeeds; Order ticket shows amber automation notice.
6. **One strategy per account** — bind second strategy to same account → API `400`.
7. **Price rule** — `price_above` BTO fires once while flat; repeats only after position is closed.
8. **No repeat entry** — `signal_side` long + BTO on AAPL with signal stuck on L1: only **one** buy until flat; log shows `Already in long position — entry skipped` on later runs.

## 7) Data consistency queries

### Open lots by account and ticker

```sql
select account_id, ticker, side, sum(remaining_qty) as qty
from public.paper_position_lots
where status = 'open'
group by account_id, ticker, side
order by account_id, ticker, side;
```

### Realized P&L from closures vs closed trades

```sql
select
  c.account_id,
  round(sum(c.net_realized_pnl)::numeric, 4) as closure_net,
  round(sum(t.net_realized_pnl)::numeric, 4) as trade_net
from public.paper_lot_closures c
join public.paper_trades_closed t
  on t.account_id = c.account_id
 and t.close_fill_id = c.close_fill_id
group by c.account_id;
```

## 8) Known assumptions

- FIFO is used for lot closure.
- Equity-only order model now; contracts can reuse `action` + lot tables later.
- Fees/slippage are modeled per fill and included in cash and realized net P&L.
- **Portfolio value (equity):** `cash + Σ(long qty×last price) − Σ(short qty×last price)` per open lot (shorts reduce equity as liabilities).
