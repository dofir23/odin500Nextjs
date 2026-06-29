'use client';
import { SeasonalityHeatmap } from './tickerReport/SeasonalityHeatmap.jsx';

/**
 * @param {{ seasonality: object | null, placement?: 'desktop' | 'mobile', loading?: boolean }} props
 */
export function MonthlySeasonalitySection({ seasonality, placement = 'desktop', loading = false }) {
  if (!seasonality && !loading) return null;

  const placementClass =
    placement === 'mobile' ? 'ticker-page__seasonality--mobile' : 'ticker-page__seasonality--desktop';

  return (
    <section
      className={`statistic-data__card ticker-page__seasonality ${placementClass}`}
      aria-labelledby={`monthly-seasonality-h-${placement}`}
    >
      <h2 id={`monthly-seasonality-h-${placement}`} className="statistic-data__table-title">
        Monthly Seasonality
      </h2>
      <div className="ticker-page__seasonality-body ticker-report__heatmap-host">
        {loading ? (
          <p className="ticker-page__muted ticker-page__seasonality-loading">Loading seasonality…</p>
        ) : seasonality ? (
          <SeasonalityHeatmap seasonality={seasonality} />
        ) : null}
      </div>
    </section>
  );
}
