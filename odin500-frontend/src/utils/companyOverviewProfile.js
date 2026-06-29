import { companyProfileDataKey } from '../lib/env.js';

const COMPANY_OVERVIEW_BASE = 'https://www.alphavantage.co/query';
const COMPANY_PROFILE_DATA_KEY = companyProfileDataKey();

const MEM_CACHE = new Map();
const INFLIGHT = new Map();
const STORAGE_PREFIX = 'odin_company_overview_';
const STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

function storageKey(symbol) {
  return `${STORAGE_PREFIX}${String(symbol || '').toUpperCase().trim()}`;
}

function readFromStorage(symbol) {
  try {
    const raw = sessionStorage.getItem(storageKey(symbol));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.ts || !parsed.payload) return null;
    if (Date.now() - Number(parsed.ts) > STORAGE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeToStorage(symbol, payload) {
  try {
    sessionStorage.setItem(storageKey(symbol), JSON.stringify({ ts: Date.now(), payload }));
  } catch {
    // ignore storage quota / privacy errors
  }
}

export function getCompanyProfileApiKeyPresent() {
  return Boolean(COMPANY_PROFILE_DATA_KEY);
}

export function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fmtCompact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1
  }).format(n);
}

export function alphaProfileIrlink(site) {
  const raw = String(site || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = String(u.hostname || '').replace(/^www\./i, '').trim();
    if (!host) return '';
    return `https://investor.${host}`;
  } catch {
    return '';
  }
}

export async function fetchCompanyOverviewCached(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym || !COMPANY_PROFILE_DATA_KEY) return null;
  if (MEM_CACHE.has(sym)) return MEM_CACHE.get(sym);

  const fromStorage = readFromStorage(sym);
  if (fromStorage) {
    MEM_CACHE.set(sym, fromStorage);
    return fromStorage;
  }

  if (INFLIGHT.has(sym)) return INFLIGHT.get(sym);

  const qs = new URLSearchParams({
    function: 'OVERVIEW',
    symbol: sym,
    apikey: COMPANY_PROFILE_DATA_KEY
  });
  const req = (async () => {
    try {
      const res = await fetch(`${COMPANY_OVERVIEW_BASE}?${qs.toString()}`);
      const payload = await res.json();
      if (payload?.Information || payload?.Note || payload?.ErrorMessage) {
        return MEM_CACHE.get(sym) || null;
      }
      const normalized = payload && typeof payload === 'object' ? payload : null;
      if (normalized) {
        MEM_CACHE.set(sym, normalized);
        writeToStorage(sym, normalized);
      }
      return normalized;
    } catch {
      return MEM_CACHE.get(sym) || null;
    } finally {
      INFLIGHT.delete(sym);
    }
  })();

  INFLIGHT.set(sym, req);
  return req;
}
