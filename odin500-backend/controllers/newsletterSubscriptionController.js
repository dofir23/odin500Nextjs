const {
  getSubscriptionByUserId,
  subscribeUser,
  unsubscribeUser
} = require('../services/newsletter/subscriptionStore');

function subscriptionStatus(sub) {
  if (!sub || !sub.isActive) {
    return { subscribed: false, emailOptIn: false, inAppOptIn: false, email: null };
  }
  return {
    subscribed: true,
    emailOptIn: sub.emailOptIn,
    inAppOptIn: sub.inAppOptIn,
    email: sub.email
  };
}

async function getSubscribeStatus(req, res) {
  try {
    const sub = await getSubscriptionByUserId(req.user.id);
    return res.json({ success: true, ...subscriptionStatus(sub) });
  } catch (err) {
    console.error('[newsletter-subscribe] status failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to load subscription status' });
  }
}

async function postSubscribe(req, res) {
  const email = String(req.user.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, error: 'Account email is required to subscribe' });
  }
  const emailOptIn = req.body?.emailOptIn !== false;
  const inAppOptIn = req.body?.inAppOptIn !== false;
  try {
    const sub = await subscribeUser({
      userId: req.user.id,
      email,
      emailOptIn,
      inAppOptIn,
      source: req.body?.source || 'app'
    });
    return res.json({ success: true, ...subscriptionStatus(sub) });
  } catch (err) {
    console.error('[newsletter-subscribe] subscribe failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
}

async function deleteSubscribe(req, res) {
  try {
    await unsubscribeUser(req.user.id);
    return res.json({ success: true, subscribed: false, emailOptIn: false, inAppOptIn: false });
  } catch (err) {
    console.error('[newsletter-subscribe] unsubscribe failed:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
  }
}

module.exports = { getSubscribeStatus, postSubscribe, deleteSubscribe };
