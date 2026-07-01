const fetch = require('node-fetch');
const { config } = require('../config');

async function notifyPostGenerated(post) {
  if (!config.webhookUrl) return;

  const twitter = post.copy?.twitter || '';
  const preview = twitter.slice(0, 280);
  const imageUrl = post.assets?.imagePath
    ? `(local) ${post.assets.imagePath}`
    : '(no image)';

  const payload = {
    text: [
      `**Odin500 social draft** — \`${post.id}\``,
      `Campaign: ${post.campaign} · Status: ${post.status}`,
      '',
      preview,
      '',
      `Link: ${post.links?.twitter || post.links?.default || ''}`,
      `Image: ${imageUrl}`
    ].join('\n')
  };

  // Slack incoming webhook
  if (config.webhookUrl.includes('hooks.slack.com')) {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload.text })
    });
    return;
  }

  // Discord webhook
  await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: payload.text.slice(0, 1900) })
  });
}

module.exports = { notifyPostGenerated };
