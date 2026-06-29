const { runPaperSplitAdjustments } = require('../services/splits/paperSplitAdjuster');

const ENABLE = process.env.ENABLE_PAPER_SPLIT_ADJUST !== '0';

/**
 * Run after split sync or on paper job interval.
 * @param {{ forceFrom?: string }} [opts]
 */
async function runPaperSplitAdjustmentJob(opts = {}) {
  if (!ENABLE) {
    return { ok: false, skipped: true, reason: 'ENABLE_PAPER_SPLIT_ADJUST=0' };
  }
  try {
    return await runPaperSplitAdjustments(opts);
  } catch (err) {
    if (String(err?.message || '').includes('does not exist')) {
      return {
        ok: false,
        skipped: true,
        reason: 'Run supabase/manual/paper_split_adjustments.sql in Supabase first'
      };
    }
    throw err;
  }
}

module.exports = { runPaperSplitAdjustmentJob };
