'use client';
import TickerMonthlyPage from './TickerMonthlyPage.jsx';

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').PeriodicTickerInitialData | null} [props.initialData]
 */
export default function TickerDailyPage({ initialData = null }) {
  return <TickerMonthlyPage periodMode="daily" initialData={initialData} />;
}
