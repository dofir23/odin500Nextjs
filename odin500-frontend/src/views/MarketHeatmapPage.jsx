'use client';
import { dedupeTickerDetailRows } from '../utils/dedupeTickerRows.js';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { Upload } from 'lucide-react';
import { ChartFullscreenToggleIcon } from '../components/ChartFullscreenToggleIcon.jsx';
import { ChartInfoTip } from '../components/ChartInfoTip.jsx';
import { ChartSnapshotExportModal } from '../components/ChartSnapshotExportModal.jsx';
import { useChartFullscreen } from '../components/ChartSectionIconActions.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { SectorTreemap } from '../components/SectorTreemap.jsx';
import { resolveTreemapRows } from '../components/SectorTreemap.jsx';
import TradingChartLoader from '../components/TradingChartLoader.jsx';
import {fetchJsonCached, getAuthToken, canFetchMarketData} from '../store/apiStore.js';
import { fetchTickerDetailsQuery } from '../query/marketQueries.js';
import { CHART_INFO_TIPS } from '../components/chartInfoTips.js';
import { returnToHeatColor } from '../utils/heatmapColors.js';
import { useChartSnapshotExport } from '../hooks/useChartSnapshotExport.js';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { fmtPctSigned, fmtPrice } from '../utils/formatDisplayNumber.js';
/** `apiIndex` must match `market_groups.name` from Supabase (see GET /api/market/indices). */
const INDEX_MENU = [
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones' },
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100' },
  { id: 'etf', apiIndex: 'ETF', label: 'ETF' },
  // { id: 'all', apiIndex: 'SP500', label: 'All Stocks' }
];

const PERIOD_LABEL_OVERRIDES = {
  'last-date': '1 day',
  week: '1 week',
  'last-month': '1 month',
  'last-3-months': '3 month',
  'last-6-months': '6 month',
  ytd: 'Year to date',
  'last-1-year': '1 year',
  'last-2-years': '2 year',
  'last-3-years': '3 year',
  'last-5-years': '5 year',
  'last-10-years': '10 year'
};
const HEATMAP_TABLE_PAGE_SIZE = 30;
const BOTTOM_SORT_ABS = 'absChange';

function cmpStr(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

/** Sector / industry labels: Title Case (e.g. “Health Care”) — matches market heatmap preview. */
function toTitleCaseGroupLabel(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function cmpNumNullable(a, b) {
  const na = Number.isFinite(a) ? a : null;
  const nb = Number.isFinite(b) ? b : null;
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  return na - nb;
}

function tileSizeForSort(row) {
  const n = Number(row?.__tmw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sortBottomTableRows(rows, sortKey, sortDir) {
  const copy = [...rows];
  const mul = sortDir === 'asc' ? 1 : -1;
  copy.sort((a, b) => {
    if (sortKey === BOTTOM_SORT_ABS) {
      const da = Math.abs(parsePct(a.totalReturnPercentage) || 0);
      const db = Math.abs(parsePct(b.totalReturnPercentage) || 0);
      const c = da - db;
      return sortDir === 'desc' ? -c : c;
    }
    let c = 0;
    switch (sortKey) {
      case 'symbol':
        c = cmpStr(a.symbol, b.symbol);
        break;
      case 'company':
        c = cmpStr(a.security, b.security);
        break;
      case 'sector':
        c = cmpStr(a.sector, b.sector);
        break;
      case 'industry':
        c = cmpStr(a.industry, b.industry);
        break;
      case 'price':
        c = cmpNumNullable(
          a.price != null ? Number(a.price) : null,
          b.price != null ? Number(b.price) : null
        );
        break;
      case 'changePct':
        c = cmpNumNullable(parsePct(a.totalReturnPercentage), parsePct(b.totalReturnPercentage));
        break;
      case 'signal':
        c = cmpStr(a.signal, b.signal);
        break;
      case 'weight':
        c = cmpNumNullable(tileSizeForSort(a), tileSizeForSort(b));
        break;
      default:
        c = 0;
    }
    return c * mul;
  });
  return copy;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function indexAvailableOnServer(apiIndex, apiIndices) {
  if (!apiIndices?.length) return true;
  const want = norm(apiIndex);
  return apiIndices.some((x) => norm(x) === want);
}

function formatListDate(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(d);
}

function parsePct(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const compact = String(v).trim().replace(/[%\s]/g, '').replace(/,/g, '');
  const n = Number(compact);
  return Number.isFinite(n) ? n : NaN;
}

function rowSubIndustry(row) {
  return (
    row?.subIndustry ||
    row?.sub_industry ||
    row?.subindustry ||
    row?.SubIndustry ||
    row?.Sub_Industry ||
    '—'
  );
}

function rowWeight(row) {
  const candidates = [
    row?.weight,
    row?.Weight,
    row?.indexWeight,
    row?.index_weight,
    row?.weightPercent,
    row?.weight_percentage
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').HeatmapInitialData | null} [props.initialData]
 */
export default function MarketHeatmapPage({ initialData = null }) {
  const navigate = useNavigate();
  const ssrMatchesDefaults =
    initialData?.index === 'Dow Jones' && initialData?.period === 'last-date';
  const [apiIndices, setApiIndices] = useState(() => initialData?.apiIndices ?? []);
  const [periodOptions, setPeriodOptions] = useState(() => initialData?.periodOptions ?? []);
  const [indexMenuId, setIndexMenuId] = useState('dow');
  const [periodValue, setPeriodValue] = useState(() => initialData?.period ?? 'last-date');
  const [rows, setRows] = useState(() =>
    ssrMatchesDefaults ? dedupeTickerDetailRows(initialData?.rows ?? []) : []
  );
  const [loading, setLoading] = useState(() => !ssrMatchesDefaults || !initialData?.rows?.length);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoverSymbol, setHoverSymbol] = useState('');
  const [scaleSpan, setScaleSpan] = useState(3);
  const [colorFade, setColorFade] = useState({
    negFade: 100,
    neutralFade: 100,
    posFade: 100
  });
  const [zoom, setZoom] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [bottomSortKey, setBottomSortKey] = useState(BOTTOM_SORT_ABS);
  const [bottomSortDir, setBottomSortDir] = useState('desc');
  const heatmapVizRef = useRef(null);
  const treemapHostRef = useRef(null);
  const exportTitleId = useId().replace(/:/g, '');
  const indicesInitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!canFetchMarketData()) return;
      if (initialData?.apiIndices?.length && initialData?.periodOptions?.length) {
        return;
      }
      try {
        const [ir, pr] = await Promise.all([
          fetchJsonCached({ path: '/api/market/indices', method: 'GET', ttlMs: 60 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/period-options', method: 'GET', ttlMs: 60 * 60 * 1000 })
        ]);
        if (cancelled) return;
        const idx = Array.isArray(ir.data?.indices) ? ir.data.indices : [];
        const periods = Array.isArray(pr.data?.periods) ? pr.data.periods : [];
        setApiIndices(idx);
        setPeriodOptions(periods);
      } catch {
        if (!cancelled) {
          setApiIndices([]);
          setPeriodOptions([]);
        }
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiIndices.length || indicesInitRef.current) return;
    indicesInitRef.current = true;
    setIndexMenuId((currentId) => {
      const cur = INDEX_MENU.find((m) => m.id === currentId);
      const ok =
        cur &&
        (cur.id === 'all' || indexAvailableOnServer(cur.apiIndex, apiIndices));
      if (ok) return currentId;
      const fb = INDEX_MENU.find(
        (m) => m.id === 'all' || indexAvailableOnServer(m.apiIndex, apiIndices)
      );
      return fb ? fb.id : currentId;
    });
  }, [apiIndices]);

  const activeMenu = INDEX_MENU.find((m) => m.id === indexMenuId) || INDEX_MENU[0];
  const fetchIndex = activeMenu.apiIndex;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!canFetchMarketData()) {
        setError('Unable to load market data.');
        return;
      }
      if (
        ssrMatchesDefaults &&
        initialData?.rows?.length &&
        fetchIndex === initialData.index &&
        periodValue === initialData.period
      ) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const payload = await fetchTickerDetailsQuery(
          { index: fetchIndex, period: periodValue },
          { staleTime: 3 * 60 * 1000 }
        );
        if (cancelled) return;
        const list = dedupeTickerDetailRows(Array.isArray(payload?.data) ? payload.data : []);
        setRows(list);
        if (!list.length) setError('No rows returned for this index and period.');
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load heatmap data');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchIndex, periodValue, initialData, ssrMatchesDefaults]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.symbol || '')
          .toUpperCase()
          .includes(q) ||
        String(r.security || '')
          .toUpperCase()
          .includes(q)
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    const copy = [...resolveTreemapRows(filteredRows)];
    copy.sort((a, b) => {
      const da = Math.abs(parsePct(a.totalReturnPercentage) || 0);
      const db = Math.abs(parsePct(b.totalReturnPercentage) || 0);
      return db - da;
    });
    return copy;
  }, [filteredRows]);
  const leftTableRows = useMemo(() => sortedRows.slice(0, 80), [sortedRows]);

  const bottomBaseRows = useMemo(() => resolveTreemapRows(filteredRows), [filteredRows]);
  const bottomSortedRows = useMemo(
    () => sortBottomTableRows(bottomBaseRows, bottomSortKey, bottomSortDir),
    [bottomBaseRows, bottomSortKey, bottomSortDir]
  );

  const tableTotalPages = useMemo(
    () => Math.max(1, Math.ceil(bottomSortedRows.length / HEATMAP_TABLE_PAGE_SIZE)),
    [bottomSortedRows.length]
  );
  const tablePageSafe = Math.min(Math.max(1, tablePage), tableTotalPages);
  const tableRows = useMemo(() => {
    const start = (tablePageSafe - 1) * HEATMAP_TABLE_PAGE_SIZE;
    return bottomSortedRows.slice(start, start + HEATMAP_TABLE_PAGE_SIZE);
  }, [bottomSortedRows, tablePageSafe]);
  const gainsLosses = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const r of rows) {
      const pct = parsePct(r?.totalReturnPercentage);
      if (!Number.isFinite(pct)) continue;
      if (pct > 0) up += 1;
      else if (pct < 0) down += 1;
    }
    return { up, down };
  }, [rows]);

  const periodSelectOptions = useMemo(() => {
    if (!periodOptions.length) {
      return Object.entries(PERIOD_LABEL_OVERRIDES).map(([value, label]) => ({ value, label }));
    }
    return periodOptions.map((p) => ({
      value: p.value,
      label: PERIOD_LABEL_OVERRIDES[p.value] || p.label || p.value
    }));
  }, [periodOptions]);

  const periodDropdownOptions = useMemo(
    () => periodSelectOptions.map((o) => ({ id: o.value, label: o.label })),
    [periodSelectOptions]
  );

  const tablePageButtons = useMemo(() => {
    if (tableTotalPages <= 1) return [1];
    if (tableTotalPages <= 5) return Array.from({ length: tableTotalPages }, (_, i) => i + 1);
    let start = Math.max(1, tablePageSafe - 2);
    if (start + 4 > tableTotalPages) start = tableTotalPages - 4;
    return [start, start + 1, start + 2, start + 3, start + 4];
  }, [tablePageSafe, tableTotalPages]);

  useEffect(() => {
    if (!periodSelectOptions.length) return;
    if (!periodSelectOptions.some((o) => o.value === periodValue)) {
      setPeriodValue(periodSelectOptions[0].value);
    }
  }, [periodSelectOptions, periodValue]);

  useEffect(() => {
    setBottomSortKey(BOTTOM_SORT_ABS);
    setBottomSortDir('desc');
    setTablePage(1);
  }, [indexMenuId, periodValue, searchQuery]);

  useEffect(() => {
    setTablePage(1);
  }, [bottomSortKey, bottomSortDir]);

  const handleBottomSortClick = useCallback(
    (key) => {
      if (key === 'changePct' && bottomSortKey === BOTTOM_SORT_ABS) {
        setBottomSortKey('changePct');
        setBottomSortDir('desc');
        return;
      }
      if (key === bottomSortKey) {
        setBottomSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setBottomSortKey(key);
        if (['price', 'changePct', 'weight'].includes(key)) setBottomSortDir('desc');
        else setBottomSortDir('asc');
      }
    },
    [bottomSortKey]
  );

  const bottomThAriaSort = useCallback(
    (key) => {
      const active =
        bottomSortKey === key || (key === 'changePct' && bottomSortKey === BOTTOM_SORT_ABS);
      if (!active) return undefined;
      return bottomSortDir === 'asc' ? 'ascending' : 'descending';
    },
    [bottomSortKey, bottomSortDir]
  );

  const isBottomSortColumnActive = useCallback(
    (key) => {
      if (key === 'changePct') {
        return bottomSortKey === BOTTOM_SORT_ABS || bottomSortKey === 'changePct';
      }
      return bottomSortKey === key;
    },
    [bottomSortKey]
  );

  const scaleMin = -scaleSpan;
  const scaleMax = scaleSpan;

  const { isFullscreen, toggleFullscreen } = useChartFullscreen(heatmapVizRef);

  const buildHeatmapSnapshotFilename = useCallback(() => {
    const idx = String(fetchIndex || 'heatmap')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const per = String(periodValue || 'period')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `heatmap-${idx || 'index'}-${per || 'period'}.png`;
  }, [fetchIndex, periodValue]);

  const {
    exportingSnapshot,
    exportModalOpen,
    exportModalStatus,
    exportPreviewUrl,
    exportFilename,
    exportModalError,
    openExportModal,
    closeExportModal,
    downloadFromExportModal
  } = useChartSnapshotExport({
    snapshotRootRef: heatmapVizRef,
    plotHostRef: treemapHostRef,
    fullscreenTargetRef: heatmapVizRef,
    buildFilename: buildHeatmapSnapshotFilename,
    disabled: loading || !filteredRows.length,
    getBackgroundColor: (isLight) => (isLight ? '#f8fafc' : '#0b0f16')
  });

  const downloadCsv = useCallback(() => {
    if (!bottomSortedRows.length) return;
    const header = ['Ticker', 'Company', 'Sector', 'Industry', 'Price', 'Change %', 'Signal', 'Weight'];
    const lines = [
      header.map(csvEscape).join(','),
      ...bottomSortedRows.map((r) => {
        const pct = parsePct(r.totalReturnPercentage);
        const chg = Number.isFinite(pct) ? String(pct) : '';
        const tw = tileSizeForSort(r);
        const w = tw != null ? tw.toFixed(3) : '';
        return [
          csvEscape(r.symbol || ''),
          csvEscape(r.security || ''),
          csvEscape(r.sector || ''),
          csvEscape(r.industry || ''),
          r.price != null && Number.isFinite(Number(r.price)) ? String(Number(r.price)) : '',
          chg,
          csvEscape(String(r.signal ?? '')),
          csvEscape(w)
        ].join(',');
      })
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-table-${fetchIndex}-${periodValue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bottomSortedRows, fetchIndex, periodValue]);

  const downloadCsvClick = useGatedCsvDownload(downloadCsv);

  const zoomIn = () => setZoom((z) => Math.min(2.25, Math.round((z + 0.25) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100));
  const openTickerPage = useCallback(
    (sym) => {
      const clean = String(sym || '').toUpperCase().trim();
      if (!clean) return;
      navigate(`/ticker/${encodeURIComponent(clean)}?ticker=${encodeURIComponent(clean)}`);
    },
    [navigate]
  );
  const renderTickerListCard = () => (
    <section className="heatmap-card heatmap-card--table">
      <h2 className="heatmap-card__title">Tickers</h2>
      <div className="heatmap-search">
        <span className="heatmap-search__icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          className="heatmap-search__input"
          placeholder="Search ticker"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search ticker"
        />
      </div>
      <div className="heatmap-table-wrap">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Price</th>
              <th>Change %</th>
            </tr>
          </thead>
          <tbody>
            {leftTableRows.map((t, idx) => {
              const pct = parsePct(t.totalReturnPercentage);
              const neg = Number.isFinite(pct) && pct < 0;
              const pos = Number.isFinite(pct) && pct > 0;
              return (
                <tr key={`${t.symbol}-${idx}`} onMouseEnter={() => setHoverSymbol(String(t.symbol || ''))} onMouseLeave={() => setHoverSymbol('')}>
                  <td className="heatmap-table__td-ticker">
                    <button type="button" className="index-constituents-link" onClick={() => openTickerPage(t.symbol)}>
                      {t.symbol}
                    </button>
                  </td>
                  <td
                    className={
                      'heatmap-table__td-num' +
                      (pos ? ' heatmap-table__chg--up' : '') +
                      (neg ? ' heatmap-table__chg--down' : '')
                    }
                  >
                    {fmtPrice(t.price)}
                  </td>
                  <td
                    className={
                      'heatmap-table__td-num' +
                      (pos ? ' heatmap-table__chg--up' : '') +
                      (neg ? ' heatmap-table__chg--down' : '')
                    }
                  >
                    {fmtPctSigned(t.totalReturnPercentage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="heatmap-page">
      <div className="heatmap-page__grid">
        <aside className="heatmap-sidebar" aria-label="Filters">
          <section className="heatmap-card">
            <h2 className="heatmap-card__title">Index / List selection</h2>
            <ul className="heatmap-index-list">
              {INDEX_MENU.map((item) => {
                const enabled =
                  item.id === 'all' || apiIndices.length === 0
                    ? true
                    : indexAvailableOnServer(item.apiIndex, apiIndices);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        'heatmap-index-row' +
                        (indexMenuId === item.id ? ' heatmap-index-row--active' : '') +
                        (!enabled ? ' heatmap-index-row--disabled' : '')
                      }
                      disabled={!enabled}
                      onClick={() => enabled && setIndexMenuId(item.id)}
                    >
                      <span>{item.label}</span>
                      <span className="heatmap-index-row__chev" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {activeMenu.id === 'all' ? (
              <p className="heatmap-card__hint">Uses the same universe as SP500 (broad market set).</p>
            ) : null}
          </section>

          <section className="heatmap-card">
            <h2 className="heatmap-card__title">Period selection</h2>
            <label className="heatmap-field-label" htmlFor="heatmap-period">
              Choose period
            </label>
            <ThemedDropdown
              buttonId="heatmap-period"
              className="heatmap-period-dd"
              value={periodValue}
              options={periodDropdownOptions}
              onChange={setPeriodValue}
              title="Choose period"
              ariaLabelPrefix="Period"
              wideLabel
            />
          </section>

          <div className="heatmap-flow-desktop-only">{renderTickerListCard()}</div>
        </aside>

        <main className="heatmap-main">
          <div
            className={'heatmap-main__viz' + (isFullscreen ? ' heatmap-main__viz--fullscreen-active' : '')}
            ref={heatmapVizRef}
          >
          <header className="heatmap-main__header">
            <div className="heatmap-main__date">
              <span className="heatmap-main__cal" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
                  <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              {formatListDate(new Date())}
              <ChartInfoTip tip={CHART_INFO_TIPS.heatmapTreemap} align="start" />
            </div>
            <div className="heatmap-main__tools">
              <button
                type="button"
                className="heatmap-icon-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen heatmap'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen heatmap'}
              >
                <ChartFullscreenToggleIcon isFullscreen={isFullscreen} />
              </button>
              <button
                type="button"
                className="heatmap-icon-btn"
                onClick={downloadCsvClick}
                title="Download CSV"
                aria-label="Download CSV"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0l4-4m-4 4L8 11M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="heatmap-icon-btn"
                onClick={openExportModal}
                disabled={loading || exportingSnapshot || !filteredRows.length}
                title={exportingSnapshot ? 'Exporting…' : 'Export heatmap'}
                aria-label={exportingSnapshot ? 'Exporting heatmap' : 'Export heatmap snapshot'}
              >
                <Upload size={18} strokeWidth={2} aria-hidden />
              </button>
              <button type="button" className="heatmap-icon-btn" onClick={zoomIn} title="Zoom in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4M11 8v6M8 11h6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="heatmap-icon-btn" onClick={zoomOut} title="Zoom out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4M8 11h6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          {error ? <div className="heatmap-main__error">{error}</div> : null}

          <div className="heatmap-treemap-outer" ref={treemapHostRef}>
            {loading ? (
              <div className="chart-viz-loading-wrap heatmap-chart-viz-loading-wrap">
                <TradingChartLoader
                  label="Loading sector heatmap…"
                  sublabel={`${activeMenu.label} · ${
                    periodSelectOptions.find((o) => o.value === periodValue)?.label || periodValue
                  }`}
                />
              </div>
            ) : (
              <div
                className="heatmap-treemap-zoom"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
              >
                <SectorTreemap
                  rows={filteredRows}
                  scaleMin={scaleMin}
                  scaleMax={scaleMax}
                  colorFade={colorFade}
                  highlightSymbol={hoverSymbol}
                  finvizStrict
                  titleCaseGroupLabels
                />
              </div>
            )}
          </div>

          <footer className="heatmap-scale-bar">
            {/* <div className="heatmap-scale-bar__hint" aria-live="polite">
              <div>Use mouse wheel to zoom in and out. Drag zoomed map to pan it.</div>
              <div>Double-click a ticker to display detailed information in a new window.</div>
              <div>
                Hover mouse cursor over a ticker to see its main competitors in a stacked view with a 3-month history
                graph.
              </div>
            </div> */}
            <div className="heatmap-scale-bar__legend">
              <div className="heatmap-scale-bar__fades">
                <div className="flex w-full min-w-0 flex-row items-end justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 basis-0 flex-col items-stretch gap-1">
                    <label
                      htmlFor="heatmap-fade-green"
                      className="flex min-h-10 flex-col items-center justify-end gap-0.5 text-center text-[10px] leading-snug text-white/70 [html[data-theme=light]_&]:text-slate-700"
                    >
                      <span className="block w-full shrink-0">Green fade</span>
                      <span className="inline-block min-w-[4.25ch] text-center tabular-nums">{colorFade.posFade}%</span>
                    </label>
                    <input
                      id="heatmap-fade-green"
                      type="range"
                      className="h-2 w-full min-w-0 cursor-pointer"
                      min="0"
                      max="100"
                      step="1"
                      value={colorFade.posFade}
                      onChange={(e) =>
                        setColorFade((prev) => ({ ...prev, posFade: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 basis-0 flex-col items-stretch gap-1">
                    <label
                      htmlFor="heatmap-fade-neutral"
                      className="flex min-h-10 flex-col items-center justify-end gap-0.5 text-center text-[10px] leading-snug text-white/70 [html[data-theme=light]_&]:text-slate-700"
                    >
                      <span className="block w-full shrink-0">Neutral fade</span>
                      <span className="inline-block min-w-[4.25ch] text-center tabular-nums">{colorFade.neutralFade}%</span>
                    </label>
                    <input
                      id="heatmap-fade-neutral"
                      type="range"
                      className="h-2 w-full min-w-0 cursor-pointer"
                      min="0"
                      max="100"
                      step="1"
                      value={colorFade.neutralFade}
                      onChange={(e) =>
                        setColorFade((prev) => ({ ...prev, neutralFade: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 basis-0 flex-col items-stretch gap-1">
                    <label
                      htmlFor="heatmap-fade-red"
                      className="flex min-h-10 flex-col items-center justify-end gap-0.5 text-center text-[10px] leading-snug text-white/70 [html[data-theme=light]_&]:text-slate-700"
                    >
                      <span className="block w-full shrink-0">Red fade</span>
                      <span className="inline-block min-w-[4.25ch] text-center tabular-nums">{colorFade.negFade}%</span>
                    </label>
                    <input
                      id="heatmap-fade-red"
                      type="range"
                      className="h-2 w-full min-w-0 cursor-pointer"
                      min="0"
                      max="100"
                      step="1"
                      value={colorFade.negFade}
                      onChange={(e) =>
                        setColorFade((prev) => ({ ...prev, negFade: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="heatmap-scale-bar__scale">
                <div
                  className="heatmap-scale-bar__gradient"
                  style={{
                    background: `linear-gradient(90deg, ${returnToHeatColor(-3, scaleMin, scaleMax, colorFade)} 0%, ${returnToHeatColor(0, scaleMin, scaleMax, colorFade)} 50%, ${returnToHeatColor(3, scaleMin, scaleMax, colorFade)} 100%)`
                  }}
                />
                <div className="heatmap-scale-bar__ticks">
                  {['-3%', '-2%', '-1%', '0%', '+1%', '+2%', '+3%'].map((lbl) => (
                    <span key={lbl} className="heatmap-scale-bar__lbl">
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </footer>
          </div>
          <div className="heatmap-flow-mobile-only">{renderTickerListCard()}</div>

          <section className="heatmap-bottom-table" aria-labelledby="heatmap-bottom-table-title">
            <div className="heatmap-bottom-table__head">
              <h2 className="heatmap-card__title" id="heatmap-bottom-table-title">
                {activeMenu.label} Tickers
              </h2>
              <div className="heatmap-bottom-table__head-right">
                <button
                  type="button"
                  className="historical-data__btn"
                  disabled={loading || !bottomSortedRows.length}
                  title="Download CSV"
                  onClick={downloadCsvClick}
                >
                  Download CSV
                </button>
              </div>
            </div>
            <div className="heatmap-table-wrap heatmap-table-wrap--bottom">
              <table className="heatmap-table heatmap-table--bottom">
                <thead>
                  <tr>
                    <th aria-sort={bottomThAriaSort('symbol')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        onClick={() => handleBottomSortClick('symbol')}
                      >
                        <span className="heatmap-table__sort-text">Ticker</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('symbol')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('symbol') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    <th aria-sort={bottomThAriaSort('company')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        onClick={() => handleBottomSortClick('company')}
                      >
                        <span className="heatmap-table__sort-text">Company</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('company')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('company') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    <th aria-sort={bottomThAriaSort('sector')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        onClick={() => handleBottomSortClick('sector')}
                      >
                        <span className="heatmap-table__sort-text">Sector</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('sector')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('sector') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    <th aria-sort={bottomThAriaSort('industry')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        onClick={() => handleBottomSortClick('industry')}
                      >
                        <span className="heatmap-table__sort-text">Industry</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('industry')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('industry') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    <th aria-sort={bottomThAriaSort('price')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        onClick={() => handleBottomSortClick('price')}
                      >
                        <span className="heatmap-table__sort-text">Price</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('price')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('price') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    <th aria-sort={bottomThAriaSort('changePct')}>
                      <button
                        type="button"
                        className="heatmap-table__sort-btn"
                        title={
                          bottomSortKey === BOTTOM_SORT_ABS
                            ? 'Sorted by absolute change; click for signed %'
                            : 'Sort by change %'
                        }
                        onClick={() => handleBottomSortClick('changePct')}
                      >
                        <span className="heatmap-table__sort-text">Change %</span>
                        <span
                          className={
                            'heatmap-table__sort-ico' +
                            (isBottomSortColumnActive('changePct')
                              ? ' heatmap-table__sort-ico--active'
                              : ' heatmap-table__sort-ico--idle')
                          }
                          aria-hidden
                        >
                          {isBottomSortColumnActive('changePct') ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                    
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => {
                    const pct = parsePct(t.totalReturnPercentage);
                    const neg = Number.isFinite(pct) && pct < 0;
                    const pos = Number.isFinite(pct) && pct > 0;
                    const weight = rowWeight(t);
                    const tileSize =
                      Number.isFinite(Number(t.__tmw)) && Number(t.__tmw) > 0 ? Number(t.__tmw) : null;
                    return (
                      <tr
                        key={`${t.symbol}-${t.industry || ''}-${t.sector || ''}`}
                        onMouseEnter={() => setHoverSymbol(String(t.symbol || ''))}
                        onMouseLeave={() => setHoverSymbol('')}
                      >
                        <td className="heatmap-table__td-ticker">
                          <button
                            type="button"
                            className="index-constituents-link"
                            onClick={() => openTickerPage(t.symbol)}
                          >
                            {t.symbol || 'N/A'}
                          </button>
                        </td>
                        <td className="heatmap-table__td-muted" title={t.security || undefined}>
                          {t.security || 'N/A'}
                        </td>
                        <td className="heatmap-table__td-muted">
                          {t.sector ? toTitleCaseGroupLabel(t.sector) : 'N/A'}
                        </td>
                        <td className="heatmap-table__td-muted">
                          {t.industry ? toTitleCaseGroupLabel(t.industry) : 'N/A'}
                        </td>
                        <td
                          className={
                            'heatmap-table__td-num' +
                            (pos ? ' heatmap-table__chg--up' : '') +
                            (neg ? ' heatmap-table__chg--down' : '')
                          }
                        >
                          {fmtPrice(t.price)}
                        </td>
                        <td
                          className={
                            'heatmap-table__td-num' +
                            (pos ? ' heatmap-table__chg--up' : '') +
                            (neg ? ' heatmap-table__chg--down' : '')
                          }
                        >
                          {fmtPctSigned(t.totalReturnPercentage)}
                        </td>
                        
                      </tr>
                    );
                  })}
                  {!loading && !tableRows.length ? (
                    <tr>
                      <td colSpan={6} className="heatmap-table__empty">
                        No tickers found for this index/period.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="heatmap-table-pagination" aria-label="Heatmap ticker pagination">
              <button
                type="button"
                className="heatmap-table-pagination__btn heatmap-table-pagination__btn--nav"
                disabled={tablePageSafe <= 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              {tablePageButtons.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={
                    'heatmap-table-pagination__btn' +
                    (p === tablePageSafe ? ' heatmap-table-pagination__btn--active' : '')
                  }
                  onClick={() => setTablePage(p)}
                  aria-current={p === tablePageSafe ? 'page' : undefined}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="heatmap-table-pagination__btn heatmap-table-pagination__btn--nav"
                disabled={tablePageSafe >= tableTotalPages}
                onClick={() => setTablePage((p) => Math.min(tableTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </section>
        </main>
      </div>
      <ChartSnapshotExportModal
        open={exportModalOpen}
        status={exportModalStatus}
        error={exportModalError}
        previewUrl={exportPreviewUrl}
        onClose={closeExportModal}
        onDownload={downloadFromExportModal}
        title="Export heatmap"
        titleId={exportTitleId}
        previewAlt="Exported market heatmap"
        shareLabel="Market heatmap"
        exportFilename={exportFilename}
      />
    </div>
  );
}
