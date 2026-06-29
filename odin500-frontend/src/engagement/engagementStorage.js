/** Active browsing time before showing the signup gate (logged-out users). */
export const ENGAGEMENT_ACTIVE_MS_THRESHOLD = 3 * 60 * 1000;

export function markEngagementFirstVisit() {
  /* reserved for analytics; modal re-shows after refresh + 3 min active time */
}

export function canShowEngagementModal() {
  return true;
}
