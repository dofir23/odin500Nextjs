const { listActiveSubscribers } = require('./subscriptionStore');
const {
  notificationExistsForNewsletter,
  createNotification
} = require('../notifications/notificationStore');
const { sendNewsletterIssueEmail } = require('../notifications/notificationMailer');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fan out in-app notifications + email when a new weekly issue is published.
 * @param {{ slug: string, title: string, description: string, weekLabel?: string }} issue
 */
async function notifyNewsletterSubscribers(issue) {
  const slug = String(issue.slug || '').trim();
  const title = String(issue.title || 'Odin500 Weekly').trim();
  const description = String(issue.description || '').trim();
  const weekLabel = issue.weekLabel ? String(issue.weekLabel) : '';
  if (!slug || !title) {
    return { subscribers: 0, inApp: 0, emails: 0, skipped: 0, errors: 0 };
  }

  const subscribers = await listActiveSubscribers();
  const batchSize = Number(process.env.NEWSLETTER_EMAIL_BATCH_SIZE || 50);
  const batchDelay = Number(process.env.NEWSLETTER_EMAIL_BATCH_DELAY_MS || 1000);

  let inApp = 0;
  let emails = 0;
  let skipped = 0;
  let errors = 0;
  let emailBatch = 0;

  const linkPath = `/newsletter/${slug}`;

  for (const sub of subscribers) {
    try {
      const already = await notificationExistsForNewsletter(sub.userId, slug);
      if (already) {
        skipped += 1;
        continue;
      }

      if (sub.inAppOptIn) {
        await createNotification({
          userId: sub.userId,
          type: 'newsletter_weekly',
          title,
          body: description,
          linkPath,
          newsletterSlug: slug
        });
        inApp += 1;
      }

      if (sub.emailOptIn && sub.email) {
        await sendNewsletterIssueEmail({
          to: sub.email,
          title,
          description,
          weekLabel,
          slug
        });
        emails += 1;
        emailBatch += 1;
        if (emailBatch >= batchSize) {
          emailBatch = 0;
          await sleep(batchDelay);
        }
      }
    } catch (err) {
      errors += 1;
      console.warn(
        `[newsletter-notify] failed user=${sub.userId}:`,
        err?.message || err
      );
    }
  }

  return {
    subscribers: subscribers.length,
    inApp,
    emails,
    skipped,
    errors
  };
}

module.exports = { notifyNewsletterSubscribers };
