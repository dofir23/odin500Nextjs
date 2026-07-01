const PLAN_NAMES = Object.freeze(['Free', 'Odin500 Pro']);
const PLAN_STATUSES = Object.freeze(['active', 'paused', 'expired']);

function defaultRenewalFromJoinDate(joinDate) {
  const base = joinDate ? new Date(joinDate) : new Date();
  if (Number.isNaN(base.getTime())) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const renewal = new Date(base);
  renewal.setMonth(renewal.getMonth() + 1);
  return renewal.toISOString();
}

function normalizePlanName(value) {
  const name = String(value || '').trim();
  if (PLAN_NAMES.includes(name)) return name;
  return 'Free';
}

function normalizePlanStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (PLAN_STATUSES.includes(status)) return status;
  return 'active';
}

module.exports = {
  PLAN_NAMES,
  PLAN_STATUSES,
  defaultRenewalFromJoinDate,
  normalizePlanName,
  normalizePlanStatus
};
