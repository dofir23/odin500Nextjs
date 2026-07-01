export const ADMIN_PLAN_NAMES = ['Free', 'Odin500 Pro'];

export const ADMIN_PLAN_STATUSES = ['active', 'paused', 'expired'];

export function defaultRenewalFromJoinDate(joinDate) {
  const base = joinDate ? new Date(joinDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  const renewal = new Date(base);
  renewal.setMonth(renewal.getMonth() + 1);
  return renewal.toISOString().slice(0, 10);
}

export function renewalDateInputValue(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}
