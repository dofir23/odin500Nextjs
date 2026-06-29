'use client';
/**
 * Non-dismissable signup gate for logged-out users (refresh clears; re-shows after 3 min active time).
 * @param {{ open: boolean, onSignup: () => void, onLogin: () => void }} props
 */
export function EngagementSignupModal({ open, onSignup, onLogin }) {
  if (!open) return null;

  return (
    <div className="wl-manage-overlay engagement-signup-overlay engagement-signup-overlay--blocking" role="presentation">
      <div
        className="wl-manage-modal engagement-signup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="engagement-signup-title"
      >
        <div className="wl-manage-modal__head engagement-signup-modal__head">
          <h2 id="engagement-signup-title" className="wl-manage-modal__title">
            Unlock Odin premium features
          </h2>
        </div>
        <div className="wl-manage-modal__body engagement-signup-modal__body">
          <p className="engagement-signup-modal__lead">
            Sign in or create a free account to access member-only tools across Odin.
          </p>
          <ul className="engagement-signup-modal__list">
            <li>Download market data in <strong>CSV</strong> format</li>
            <li>Create, update, and delete <strong>watchlists</strong></li>
            <li>
              Open <strong>paper trading accounts</strong> with custom automated strategies
            </li>
            <li>Create and delete strategy rules tailored to your workflow</li>
            <li>Run and monitor simulated portfolios with Odin signals and watchlist leaders</li>
          </ul>
          <p className="engagement-signup-modal__cta-hint">Log in or sign up to continue using Odin.</p>
        </div>
        <div className="wl-manage-modal__foot engagement-signup-modal__foot">
          <button type="button" className="wl-manage-btn wl-manage-btn--ghost engagement-signup-modal__login" onClick={onLogin}>
            Log in
          </button>
          <button type="button" className="wl-manage-btn wl-manage-btn--primary engagement-signup-modal__signup" onClick={onSignup}>
            Sign up free
          </button>
        </div>
      </div>
    </div>
  );
}
