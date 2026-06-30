const express = require('express');
const {
  listPublicNewsletters,
  listPublicNewsletterSlugs,
  getPublicNewsletterBySlug,
  adminGenerateNewsletter
} = require('../controllers/newsletterController');

const publicRouter = express.Router();
publicRouter.get('/slugs', listPublicNewsletterSlugs);
publicRouter.get('/', listPublicNewsletters);
publicRouter.get('/:slug', getPublicNewsletterBySlug);

const adminRouter = express.Router();
adminRouter.post('/generate', adminGenerateNewsletter);

module.exports = { publicRouter, adminRouter };
