'use client';

import { useState } from 'react';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminTableSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { useAdminSocial } from '../../hooks/useAdminSocial.js';
import '../../styles/admin.css';

const JOBS = [
  { id: 'daily-pulse', label: 'Daily pulse' },
  { id: 'ticker-spotlight', label: 'Ticker spotlight' },
  { id: 'weekly-newsletter', label: 'Weekly newsletter' }
];

export default function AdminSocialPage() {
  return (
    <AdminGate>
      <AdminSocialContent />
    </AdminGate>
  );
}

function AdminSocialContent() {
  const { posts, health, loading, generating, error, refetch, runJob } = useAdminSocial();
  const [symbol, setSymbol] = useState('AAPL');
  const [copied, setCopied] = useState('');

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  return (
    <AdminShell
      title="Social drafts"
      subtitle="Preview automated post drafts from the odin500-social worker. Generate jobs, copy text, and open UTM landing links."
    >
      <section className="admin-stats">
        <article className="admin-stat">
          <span className="admin-stat__label">Worker</span>
          <span className="admin-stat__value">{health?.ok ? 'Online' : 'Offline'}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Drafts</span>
          <span className="admin-stat__value">{posts.length}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">API</span>
          <span className="admin-stat__value admin-stat__value--sm">
            {health?.odinApi || '—'}
          </span>
        </article>
      </section>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {!health?.ok && !loading ? (
        <div className="paper-alert paper-alert--warn admin-social-hint">
          Start the social worker: <code>cd odin500-social && npm start</code>. Set{' '}
          <code>SOCIAL_ORIGIN=http://localhost:8080</code> in frontend <code>.env</code>.
        </div>
      ) : null}

      <div className="admin-toolbar">
        <button type="button" className="paper-btn paper-btn--ghost" onClick={() => refetch()}>
          Refresh
        </button>
        {JOBS.map((job) => (
          <button
            key={job.id}
            type="button"
            className="paper-btn paper-btn--primary"
            disabled={Boolean(generating)}
            onClick={() =>
              runJob(
                job.id,
                job.id === 'ticker-spotlight' ? { symbol: symbol.trim().toUpperCase() } : {}
              )
            }
          >
            {generating === job.id ? 'Generating…' : `Generate ${job.label}`}
          </button>
        ))}
        <label className="admin-social-symbol">
          <span className="admin-social-symbol__label">Ticker</span>
          <input
            className="admin-input admin-social-symbol__input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            maxLength={12}
          />
        </label>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={4} />
      ) : !posts.length ? (
        <section className="admin-card">
          <div className="admin-empty">
            No drafts yet. Run a generate job above or use{' '}
            <code>npm run job:ticker</code> in <code>odin500-social</code>.
          </div>
        </section>
      ) : (
        <div className="admin-social-grid">
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              copied={copied}
              onCopy={copyText}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function SocialPostCard({ post, copied, onCopy }) {
  const imageName = post.assets?.image;
  const imageSrc = imageName ? `/api/social/assets/${encodeURIComponent(imageName)}` : null;
  const link = post.links?.default || post.links?.twitter || '';

  return (
    <article className="admin-card admin-social-card">
      <div className="admin-card__head">
        <div>
          <h2 className="admin-card__title">{post.campaign || post.pillar}</h2>
          <p className="admin-social-card__meta">
            <span className="admin-badge">{post.status}</span>
            <span>{formatWhen(post.createdAt)}</span>
            {post.data?.symbol ? <span>${post.data.symbol}</span> : null}
          </p>
        </div>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="paper-btn paper-btn--ghost">
            Open link
          </a>
        ) : null}
      </div>

      {imageSrc ? (
        <div className="admin-social-card__image-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="admin-social-card__image" loading="lazy" />
        </div>
      ) : null}

      <div className="admin-social-card__copy">
        <CopyBlock
          label="X / Twitter"
          text={post.copy?.twitter || ''}
          copyKey={`${post.id}-twitter`}
          copied={copied}
          onCopy={onCopy}
        />
        <CopyBlock
          label="LinkedIn"
          text={post.copy?.linkedin || ''}
          copyKey={`${post.id}-linkedin`}
          copied={copied}
          onCopy={onCopy}
        />
      </div>
    </article>
  );
}

function CopyBlock({ label, text, copyKey, copied, onCopy }) {
  if (!text) return null;
  return (
    <div className="admin-social-copy">
      <div className="admin-social-copy__head">
        <span className="admin-social-copy__label">{label}</span>
        <button
          type="button"
          className="paper-btn paper-btn--ghost"
          onClick={() => onCopy(text, copyKey)}
        >
          {copied === copyKey ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="admin-social-copy__text">{text}</pre>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return iso;
  }
}
