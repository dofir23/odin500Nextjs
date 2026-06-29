import { finnhubToken } from '@/lib/env';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function recentRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function fmtTime(unixSec: number) {
  const ts = Number(unixSec);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapNews(row: Record<string, unknown>, prefix: string) {
  const headline = String(row.headline || '').trim();
  const id = row.id != null ? `${prefix}-${row.id}` : `${prefix}-${row.url || headline}`;
  if (!headline || !id) return null;
  return {
    id,
    headline,
    source: String(row.source || 'Finnhub').trim() || 'Finnhub',
    time: fmtTime(Number(row.datetime)) || '',
    url: String(row.url || '').trim()
  };
}

export type NewsItem = {
  id: string;
  headline: string;
  source: string;
  time: string;
  url: string;
};

export async function fetchFinnhubGeneralNews(): Promise<NewsItem[]> {
  const token = finnhubToken();
  if (!token) return [];
  try {
    const qs = new URLSearchParams({ category: 'general', token });
    const res = await fetch(`${FINNHUB_BASE}/news?${qs}`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : [];
    return list
      .map((r) => mapNews(r as Record<string, unknown>, 'general'))
      .filter(Boolean)
      .slice(0, 24) as NewsItem[];
  } catch {
    return [];
  }
}

export async function fetchFinnhubCompanyNews(symbol: string, days = 10): Promise<NewsItem[]> {
  const token = finnhubToken();
  if (!token) return [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  try {
    const { from, to } = recentRange(days);
    const qs = new URLSearchParams({ symbol: sym, from, to, token });
    const res = await fetch(`${FINNHUB_BASE}/company-news?${qs}`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : [];
    return list
      .map((r) => mapNews(r as Record<string, unknown>, sym))
      .filter(Boolean)
      .slice(0, 24) as NewsItem[];
  } catch {
    return [];
  }
}

export type NewsPageInitialData = {
  generalItems: NewsItem[];
  indexItems: NewsItem[];
  tickerItems: NewsItem[];
  indexSymbol: string;
  tickerSymbol: string;
};

export async function fetchNewsPageData(
  tickerSymbol = 'AAPL',
  indexSymbol = 'SPY'
): Promise<NewsPageInitialData> {
  const [generalItems, indexItems, tickerItems] = await Promise.all([
    fetchFinnhubGeneralNews(),
    fetchFinnhubCompanyNews(indexSymbol, 10),
    fetchFinnhubCompanyNews(tickerSymbol, 10)
  ]);
  return {
    generalItems,
    indexItems,
    tickerItems,
    indexSymbol,
    tickerSymbol: String(tickerSymbol).toUpperCase()
  };
}
