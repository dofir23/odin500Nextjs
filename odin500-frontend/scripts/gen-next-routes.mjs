import fs from 'node:fs';
import path from 'node:path';

const REVALIDATE = `export const revalidate = 300;\n\n`;

const staticMeta = {
  'src/app/(auth)/login/page.tsx': '/login',
  'src/app/(auth)/signup/page.tsx': '/signup',
  'src/app/(auth)/signup/verify-email/page.tsx': '/signup/verify-email',
  'src/app/(auth)/signup/enter-code/page.tsx': '/signup/enter-code',
  'src/app/(auth)/signup/username/page.tsx': '/signup/username',
  'src/app/(auth)/forgot-password/page.tsx': '/forgot-password',
  'src/app/(protected)/market/page.tsx': '/market',
  'src/app/(protected)/heatmap/page.tsx': '/heatmap',
  'src/app/(protected)/market-movers/page.tsx': '/market-movers',
  'src/app/(protected)/stock-splits/page.tsx': '/stock-splits',
  'src/app/(protected)/news/page.tsx': '/news',
  'src/app/(protected)/odin-signals/page.tsx': '/odin-signals',
  'src/app/(protected)/statistic-data/page.tsx': '/statistic-data',
  'src/app/(protected)/return-table/page.tsx': '/return-table',
  'src/app/(protected)/accounts/page.tsx': '/accounts',
  'src/app/(protected)/paper-trading/page.tsx': '/paper-trading',
  'src/app/(protected)/premium/page.tsx': '/premium',
  'src/app/(protected)/about/page.tsx': '/about'
};

const dynamicMeta = {
  'src/app/(protected)/ticker/[symbol]/page.tsx': { param: 'symbol', prefix: '/ticker/' },
  'src/app/(protected)/indices/[indexSlug]/page.tsx': { param: 'indexSlug', prefix: '/indices/' },
  'src/app/(protected)/sector-data/[sectorKey]/page.tsx': { param: 'sectorKey', prefix: '/sector-data/' },
  'src/app/(protected)/statistic/ticker-annual/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/statistic/ticker-annual/'
  },
  'src/app/(protected)/statistic/ticker-quarterly/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/statistic/ticker-quarterly/'
  },
  'src/app/(protected)/statistic/ticker-monthly/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/statistic/ticker-monthly/'
  },
  'src/app/(protected)/statistic/ticker-weekly/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/statistic/ticker-weekly/'
  },
  'src/app/(protected)/statistic/ticker-daily/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/statistic/ticker-daily/'
  },
  'src/app/(protected)/relative-performance/ticker/[symbol]/page.tsx': {
    param: 'symbol',
    prefix: '/relative-performance/ticker/'
  },
  'src/app/(protected)/ticker-report/[symbol]/page.tsx': { param: 'symbol', prefix: '/ticker-report/' },
  'src/app/(protected)/historical-data/[symbol]/page.tsx': { param: 'symbol', prefix: '/historical-data/' }
};

/** @type {Record<string, { component: string, importPath: string, prop: string, fetchFn: string, fetchCall: string, pathname: string, breadcrumbs?: string }>} */
const ssrConfig = {
  'src/app/(protected)/market/page.tsx': {
    component: 'App',
    importPath: '@/App.jsx',
    prop: 'initialMarketData',
    fetchFn: 'fetchMarketDashboardData',
    fetchCall: "fetchMarketDashboardData('1Y')",
    pathname: '/market'
  },
  'src/app/(protected)/heatmap/page.tsx': {
    component: 'MarketHeatmapPage',
    importPath: '@/views/MarketHeatmapPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchHeatmapPageData',
    fetchCall: 'fetchHeatmapPageData()',
    pathname: '/heatmap'
  },
  'src/app/(protected)/market-movers/page.tsx': {
    component: 'MarketMoversPage',
    importPath: '@/views/MarketMoversPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchMarketMoversPageData',
    fetchCall: 'fetchMarketMoversPageData()',
    pathname: '/market-movers'
  },
  'src/app/(protected)/stock-splits/page.tsx': {
    component: 'StockSplitsPage',
    importPath: '@/views/StockSplitsPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStockSplitsPageData',
    fetchCall: 'fetchStockSplitsPageData()',
    pathname: '/stock-splits'
  },
  'src/app/(protected)/news/page.tsx': {
    component: 'NewsPage',
    importPath: '@/views/NewsPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchNewsPageData',
    fetchCall: 'fetchNewsPageData()',
    pathname: '/news'
  },
  'src/app/(protected)/odin-signals/page.tsx': {
    component: 'OdinSignalsPage',
    importPath: '@/views/OdinSignalsPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchOdinSignalsPageData',
    fetchCall: 'fetchOdinSignalsPageData()',
    pathname: '/odin-signals'
  },
  'src/app/(protected)/statistic-data/page.tsx': {
    component: 'StatisticDataPage',
    importPath: '@/views/StatisticDataPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticDataPageData',
    fetchCall: "fetchStatisticDataPageData('AAPL')",
    pathname: '/statistic-data'
  },
  'src/app/(protected)/return-table/page.tsx': {
    component: 'ReturnTablePage',
    importPath: '@/views/ReturnTablePage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchReturnTablePageData',
    fetchCall: 'fetchReturnTablePageData()',
    pathname: '/return-table'
  },
  'src/app/(protected)/ticker/[symbol]/page.tsx': {
    component: 'TickerPage',
    importPath: '@/views/TickerPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchTickerPageData',
    fetchCall: 'fetchTickerPageData(symbol)',
    pathname: "(`/ticker/${symbol}`)"
  },
  'src/app/(protected)/indices/[indexSlug]/page.tsx': {
    component: 'IndexPage',
    importPath: '@/views/IndexPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchIndexPageData',
    fetchCall: 'fetchIndexPageData(indexSlug, false)',
    pathname: "(`/indices/${indexSlug}`)"
  },
  'src/app/(protected)/sector-data/[sectorKey]/page.tsx': {
    component: 'IndexPage',
    importPath: '@/views/IndexPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchIndexPageData',
    fetchCall: 'fetchIndexPageData(sectorKey, true)',
    pathname: "(`/sector-data/${sectorKey}`)"
  },
  'src/app/(protected)/statistic/ticker-annual/[symbol]/page.tsx': {
    component: 'TickerAnnualPage',
    importPath: '@/views/TickerAnnualPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticAnnualPageData',
    fetchCall: 'fetchStatisticAnnualPageData(symbol)',
    pathname: "(`/statistic/ticker-annual/${symbol}`)"
  },
  'src/app/(protected)/statistic/ticker-quarterly/[symbol]/page.tsx': {
    component: 'TickerQuarterlyPage',
    importPath: '@/views/TickerQuarterlyPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticQuarterlyPageData',
    fetchCall: 'fetchStatisticQuarterlyPageData(symbol)',
    pathname: "(`/statistic/ticker-quarterly/${symbol}`)"
  },
  'src/app/(protected)/statistic/ticker-monthly/[symbol]/page.tsx': {
    component: 'TickerMonthlyPage',
    importPath: '@/views/TickerMonthlyPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticPeriodicPageData',
    fetchCall: "fetchStatisticPeriodicPageData(symbol, 'monthly')",
    pathname: "(`/statistic/ticker-monthly/${symbol}`)"
  },
  'src/app/(protected)/statistic/ticker-weekly/[symbol]/page.tsx': {
    component: 'TickerWeeklyPage',
    importPath: '@/views/TickerWeeklyPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticPeriodicPageData',
    fetchCall: "fetchStatisticPeriodicPageData(symbol, 'weekly')",
    pathname: "(`/statistic/ticker-weekly/${symbol}`)"
  },
  'src/app/(protected)/statistic/ticker-daily/[symbol]/page.tsx': {
    component: 'TickerDailyPage',
    importPath: '@/views/TickerDailyPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchStatisticPeriodicPageData',
    fetchCall: "fetchStatisticPeriodicPageData(symbol, 'daily')",
    pathname: "(`/statistic/ticker-daily/${symbol}`)"
  },
  'src/app/(protected)/relative-performance/ticker/[symbol]/page.tsx': {
    component: 'RelativeStrengthTickerPage',
    importPath: '@/views/RelativeStrengthTickerPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchRelativeStrengthPageData',
    fetchCall: 'fetchRelativeStrengthPageData(symbol)',
    pathname: "(`/relative-performance/ticker/${symbol}`)"
  },
  'src/app/(protected)/ticker-report/[symbol]/page.tsx': {
    component: 'TickerReportPage',
    importPath: '@/views/TickerReportPage.jsx',
    prop: 'initialData',
    fetchFn: 'fetchTickerReportPageData',
    fetchCall: 'fetchTickerReportPageData(symbol)',
    pathname: "(`/ticker-report/${symbol}`)"
  }
};

const clientOnlyRoutes = [
  ['src/app/(auth)/login/page.tsx', '@/views/LoginPage.jsx', 'LoginPage'],
  ['src/app/(auth)/signup/page.tsx', '@/views/SignupPage.jsx', 'SignupPage'],
  ['src/app/(auth)/signup/verify-email/page.tsx', '@/views/SignupVerifyEmailPage.jsx', 'SignupVerifyEmailPage'],
  ['src/app/(auth)/signup/enter-code/page.tsx', '@/views/SignupEnterCodePage.jsx', 'SignupEnterCodePage'],
  ['src/app/(auth)/signup/username/page.tsx', '@/views/SignupUsernamePage.jsx', 'SignupUsernamePage'],
  ['src/app/(auth)/forgot-password/page.tsx', '@/views/ForgotPasswordPage.jsx', 'ForgotPasswordPage'],
  ['src/app/(auth)/auth/callback/page.tsx', '@/views/AuthCallbackPage.jsx', 'AuthCallbackPage'],
  ['src/app/(protected)/accounts/page.tsx', '@/views/AccountsPage.jsx', 'AccountsPage'],
  ['src/app/(protected)/paper-trading/page.tsx', '@/views/PaperTrading/PaperTradingPage.jsx', 'PaperTradingPage'],
  ['src/app/(protected)/about/page.tsx', '@/views/AboutPage.jsx', 'AboutPage']
];

function metaBlockFor(file) {
  if (staticMeta[file]) {
    return `import { toNextMetadata } from '@/seo/metadata';\n\nexport const metadata = toNextMetadata('${staticMeta[file]}');\n`;
  }
  const dyn = dynamicMeta[file];
  if (dyn) {
    return `import { toNextMetadata } from '@/seo/metadata';\n\nexport async function generateMetadata({ params }: { params: Promise<{ ${dyn.param}: string }> }) {\n  const p = await params;\n  return toNextMetadata('${dyn.prefix}' + p.${dyn.param});\n}\n`;
  }
  return '';
}

function pageHeader(file) {
  return `${metaBlockFor(file)}${REVALIDATE}`;
}

function ssrPageBody(file, cfg) {
  const dyn = dynamicMeta[file];
  const fetchImports = new Set([cfg.fetchFn]);
  if (cfg.fetchFn === 'fetchNewsPageData') {
    return generateNewsPage(file, cfg);
  }

  const paramDecl = dyn
    ? `{ params }: { params: Promise<{ ${dyn.param}: string }> }`
    : '';
  const paramAwait = dyn ? `  const { ${dyn.param} } = await params;\n` : '';
  const pathnameExpr = cfg.pathname.startsWith('(') ? cfg.pathname : `'${cfg.pathname}'`;

  return `${pageHeader(file)}import { PageServerShell } from '@/seo/PageServerShell';
import { ${[...fetchImports].join(', ')} } from '@/ssr/fetchPageData';
import ${cfg.component} from '${cfg.importPath}';

export default async function Page(${paramDecl}) {
${paramAwait}  let seoData: unknown = null;
  try {
    seoData = await ${cfg.fetchCall};
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = ${pathnameExpr};
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <${cfg.component} ${cfg.prop}={seoData as never} />
    </PageServerShell>
  );
}
`;
}

function generateNewsPage(file, cfg) {
  return `${pageHeader(file)}import { PageServerShell } from '@/seo/PageServerShell';
import { fetchNewsPageData } from '@/ssr/fetchPageData';
import NewsPage from '@/views/NewsPage.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchNewsPageData();
  } catch {
    /* ignore */
  }

  return (
    <PageServerShell pathname="/news" seoData={seoData}>
      <NewsPage initialData={seoData as never} />
    </PageServerShell>
  );
}
`;
}

const historicalPage = `import HistoricalDataPage from '@/views/HistoricalDataPage.jsx';
import { fetchHistoricalDataPreview } from '@/ssr/fetchHistoricalDataPreview.js';
import {
  enrichHistoricalDataMetadata,
  metadataFromResolved,
  resolveRequestMetadata,
  toNextMetadata
} from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = \`/historical-data/\${symbol}\`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const preview = await fetchHistoricalDataPreview(symbol.toUpperCase());
    if (preview) {
      const enriched = enrichHistoricalDataMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        preview
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* ignore */
  }
  return toNextMetadata(pathname);
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let initialPreview = null;
  try {
    initialPreview = await fetchHistoricalDataPreview(symbol.toUpperCase());
  } catch {
    /* ignore */
  }
  const pathname = \`/historical-data/\${symbol}\`;
  return (
    <PageServerShell pathname={pathname} seoData={initialPreview}>
      <HistoricalDataPage initialPreview={initialPreview} />
    </PageServerShell>
  );
}
`;

const tickerPage = `import {
  enrichTickerMetadata,
  metadataFromResolved,
  resolveRequestMetadata,
  toNextMetadata
} from '@/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = \`/ticker/\${symbol}\`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const { fetchTickerPageData } = await import('@/ssr/fetchPageData');
    const seoData = await fetchTickerPageData(symbol);
    if (seoData) {
      const enriched = enrichTickerMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        seoData
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* fallback */
  }
  return toNextMetadata(pathname);
}

export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchTickerPageData } from '@/ssr/fetchPageData';
import TickerPage from '@/views/TickerPage.jsx';

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchTickerPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = \`/ticker/\${symbol}\`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerPage initialData={seoData as never} />
    </PageServerShell>
  );
}
`;

const relPerfRedirect = `import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/relative-performance/ticker/aapl');
}
`;

// SSR market + analytics pages (skip ticker — custom template above)
for (const file of Object.keys(ssrConfig)) {
  if (file === 'src/app/(protected)/ticker/[symbol]/page.tsx') continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ssrPageBody(file, ssrConfig[file]));
}

// Historical data (custom)
fs.mkdirSync(path.dirname('src/app/(protected)/historical-data/[symbol]/page.tsx'), { recursive: true });
fs.writeFileSync('src/app/(protected)/historical-data/[symbol]/page.tsx', historicalPage);

// Ticker page (enriched metadata)
fs.mkdirSync(path.dirname('src/app/(protected)/ticker/[symbol]/page.tsx'), { recursive: true });
fs.writeFileSync('src/app/(protected)/ticker/[symbol]/page.tsx', tickerPage);

const premiumPage = `${pageHeader('src/app/(protected)/premium/page.tsx')}import { PageServerShell } from '@/seo/PageServerShell';
import Pricing from '@/views/Pricing.jsx';

export default function Page() {
  return (
    <PageServerShell pathname="/premium" seoData={{ premium: true }}>
      <Pricing />
    </PageServerShell>
  );
}
`;

fs.mkdirSync(path.dirname('src/app/(protected)/premium/page.tsx'), { recursive: true });
fs.writeFileSync('src/app/(protected)/premium/page.tsx', premiumPage);

// Relative performance index redirect
fs.mkdirSync('src/app/(protected)/relative-performance/ticker', { recursive: true });
fs.writeFileSync('src/app/(protected)/relative-performance/ticker/page.tsx', relPerfRedirect);

// Client-only / no SSR data pages
for (const [file, imp, name] of clientOnlyRoutes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = `import ${name} from '${imp}';\n\nexport default function Page() {\n  return <${name} />;\n}\n`;
  fs.writeFileSync(file, metaBlockFor(file) + body);
}

console.log('Regenerated SSR route pages:', Object.keys(ssrConfig).length + clientOnlyRoutes.length + 2);
