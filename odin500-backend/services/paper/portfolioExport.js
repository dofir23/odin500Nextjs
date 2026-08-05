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
      ['Rebalance cadence', AI_CADENCE_LABELS[portfolio.ai_rebalance_cadence] || portfolio.ai_rebalance_cadence]
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

/** Accepts "Long"/"BTO" for a long leg or "Short"/"STO" for a short leg (matches the export's own Holdings sheet). */
function directionToAction(raw) {
  const v = String(raw || '').trim().toUpperCase();
  if (v === 'LONG' || v === 'BTO') return 'BTO';
  if (v === 'SHORT' || v === 'STO') return 'STO';
  return null;
}

/**
 * Parses an uploaded .xlsx buffer's "Holdings" sheet (same shape the export above produces:
 * Ticker + Direction columns) into the { ticker, action }[] shape the AI portfolio creator's
 * propose_create_ai_portfolio tool produces — so an imported file goes through the exact same
 * validateProposal() + confirm flow as a chat-derived proposal.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ ticker: string, action: string }>>}
 */
async function parseHoldingsWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet =
    workbook.worksheets.find((s) => /holdings/i.test(s.name)) || workbook.worksheets[0];
  if (!sheet) {
    const err = new Error('No sheet found in the uploaded file.');
    err.status = 400;
    throw err;
  }

  const headerRow = sheet.getRow(1).values || [];
  const colIndex = { ticker: -1, direction: -1 };
  headerRow.forEach((cell, i) => {
    const label = String(cell || '').trim().toLowerCase();
    if (label === 'ticker' || label === 'symbol') colIndex.ticker = i;
    if (label === 'direction' || label === 'action') colIndex.direction = i;
  });
  if (colIndex.ticker < 0 || colIndex.direction < 0) {
    const err = new Error('The "Holdings" sheet needs "Ticker" and "Direction" columns.');
    err.status = 400;
    throw err;
  }

  const holdings = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const ticker = normalizeTicker(row.getCell(colIndex.ticker).value);
    const action = directionToAction(row.getCell(colIndex.direction).value);
    if (ticker && action) holdings.push({ ticker, action });
  });

  return holdings;
}

module.exports = { buildPortfolioExportWorkbook, parseHoldingsWorkbook };
