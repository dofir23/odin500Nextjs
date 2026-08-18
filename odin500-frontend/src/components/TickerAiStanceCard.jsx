'use client';
import { useState } from 'react';
import { useTickerAiStanceQuery } from '../query/marketQueries.js';
import { canFetchMarketData } from '../store/apiStore.js';

/**
 * Fixed row order and labels — rows render even when an engine has no answer.
 *
 * `logo` is an explicit path rather than a guessed `${id}.svg`: guessing meant a 404 (and a
 * silently hidden image) the moment the asset arrived as a .png instead. Drop a replacement in
 * public/ai-logos/ and update the path here.
 */
const ENGINES = [
  { id: 'claude', label: 'Claude', logo: '/ai-logos/claude.png' },
  { id: 'chatgpt', label: 'ChatGPT', logo: '/ai-logos/chatgpt.png' },
  { id: 'gemini', label: 'Gemini', logo: '/ai-logos/gemini.png' }
];

/** Column order matches the card design: bullish, bearish, then no-call. */
const COLUMNS = [
  { id: 'long', label: 'Long' },
  { id: 'short', label: 'Short' },
  { id: 'neutral', label: 'Neutral' }
];

function asOfLabel(iso) {
  if (!iso) return '';
  // The API returns a plain market day (YYYY-MM-DD); parse as UTC so the label cannot slip a
  // day backwards for viewers west of Greenwich.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * Brand mark from `public/ai-logos/`. Falls back to nothing (wordmark only) if the file is
 * missing, so a bad path degrades instead of showing a broken-image icon.
 */
function EngineLogo({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <span className="ticker-ai-stance__logo-chip">
      <img
        className="ticker-ai-stance__logo"
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function StanceRow({ engine, label, logo, stance, rationale, note }) {
  const answered = Boolean(stance);
  const rowTitle = answered
    ? `${label}: ${stance}${rationale ? ` — ${rationale}` : ''}`
    : `${label}: ${note || 'no answer'}`;

  return (
    <div
      className={'ticker-ai-stance__row' + (answered ? '' : ' ticker-ai-stance__row--idle')}
      role="row"
      aria-label={answered ? `${label}: ${stance}` : `${label}: no answer`}
      title={rowTitle}
    >
      <div className="ticker-ai-stance__agent" role="rowheader">
        <EngineLogo src={logo} />
        <span className="ticker-ai-stance__name" data-engine={engine}>
          {label}
        </span>
      </div>
      {COLUMNS.map((col) => {
        const active = stance === col.id;
        return (
          <div
            key={col.id}
            role="cell"
            className={
              `ticker-ai-stance__cell ticker-ai-stance__cell--${col.id}` +
              (active ? ' ticker-ai-stance__cell--active' : '')
            }
            aria-current={active ? 'true' : undefined}
          >
            {col.label}
          </div>
        );
      })}
    </div>
  );
}

function Shell({ children }) {
  return <div className="ticker-aside-mini__body">{children}</div>;
}

/**
 * Where each AI agent stands on the selected ticker.
 *
 * Every agent gets a full Long / Short / Neutral row and the agent's actual call is highlighted,
 * so the card reads as a comparison grid rather than four separate verdicts. Verdicts are computed
 * server-side once per ticker per market day and stored in BigQuery, so this is a cheap read for
 * everyone after the first viewer of the day.
 *
 * @param {{ symbol: string }} props
 */
export function TickerAiStanceCard({ symbol }) {
  const sym = String(symbol || '').toUpperCase().trim();
  const signedIn = canFetchMarketData();
  const { data, isLoading, isError, error } = useTickerAiStanceQuery({ ticker: sym });

  if (!signedIn) {
    return (
      <Shell>
        <p className="ticker-signal-asof">
          Sign in to see how each AI agent reads {sym || 'this ticker'}.
        </p>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <p className="ticker-signal-asof">
          {error?.message || 'Could not load the AI view for this ticker.'}
        </p>
      </Shell>
    );
  }

  const byEngine = new Map((data?.agents || []).map((a) => [a.engine, a]));
  const noteByEngine = new Map((data?.unavailable || []).map((u) => [u.engine, u.reason]));

  return (
    <Shell>
      <p className="ticker-signal-asof">
        {isLoading ? 'Asking the AI agents…' : `As of ${asOfLabel(data?.as_of)}`}
      </p>
      <div
        className={'ticker-ai-stance__grid' + (isLoading ? ' ticker-ai-stance__grid--loading' : '')}
        role="table"
        aria-label={`AI agent view on ${sym}`}
        aria-busy={isLoading || undefined}
      >
        {ENGINES.map((e) => {
          const hit = byEngine.get(e.id);
          return (
            <StanceRow
              key={e.id}
              engine={e.id}
              label={e.label}
              logo={e.logo}
              stance={hit?.stance || null}
              rationale={hit?.rationale || null}
              note={noteByEngine.get(e.id)}
            />
          );
        })}
      </div>
    </Shell>
  );
}
