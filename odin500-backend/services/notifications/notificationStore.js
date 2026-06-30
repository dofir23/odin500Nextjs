const crypto = require('crypto');
const bigquery = require('../../config/bigquery');
const { NOTIFICATIONS_TABLE_FQN } = require('../newsletter/newsletterConfig');

let tablesReady = false;

function rowTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v.value) return String(v.value);
  return String(v);
}

function rowToNotification(row) {
  if (!row) return null;
  return {
    id: String(row.notification_id || ''),
    userId: String(row.user_id || ''),
    type: String(row.type || ''),
    title: String(row.title || ''),
    body: row.body ? String(row.body) : '',
    linkPath: row.link_path ? String(row.link_path) : '',
    newsletterSlug: row.newsletter_slug ? String(row.newsletter_slug) : undefined,
    readAt: rowTimestamp(row.read_at),
    createdAt: rowTimestamp(row.created_at)
  };
}

async function ensureTables() {
  if (tablesReady) return;
  const ddl = `
    CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE_FQN} (
      notification_id STRING NOT NULL,
      user_id STRING NOT NULL,
      type STRING NOT NULL,
      title STRING NOT NULL,
      body STRING,
      link_path STRING,
      newsletter_slug STRING,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL
    )
    CLUSTER BY user_id, created_at
  `;
  await bigquery.query({ query: ddl });
  tablesReady = true;
}

async function notificationExistsForNewsletter(userId, newsletterSlug) {
  await ensureTables();
  const query = `
    SELECT notification_id
    FROM ${NOTIFICATIONS_TABLE_FQN}
    WHERE user_id = @userId AND newsletter_slug = @slug
    LIMIT 1
  `;
  const [rows] = await bigquery.query({
    query,
    params: { userId: String(userId), slug: String(newsletterSlug) }
  });
  return Boolean(rows?.[0]);
}

async function createNotification({
  userId,
  type,
  title,
  body,
  linkPath,
  newsletterSlug
}) {
  await ensureTables();
  const notificationId = crypto.randomUUID();
  const query = `
    INSERT INTO ${NOTIFICATIONS_TABLE_FQN} (
      notification_id, user_id, type, title, body, link_path, newsletter_slug, read_at, created_at
    ) VALUES (
      @notificationId, @userId, @type, @title, @body, @linkPath, @newsletterSlug, NULL, CURRENT_TIMESTAMP()
    )
  `;
  await bigquery.query({
    query,
    params: {
      notificationId,
      userId: String(userId),
      type: String(type),
      title: String(title),
      body: body ? String(body) : '',
      linkPath: linkPath ? String(linkPath) : '',
      newsletterSlug: newsletterSlug ? String(newsletterSlug) : ''
    }
  });
  return {
    id: notificationId,
    userId: String(userId),
    type,
    title,
    body: body || '',
    linkPath: linkPath || '',
    newsletterSlug,
    readAt: null,
    createdAt: new Date().toISOString()
  };
}

async function listNotificationsForUser(userId, limit = 30) {
  await ensureTables();
  const query = `
    SELECT notification_id, user_id, type, title, body, link_path, newsletter_slug, read_at, created_at
    FROM ${NOTIFICATIONS_TABLE_FQN}
    WHERE user_id = @userId
    ORDER BY created_at DESC
    LIMIT @limit
  `;
  const [rows] = await bigquery.query({
    query,
    params: { userId: String(userId), limit: Number(limit) }
  });
  return (rows || []).map(rowToNotification).filter(Boolean);
}

async function countUnreadForUser(userId) {
  await ensureTables();
  const query = `
    SELECT COUNT(*) AS cnt
    FROM ${NOTIFICATIONS_TABLE_FQN}
    WHERE user_id = @userId AND read_at IS NULL
  `;
  const [rows] = await bigquery.query({ query, params: { userId: String(userId) } });
  const n = Number(rows?.[0]?.cnt ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function markNotificationRead(userId, notificationId) {
  await ensureTables();
  await bigquery.query({
    query: `
      UPDATE ${NOTIFICATIONS_TABLE_FQN}
      SET read_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId AND notification_id = @notificationId AND read_at IS NULL
    `,
    params: { userId: String(userId), notificationId: String(notificationId) }
  });
}

async function markAllNotificationsRead(userId) {
  await ensureTables();
  await bigquery.query({
    query: `
      UPDATE ${NOTIFICATIONS_TABLE_FQN}
      SET read_at = CURRENT_TIMESTAMP()
      WHERE user_id = @userId AND read_at IS NULL
    `,
    params: { userId: String(userId) }
  });
}

module.exports = {
  ensureTables,
  notificationExistsForNewsletter,
  createNotification,
  listNotificationsForUser,
  countUnreadForUser,
  markNotificationRead,
  markAllNotificationsRead
};
