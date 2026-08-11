const rateLimit = require('express-rate-limit');

// Rule: Max 5 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Portfolio AI chat — prefer authenticated user id, else IP. */
const paperAssistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PAPER_ASSISTANT_RATE_MAX || 40),
  message: { error: 'Too many assistant requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `paper-assistant:${req.user?.id || req.ip || 'anon'}`,
  validate: { keyGeneratorIpFallback: false }
});

/** AI portfolio creator chat — separate, lower budget (multi-round tool calls against paid APIs). */
const aiPortfolioChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PAPER_AI_PORTFOLIO_RATE_MAX || 20),
  message: { error: 'Too many AI portfolio requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ai-portfolio:${req.user?.id || req.ip || 'anon'}`,
  validate: { keyGeneratorIpFallback: false }
});

/** Copying a portfolio creates an account and places a burst of orders — keep it deliberate. */
const copyPortfolioLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PAPER_COPY_RATE_MAX || 10),
  message: { error: 'Too many portfolio copies. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `copy-portfolio:${req.user?.id || req.ip || 'anon'}`,
  validate: { keyGeneratorIpFallback: false }
});

module.exports = {
  loginLimiter,
  paperAssistantLimiter,
  aiPortfolioChatLimiter,
  copyPortfolioLimiter
};
