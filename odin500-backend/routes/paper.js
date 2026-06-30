// Paper trading API — auth: middleware/authMiddleware requireAuthStrict (same as watchlists).
// Mount: index.js → app.use('/api/paper', paperRoutes)

const express = require('express');
const router = express.Router();
const { requireAuthStrict } = require('../middleware/authMiddleware');
const supabaseService = require('../config/supabaseService');
const {
  getOrCreateAccount,
  resolveAccountForUser,
  listAccountsForUser,
  createAccountForUser,
  deleteAccountForUser,
  setAccountPublished,
  placeOrder,
  cancelOrderForUser,
  modifyOrderForUser,
  STARTING_CAPITAL
} = require('../services/paper/orderEngine');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('../services/paper/pnlCalculator');
const { runStrategiesForAccount } = require('../services/paper/strategyRunner');
const { getWatchlistSignalLeaders } = require('../services/paper/watchlistResolver');
const {
  getAccountsSummary,
  getSectorAllocation,
  getCompareHistory
} = require('../services/paper/portfolioAnalytics');

router.use(requireAuthStrict);

async function loadActiveAccount(userId, req) {
  const accountId = req.query.account_id || req.query.accountId || req.body?.account_id || req.body?.accountId;
  return resolveAccountForUser(userId, accountId);
}

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await listAccountsForUser(req.user.id);
    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounts/summary', async (req, res) => {
  try {
    const accounts = await getAccountsSummary(req.user.id);
    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const account = await createAccountForUser(req.user.id, req.body || {});
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const result = await deleteAccountForUser(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    const msg = error.message || 'Delete failed';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

router.patch('/accounts/:id/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const account = await setAccountPublished(req.user.id, req.params.id, true, {
      publishDescription: body.publishDescription ?? body.publish_description,
      publishStrategy: body.publishStrategy ?? body.publish_strategy
    });
    res.status(200).json(account);
  } catch (error) {
    const msg = error.message || 'Publish failed';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

router.patch('/accounts/:id/unpublish', async (req, res) => {
  try {
    const account = await setAccountPublished(req.user.id, req.params.id, false);
    res.status(200).json(account);
  } catch (error) {
    const msg = error.message || 'Unpublish failed';
    const status = msg.includes('not found') ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

router.get('/account', async (req, res) => {
  try {
    const userId = req.user.id;
    const account = await loadActiveAccount(userId, req);
    const { data: lots, error: lotErr } = await supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0);
    if (lotErr) throw lotErr;

    const { data: closedTrades, error: closeErr } = await supabaseService
      .from('paper_trades_closed')
      .select('*')
      .eq('account_id', account.id)
      .order('closed_at', { ascending: false })
      .limit(500);
    if (closeErr) throw closeErr;

    const enrichedLots = await enrichLotsWithPnl(lots || []);
    const positions = aggregateLotsToPositions(enrichedLots);
    const metrics = summarizeAccountMetrics(account, positions, closedTrades || []);

    res.status(200).json({
      ...account,
      ...metrics,
      positions_count: positions.length,
      positions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const result = await placeOrder(req.user.id, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    const msg = error.message || 'Order failed';
    const status =
      msg.includes('Insufficient') || msg.includes('required') || msg.includes('exceed')
        ? 400
        : 500;
    res.status(status).json({ error: msg });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const order = await cancelOrderForUser(
      req.user.id,
      req.params.id,
      req.query.account_id || req.query.accountId || null
    );
    res.status(200).json(order);
  } catch (error) {
    const status = error.message === 'Order not found' ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const order = await modifyOrderForUser(
      req.user.id,
      req.params.id,
      req.body || {},
      req.query.account_id || req.query.accountId || req.body?.account_id || null
    );
    res.status(200).json(order);
  } catch (error) {
    const status =
      error.message === 'Order not found'
        ? 404
        : error.message.includes('Insufficient') ||
            error.message.includes('required') ||
            error.message.includes('exceed') ||
            error.message.includes('must') ||
            error.message.includes('Only pending') ||
            error.message.includes('cannot be modified')
          ? 400
          : 500;
    res.status(status).json({ error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data, error } = await supabaseService
      .from('paper_orders')
      .select('*')
      .eq('account_id', account.id)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.status(200).json({ orders: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const { data, error } = await supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0);

    if (error) throw error;
    const enrichedLots = await enrichLotsWithPnl(data || []);
    const positions = aggregateLotsToPositions(enrichedLots);
    res.status(200).json({ positions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portfolio/history', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const { data, error } = await supabaseService
      .from('paper_portfolio_snapshots')
      .select('snapshot_at, equity, cash')
      .eq('account_id', account.id)
      .order('snapshot_at', { ascending: true })
      .limit(500);

    if (error) throw error;
    const history = (data || []).map((row) => ({
      snapshot_at: row.snapshot_at,
      equity: row.equity,
      cash_balance: row.cash
    }));
    res.status(200).json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portfolio/compare-history', async (req, res) => {
  try {
    const accounts = await getCompareHistory(req.user.id);
    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portfolio/sectors', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const payload = await getSectorAllocation(req.user.id, account.id);
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trades', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const { data, error } = await supabaseService
      .from('paper_fills')
      .select('*')
      .eq('account_id', account.id)
      .order('filled_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.status(200).json({ trades: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trades/closed', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const { data, error } = await supabaseService
      .from('paper_trades_closed')
      .select('*')
      .eq('account_id', account.id)
      .order('closed_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const totals = (data || []).reduce(
      (acc, row) => {
        acc.realized += Number(row.net_realized_pnl || 0);
        acc.gross += Number(row.gross_realized_pnl || 0);
        return acc;
      },
      { realized: 0, gross: 0 }
    );
    res.status(200).json({
      trades: data || [],
      totals: {
        gross_realized_pnl: Math.round(totals.gross * 100) / 100,
        net_realized_pnl: Math.round(totals.realized * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/strategies', async (req, res) => {
  try {
    const { data, error } = await supabaseService
      .from('paper_strategies')
      .select('*, paper_strategy_rules(*), paper_strategy_account_bindings(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ strategies: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/strategies', async (req, res) => {
  try {
    const payload = req.body || {};
    const { data, error } = await supabaseService
      .from('paper_strategies')
      .insert({
        user_id: req.user.id,
        name: String(payload.name || '').trim() || 'Untitled Strategy',
        strategy_key: String(payload.strategy_key || 'rule-based'),
        description: payload.description || null,
        is_active: payload.is_active !== false
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/strategies/:id/rules', async (req, res) => {
  try {
    const strategyId = req.params.id;
    const payload = req.body || {};
    const { data: strategy, error: sErr } = await supabaseService
      .from('paper_strategies')
      .select('id, user_id')
      .eq('id', strategyId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    const { data, error } = await supabaseService
      .from('paper_strategy_rules')
      .insert({
        strategy_id: strategyId,
        rule_type: String(payload.rule_type || 'always'),
        ticker: String(payload.ticker || '').toUpperCase(),
        action: String(payload.action || 'BTO').toUpperCase(),
        qty: Number(payload.qty || 0),
        threshold_value: payload.threshold_value != null ? Number(payload.threshold_value) : null,
        params: payload.params || {},
        is_active: payload.is_active !== false
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function assertStrategyOwned(userId, strategyId) {
  const { data: strategy, error } = await supabaseService
    .from('paper_strategies')
    .select('id, user_id')
    .eq('id', strategyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!strategy) {
    const err = new Error('Strategy not found');
    err.status = 404;
    throw err;
  }
  return strategy;
}

async function assertNoOtherActiveBinding(accountId, strategyId) {
  const { data: existing, error } = await supabaseService
    .from('paper_strategy_account_bindings')
    .select('id, strategy_id')
    .eq('account_id', accountId)
    .eq('is_active', true);
  if (error) throw error;
  const conflict = (existing || []).find((b) => b.strategy_id !== strategyId);
  if (conflict) {
    const err = new Error(
      'This portfolio already has an active strategy. Pause or remove it before binding another.'
    );
    err.status = 400;
    throw err;
  }
}

router.get('/strategies/watchlist-signals', async (req, res) => {
  try {
    const watchlistKey = req.query.watchlist_key || req.query.watchlistKey;
    if (!watchlistKey) {
      return res.status(400).json({ error: 'watchlist_key is required' });
    }
    const limit = req.query.limit;
    const { data, cacheHit } = await getWatchlistSignalLeaders(req.user.id, String(watchlistKey), {
      limit
    });
    res.set('X-Cache-Hit', cacheHit ? '1' : '0');
    res.status(200).json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.get('/strategies/by-account', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const { data: binding, error: bErr } = await supabaseService
      .from('paper_strategy_account_bindings')
      .select('*, paper_strategies(*, paper_strategy_rules(*))')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!binding?.paper_strategies) {
      return res.status(200).json({ strategy: null, binding: null, rules: [] });
    }
    const strategy = binding.paper_strategies;
    const rules = (strategy.paper_strategy_rules || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    res.status(200).json({
      strategy: { ...strategy, paper_strategy_rules: undefined },
      binding: {
        id: binding.id,
        strategy_id: binding.strategy_id,
        account_id: binding.account_id,
        is_active: binding.is_active,
        last_run_at: binding.last_run_at,
        last_error: binding.last_error,
        created_at: binding.created_at
      },
      rules
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/strategies/execution-log', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { data, error } = await supabaseService
      .from('paper_strategy_execution_log')
      .select('*, paper_strategy_rules(rule_type, ticker, action)')
      .eq('account_id', account.id)
      .order('ran_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.status(200).json({ log: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/strategies/run-once', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);
    const result = await runStrategiesForAccount(account.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/strategies/:id', async (req, res) => {
  try {
    const strategyId = req.params.id;
    await assertStrategyOwned(req.user.id, strategyId);
    const payload = req.body || {};
    const updates = {};
    if (payload.name != null) updates.name = String(payload.name).trim() || 'Untitled Strategy';
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.is_active !== undefined) updates.is_active = !!payload.is_active;
    if (payload.watchlist_key !== undefined) {
      updates.watchlist_key =
        payload.watchlist_key == null || payload.watchlist_key === ''
          ? null
          : String(payload.watchlist_key);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const { data, error } = await supabaseService
      .from('paper_strategies')
      .update(updates)
      .eq('id', strategyId)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.patch('/strategies/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id: strategyId, ruleId } = req.params;
    await assertStrategyOwned(req.user.id, strategyId);
    const payload = req.body || {};
    const updates = {};
    if (payload.rule_type != null) updates.rule_type = String(payload.rule_type);
    if (payload.ticker != null) updates.ticker = String(payload.ticker).toUpperCase();
    if (payload.action != null) updates.action = String(payload.action).toUpperCase();
    if (payload.qty != null) updates.qty = Number(payload.qty);
    if (payload.threshold_value !== undefined) {
      updates.threshold_value =
        payload.threshold_value != null ? Number(payload.threshold_value) : null;
    }
    if (payload.params !== undefined) updates.params = payload.params || {};
    if (payload.is_active !== undefined) updates.is_active = !!payload.is_active;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const { data, error } = await supabaseService
      .from('paper_strategy_rules')
      .update(updates)
      .eq('id', ruleId)
      .eq('strategy_id', strategyId)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Rule not found' });
    res.status(200).json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.delete('/strategies/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id: strategyId, ruleId } = req.params;
    await assertStrategyOwned(req.user.id, strategyId);
    const { error } = await supabaseService
      .from('paper_strategy_rules')
      .delete()
      .eq('id', ruleId)
      .eq('strategy_id', strategyId);
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.post('/strategies/:id/bindings', async (req, res) => {
  try {
    const strategyId = req.params.id;
    const body = req.body || {};
    if (!body.account_id && !body.accountId) {
      return res.status(400).json({ error: 'account_id is required' });
    }
    const account = await resolveAccountForUser(
      req.user.id,
      body.account_id || body.accountId
    );
    await assertStrategyOwned(req.user.id, strategyId);
    await assertNoOtherActiveBinding(account.id, strategyId);

    const { data, error } = await supabaseService
      .from('paper_strategy_account_bindings')
      .upsert(
        {
          strategy_id: strategyId,
          account_id: account.id,
          is_active: body.is_active !== false
        },
        { onConflict: 'strategy_id,account_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.patch('/strategies/:id/bindings', async (req, res) => {
  try {
    const strategyId = req.params.id;
    const body = req.body || {};
    if (!body.account_id && !body.accountId) {
      return res.status(400).json({ error: 'account_id is required' });
    }
    const account = await resolveAccountForUser(
      req.user.id,
      body.account_id || body.accountId
    );
    await assertStrategyOwned(req.user.id, strategyId);
    if (body.is_active === true) {
      await assertNoOtherActiveBinding(account.id, strategyId);
    }
    const updates = {};
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const { data, error } = await supabaseService
      .from('paper_strategy_account_bindings')
      .update(updates)
      .eq('strategy_id', strategyId)
      .eq('account_id', account.id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Binding not found' });
    res.status(200).json(data);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

router.post('/account/reset', async (req, res) => {
  try {
    const account = await loadActiveAccount(req.user.id, req);

    await supabaseService
      .from('paper_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('account_id', account.id)
      .eq('status', 'pending');

    const resetTables = [
      'paper_strategy_execution_log',
      'paper_fills',
      'paper_orders',
      'paper_positions',
      'paper_position_lots',
      'paper_lot_closures',
      'paper_trades_closed',
      'paper_portfolio_snapshots',
      'paper_account_daily_snapshots'
    ];
    for (const table of resetTables) {
      const { error: delErr } = await supabaseService.from(table).delete().eq('account_id', account.id);
      if (delErr && !/relation|does not exist|schema cache/i.test(String(delErr.message || ''))) {
        throw delErr;
      }
    }

    const { data: binding } = await supabaseService
      .from('paper_strategy_account_bindings')
      .select('strategy_id')
      .eq('account_id', account.id)
      .maybeSingle();

    if (binding?.strategy_id) {
      const { error: rulesErr } = await supabaseService
        .from('paper_strategy_rules')
        .delete()
        .eq('strategy_id', binding.strategy_id);
      if (rulesErr) throw rulesErr;

      await supabaseService
        .from('paper_strategy_account_bindings')
        .update({ last_run_at: null, last_error: null })
        .eq('account_id', account.id);
    }

    const resetPayload = { cash_balance: STARTING_CAPITAL };
    if (account.starting_capital != null) {
      resetPayload.starting_capital = STARTING_CAPITAL;
    }
    const { data: updated, error } = await supabaseService
      .from('paper_accounts')
      .update(resetPayload)
      .eq('id', account.id)
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
