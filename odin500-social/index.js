const express = require('express');
const path = require('path');
const { config, ensureDirs } = require('./src/config');
const { log } = require('./src/utils/log');
const { startScheduler } = require('./src/scheduler');
const { runJob, JOBS } = require('./src/jobs');
const { listPosts, getPost, deletePost } = require('./src/queue/store');

ensureDirs();

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'odin500-social',
    odinApi: config.odinApiOrigin,
    odinSite: config.odinSiteOrigin,
    cronEnabled: config.cronEnabled,
    utmEnabled: config.utmEnabled,
    openai: {
      configured: Boolean(config.openaiApiKey),
      model: config.openaiModel
    },
    snapshot: {
      enabled: config.snapshotEnabled,
      puppeteerPath: config.puppeteerExecutablePath || 'bundled'
    },
    jobs: Object.keys(JOBS)
  });
});

function requireSecret(req, res, next) {
  if (!config.internalSecret) {
    return res.status(503).json({ error: 'SOCIAL_INTERNAL_SECRET not configured' });
  }
  const key = req.headers['x-social-secret'];
  if (key !== config.internalSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/posts', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const status = req.query.status ? String(req.query.status) : undefined;
  res.json({ posts: listPosts({ limit, status }) });
});

app.get('/posts/:id', (req, res) => {
  const post = getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post });
});

app.get('/assets/:file', (req, res) => {
  const file = path.basename(req.params.file);
  res.sendFile(path.join(config.assetsDir, file), (err) => {
    if (err) res.status(404).json({ error: 'Asset not found' });
  });
});

app.post('/jobs/:name', requireSecret, async (req, res) => {
  try {
    const post = await runJob(req.params.name, req.body || {});
    res.status(201).json({ success: true, post });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Job failed' });
  }
});

app.delete('/posts/:id', requireSecret, (req, res) => {
  const removed = deletePost(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true, id: req.params.id });
});

app.post('/posts/:id/discard', requireSecret, (req, res) => {
  const removed = deletePost(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true, id: req.params.id });
});

app.listen(config.port, () => {
  log.info('server', `listening on :${config.port}`);
  log.info('server', 'OpenAI', {
    configured: Boolean(config.openaiApiKey),
    model: config.openaiModel
  });
  log.info('server', 'Snapshots', {
    enabled: config.snapshotEnabled,
    site: config.odinSiteOrigin
  });
  startScheduler();
});
