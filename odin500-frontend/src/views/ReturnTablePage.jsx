'use client';
import { useEffect, useMemo, useState } from 'react';
import { MarketReturnsSummaryTable } from '../components/MarketReturnsSummaryTable.jsx';
import { ReturnTableIndexUniverse } from '../components/ReturnTableIndexUniverse.jsx';
import {
  RETURN_TABLE_INDEX_UNIVERSES,
  allReturnTableRowDefs,
  buildValsFromBatch,
  fetchMarketTickerReturnsBatch,
  returnTableSections,
  uniqueMarketSummaryTickers
} from '../utils/marketReturnsTable.js';

const REFRESH_MS = 5 * 60 * 1000;
const PRIORITY_SECTION_IDS = new Set(['us', 'index']);

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').ReturnTableInitialData | null} [props.initialData]
 */
export default function ReturnTablePage({ initialData = null }) {

  const sections = useMemo(() => returnTableSections(), []);
  const allDefs = useMemo(() => allReturnTableRowDefs(), []);
  const prioritySections = useMemo(
    () => sections.filter((section) => PRIORITY_SECTION_IDS.has(section.id)),
    [sections]
  );
  const deferredSections = useMemo(
    () => sections.filter((section) => !PRIORITY_SECTION_IDS.has(section.id)),
    [sections]
  );
  const priorityDefs = useMemo(
    () =>
      prioritySections.flatMap((section) =>
        section.subsections?.length
          ? section.subsections.flatMap((sub) => sub.rows || [])
          : section.rows || []
      ),
    [prioritySections]
  );
  const deferredDefs = useMemo(
    () =>
      deferredSections.flatMap((section) =>
        section.subsections?.length
          ? section.subsections.flatMap((sub) => sub.rows || [])
          : section.rows || []
      ),
    [deferredSections]
  );
  const priorityTickers = useMemo(() => uniqueMarketSummaryTickers(priorityDefs), [priorityDefs]);
  const deferredTickers = useMemo(() => uniqueMarketSummaryTickers(deferredDefs), [deferredDefs]);

  const [vals, setVals] = useState(() => initialData?.vals ?? {});
  const [loadingPriority, setLoadingPriority] = useState(() => !initialData?.vals || !Object.keys(initialData.vals).length);
  const [loadingDeferred, setLoadingDeferred] = useState(false);
  const [error, setError] = useState('');
  const [showDeferredSections, setShowDeferredSections] = useState(false);
  const [showIndexConstituents, setShowIndexConstituents] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowDeferredSections(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showDeferredSections) return;
    const timer = window.setTimeout(() => setShowIndexConstituents(true), 420);
    return () => window.clearTimeout(timer);
  }, [showDeferredSections]);

  const hasSsrVals = Boolean(initialData?.vals && Object.keys(initialData.vals).length);

  useEffect(() => {
    let cancel = false;

    async function loadPriority() {
      if (!priorityTickers.length) return;
      if (hasSsrVals) {
        setLoadingPriority(false);
        return;
      }
      setLoadingPriority(true);
      setError('');
      try {
        const priorityPayload = await fetchMarketTickerReturnsBatch(priorityTickers, REFRESH_MS);
        if (cancel) return;
        setVals(buildValsFromBatch(priorityPayload, priorityDefs));
      } catch (e) {
        if (!cancel) {
          setError(e.message || 'Failed loading return tables');
          setVals({});
        }
      } finally {
        if (!cancel) setLoadingPriority(false);
      }
    }

    async function loadDeferred() {
      if (!deferredTickers.length) return;
      setLoadingDeferred(true);
      try {
        const deferredPayload = await fetchMarketTickerReturnsBatch(deferredTickers, REFRESH_MS);
        if (cancel) return;
        const deferredVals = buildValsFromBatch(deferredPayload, deferredDefs);
        setVals((prev) => ({ ...prev, ...deferredVals }));
      } catch {
        /* keep priority vals */
      } finally {
        if (!cancel) setLoadingDeferred(false);
      }
    }

    async function load() {
      await loadPriority();
      if (!cancel) await loadDeferred();
    }

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [deferredDefs, deferredTickers, priorityDefs, priorityTickers, hasSsrVals]);

  return (
    <div className="return-table-page odin-content-page">
      <header className="return-table-page__head">
        <h1 className="return-table-page__title">Return table</h1>
        <p className="return-table-page__sub">
          Period returns for US indices, sector ETFs, and other market series — same periods as the Markets page summary.
        </p>
        {error && !loadingPriority ? (
          <p className="return-table-page__status return-table-page__status--err" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <div className="return-table-page__sections">
        {prioritySections.map((section) => {
          if (section.subsections?.length) {
            return (
              <div key={section.id} className="return-table-page__group">
                <h2 className="return-table-page__group-title">{section.title}</h2>
                {section.subsections.map((sub) => (
                  <MarketReturnsSummaryTable
                    key={sub.id}
                    title={sub.title}
                    defs={sub.rows}
                    vals={vals}
                    loading={loadingPriority}
                  />
                ))}
              </div>
            );
          }
          return (
            <MarketReturnsSummaryTable
              key={section.id}
              title={section.title}
              defs={section.rows}
              vals={vals}
              loading={loadingPriority}
              showInfoTip={section.id === 'us'}
            />
          );
        })}

        {showDeferredSections
          ? deferredSections.map((section) => {
              if (section.subsections?.length) {
                return (
                  <div key={section.id} className="return-table-page__group">
                    <h2 className="return-table-page__group-title">{section.title}</h2>
                    {section.subsections.map((sub) => (
                      <MarketReturnsSummaryTable
                        key={sub.id}
                        title={sub.title}
                        defs={sub.rows}
                        vals={vals}
                        loading={loadingDeferred}
                      />
                    ))}
                  </div>
                );
              }
              return (
                <MarketReturnsSummaryTable
                  key={section.id}
                  title={section.title}
                  defs={section.rows}
                  vals={vals}
                  loading={loadingDeferred}
                  showInfoTip={section.id === 'us'}
                />
              );
            })
          : null}

        <div className="return-table-page__group">
          <h2 className="return-table-page__group-title">Index constituents</h2>
          <p className="return-table-page__group-hint">
            Full index membership with period returns — 20 symbols per page.
          </p>
          {showIndexConstituents
            ? RETURN_TABLE_INDEX_UNIVERSES.map((universe) => (
                <ReturnTableIndexUniverse key={universe.id} universe={universe} />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
