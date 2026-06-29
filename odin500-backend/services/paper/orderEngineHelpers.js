function normalizeAction(rawAction, rawSide = '') {
  const act = String(rawAction || '').toUpperCase().trim();
  if (['BTO', 'STO', 'BTC', 'STC'].includes(act)) return act;
  const side = String(rawSide || '').toLowerCase().trim();
  if (side === 'buy') return 'BTO';
  if (side === 'sell') return 'STC';
  return 'BTO';
}

function actionToLegacySide(action) {
  return action === 'BTO' || action === 'BTC' ? 'buy' : 'sell';
}

module.exports = { normalizeAction, actionToLegacySide };
