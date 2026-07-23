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

module.exports = { loginLimiter, paperAssistantLimiter };
