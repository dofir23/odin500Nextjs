'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from '@/navigation/appRouterCompat.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerReportContent } from '../components/tickerReport/TickerReportContent.jsx';
import {
  formatMonthShort,
  getLatestReportPeriod,
  getMonthsForYear,
  getReportYears,
  getTickerReport,
  hasExactReport,
  isMonthlyReportYear
} from '../data/tickerReports/registry.js';
import { downloadTickerReportCsv, downloadTickerReportPdf } from '../utils/tickerReportExport.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth } from '../store/apiStore.js';
import '../styles/ticker-report.css';

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').TickerReportInitialData | null} [props.initialData]
 */
export default function TickerReportPage({ initialData = null }) {
  const { symbol: symbolParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [exportBusy, setExportBusy] = useState(false);

  const sym = useMemo(() => sanitizeTickerPageInput(symbolParam || 'AAPL') || 'AAPL', [symbolParam]);

  const yearParam = Number(searchParams.get('year'));
  const monthParam = Number(searchParams.get('month'));
  const latest = useMemo(() => getLatestReportPeriod(sym), [sym]);

  const selectedYear = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : latest.year;
  const isAnnualPeriod = !isMonthlyReportYear(selectedYear);
  const selectedMonth = isAnnualPeriod
    ? null
    : Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : latest.month;

  const ssrMatchesPeriod =
    initialData?.symbol &&
    String(initialData.symbol).toUpperCase() === String(sym).toUpperCase() &&
    initialData.year === selectedYear &&
    (isAnnualPeriod ? initialData.isAnnual : initialData.month === selectedMonth);

  const [liveReport, setLiveReport] = useState(() =>
    ssrMatchesPeriod ? initialData?.report ?? null : null
  );
  const [liveError, setLiveError] = useState('');
  const [liveLoading, setLiveLoading] = useState(() => !(ssrMatchesPeriod && initialData?.report));

  const [expandedYear, setExpandedYear] = useState(
    isMonthlyReportYear(selectedYear) ? selectedYear : null
  );
  const years = useMemo(() => getReportYears(), []);

  useEffect(() => {
    setExpandedYear(isMonthlyReportYear(selectedYear) ? selectedYear : null);
  }, [selectedYear]);

  const templateReport = useMemo(() => {
    if (isAnnualPeriod) return getTickerReport(sym, selectedYear, null);
    return getTickerReport(sym, selectedYear, selectedMonth);
  }, [sym, selectedYear, selectedMonth, isAnnualPeriod]);

  useEffect(() => {
    if (ssrMatchesPeriod && initialData?.report) {
      return undefined;
    }
    let cancelled = false;
    const url =
      apiUrl(`/api/reports/ticker/${encodeURIComponent(sym.toLowerCase())}`) +
      `?year=${encodeURIComponent(selectedYear)}` +
      (isAnnualPeriod ? '' : `&month=${encodeURIComponent(selectedMonth || 1)}`);

    (async () => {
      setLiveLoading(true);
      try {
        const res = await fetchWithAuth(url, { method: 'GET' });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !payload?.report) {
          setLiveReport(null);
          setLiveError(payload?.error || 'Live report unavailable');
          setLiveLoading(false);
          return;
        }
        setLiveReport(payload.report);
        setLiveError('');
        setLiveLoading(false);
      } catch (e) {
        if (cancelled) return;
        setLiveReport(null);
        setLiveError(e?.message || 'Live report unavailable');
        setLiveLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, selectedYear, selectedMonth, isAnnualPeriod, ssrMatchesPeriod, initialData]);

  const report = liveReport || (!liveLoading ? templateReport : null);
  const periodLabel = report?.meta?.periodLabel || `${selectedYear}`;
  const reportKind = report?.meta?.reportKind || (isAnnualPeriod ? 'annual' : 'monthly');


  const setPeriod = useCallback(
    (year, month) => {
      const next = new URLSearchParams(searchParams);
      next.set('year', String(year));
      if (isMonthlyReportYear(year) && month) {
        next.set('month', String(month));
      } else {
        next.delete('month');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const onSymbolChange = useCallback(
    (next) => {
      const s = sanitizeTickerPageInput(next) || 'AAPL';
      const p = getLatestReportPeriod(s);
      navigate(`/ticker-report/${encodeURIComponent(s.toLowerCase())}?year=${p.year}&month=${p.month}`, {
        replace: false
      });
    },
    [navigate]
  );

  const onExportCsv = useCallback(() => {
    if (!report) return;
    downloadTickerReportCsv(report);
  }, [report]);

  const onExportPdf = useCallback(async () => {
    if (!report || !reportRef.current) return;
    setExportBusy(true);
    try {
      await downloadTickerReportPdf(reportRef.current, report);
    } catch (e) {
      console.warn('[TickerReportPage] PDF export failed', e);
    } finally {
      setExportBusy(false);
    }
  }, [report]);

  const expandedMonths = useMemo(() => {
    if (!expandedYear || !isMonthlyReportYear(expandedYear)) return [];
    return getMonthsForYear(expandedYear);
  }, [expandedYear]);

  if (!report) {
    return (
      <div className="ticker-report-page odin-content-page">
        <p className="ticker-report-page__empty">
          {liveError ? 'Report data is not available.' : 'Generating live report…'}
        </p>
      </div>
    );
  }

  const isDemoCopy = !liveLoading && !liveReport && !hasExactReport(sym, selectedYear, selectedMonth);

  if (liveLoading && !liveReport) {
    return (
      <div className="ticker-report-page odin-content-page">
        <p className="ticker-report-page__empty">Generating live report…</p>
      </div>
    );
  }

  return (
    <div className="ticker-report-page odin-content-page">
      <div className="ticker-report-page__toolbar">
        <div className="ticker-report-page__symbol-wrap">
          <label className="ticker-report-page__symbol-label" htmlFor="ticker-report-symbol">
            Ticker
          </label>
          <TickerSymbolCombobox
            symbol={sym}
            onSymbolChange={onSymbolChange}
            inputId="ticker-report-symbol"
          />
        </div>
        <div className="ticker-report-page__export-actions">
          <button type="button" className="ticker-report-page__export-btn" onClick={onExportCsv}>
            Download CSV
          </button>
          <button
            type="button"
            className="ticker-report-page__export-btn ticker-report-page__export-btn--primary"
            onClick={onExportPdf}
            disabled={exportBusy}
          >
            {exportBusy ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {isDemoCopy ? (
        <p className="ticker-report-page__demo-note" role="status">
          Showing sample report layout for {sym} — {periodLabel}. Full symbol-specific reports will be generated from
          live data.
        </p>
      ) : null}
      {!liveLoading && !liveReport && liveError ? (
        <p className="ticker-report-page__demo-note" role="status">
          Live report generation is unavailable right now ({liveError}). Showing fallback report layout.
        </p>
      ) : null}

      <div className="ticker-report-page__layout">
        <aside className="ticker-report-page__period-nav" aria-label="Report period">
          <p className="ticker-report-page__period-nav-title">Report archive</p>
          <div className="ticker-report-page__years-scroll">
            <ul className="ticker-report-page__years">
              {years.map((year) => {
                const hasMonths = getMonthsForYear(year).length > 0;
                const isExpanded = expandedYear === year;
                const isCurrentSelection = selectedYear === year;
                const annualActive = isCurrentSelection && !isMonthlyReportYear(year);
                return (
                  <li key={year} className="ticker-report-page__year-item">
                    <button
                      type="button"
                      className={
                        'ticker-report-page__year-btn' +
                        (isExpanded ? ' is-expanded' : '') +
                        (isCurrentSelection ? ' is-active-year' : '') +
                        (annualActive ? ' is-active' : '')
                      }
                      onClick={() => {
                        if (hasMonths) {
                          setExpandedYear((y) => (y === year ? null : year));
                        } else {
                          setExpandedYear(null);
                          setPeriod(year);
                        }
                      }}
                      aria-expanded={hasMonths ? isExpanded : undefined}
                    >
                      {year}
                      {!hasMonths ? <span className="ticker-report-page__year-tag">Annual</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {expandedMonths.length > 0 ? (
            <div className="ticker-report-page__months-scroll">
              <ul className="ticker-report-page__months" aria-label={`${expandedYear} months`}>
                {expandedMonths.map((month) => {
                  const active = selectedYear === expandedYear && selectedMonth === month;
                  return (
                    <li key={`${expandedYear}-${month}`}>
                      <button
                        type="button"
                        className={'ticker-report-page__month-btn' + (active ? ' is-active' : '')}
                        onClick={() => {
                          setExpandedYear(expandedYear);
                          setPeriod(expandedYear, month);
                        }}
                      >
                        {formatMonthShort(month)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </aside>

        <div className="ticker-report-page__main" ref={reportRef}>
          <TickerReportContent report={report} />
        </div>
      </div>
    </div>
  );
}
