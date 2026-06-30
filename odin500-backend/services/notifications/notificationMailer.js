const nodemailer = require('nodemailer');

function isEmailEnabled() {
  return process.env.ENABLE_NEWSLETTER_EMAIL !== '0' && Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function frontendBase() {
  return String(process.env.FRONTEND_URL || 'https://www.odin500.com').replace(/\/$/, '');
}

function buildNewsletterEmail({ title, description, weekLabel, slug }) {
  const issueUrl = `${frontendBase()}/newsletter/${encodeURIComponent(slug)}`;
  const unsubscribeUrl = `${frontendBase()}/newsletter`;
  const subject = `Odin500 Weekly: ${title}`;
  const text = `${weekLabel || 'New issue'}\n\n${description}\n\nRead the full recap: ${issueUrl}\n\nUnsubscribe: open ${unsubscribeUrl} and turn off weekly alerts in your account.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#111">
      <p style="color:#666;font-size:14px">${weekLabel || 'Odin500 Weekly'}</p>
      <h1 style="font-size:22px;line-height:1.3">${title}</h1>
      <p style="font-size:16px;line-height:1.5">${description}</p>
      <p><a href="${issueUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Read issue</a></p>
      <p style="font-size:12px;color:#888;margin-top:32px">Not investment advice. Data from Odin500.</p>
      <p style="font-size:12px;color:#888"><a href="${unsubscribeUrl}">Manage newsletter preferences</a></p>
    </div>
  `;
  return { subject, text, html, issueUrl };
}

async function sendNewsletterIssueEmail({ to, title, description, weekLabel, slug }) {
  if (!isEmailEnabled()) {
    console.warn('[newsletter-email] skipped (SMTP not configured or ENABLE_NEWSLETTER_EMAIL=0)');
    return { sent: false, reason: 'disabled' };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const { subject, text, html } = buildNewsletterEmail({ title, description, weekLabel, slug });
  const transport = getTransport();
  await transport.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

module.exports = { isEmailEnabled, sendNewsletterIssueEmail, buildNewsletterEmail };
