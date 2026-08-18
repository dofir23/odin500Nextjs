const ExcelJS = require('exceljs');
const {
  getPublishedPortfolioDetail,
  getPublishedClosedTrades,
  getPublishedStrategy
} = require('./publicPortfolio');

const AI_ENGINE_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };
const AI_INDEX_LABELS = { dow: 'Dow Jones', nasdaq: 'Nasdaq-100', sp500: 'S&P 500' };
const AI_DIRECTION_LABELS = { long: 'Long', short: 'Short', long_short: 'Long-Short' };
const AI_CRITERIA_LABELS = {
  none: 'No specific criteria',
  news_momentum: 'News / momentum',
  fundamental: 'Fundamental analysis',
  technical: 'Technical analysis'
};
const AI_CADENCE_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const AI_SIZING_LABELS = {
  equal_split: 'Equal split (same share count)',
  equal_capital: 'Equal capital (same $ per position)',
  fixed_qty: 'Fixed share count'
};

/**
 * Builds a 3-sheet workbook (Info & Strategy / Holdings / Closed Trades) for a published
 * portfolio — reused for both the "Export" button and as the template shape the AI portfolio
 * importer expects a re-uploaded Holdings sheet to match.
 * @param {string} accountId
 * @returns {Promise<{ workbook: ExcelJS.Workbook, filename: string }>}
 */
async function buildPortfolioExportWorkbook(accountId) {
  const [portfolio, closed, strategyBundle] = await Promise.all([
    getPublishedPortfolioDetail(accountId),
    getPublishedClosedTrades(accountId),
    getPublishedStrategy(accountId)
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Odin500';
  workbook.created = new Date();

  const infoSheet = workbook.addWorksheet('Info & Strategy');
  infoSheet.columns = [
    { key: 'field', width: 26 },
    { key: 'value', width: 60 }
  ];
  const infoRows = [
    ['Name', portfolio.name],
    ['Owner', portfolio.owner_label],
    ['Published at', portfolio.published_at],
    ['AI-managed', portfolio.ai_managed ? 'Yes' : 'No']
  ];
  if (portfolio.ai_managed) {
    infoRows.push(
      ['AI engine', AI_ENGINE_LABELS[portfolio.ai_engine] || portfolio.ai_engine],
      ['Index focus', AI_INDEX_LABELS[portfolio.ai_index_focus] || portfolio.ai_index_focus],
      ['Direction', AI_DIRECTION_LABELS[portfolio.ai_direction] || portfolio.ai_direction],
      ['Selection criteria', AI_CRITERIA_LABELS[portfolio.ai_criteria] || portfolio.ai_criteria],
      ['Rebalance cadence', AI_CADENCE_LABELS[portfolio.ai_rebalance_cadence] || portfolio.ai_rebalance_cadence],
      ['Target positions', portfolio.ai_position_count],
      ['Position sizing', AI_SIZING_LABELS[portfolio.ai_position_sizing] || ''],
      ['Shares per position', portfolio.ai_position_qty || '']
    );
  }
  infoRows.push(
    ['Strategy mode', portfolio.strategy_mode],
    ['Strategy label', strategyBundle.strategy?.name || strategyBundle.strategy?.strategy_key || ''],
    ['Description', portfolio.publish_description || ''],
    ['Strategy notes', portfolio.publish_strategy || ''],
    ['Starting capital', portfolio.starting_capital],
    ['Equity', portfolio.equity],
    ['Total return', portfolio.total_return],
    ['Total return %', portfolio.total_return_pct],
    ['Avg monthly return %', portfolio.avg_monthly_return_pct],
    ['Positions count', portfolio.positions_count]
  );
  for (const [field, value] of infoRows) {
    infoSheet.addRow({ field, value: value == null ? '' : value });
  }
  infoSheet.getColumn('field').font = { bold: true };

  const holdingsSheet = workbook.addWorksheet('Holdings');
  holdingsSheet.columns = [
    { header: 'Ticker', key: 'ticker', width: 12 },
    { header: 'Direction', key: 'direction', width: 12 },
    { header: 'Qty', key: 'qty', width: 12 },
    { header: 'Avg Cost', key: 'avg_cost', width: 14 },
    { header: 'Current Price', key: 'current_price', width: 14 },
    { header: 'Market Value', key: 'market_value', width: 14 },
    { header: 'Unrealized P&L', key: 'unrealized_pnl', width: 16 }
  ];
  holdingsSheet.getRow(1).font = { bold: true };
  holdingsSheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const p of portfolio.positions || []) {
    const isLong = Number(p.long_qty) > 0;
    holdingsSheet.addRow({
      ticker: p.ticker,
      direction: isLong ? 'Long' : 'Short',
      qty: isLong ? p.long_qty : p.short_qty,
      avg_cost: isLong ? p.avg_long_cost : p.avg_short_cost,
      current_price: p.current_price,
      market_value: isLong ? p.long_market_value : p.short_market_value,
      unrealized_pnl: p.unrealized_pnl
    });
  }

  const closedSheet = workbook.addWorksheet('Closed Trades');
  closedSheet.columns = [
    { header: 'Ticker', key: 'ticker', width: 12 },
    { header: 'Action', key: 'action', width: 10 },
    { header: 'Qty Closed', key: 'qty_closed', width: 12 },
    { header: 'Avg Entry Price', key: 'avg_entry_price', width: 16 },
    { header: 'Avg Exit Price', key: 'avg_exit_price', width: 16 },
    { header: 'Gross Realized P&L', key: 'gross_realized_pnl', width: 18 },
    { header: 'Total Fees', key: 'total_fees', width: 12 },
    { header: 'Net Realized P&L', key: 'net_realized_pnl', width: 16 },
    { header: 'Closed At', key: 'closed_at', width: 22 }
  ];
  closedSheet.getRow(1).font = { bold: true };
  closedSheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const t of closed.trades || []) {
    closedSheet.addRow({
      ticker: t.ticker,
      action: t.action,
      qty_closed: t.qty_closed,
      avg_entry_price: t.avg_entry_price,
      avg_exit_price: t.avg_exit_price,
      gross_realized_pnl: t.gross_realized_pnl,
      total_fees: t.total_fees,
      net_realized_pnl: t.net_realized_pnl,
      closed_at: t.closed_at
    });
  }

  const safeName = String(portfolio.name || 'portfolio')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'portfolio';

  return { workbook, filename: `odin500-${safeName}.xlsx` };
}

function normalizeTicker(t) {
  return String(t || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 12);
}

/**
 * Accepts a long leg as "Long"/"Long-only"/"BTO"/"Buy"/"L" and a short leg as
 * "Short"/"Short-only"/"STO"/"Sell"/"S" (matches the export's own Holdings sheet, plus what
 * people actually type). Anything else is ignored so stray rows can't become phantom holdings.
 */
function directionToAction(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(long|bto|buy|l)\b/i.test(v)) return 'BTO';
  if (/^(short|sto|sell|s)\b/i.test(v)) return 'STO';
  return null;
}

/** Cell values can be rich text / formula objects — reduce any of them to plain text. */
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    return '';
  }
  return String(value);
}

/**
 * Ordered, forgiving matchers — a hand-typed spreadsheet cell is not a dropdown, so these
 * tolerate typos, spacing, and partial labels ("dow jons" → dow, "no speciifc criteria" → none).
 * Order matters: the most specific pattern for each field is tested first.
 */
const SETTING_MATCHERS = {
  index: [
    { id: 'nasdaq', re: /nasdaq|ndx/ },
    { id: 'dow', re: /dow|djia/ },
    { id: 'sp500', re: /s\s*&?\s*p\s*-?\s*500|sp\s*500|standard\s*&?\s*poor/ }
  ],
  direction: [
    { id: 'long_short', re: /long\s*[-_/&+]?\s*(and\s*)?short|both/ },
    { id: 'short', re: /short/ },
    { id: 'long', re: /long/ }
  ],
  criteria: [
    { id: 'technical', re: /technical|signal/ },
    { id: 'fundamental', re: /fundament/ },
    { id: 'news_momentum', re: /news|momentum/ },
    // Catch-all for "none" / "no preference" / "any" / typo'd "no speciifc criteria".
    { id: 'none', re: /none|no\b|any|specif|prefer/ }
  ],
  cadence: [
    { id: 'daily', re: /dai?ly|every\s*day/ },
    { id: 'weekly', re: /week/ },
    { id: 'monthly', re: /month/ }
  ]
};

/** Maps a human-typed label ("S&P 500", "Long-Short", "Daily") or a raw id to the stored id. */
function matchSetting(raw, field) {
  const v = cellText(raw).trim().toLowerCase();
  if (!v) return null;
  for (const { id, re } of SETTING_MATCHERS[field] || []) {
    if (id === v) return id;
    if (re.test(v)) return id;
  }
  return null;
}

/** Wording that means "same dollar amount per position" rather than "same share count". */
const EQUAL_CAPITAL_CELL_RE = /capital|dollar|money|value|weight|amount|budget/i;

/**
 * The Shares-per-position cell is hand-typed, so it accepts a number, "equal capital", or
 * anything else — which falls through to equal split rather than erroring the upload.
 */
function parseSharesPerPosition(raw) {
  const text = cellText(raw).trim();
  if (!text) return null;
  if (EQUAL_CAPITAL_CELL_RE.test(text)) return { sizing: 'equal_capital', positionQty: null };
  const n = Math.trunc(Number(text.replace(/[^0-9.]/g, '')));
  if (!Number.isFinite(n) || n <= 0) return { sizing: 'equal_split', positionQty: null };
  return { sizing: 'fixed_qty', positionQty: n };
}

/** Which settings row label maps to which config key. */
const SETTING_KEYS = [
  { key: 'name', re: /^(portfolio\s*)?name$/i, raw: true },
  { key: 'indexFocus', re: /^index(\s*(focus|universe))?$/i, field: 'index' },
  { key: 'direction', re: /^direction$/i, field: 'direction' },
  { key: 'criteria', re: /^(selection\s*)?criteria|picking\s*style$/i, field: 'criteria' },
  { key: 'cadence', re: /^(rebalance\s*)?cadence|rebalance$/i, field: 'cadence' },
  { key: 'sizing', re: /^(shares?\s*(per|\/)\s*position|shares?\s*each|position\s*size|qty)$/i, sizing: true }
];

/** Reads an optional "Settings" sheet of Setting/Value rows into config ids. */
function parseSettingsSheet(workbook) {
  const sheet = workbook.worksheets.find((s) => /settings|config/i.test(s.name));
  if (!sheet) return {};
  const settings = {};
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const label = cellText(row.getCell(1).value).trim();
    const value = row.getCell(2).value;
    if (!label) return;
    for (const spec of SETTING_KEYS) {
      if (!spec.re.test(label)) continue;
      if (spec.sizing) {
        const parsed = parseSharesPerPosition(value);
        if (parsed) Object.assign(settings, parsed);
      } else if (spec.raw) {
        const text = cellText(value).trim();
        if (text) settings[spec.key] = text.slice(0, 120);
      } else {
        const id = matchSetting(value, spec.field);
        if (id) settings[spec.key] = id;
      }
      break;
    }
  });
  return settings;
}

/**
 * Parses an uploaded .xlsx buffer into the { ticker, action }[] shape the AI portfolio creator's
 * propose_create_ai_portfolio tool produces — so an imported file goes through the exact same
 * validateProposal() + confirm flow as a chat-derived proposal. Reads the "Holdings" sheet
 * (Ticker + Direction columns, same shape the export produces) plus an optional "Settings"
 * sheet, so a template file can supply the whole wizard config without any chat.
 * @param {Buffer} buffer
 * @returns {Promise<{ holdings: Array<{ ticker: string, action: string }>, settings: object }>}
 */
const HEADER_SCAN_ROWS = 10;
const TICKER_HEADER_RE = /^(ticker|symbol|stock)s?$/;
const DIRECTION_HEADER_RE = /^(direction|action|side|position|long\s*\/?\s*short)$/;

/** Reads one row as a dense array of trimmed lower-case strings, 1-indexed like ExcelJS cells. */
function rowLabels(row) {
  const labels = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    labels[colNumber] = cellText(cell.value).trim().toLowerCase();
  });
  return labels;
}

/**
 * Locates the holdings table anywhere in the workbook: any sheet, and any of the first few rows
 * (files get re-saved with renamed tabs, title rows, or the settings sheet first). Prefers a
 * sheet actually named "Holdings" but never assumes it — falling back to worksheets[0] used to
 * pick the Settings sheet and report a misleading "needs Ticker and Direction" error.
 * @returns {{ sheet: object, headerRow: number, ticker: number, direction: number } | null}
 */
function findHoldingsLayout(workbook) {
  const sheets = [...workbook.worksheets].sort((a, b) => {
    const aNamed = /holding/i.test(a.name) ? 0 : 1;
    const bNamed = /holding/i.test(b.name) ? 0 : 1;
    return aNamed - bNamed;
  });

  for (const sheet of sheets) {
    // Scan a fixed window rather than trusting rowCount — getRow() on a missing row is harmless.
    for (let r = 1; r <= HEADER_SCAN_ROWS; r += 1) {
      const labels = rowLabels(sheet.getRow(r));
      let ticker = -1;
      let direction = -1;
      for (let c = 1; c < labels.length; c += 1) {
        const label = labels[c];
        if (!label) continue;
        if (ticker < 0 && TICKER_HEADER_RE.test(label)) ticker = c;
        else if (direction < 0 && DIRECTION_HEADER_RE.test(label)) direction = c;
      }
      if (ticker > 0 && direction > 0) {
        return { sheet, headerRow: r, ticker, direction };
      }
    }
  }
  return null;
}

async function parseHoldingsWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets.length) {
    const err = new Error('No sheet found in the uploaded file.');
    err.status = 400;
    throw err;
  }

  const layout = findHoldingsLayout(workbook);
  if (!layout) {
    // Tell the user what we actually saw — a silent "wrong columns" is impossible to debug.
    const seen = workbook.worksheets
      .map((s) => {
        const labels = rowLabels(s.getRow(1)).filter(Boolean);
        return `"${s.name}" (${labels.length ? labels.join(', ') : 'empty first row'})`;
      })
      .join('; ');
    const err = new Error(
      `Couldn't find a holdings table with "Ticker" and "Direction" columns. Sheets found: ${seen}.`
    );
    err.status = 400;
    throw err;
  }

  const holdings = [];
  layout.sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= layout.headerRow) return;
    const ticker = normalizeTicker(cellText(row.getCell(layout.ticker).value));
    const action = directionToAction(cellText(row.getCell(layout.direction).value));
    if (ticker && action) holdings.push({ ticker, action });
  });

  return { holdings, settings: parseSettingsSheet(workbook) };
}

/**
 * Blank, self-documenting template for the AI portfolio importer: a Settings sheet holding the
 * wizard answers and a Holdings sheet pre-filled with the right row count for a Long-Short book.
 * @returns {{ workbook: ExcelJS.Workbook, filename: string }}
 */
function buildAiPortfolioTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Odin500';
  workbook.created = new Date();

  const settings = workbook.addWorksheet('Settings');
  settings.columns = [
    { header: 'Setting', key: 'setting', width: 22 },
    { header: 'Value', key: 'value', width: 26 },
    { header: 'Allowed values', key: 'allowed', width: 52 }
  ];
  settings.getRow(1).font = { bold: true };
  const settingRows = [
    ['Portfolio Name', 'My AI Portfolio', 'Any text (max 120 characters)'],
    ['Index', 'S&P 500', 'S&P 500 | Dow Jones | Nasdaq-100'],
    ['Direction', 'Long-Short', 'Long-only | Short-only | Long-Short (needs both sides)'],
    ['Criteria', 'Technical analysis', 'No specific criteria | News / momentum | Fundamental analysis | Technical analysis'],
    ['Cadence', 'Daily', 'Daily | Weekly | Monthly'],
    [
      'Shares per position',
      'Equal split',
      'Equal split (same share count each) | Equal capital (same $ each) | any whole number of shares'
    ]
  ];
  for (const [setting, value, allowed] of settingRows) {
    settings.addRow({ setting, value, allowed });
  }
  settings.getColumn('setting').font = { bold: true };
  settings.getColumn('allowed').font = { italic: true, color: { argb: 'FF6B7280' } };

  settings.addRow({});
  const note = settings.addRow({
    setting: 'Note',
    value:
      'Fill the Holdings sheet with tickers from the index above — however many rows you want (1–30) is how many positions you get. Direction must be Long or Short. Sizing never spends more than your starting capital, so some cash is normally left over.'
  });
  note.font = { italic: true, color: { argb: 'FF6B7280' } };

  const holdings = workbook.addWorksheet('Holdings');
  holdings.columns = [
    { header: 'Ticker', key: 'ticker', width: 14 },
    { header: 'Direction', key: 'direction', width: 14 }
  ];
  holdings.getRow(1).font = { bold: true };
  // A 5+5 Long-Short starting shape — add or delete rows freely; the row count is the book size.
  for (let i = 0; i < 5; i += 1) holdings.addRow({ ticker: '', direction: 'Long' });
  for (let i = 0; i < 5; i += 1) holdings.addRow({ ticker: '', direction: 'Short' });

  return { workbook, filename: 'odin500-ai-portfolio-template.xlsx' };
}

module.exports = {
  buildPortfolioExportWorkbook,
  parseHoldingsWorkbook,
  buildAiPortfolioTemplateWorkbook
};
