'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminTableSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { ThemedDropdown } from '../../components/ThemedDropdown.jsx';
import { useAdminSocial } from '../../hooks/useAdminSocial.js';
import {
  buildLinkedInShareUrl,
  dedupeDisclaimer,
  normalizeTwitterCaption,
  openInstagramShare,
  openXShare
} from '../../utils/socialShare.js';
import '../../styles/admin.css';

export default function AdminSocialPage() {
  return (
    <AdminGate>
      <AdminSocialContent />
    </AdminGate>
  );
}

function AdminSocialContent() {
  const { posts, charts, health, loading, generating, error, refetch, runJob, discardPost } =
    useAdminSocial();
  const [symbol, setSymbol] = useState('AAPL');
  const [chartId, setChartId] = useState('ticker-ohlc');
  const [copied, setCopied] = useState('');
  const [discarding, setDiscarding] = useState('');
  const [shareHint, setShareHint] = useState('');
  const [xGuide, setXGuide] = useState(null);

  const selectedChart = charts.find((c) => c.id === chartId) || charts[0];
  const chartNeedsSymbol = Boolean(selectedChart?.requiresSymbol);
  const chartOptions = useMemo(
    () =>
      charts.map((c) => ({
        id: c.id,
        label: c.group ? `${c.group}: ${c.label}` : c.label
      })),
    [charts]
  );

  useEffect(() => {
    if (!charts.length) return;
    if (!charts.some((c) => c.id === chartId)) {
      setChartId(charts[0].id);
    }
  }, [charts, chartId]);

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  const handleDiscard = async (id) => {
    if (!window.confirm('Discard this draft? It will be removed permanently.')) return;
    setDiscarding(id);
    try {
      await discardPost(id);
    } finally {
      setDiscarding('');
    }
  };

  const showShareHint = (message) => {
    setShareHint(message);
    setTimeout(() => setShareHint(''), 5000);
  };

  return (
    <AdminShell
      title="Social drafts"
      subtitle="Preview drafts, post to X, LinkedIn, or Instagram, or discard ones you do not need."
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
          <span className="admin-stat__label">OpenAI</span>
          <span className="admin-stat__value">{health?.openai?.configured ? 'Ready' : 'Off'}</span>
        </article>
        <article className="admin-stat">
          <span className="admin-stat__label">Snapshots</span>
          <span className="admin-stat__value">{health?.snapshot?.enabled ? 'On' : 'Off'}</span>
        </article>
      </section>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}
      {shareHint ? <div className="paper-alert paper-alert--warn admin-social-hint">{shareHint}</div> : null}

      {xGuide ? (
        <XShareGuideModal guide={xGuide} onClose={() => setXGuide(null)} />
      ) : null}

      {!health?.openai?.configured && !loading ? (
        <div className="paper-alert paper-alert--warn admin-social-hint">
          OpenAI is off — add <code>OPENAI_API_KEY</code> to <code>odin500-social/.env</code> (or Railway) and
          restart the worker. Copy will use templates until then.
        </div>
      ) : null}

      {health?.ok && health?.openai == null && !loading ? (
        <div className="paper-alert paper-alert--warn admin-social-hint">
          Social worker is outdated — stop any old process on port 8080, then run{' '}
          <code>cd odin500-social && npm start</code> again.
        </div>
      ) : null}

      {health?.ok && health?.snapshot?.enabled === false && !loading ? (
        <div className="paper-alert paper-alert--warn admin-social-hint">
          Page snapshots are off — set <code>SNAPSHOT_ENABLED=true</code> in <code>odin500-social/.env</code> and
          restart.
        </div>
      ) : null}

      {health?.ok && health?.snapshot?.enabled && !loading ? (
        <div className="paper-alert paper-alert--warn admin-social-hint">
          Page snapshots use <code>ODIN_SITE_ORIGIN</code> on the social worker (
          {health?.odinSite || 'not set'}).
        </div>
      ) : null}

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
        <button
          type="button"
          className="paper-btn paper-btn--primary"
          disabled={Boolean(generating)}
          onClick={() => runJob('daily-pulse')}
        >
          {generating === 'daily-pulse' ? 'Generating…' : 'Generate Daily pulse'}
        </button>
        <div className="admin-social-job-group">
          <button
            type="button"
            className="paper-btn paper-btn--primary"
            disabled={Boolean(generating)}
            onClick={() => runJob('ticker-spotlight', { symbol: symbol.trim().toUpperCase() })}
          >
            {generating === 'ticker-spotlight' ? 'Generating…' : 'Generate Ticker spotlight'}
          </button>
          <label className="admin-social-symbol" title="Symbol for ticker spotlight and chart posts">
            <span className="admin-social-symbol__label">Symbol</span>
            <input
              className="admin-input admin-social-symbol__input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={12}
            />
          </label>
        </div>
        <button
          type="button"
          className="paper-btn paper-btn--primary"
          disabled={Boolean(generating)}
          onClick={() => runJob('weekly-newsletter')}
        >
          {generating === 'weekly-newsletter' ? 'Generating…' : 'Generate Weekly newsletter'}
        </button>
      </div>

      <div className="admin-toolbar admin-social-chart-toolbar">
        <div className="admin-social-job-group">
          <div className="admin-social-symbol" title="Chart to snapshot for a social draft">
            <span className="admin-social-symbol__label">Chart</span>
            <ThemedDropdown
              className="admin-social-chart-dd"
              value={selectedChart?.id || chartId}
              options={chartOptions}
              onChange={setChartId}
              title="Chart for social draft"
              ariaLabelPrefix="Chart"
              labelFallback="No charts loaded"
              wideLabel
              menuMaxHeight="320px"
              disabled={!charts.length || Boolean(generating)}
            />
          </div>
          {chartNeedsSymbol ? (
            <label className="admin-social-symbol" title="Required for this chart">
              <span className="admin-social-symbol__label">Symbol</span>
              <input
                className="admin-input admin-social-symbol__input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={12}
              />
            </label>
          ) : null}
          <button
            type="button"
            className="paper-btn paper-btn--primary"
            disabled={Boolean(generating) || !selectedChart}
            onClick={() =>
              runJob('chart-post', {
                chartId: selectedChart.id,
                ...(selectedChart.requiresSymbol
                  ? { symbol: symbol.trim().toUpperCase() }
                  : {})
              })
            }
          >
            {generating === 'chart-post' ? 'Generating…' : 'Generate post'}
          </button>
        </div>
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
              discarding={discarding}
              onCopy={copyText}
              onDiscard={handleDiscard}
              onShareHint={showShareHint}
              onXGuide={setXGuide}
            />
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function SocialPostCard({ post, copied, discarding, onCopy, onDiscard, onShareHint, onXGuide }) {
  const imageName = post.assets?.image;
  const imageSrc = imageName ? `/api/social/assets/${encodeURIComponent(imageName)}` : null;
  const link = post.links?.default || post.links?.twitter || '';
  const twitterText = normalizeTwitterCaption(post.copy?.twitter || '', { link });
  const linkedinText = dedupeDisclaimer(post.copy?.linkedin || '');
  const instagramText = dedupeDisclaimer(post.copy?.instagram || linkedinText);

  const openX = async () => {
    const result = await openXShare({
      text: post.copy?.twitter || '',
      link,
      imageUrl: imageSrc,
      filename: imageName || `${post.id}.png`
    });
    onXGuide({
      imageSrc,
      filename: imageName || `${post.id}.png`,
      composeText: result.composeText,
      fullCaption: result.fullCaption,
      imageDownloaded: result.imageDownloaded,
      imageCopied: result.imageCopied,
      textCopied: result.textCopied
    });
  };

  const openLinkedIn = () => {
    window.open(buildLinkedInShareUrl(linkedinText), '_blank', 'noopener,noreferrer,width=900,height=700');
  };

  const openInstagram = async () => {
    const copiedCaption = await openInstagramShare({
      caption: instagramText,
      imageUrl: imageSrc,
      filename: imageName || `${post.id}.png`
    });
    onShareHint(
      copiedCaption
        ? 'Instagram: caption copied and image downloaded — upload the image on Instagram, paste the caption, then post.'
        : 'Instagram opened — upload the chart image and paste your caption manually.'
    );
  };

  return (
    <article className="admin-card admin-social-card">
      <div className="admin-card__head">
        <div>
          <h2 className="admin-card__title">
            {post.meta?.chartLabel || post.data?.chartLabel || post.campaign || post.pillar}
          </h2>
          <p className="admin-social-card__meta">
            <span className="admin-badge">{post.status}</span>
            {post.meta?.chartId || post.data?.chartId ? (
              <span className="admin-badge">{post.meta?.chartId || post.data?.chartId}</span>
            ) : null}
            {post.meta?.copySource ? (
              <span className="admin-badge admin-badge--ai">
                Copy: {post.meta.copySource}
                {post.meta.copyFallbackReason ? ` (${post.meta.copyFallbackReason})` : ''}
              </span>
            ) : null}
            {post.meta?.imageSource ? (
              <span className="admin-badge admin-badge--img">Img: {post.meta.imageSource}</span>
            ) : null}
            <span>{formatWhen(post.createdAt)}</span>
            {post.data?.symbol ? <span>${post.data.symbol}</span> : null}
          </p>
        </div>
        <div className="admin-social-card__actions">
          <div className="admin-social-share" role="group" aria-label="Post to social">
            <button
              type="button"
              className="admin-social-share__btn"
              title="Post on X — attach snapshot image (see guide)"
              onClick={() => void openX()}
              aria-label="Post on X"
            >
              <SocialIconX />
            </button>
            <button
              type="button"
              className="admin-social-share__btn admin-social-share__btn--instagram"
              title="Post on Instagram"
              onClick={() => void openInstagram()}
              aria-label="Post on Instagram"
            >
              <SocialIconInstagram />
            </button>
            <button
              type="button"
              className="admin-social-share__btn admin-social-share__btn--linkedin"
              title="Post on LinkedIn"
              onClick={openLinkedIn}
              aria-label="Post on LinkedIn"
            >
              <SocialIconLinkedIn />
            </button>
          </div>
          <button
            type="button"
            className="paper-btn paper-btn--ghost admin-social-discard"
            disabled={discarding === post.id}
            onClick={() => onDiscard(post.id)}
          >
            {discarding === post.id ? 'Discarding…' : 'Discard'}
          </button>
        </div>
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
          text={twitterText}
          copyKey={`${post.id}-twitter`}
          copied={copied}
          onCopy={onCopy}
        />
        <CopyBlock
          label="LinkedIn"
          text={linkedinText}
          copyKey={`${post.id}-linkedin`}
          copied={copied}
          onCopy={onCopy}
        />
        <CopyBlock
          label="Instagram"
          text={instagramText}
          copyKey={`${post.id}-instagram`}
          copied={copied}
          onCopy={onCopy}
        />
      </div>

      {link ? (
        <div className="admin-social-card__footer">
          <a href={link} target="_blank" rel="noopener noreferrer" className="paper-btn paper-btn--ghost">
            Open link
          </a>
        </div>
      ) : null}
    </article>
  );
}

function XShareGuideModal({ guide, onClose }) {
  return (
    <div className="admin-social-xguide-backdrop" role="dialog" aria-modal="true" aria-labelledby="xguide-title">
      <div className="admin-social-xguide">
        <div className="admin-social-xguide__head">
          <h3 id="xguide-title">Post on X — attach your snapshot</h3>
          <button type="button" className="paper-btn paper-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="admin-social-xguide__lead">
          X cannot attach images automatically. If a link is in the tweet, X shows the website preview
          instead of your chart — follow these steps to match the draft.
        </p>
        <ol className="admin-social-xguide__steps">
          <li>
            <strong>Attach the snapshot image first.</strong>{' '}
            {guide.imageDownloaded
              ? `Use the downloaded file "${guide.filename}" (image icon in X compose → upload).`
              : 'Download failed — save the preview below and upload it in X.'}
            {guide.imageCopied ? ' Image is also on your clipboard (Ctrl+V).' : null}
          </li>
          <li>
            <strong>Caption is pre-filled</strong> in the X window (same text as below). The link line is
            omitted from X so it does not replace your chart with a website preview — paste it from your
            clipboard after attaching the image.
          </li>
          <li>
            <strong>Click Post</strong> once the chart image is attached.
          </li>
        </ol>
        {guide.imageSrc ? (
          <div className="admin-social-xguide__preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={guide.imageSrc} alt="Draft snapshot" />
            <span>This is the image to upload</span>
          </div>
        ) : null}
        <p className="admin-social-xguide__label">Prefilled in X (same as below)</p>
        <pre className="admin-social-copy__text admin-social-xguide__text">{guide.composeText}</pre>
        {guide.fullCaption !== guide.composeText ? (
          <>
            <p className="admin-social-xguide__label">Full caption on clipboard (includes link)</p>
            <pre className="admin-social-copy__text admin-social-xguide__text">{guide.fullCaption}</pre>
          </>
        ) : null}
      </div>
    </div>
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

function SocialIconX() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

function SocialIconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zm4.5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5.75-.88a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z"
      />
    </svg>
  );
}

function SocialIconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.58 0 4.24 2.36 4.24 5.43v6.31zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"
      />
    </svg>
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
