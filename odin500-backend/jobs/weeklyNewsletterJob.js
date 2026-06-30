const { generateWeeklyNewsletter } = require('../services/newsletter/generateWeeklyNewsletter');

async function runWeeklyNewsletterJob() {
  return generateWeeklyNewsletter();
}

module.exports = { runWeeklyNewsletterJob };
