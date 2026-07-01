const supabaseService = require('../../config/supabaseService');
const bigquery = require('../../config/bigquery');
const { SUBSCRIPTIONS_TABLE_FQN, NEWSLETTER_TABLE_FQN } = require('../newsletter/newsletterConfig');
const { listNewsletterSummaries } = require('../newsletter/newsletterStore');
const {
  getSubscriptionByUserId,
  unsubscribeUser,
  ensureTables: ensureSubscriptionTables
} = require('../newsletter/subscriptionStore');
const { listNotificationsForUser } = require('../notifications/notificationStore');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('../paper/pnlCalculator');
const { logAdminAction } = require('./adminAudit');
const { countAdmins } = require('./adminAuth');
const {
  PLAN_NAMES,
  PLAN_STATUSES,
  defaultRenewalFromJoinDate,
  normalizePlanName,
  normalizePlanStatus
} = require('./adminPlans');
const { deleteAccountForUser } = require('../paper/orderEngine');
const { deleteSubscriptionByUserId } = require('../newsletter/subscriptionStore');

function rowTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v.value) return String(v.value);
  return String(v);
}

async function getAuthUser(userId) {
  const { data, error } = await supabaseService.auth.admin.getUserById(String(userId));
  if (error) throw error;
  return data?.user || null;
}

async function fetchProfilesByIds(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabaseService
    .from('user_profiles')
    .select(
      'id, display_name, is_admin, plan_name, plan_status, plan_renewal_at, updated_at'
    )
    .in('id', ids);

  if (error) throw error;
  const map = new Map();
  for (const row of data || []) map.set(row.id, row);
  return map;
}

async function fetchUserAggregates(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  const result = new Map();
  for (const id of ids) {
    result.set(id, { paper_account_count: 0, published_portfolio_count: 0, watchlist_count: 0 });
  }
  if (!ids.length) return result;

  const [{ data: accounts }, { data: watchlists }] = await Promise.all([
    supabaseService.from('paper_accounts').select('user_id, is_published').in('user_id', ids),
    supabaseService.from('watchlists').select('user_id').in('user_id', ids)
  ]);

  for (const row of accounts || []) {
    const cur = result.get(row.user_id) || {
      paper_account_count: 0,
      published_portfolio_count: 0,
      watchlist_count: 0
    };
    cur.paper_account_count += 1;
    if (row.is_published) cur.published_portfolio_count += 1;
    result.set(row.user_id, cur);
  }

  for (const row of watchlists || []) {
    const cur = result.get(row.user_id) || {
      paper_account_count: 0,
      published_portfolio_count: 0,
      watchlist_count: 0
    };
    cur.watchlist_count += 1;
    result.set(row.user_id, cur);
  }

  return result;
}

async function fetchSubscriptionsForUsers(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  try {
    await ensureSubscriptionTables();
    const query = `
      SELECT user_id, email, subscribed_at, unsubscribed_at, is_active,
             email_opt_in, in_app_opt_in, source, updated_at
      FROM ${SUBSCRIPTIONS_TABLE_FQN}
      WHERE user_id IN UNNEST(@userIds)
      QUALIFY ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) = 1
    `;
    const [rows] = await bigquery.query({ query, params: { userIds: ids } });
    for (const row of rows || []) {
      map.set(String(row.user_id), {
        email: String(row.email || ''),
        isActive: Boolean(row.is_active),
        emailOptIn: Boolean(row.email_opt_in),
        inAppOptIn: Boolean(row.in_app_opt_in),
        subscribedAt: rowTimestamp(row.subscribed_at),
        unsubscribedAt: rowTimestamp(row.unsubscribed_at)
      });
    }
  } catch (err) {
    console.warn('[admin] subscription batch lookup failed:', err?.message || err);
  }

  return map;
}

async function countActiveSubscribers() {
  try {
    await ensureSubscriptionTables();
    const query = `
      SELECT COUNT(*) AS cnt
      FROM ${SUBSCRIPTIONS_TABLE_FQN}
      WHERE is_active = TRUE
    `;
    const [rows] = await bigquery.query({ query });
    return Number(rows?.[0]?.cnt) || 0;
  } catch {
    return 0;
  }
}

async function countNewsletterIssues() {
  try {
    const query = `SELECT COUNT(*) AS cnt FROM ${NEWSLETTER_TABLE_FQN}`;
    const [rows] = await bigquery.query({ query });
    return Number(rows?.[0]?.cnt) || 0;
  } catch {
    return 0;
  }
}

/** Paginate auth users once — avoids parallel listUsers races and bad Supabase `total`. */
async function getAuthUserStats({ recentDays = 7 } = {}) {
  const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
  let totalUsers = 0;
  let recentSignups = 0;
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabaseService.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    totalUsers += users.length;
    recentSignups += users.filter((u) => u.created_at && u.created_at >= since).length;
    if (users.length < perPage) break;
    page += 1;
    if (page > 100) break;
  }

  return { total_users: totalUsers, recent_signups_7d: recentSignups };
}

async function countUsersFromProfiles() {
  const { count, error } = await supabaseService
    .from('user_profiles')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return Number(count) || 0;
}

async function getOverview() {
  const [publishedResult, subscriberCount, newsletterCount, authStats] = await Promise.all([
    supabaseService.from('paper_accounts').select('id').eq('is_published', true),
    countActiveSubscribers(),
    countNewsletterIssues(),
    getAuthUserStats({ recentDays: 7 })
  ]);

  const publishedRows = publishedResult?.data;
  let totalUsers = authStats.total_users;
  if (totalUsers === 0) {
    totalUsers = await countUsersFromProfiles();
  }

  return {
    total_users: totalUsers,
    recent_signups_7d: authStats.recent_signups_7d,
    active_newsletter_subscribers: subscriberCount,
    published_portfolios: (publishedRows || []).length,
    newsletter_issues: newsletterCount
  };
}

function mapUserRow(authUser, profile, aggregates, subscription) {
  const id = authUser.id;
  const agg = aggregates.get(id) || {
    paper_account_count: 0,
    published_portfolio_count: 0,
    watchlist_count: 0
  };

  return {
    id,
    email: authUser.email || '',
    display_name: profile?.display_name || '',
    is_admin: Boolean(profile?.is_admin),
    created_at: authUser.created_at,
    last_sign_in_at: authUser.last_sign_in_at,
    email_confirmed_at: authUser.email_confirmed_at,
    plan_name: profile?.plan_name || 'Free',
    plan_status: profile?.plan_status || 'active',
    plan_renewal_at: profile?.plan_renewal_at || defaultRenewalFromJoinDate(authUser.created_at),
    paper_account_count: agg.paper_account_count,
    published_portfolio_count: agg.published_portfolio_count,
    watchlist_count: agg.watchlist_count,
    newsletter: subscription
      ? {
          is_active: subscription.isActive,
          email_opt_in: subscription.emailOptIn,
          in_app_opt_in: subscription.inAppOptIn,
          subscribed_at: subscription.subscribedAt
        }
      : null
  };
}

async function listUsers({ page = 1, perPage = 25, search = '' }) {
  const pg = Math.max(1, Number(page) || 1);
  const limit = Math.min(100, Math.max(1, Number(perPage) || 25));
  const q = String(search || '').trim().toLowerCase();

  const { data, error } = await supabaseService.auth.admin.listUsers({ page: pg, perPage: limit });
  if (error) throw error;

  let users = data?.users || [];
  const total = data?.total > 0 ? data.total : users.length;

  const ids = users.map((u) => u.id);
  const [profiles, aggregates, subscriptions] = await Promise.all([
    fetchProfilesByIds(ids),
    fetchUserAggregates(ids),
    fetchSubscriptionsForUsers(ids)
  ]);

  let rows = users.map((u) =>
    mapUserRow(u, profiles.get(u.id), aggregates, subscriptions.get(u.id))
  );

  if (q) {
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        String(r.display_name || '').toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }

  return { users: rows, page: pg, per_page: limit, total };
}

async function getUserDetail(userId) {
  const id = String(userId || '').trim();
  const authUser = await getAuthUser(id);
  if (!authUser) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const [profiles, aggregates] = await Promise.all([
    fetchProfilesByIds([id]),
    fetchUserAggregates([id])
  ]);
  const profile = profiles.get(id);
  const subscription = await getSubscriptionByUserId(id).catch(() => null);

  const [{ data: accounts }, { data: watchlists }, auditResult] = await Promise.all([
    supabaseService.from('paper_accounts').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    supabaseService.from('watchlists').select('id, name, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    supabaseService
      .from('audit_logs')
      .select('event_type, ip_address, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);
  const auditRows = auditResult.error ? [] : auditResult.data || [];

  const paperAccounts = [];
  for (const account of accounts || []) {
    const { data: lots } = await supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0);

    const enrichedLots = await enrichLotsWithPnl(lots || []);
    const positions = aggregateLotsToPositions(enrichedLots);
    const metrics = summarizeAccountMetrics(account, positions, []);

    paperAccounts.push({
      id: account.id,
      name: account.name,
      is_published: Boolean(account.is_published),
      published_at: account.published_at,
      strategy_mode: account.strategy_mode,
      equity: metrics.equity,
      cash_balance: Number(account.cash_balance) || metrics.cash,
      positions_count: positions.length
    });
  }

  const watchlistIds = (watchlists || []).map((w) => w.id);
  let watchlistItemCounts = new Map();
  if (watchlistIds.length) {
    const { data: items } = await supabaseService
      .from('watchlist_items')
      .select('watchlist_id')
      .in('watchlist_id', watchlistIds);
    for (const item of items || []) {
      watchlistItemCounts.set(item.watchlist_id, (watchlistItemCounts.get(item.watchlist_id) || 0) + 1);
    }
  }

  const notifications = await listNotificationsForUser(id, 20).catch(() => []);

  return {
    user: mapUserRow(authUser, profile, aggregates, subscription),
    profile: profile || null,
    paper_accounts: paperAccounts,
    watchlists: (watchlists || []).map((w) => ({
      id: w.id,
      name: w.name,
      created_at: w.created_at,
      item_count: watchlistItemCounts.get(w.id) || 0
    })),
    newsletter: subscription,
    notifications,
    login_events: auditRows || []
  };
}

async function updateUserPlan(adminId, userId, patch) {
  const authUser = await getAuthUser(userId);
  if (!authUser) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const updates = {};
  if (patch.plan_name !== undefined) updates.plan_name = normalizePlanName(patch.plan_name);
  if (patch.plan_status !== undefined) updates.plan_status = normalizePlanStatus(patch.plan_status);
  if (patch.plan_renewal_at !== undefined) {
    updates.plan_renewal_at = patch.plan_renewal_at
      ? new Date(patch.plan_renewal_at).toISOString()
      : defaultRenewalFromJoinDate(authUser.created_at);
  }

  const { data, error } = await supabaseService
    .from('user_profiles')
    .upsert({ id: String(userId), ...updates }, { onConflict: 'id' })
    .select('id, plan_name, plan_status, plan_renewal_at')
    .single();

  if (error) throw error;

  await logAdminAction({
    adminId,
    action: 'update_plan',
    targetUserId: userId,
    metadata: updates
  });

  return data;
}

async function setUserAdmin(adminId, userId, isAdmin) {
  const targetId = String(userId);
  const actingId = String(adminId);
  const nextAdmin = Boolean(isAdmin);

  if (targetId === actingId && !nextAdmin) {
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      const err = new Error('Cannot demote the only admin');
      err.status = 400;
      throw err;
    }
  }

  const { data, error } = await supabaseService
    .from('user_profiles')
    .upsert({ id: targetId, is_admin: nextAdmin }, { onConflict: 'id' })
    .select('id, is_admin')
    .single();

  if (error) throw error;

  await logAdminAction({
    adminId,
    action: nextAdmin ? 'promote_admin' : 'demote_admin',
    targetUserId: targetId,
    metadata: { is_admin: nextAdmin }
  });

  return data;
}

async function adminDeletePortfolio(adminId, userId, accountId) {
  const result = await deleteAccountForUser(String(userId), String(accountId));
  await logAdminAction({
    adminId,
    action: 'delete_portfolio',
    targetUserId: userId,
    targetAccountId: accountId,
    metadata: { name: result.name }
  });
  return result;
}

async function adminDeleteWatchlist(adminId, userId, watchlistId) {
  const wlId = String(watchlistId || '').trim();
  const uid = String(userId || '').trim();

  const { data: existing, error: findErr } = await supabaseService
    .from('watchlists')
    .select('id, name')
    .eq('id', wlId)
    .eq('user_id', uid)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!existing) {
    const err = new Error('Watchlist not found');
    err.status = 404;
    throw err;
  }

  const { error: delItemsErr } = await supabaseService
    .from('watchlist_items')
    .delete()
    .eq('watchlist_id', wlId);
  if (delItemsErr) throw delItemsErr;

  const { error: delWlErr } = await supabaseService
    .from('watchlists')
    .delete()
    .eq('id', wlId)
    .eq('user_id', uid);
  if (delWlErr) throw delWlErr;

  await logAdminAction({
    adminId,
    action: 'delete_watchlist',
    targetUserId: uid,
    metadata: { watchlist_id: wlId, name: existing.name }
  });

  return { id: wlId, name: existing.name };
}

async function deleteRowsQuietly(table, column, value) {
  const { error } = await supabaseService.from(table).delete().eq(column, value);
  if (error && !/relation|does not exist|schema cache/i.test(String(error.message || ''))) {
    console.warn(`[admin] delete ${table}:`, error.message);
  }
}

async function purgeUserData(targetId) {
  const uid = String(targetId);

  await deleteRowsQuietly('paper_strategies', 'user_id', uid);

  const { data: accounts } = await supabaseService.from('paper_accounts').select('id').eq('user_id', uid);
  for (const account of accounts || []) {
    await deleteAccountForUser(uid, account.id);
  }

  const { data: leftoverAccounts } = await supabaseService
    .from('paper_accounts')
    .select('id')
    .eq('user_id', uid);
  for (const account of leftoverAccounts || []) {
    await deleteAccountForUser(uid, account.id);
  }

  const { data: watchlists } = await supabaseService.from('watchlists').select('id').eq('user_id', uid);
  for (const watchlist of watchlists || []) {
    await supabaseService.from('watchlist_items').delete().eq('watchlist_id', watchlist.id);
  }
  if ((watchlists || []).length) {
    await supabaseService.from('watchlists').delete().eq('user_id', uid);
  }

  try {
    await deleteSubscriptionByUserId(uid);
  } catch (err) {
    console.warn('[admin] newsletter subscription delete:', err?.message || err);
  }

  await deleteRowsQuietly('audit_logs', 'user_id', uid);
  await deleteRowsQuietly('admin_audit_log', 'target_user_id', uid);

  const { error: profileDeleteError } = await supabaseService.from('user_profiles').delete().eq('id', uid);
  if (profileDeleteError) throw profileDeleteError;
}

async function adminDeleteUser(adminId, userId) {
  const targetId = String(userId || '').trim();
  const actingId = String(adminId || '').trim();

  if (targetId === actingId) {
    const err = new Error('Cannot delete your own account');
    err.status = 400;
    throw err;
  }

  const authUser = await getAuthUser(targetId);
  if (!authUser) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const profiles = await fetchProfilesByIds([targetId]);
  const profile = profiles.get(targetId);
  if (profile?.is_admin) {
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      const err = new Error('Cannot delete the only admin');
      err.status = 400;
      throw err;
    }
  }

  await purgeUserData(targetId);

  const { error } = await supabaseService.auth.admin.deleteUser(targetId);
  if (error) {
    const err = new Error(error.message || 'Failed to delete auth user');
    err.status = 500;
    throw err;
  }

  await logAdminAction({
    adminId: actingId,
    action: 'delete_user',
    targetUserId: targetId,
    metadata: { email: authUser.email || '' }
  });

  return { id: targetId };
}

async function listPublishedPortfolios() {
  const { data: accounts, error } = await supabaseService
    .from('paper_accounts')
    .select('id, user_id, name, published_at, publish_description, strategy_mode, cash_balance, starting_capital')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  const rows = accounts || [];
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profiles = await fetchProfilesByIds(userIds);
  const authEmails = new Map();

  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const u = await getAuthUser(uid);
        if (u?.email) authEmails.set(uid, u.email);
      } catch {
        /* ignore */
      }
    })
  );

  const result = [];
  for (const account of rows) {
    const { data: lots } = await supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0);
    const enrichedLots = await enrichLotsWithPnl(lots || []);
    const positions = aggregateLotsToPositions(enrichedLots);
    const metrics = summarizeAccountMetrics(account, positions, []);
    const profile = profiles.get(account.user_id);

    result.push({
      id: account.id,
      name: account.name,
      user_id: account.user_id,
      owner_email: authEmails.get(account.user_id) || '',
      owner_label: profile?.display_name || authEmails.get(account.user_id) || 'Unknown',
      published_at: account.published_at,
      equity: metrics.equity,
      total_return: metrics.total_return,
      positions_count: positions.length
    });
  }

  return result;
}

async function adminUnpublishPortfolio(adminId, accountId) {
  const id = String(accountId || '').trim();
  const { data, error } = await supabaseService
    .from('paper_accounts')
    .update({
      is_published: false,
      published_at: null,
      publish_description: null,
      publish_strategy: null
    })
    .eq('id', id)
    .select('id, user_id, name')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const err = new Error('Portfolio not found');
      err.status = 404;
      throw err;
    }
    throw error;
  }

  await logAdminAction({
    adminId,
    action: 'unpublish_portfolio',
    targetUserId: data.user_id,
    targetAccountId: data.id,
    metadata: { name: data.name }
  });

  return data;
}

async function adminUnsubscribeNewsletter(adminId, userId) {
  const result = await unsubscribeUser(userId);
  await logAdminAction({
    adminId,
    action: 'unsubscribe_newsletter',
    targetUserId: userId
  });
  return result;
}

async function listNewsletterIssuesAdmin() {
  return listNewsletterSummaries(200);
}

async function listAllSubscribersAdmin({ limit = 200 } = {}) {
  await ensureSubscriptionTables();
  const query = `
    SELECT user_id, email, subscribed_at, unsubscribed_at, is_active,
           email_opt_in, in_app_opt_in, source, updated_at
    FROM ${SUBSCRIPTIONS_TABLE_FQN}
    ORDER BY updated_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({ query, params: { limit: Math.min(500, Number(limit) || 200) } });
  return (rows || []).map((row) => ({
    user_id: String(row.user_id || ''),
    email: String(row.email || ''),
    is_active: Boolean(row.is_active),
    email_opt_in: Boolean(row.email_opt_in),
    in_app_opt_in: Boolean(row.in_app_opt_in),
    subscribed_at: rowTimestamp(row.subscribed_at),
    unsubscribed_at: rowTimestamp(row.unsubscribed_at),
    source: row.source ? String(row.source) : null,
    updated_at: rowTimestamp(row.updated_at)
  }));
}

module.exports = {
  getOverview,
  listUsers,
  getUserDetail,
  updateUserPlan,
  setUserAdmin,
  adminDeleteUser,
  adminDeletePortfolio,
  adminDeleteWatchlist,
  listPublishedPortfolios,
  adminUnpublishPortfolio,
  adminUnsubscribeNewsletter,
  listNewsletterIssuesAdmin,
  listAllSubscribersAdmin,
  PLAN_NAMES,
  PLAN_STATUSES
};
