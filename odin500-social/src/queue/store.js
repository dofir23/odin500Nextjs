const fs = require('fs');
const path = require('path');
const { config, ensureDirs } = require('../config');

function listPosts({ limit = 50, status } = {}) {
  ensureDirs();
  if (!fs.existsSync(config.postsDir)) return [];
  const files = fs
    .readdirSync(config.postsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const p = path.join(config.postsDir, f);
      const stat = fs.statSync(p);
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ...data, _file: f, _mtime: stat.mtimeMs };
    })
    .sort((a, b) => b._mtime - a._mtime);
  const filtered = status ? files.filter((p) => p.status === status) : files;
  return filtered.slice(0, limit).map(({ _file, _mtime, ...rest }) => rest);
}

function getPost(id) {
  ensureDirs();
  const file = path.join(config.postsDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function savePost(post) {
  ensureDirs();
  const file = path.join(config.postsDir, `${post.id}.json`);
  fs.writeFileSync(file, JSON.stringify(post, null, 2));
  return post;
}

function createPostDraft(base) {
  const now = new Date().toISOString();
  const post = {
    id: base.id,
    status: 'draft',
    pillar: base.pillar,
    campaign: base.campaign,
    createdAt: now,
    scheduledAt: base.scheduledAt || now,
    platforms: base.platforms || ['twitter', 'linkedin'],
    data: base.data || {},
    assets: base.assets || {},
    copy: base.copy || {},
    links: base.links || {},
    meta: base.meta || {}
  };
  return savePost(post);
}

module.exports = { listPosts, getPost, savePost, createPostDraft };
