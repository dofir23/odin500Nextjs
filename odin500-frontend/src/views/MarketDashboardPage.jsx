'use client';

import { MarketPageFigmaShell } from '../components/MarketPageFigmaShell.jsx';

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').MarketDashboardInitialData | null} [props.initialMarketData]
 */
export default function MarketDashboardPage({ initialMarketData = null }) {
  return (
    <div className="container">
      <h1 className="sr-only">Odin500 Market Dashboard — Quant Signals and U.S. Equity Analytics</h1>
      <MarketPageFigmaShell initialMarketData={initialMarketData} />
    </div>
  );
}
