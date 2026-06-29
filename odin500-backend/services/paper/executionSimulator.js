// Execution cost model for paper fills.
// Slippage is price-impact; fees approximate broker + regulatory charges.

const SLIPPAGE_RATE = 0.0005;
const COMMISSION_RATE = 0.0002;
const EXCHANGE_FEE_RATE = 0.00005;
const REGULATORY_FEE_RATE = 0.00003;

/**
 * @param {'BTO'|'STO'|'BTC'|'STC'} action
 * @param {number} qty
 * @param {number} marketPrice
 * @returns {{
 *  fillPrice: number,
 *  fillQty: number,
 *  slippage: number,
 *  commission: number,
 *  exchangeFee: number,
 *  regulatoryFee: number,
 *  totalFees: number,
 *  notional: number
 * }}
 */
function simulateFill(action, qty, marketPrice) {
  const price = Number(marketPrice);
  const quantity = Number(qty);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Unable to simulate fill: invalid market price');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Unable to simulate fill: invalid quantity');
  }

  const normalized = String(action || '').toUpperCase();
  const isBuy = normalized === 'BTO' || normalized === 'BTC';
  if (!isBuy && normalized !== 'STO' && normalized !== 'STC') {
    throw new Error('Unable to simulate fill: invalid action');
  }

  const slip = price * SLIPPAGE_RATE;
  const fillPrice = isBuy ? price + slip : price - slip;
  const notional = Math.max(fillPrice * quantity, 0);
  const commission = notional * COMMISSION_RATE;
  const exchangeFee = notional * EXCHANGE_FEE_RATE;
  const regulatoryFee = notional * REGULATORY_FEE_RATE;
  const totalFees = commission + exchangeFee + regulatoryFee;

  return {
    fillPrice: Math.round(fillPrice * 10000) / 10000,
    fillQty: quantity,
    slippage: Math.round(slip * quantity * 10000) / 10000,
    commission: Math.round(commission * 10000) / 10000,
    exchangeFee: Math.round(exchangeFee * 10000) / 10000,
    regulatoryFee: Math.round(regulatoryFee * 10000) / 10000,
    totalFees: Math.round(totalFees * 10000) / 10000,
    notional: Math.round(notional * 10000) / 10000
  };
}

module.exports = {
  simulateFill,
  SLIPPAGE_RATE,
  COMMISSION_RATE,
  EXCHANGE_FEE_RATE,
  REGULATORY_FEE_RATE
};
