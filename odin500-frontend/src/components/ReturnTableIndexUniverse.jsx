'use client';
import { useEffect, useMemo, useState } from 'react';
import { MarketReturnsSummaryTable } from './MarketReturnsSummaryTable.jsx';
import {
  RETURN_TABLE_PAGE_SIZE,
  buildValsFromBatch,
  fetchIndexConstituentRowDefs,
  fetchMarketTickerReturnsBatch
} from '../utils/marketReturnsTable.js';

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Paginated multi-period returns for one index universe (S&P 500, Dow, Nasdaq 100).
 * @param {{ id: string, title: string, apiIndex: string }} universe
 */
export function ReturnTableIndexUniverse({ universe }) {
  const [allDefs, setAllDefs] = useState([]);
  const [vals, setVals] = useState({});
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [returnsError, setReturnsError] = useState('');

  useEffect(() => {
    let cancel = false;
    async function loadList() {
      setListLoading(true);
      setListError('');
      setPage(1);
      setVals({});
      try {
        const defs = await fetchIndexConstituentRowDefs(universe.apiIndex);
        if (cancel) return;
        setAllDefs(defs);
        if (!defs.length) setListError('No constituents found for this index.');
      } catch (e) {
        if (!cancel) {
          setAllDefs([]);
          setListError(e.message || 'Failed loading constituents');
        }
      } finally {
        if (!cancel) setListLoading(false);
      }
    }
    loadList();
    return () => {
      cancel = true;
    };
  }, [universe.apiIndex]);

  const totalPages = Math.max(1, Math.ceil(allDefs.length / RETURN_TABLE_PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageDefs = useMemo(() => {
    const start = (pageSafe - 1) * RETURN_TABLE_PAGE_SIZE;
    return allDefs.slice(start, start + RETURN_TABLE_PAGE_SIZE);
  }, [allDefs, pageSafe]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    let cancel = false;
    if (!pageDefs.length) {
      setReturnsLoading(false);
      return () => {
        cancel = true;
      };
    }
    async function loadReturns() {
      setReturnsLoading(true);
      setReturnsError('');
      try {
        const tickers = pageDefs.map((d) => d.ticker);
        const payload = await fetchMarketTickerReturnsBatch(tickers, REFRESH_MS);
        if (cancel) return;
        const pageVals = buildValsFromBatch(payload, pageDefs);
        setVals((prev) => ({ ...prev, ...pageVals }));
      } catch (e) {
        if (!cancel) setReturnsError(e.message || 'Failed loading returns');
      } finally {
        if (!cancel) setReturnsLoading(false);
      }
    }
    loadReturns();
    return () => {
      cancel = true;
    };
  }, [pageDefs]);

  const tableTitle = `${universe.title} constituents`;
  const busy = listLoading || returnsLoading;
  const error = listError || returnsError;

  if (listLoading && !allDefs.length) {
    return (
      <MarketReturnsSummaryTable
        title={tableTitle}
        defs={[]}
        vals={{}}
        loading
        error={listError}
      />
    );
  }

  return (
    <MarketReturnsSummaryTable
      title={tableTitle}
      defs={pageDefs}
      vals={vals}
      loading={busy}
      error={error}
      titleCount={allDefs.length || null}
      page={pageSafe}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
