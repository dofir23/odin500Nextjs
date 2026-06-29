const PREFIX = 'odin.tour';

export const TOUR_IDS = {
  PAPER_STRATEGY_MANAGE: 'paper-strategy-manage-v1'
};

function key(tourId) {
  return `${PREFIX}.${tourId}`;
}

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}


export function isTourSkipped(tourId) {
  const v = safeGet(key(tourId));
  return v === 'skipped' || v === 'done';
}

export function markTourCompleted(tourId) {
  safeSet(key(tourId), 'done');
}

export function markTourSkipped(tourId) {
  safeSet(key(tourId), 'skipped');
}

export function clearTourProgress(tourId) {
  try {
    localStorage.removeItem(key(tourId));
  } catch {
    /* ignore */
  }
}
