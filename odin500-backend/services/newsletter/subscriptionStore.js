const bigquery = require('../../config/bigquery');
const { SUBSCRIPTIONS_TABLE_FQN } = require('./newsletterConfig');

let tablesReady = false;

function rowTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v.value) return String(v.value);
  return String(v);
}

function rowToSubscription(row) {
  if (!row) return null;
  return {
    userId: String(row.user_id || ''),
    email: String(row.email || ''),
    subscribedAt: rowTimestamp(row.subscribed_at),
    unsubscribedAt: rowTimestamp(row.unsubscribed_at),
    isActive: Boolean(row.is_active),
    emailOptIn: Boolean(row.email_opt_in),
    inAppOptIn: Boolean(row.in_app_opt_in),
    source: row.source ? String(row.source) : undefined,
    updatedAt: rowTimestamp(row.updated_at)
  };
}

async function ensureTables() {
  if (tablesReady) return;
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${SUBSCRIPTIONS_TABLE_FQN} (
      user_id STRING NOT NULL,
      email STRING NOT NULL,
      subscribed_at TIMESTAMP NOT NULL,
      unsubscribed_at TIMESTAMP,
      is_active BOOL NOT NULL,
      email_opt_in BOOL NOT NULL,
      in_app_opt_in BOOL NOT NULL,
      source STRING,
      updated_at TIMESTAMP NOT NULL
    )
    CLUSTER BY user_id, is_active
  `;
  await bigquery.query({ query: ddl });
  tablesReady = true;
}

async function getSubscriptionByUserId(userId) {
  await ensureTables();
  const query = `
    SELECT user_id, email, subscribed_at, unsubscribed_at, is_active,
           email_opt_in, in_app_opt_in, source, updated_at
    FROM ${SUBSCRIPTIONS_TABLE_FQN}
    WHERE user_id = @userId
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query, params: { userId: String(userId) } });
  return rowToSubscription(rows?.[0]) || null;
}

async function listActiveSubscribers() {
  await ensureTables();
  const query = `
    SELECT user_id, email, subscribed_at, unsubscribed_at, is_active,
           email_opt_in, in_app_opt_in, source, updated_at
    FROM ${SUBSCRIPTIONS_TABLE_FQN}
    WHERE is_active = TRUE
      AND (email_opt_in = TRUE OR in_app_opt_in = TRUE)
  `;
  const [rows] = await bigquery.query({ query });
  return (rows || []).map(rowToSubscription).filter(Boolean);
}

async function deleteSubscriptionByUserId(userId) {
  await ensureTables();
  await bigquery.query({
    query: `DELETE FROM ${SUBSCRIPTIONS_TABLE_FQN} WHERE user_id = @userId`,
    params: { userId: String(userId) }
  });
}

async function upsertSubscription(sub) {
  await ensureTables();
  await deleteSubscriptionByUserId(sub.userId);
  const query = sub.isActive
    ? `
    INSERT INTO ${SUBSCRIPTIONS_TABLE_FQN} (
      user_id, email, subscribed_at, unsubscribed_at, is_active,
      email_opt_in, in_app_opt_in, source, updated_at
    ) VALUES (
      @userId, @email, CURRENT_TIMESTAMP(), NULL, TRUE,
      @emailOptIn, @inAppOptIn, @source, CURRENT_TIMESTAMP()
    )
  `
    : `
    INSERT INTO ${SUBSCRIPTIONS_TABLE_FQN} (
      user_id, email, subscribed_at, unsubscribed_at, is_active,
      email_opt_in, in_app_opt_in, source, updated_at
    ) VALUES (
      @userId, @email, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), FALSE,
      FALSE, FALSE, @source, CURRENT_TIMESTAMP()
    )
  `;
  await bigquery.query({
    query,
    params: {
      userId: sub.userId,
      email: sub.email,
      emailOptIn: sub.isActive ? Boolean(sub.emailOptIn) : false,
      inAppOptIn: sub.isActive ? Boolean(sub.inAppOptIn) : false,
      source: sub.source || 'app'
    }
  });
}

async function subscribeUser({ userId, email, emailOptIn = true, inAppOptIn = true, source = 'app' }) {
  await upsertSubscription({
    userId: String(userId),
    email: String(email).trim().toLowerCase(),
    isActive: true,
    emailOptIn: Boolean(emailOptIn),
    inAppOptIn: Boolean(inAppOptIn),
    source
  });
  return getSubscriptionByUserId(userId);
}

async function unsubscribeUser(userId) {
  const existing = await getSubscriptionByUserId(userId);
  if (!existing) return null;
  await upsertSubscription({
    userId: String(userId),
    email: existing.email,
    isActive: false,
    emailOptIn: false,
    inAppOptIn: false,
    unsubscribedAt: new Date().toISOString(),
    source: existing.source || 'app'
  });
  return getSubscriptionByUserId(userId);
}

module.exports = {
  ensureTables,
  getSubscriptionByUserId,
  listActiveSubscribers,
  subscribeUser,
  unsubscribeUser,
  deleteSubscriptionByUserId
};
