const {
  listNotificationsForUser,
  countUnreadForUser,
  markNotificationRead,
  markAllNotificationsRead
} = require('../services/notifications/notificationStore');

function toPublicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.linkPath,
    newsletterSlug: row.newsletterSlug,
    readAt: row.readAt,
    createdAt: row.createdAt,
    unread: !row.readAt
  };
}

async function listNotifications(req, res) {
  const limit = Math.min(Number(req.query.limit || 30), 100);
  try {
    const rows = await listNotificationsForUser(req.user.id, limit);
    return res.json({ success: true, notifications: rows.map(toPublicNotification) });
  } catch (err) {
    console.error('[notifications] list failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await countUnreadForUser(req.user.id);
    return res.json({ success: true, count });
  } catch (err) {
    console.error('[notifications] count failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load unread count' });
  }
}

async function patchMarkRead(req, res) {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, error: 'Missing notification id' });
  try {
    await markNotificationRead(req.user.id, id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[notifications] mark read failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to mark notification read' });
  }
}

async function patchMarkAllRead(req, res) {
  try {
    await markAllNotificationsRead(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[notifications] mark all read failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to mark all read' });
  }
}

module.exports = {
  listNotifications,
  getUnreadCount,
  patchMarkRead,
  patchMarkAllRead
};
