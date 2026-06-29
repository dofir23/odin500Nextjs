'use client';
import { finnhubToken } from '../lib/env.js';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/navigation/appRouterCompat.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1/company-news';
const FINNHUB_TOKEN = finnhubToken();
const FINNHUB_TOKEN_MISSING_MSG =
  'Finnhub token is missing. Add VITE_FINNHUB_TOKEN to odin500-frontend/.env and restart the dev server (or set it at build time for production).';
const INDEX_SYMBOLS = [
  { key: 'sp500', label: 'S&P 500', symbol: 'SPY' },
  { key: 'dow', label: 'Dow Jones', symbol: 'DIA' },
  { key: 'nasdaq100', label: 'Nasdaq 100', symbol: 'QQQ' }
];
const INDEX_NEWS_DROPDOWN_OPTIONS = INDEX_SYMBOLS.map((opt) => ({
  id: opt.key,
  label: `${opt.label} (${opt.symbol})`
}));
const DEFAULT_TICKER = 'AAPL';

const FALLBACK_GENERAL = [
  {
    id: 'g1',
    headline: 'Market breadth improves as large-cap momentum cools.',
    source: 'Odin News Mock',
    time: 'sample',
    url: ''
  },
  {
    id: 'g2',
    headline: 'Rate-path uncertainty keeps volatility elevated into close.',
    source: 'Odin News Mock',
    time: 'sample',
    url: ''
  }
];
const FALLBACK_INDEX = [
  {
    id: 'i1',
    headline: 'ETF flows rotate toward defensive sectors this week.',
    source: 'Odin Index Desk',
    time: 'sample',
    url: ''
  },
  {
    id: 'i2',
    headline: 'Mega-cap earnings expectations drive index concentration discussion.',
    source: 'Odin Index Desk',
    time: 'sample',
    url: ''
  }
];
const FALLBACK_TICKER = [
  {
    id: 't1',
    headline: 'No News available for the selected ticker.',
    source: 'Odin Ticker Desk',
    time: 'sample',
    url: ''
  }
];

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function recentRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function fmtTime(unixSec) {
  const ts = Number(unixSec);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapNews(row, prefix) {
  if (!row || typeof row !== 'object') return null;
  const headline = String(row.headline || '').trim();
  const id = row.id != null ? `${prefix}-${row.id}` : `${prefix}-${row.url || headline}`;
  if (!headline || !id) return null;
  return {
    id,
    headline,
    source: String(row.source || 'Finnhub').trim() || 'Finnhub',
    time: fmtTime(row.datetime) || '',
    url: String(row.url || '').trim()
  };
}

async function fetchCompanyNews(symbol, days = 7) {
  if (!FINNHUB_TOKEN) {
    throw new Error(FINNHUB_TOKEN_MISSING_MSG);
  }
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  const { from, to } = recentRange(days);
  const qs = new URLSearchParams({ symbol: sym, from, to, token: FINNHUB_TOKEN });
  const res = await fetch(`${FINNHUB_BASE}?${qs.toString()}`);
  if (!res.ok) throw new Error(`News request failed (${res.status})`);
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : [];
  return list.map((r) => mapNews(r, sym)).filter(Boolean).slice(0, 24);
}

function NewsList({ title, subtitle, busy, error, items }) {
  const showHead = Boolean(title || subtitle);
  return (
    <section className="news-page__card">
      {showHead ? (
        <div className="news-page__head">
          <h2 className="news-page__title">{title}</h2>
          <p className="news-page__subtitle">{subtitle}</p>
        </div>
      ) : null}
      {busy ? <p className="news-page__status">Loading…</p> : null}
      {!busy && error ? <p className="news-page__status news-page__status--err">{error}</p> : null}
      {!busy && !error && !items.length ? <p className="news-page__status">No headlines.</p> : null}
      <ul className="news-page__list">
        {items.map((n) => (
          <li key={n.id} className="news-page__item">
            <a
              className="news-page__link"
              href={n.url || '#'}
              onClick={(e) => {
                if (!n.url) e.preventDefault();
              }}
              target={n.url ? '_blank' : undefined}
              rel={n.url ? 'noopener noreferrer' : undefined}
            >
              {n.headline}
            </a>
            <div className="news-page__meta">
              <span>{n.source}</span>
              {n.time ? <span>{n.time}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchNews').NewsPageInitialData | null} [props.initialData]
 */
export default function NewsPage({ initialData = null }) {
  const [searchParams] = useSearchParams();
  const tickerFromQuery = searchParams.get('ticker');

  const { busy: generalBusy, error: generalError, items: generalItemsAll } = useGeneralNewsFeed();
  const generalItems = useMemo(() => {
    if (initialData?.generalItems?.length) return initialData.generalItems;
    return generalItemsAll.length ? generalItemsAll.slice(0, 24) : FALLBACK_GENERAL;
  }, [generalItemsAll, initialData]);

  const [indexKey, setIndexKey] = useState(INDEX_SYMBOLS[0].key);
  const [indexBusy, setIndexBusy] = useState(() => !initialData?.indexItems?.length);
  const [indexError, setIndexError] = useState('');
  const [indexItems, setIndexItems] = useState(() => initialData?.indexItems ?? []);

  const [ticker, setTicker] = useState(() => initialData?.tickerSymbol || DEFAULT_TICKER);
  const [tickerBusy, setTickerBusy] = useState(() => !initialData?.tickerItems?.length);
  const [tickerError, setTickerError] = useState('');
  const [tickerItems, setTickerItems] = useState(() => initialData?.tickerItems ?? []);

  useEffect(() => {
    const s = sanitizeTickerPageInput(tickerFromQuery);
    if (s) setTicker(s);
  }, [tickerFromQuery]);

  useEffect(() => {
    let cancelled = false;
    const active = INDEX_SYMBOLS.find((i) => i.key === indexKey) || INDEX_SYMBOLS[0];
    if (initialData?.indexItems?.length && active.symbol === initialData.indexSymbol) return;
    (async () => {
      setIndexBusy(true);
      setIndexError('');
      try {
        const rows = await fetchCompanyNews(active.symbol, 10);
        if (cancelled) return;
        setIndexItems(rows.length ? rows : []);
        if (!rows.length) setIndexError('No headlines returned for this index proxy.');
      } catch (e) {
        if (!cancelled) {
          setIndexError(e?.message || 'Failed to load index-specific headlines.');
          setIndexItems(FALLBACK_INDEX);
        }
      } finally {
        if (!cancelled) setIndexBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [indexKey, initialData]);

  useEffect(() => {
    let cancelled = false;
    const symbol = sanitizeTickerPageInput(ticker) || DEFAULT_TICKER;
    if (
      initialData?.tickerItems?.length &&
      symbol === String(initialData.tickerSymbol || '').toUpperCase()
    ) {
      return;
    }
    (async () => {
      setTickerBusy(true);
      setTickerError('');
      try {
        const rows = await fetchCompanyNews(symbol, 10);
        if (cancelled) return;
        setTickerItems(rows.length ? rows : []);
        if (!rows.length) setTickerError('No headlines returned for this ticker.');
      } catch (e) {
        if (!cancelled) {
          setTickerError(e?.message || 'Failed to load ticker headlines.');
          setTickerItems(FALLBACK_TICKER);
        }
      } finally {
        if (!cancelled) setTickerBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker, initialData]);

  return (
    <div className="news-page odin-content-page">
      <div className="news-page__columns">
        <div className="news-page__col news-page__col--primary">
          <header className="news-page__hero news-page__slot news-page__slot--hero">
            <h1>News Center</h1>
            <p>General market headlines, index-focused and ticker-focused streams in one place.</p>
          </header>

          <div className="news-page__slot news-page__slot--general">
            <NewsList
              title="General Market News"
              subtitle="Live general trading feed (updates every 30s)."
              busy={generalBusy}
              error={generalError}
              items={generalItems}
            />
          </div>

          <section className="news-page__card news-page__slot news-page__slot--index">
            <div className="news-page__head">
              <h2 className="news-page__title">Index-Specific News</h2>
              <p className="news-page__subtitle">Choose an index proxy to focus headlines.</p>
            </div>
            <div className="news-page__controls">
              <label>
                Index
                <ThemedDropdown
                  wideLabel
                  className="news-page__index-dropdown"
                  size="sm"
                  style={{ minWidth: 200, maxWidth: '100%' }}
                  value={indexKey}
                  options={INDEX_NEWS_DROPDOWN_OPTIONS}
                  onChange={setIndexKey}
                  title="Index proxy"
                  ariaLabelPrefix="Index news"
                  labelFallback={(() => {
                    const o = INDEX_SYMBOLS.find((x) => x.key === indexKey);
                    return o ? `${o.label} (${o.symbol})` : '';
                  })()}
                />
              </label>
            </div>
            <NewsList
              title=""
              subtitle=""
              busy={indexBusy}
              error={indexError}
              items={indexItems}
            />
          </section>
        </div>

        <div className="news-page__col news-page__col--ticker">
          <header className="news-page__hero news-page__slot news-page__slot--ticker-head">
            <div className="news-page__hero-top">
              <h2 className="news-page__title">Ticker-Specific News</h2>
              <div className="news-page__hero-actions">
                <TickerSymbolCombobox
                  symbol={ticker}
                  onSymbolChange={(next) => setTicker(sanitizeTickerPageInput(next) || DEFAULT_TICKER)}
                  inputId="news-page-ticker"
                  placeholder="Search ticker (e.g. AAPL)"
                />
              </div>
            </div>
            <p>Type any symbol and load company-focused headlines.</p>
          </header>
          <div className="news-page__slot news-page__slot--ticker-list">
            <NewsList
              title=""
              subtitle=""
              busy={tickerBusy}
              error={tickerError}
              items={tickerItems}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

