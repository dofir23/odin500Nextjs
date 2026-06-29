import { resolveRequestMetadata } from '@/seo/metadata';
import { formatReturnPct, pickDynamicReturn } from '@/seo/performanceSnippet';

function pickPerf(performance: Record<string, unknown> | undefined, periodName: string) {
  const n = pickDynamicReturn(performance, periodName);
  return n != null ? formatReturnPct(n) : null;
}

type SeoCrawlerSummaryProps = {
  pathname: string;
  data: unknown;
};

/** Visually hidden summary for crawlers — does not affect the interactive UI. */
export function SeoCrawlerSummary({ pathname, data }: SeoCrawlerSummaryProps) {
  const meta = resolveRequestMetadata(pathname);
  const path = pathname.split('?')[0];
  const d = data as {
    symbol?: string;
    asOfDate?: string;
    company_name?: string | null;
    min_date?: string;
    max_date?: string;
    returnsSym?: { performance?: Record<string, unknown> } | null;
  } | null;

  const parts: string[] = [meta.description];

  if (path.startsWith('/ticker/') && d?.symbol) {
    const sym = String(d.symbol).toUpperCase();
    const perf = d.returnsSym?.performance;
    const ytd = pickPerf(perf, 'Year to Date (YTD)');
    const y1 = pickPerf(perf, 'Last 1 year');
    const perfBits = [ytd && `year-to-date return ${ytd}`, y1 && `one-year return ${y1}`].filter(Boolean);
    if (perfBits.length) parts.push(`${sym} ${perfBits.join(' and ')}.`);
    if (d.asOfDate) parts.push(`Figures as of ${d.asOfDate}.`);
  }

  if (path.startsWith('/historical-data/') && d?.symbol) {
    const sym = String(d.symbol).toUpperCase();
    const name = d.company_name ? String(d.company_name) : sym;
    if (d.min_date && d.max_date) {
      parts.push(`${name} OHLC history from ${d.min_date} through ${d.max_date}.`);
    }
  }

  const text = parts.filter(Boolean).join(' ');
  if (!text.trim()) return null;

  return (
    <div className="sr-only" aria-hidden="true">
      <h1>{meta.title}</h1>
      <p>{text}</p>
    </div>
  );
}
