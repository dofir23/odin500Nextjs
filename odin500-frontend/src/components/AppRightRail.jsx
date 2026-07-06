'use client';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { useHeaderProfile } from '../hooks/useHeaderProfile.js';
import { useNotifications } from '../hooks/useNotifications.js';
import { getAuthToken } from '../store/apiStore.js';

/**
 * Fixed narrow right rail (Figma): always visible, not expandable.
 */
function IcoUser() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="10" r="2.75" fill="currentColor" />
      <path
        d="M6.5 18.5c.8-2.2 2.6-3.5 5.5-3.5s4.7 1.3 5.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoAnalytics() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="9" r="2.5" fill="currentColor" />
      <path
        d="M4.5 19c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="13" y="5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15 14l2-3 2 2 2-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 4l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcoNews() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M18 6h2a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 9h6M8 12h6M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="9" width="2.5" height="2.5" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IcoFlame() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-1.2 3.5-4 4.5-4 9a4 4 0 1 0 8 0c0-3-1.5-4.5-2.5-6.5-.5-1-1-1.8-1.5-2.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 14c-.8 1.2-1 2.2-1 3a2 2 0 1 0 4 0c0-.6-.3-1.4-1-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 3a1 1 0 1 0-2 0v.75h-.557A4.214 4.214 0 0 0 6.237 7.7l-.221 3.534a7.4 7.4 0 0 1-1.308 3.754a1.617 1.617 0 0 0 1.135 2.529l3.407.408V19a2.75 2.75 0 1 0 5.5 0v-1.075l3.407-.409a1.617 1.617 0 0 0 1.135-2.528a7.4 7.4 0 0 1-1.308-3.754l-.221-3.533a4.214 4.214 0 0 0-4.206-3.951H13zm-2.557 2.25a2.714 2.714 0 0 0-2.709 2.544l-.22 3.534a8.9 8.9 0 0 1-1.574 4.516a.117.117 0 0 0 .082.183l3.737.449c1.489.178 2.993.178 4.482 0l3.737-.449a.117.117 0 0 0 .082-.183a8.9 8.9 0 0 1-1.573-4.516l-.221-3.534a2.714 2.714 0 0 0-2.709-2.544zm1.557 15c-.69 0-1.25-.56-1.25-1.25v-.75h2.5V19c0 .69-.56 1.25-1.25 1.25"
      />
    </svg>
  );
}

function IcoOdinSignals() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 15l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="15" r="1" fill="currentColor" />
      <circle cx="10" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

export function AppRightRail({ mobileOpen = false, onRequestClose = null }) {
  const navigate = useNavigate();
  const dock = useRightRailDock();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef(null);
  const { loggedIn, profileName, initials, avatarUrl, handleSignOut, goToSignIn } =
    useHeaderProfile();
  const { unreadCount } = useNotifications({
    enabled: loggedIn && Boolean(getAuthToken())
  });

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (profileWrapRef.current && !profileWrapRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const closeAll = () => {
    dock.close();
    setProfileOpen(false);
    if (typeof onRequestClose === 'function') onRequestClose();
  };

  const toggleWatchlist = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setProfileOpen(false);
    dock.toggleWatchlist();
  };

  const toggleNews = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setProfileOpen(false);
    dock.toggleNews();
  };

  const toggleMarketMovers = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setProfileOpen(false);
    dock.toggleMarketMovers();
  };

  const toggleNotifications = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setProfileOpen(false);
    dock.toggleNotifications();
  };

  return (
    <>
      <aside className={'app-right-rail' + (mobileOpen ? ' app-right-rail--mobile-open' : '')} aria-label="Quick navigation">
        <div className="app-right-rail__stack">
          <div className="header-util-wrap" ref={profileWrapRef}>
            <button
              type="button"
              className={'app-right-rail__btn header-avatar-btn' + (profileOpen ? ' app-right-rail__btn--active header-avatar-btn--active' : '')}
              title="User Silhouette"
              aria-label="User Silhouette"
              aria-expanded={profileOpen}
              onClick={() => {
                if (mobileOpen) {
                  closeAll();
                  return;
                }
                dock.close();
                setProfileOpen((v) => !v);
              }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden /> : <span className="header-avatar-placeholder">{initials}</span>}
            </button>
            {profileOpen ? (
              <div className="header-pop header-pop--profile" role="menu" aria-label="Profile menu">
                <div className="header-pop__profile-top">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="header-pop__profile-image" aria-hidden />
                  ) : (
                    <span className="header-pop__profile-icon" aria-hidden>{initials}</span>
                  )}
                  <span className="header-pop__profile-name">{profileName}</span>
                </div>
                {loggedIn ? (
                  <>
                    <button
                      type="button"
                      className="header-pop__item"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/about');
                      }}
                    >
                      Your Profile
                    </button>
                    <button type="button" className="header-pop__item" onClick={() => setProfileOpen(false)}>
                      Setting
                    </button>
                    <button
                      type="button"
                      className="header-pop__item header-pop__item--danger"
                      onClick={() => {
                        setProfileOpen(false);
                        handleSignOut();
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="header-pop__item"
                    onClick={() => {
                      setProfileOpen(false);
                      goToSignIn();
                    }}
                  >
                    Sign in
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={'app-right-rail__btn' + (dock.activePanel === 'watchlist' ? ' app-right-rail__btn--active' : '')}
            title="Watch Lists"
            aria-label="Watch Lists"
            aria-expanded={dock.activePanel === 'watchlist'}
            onClick={toggleWatchlist}
          >
            <IcoAnalytics />
          </button>
          <button
            type="button"
            className={'app-right-rail__btn' + (dock.activePanel === 'market-movers' ? ' app-right-rail__btn--active' : '')}
            title="Market Movers"
            aria-label="Market Movers"
            aria-expanded={dock.activePanel === 'market-movers'}
            onClick={toggleMarketMovers}
          >
            <IcoFlame />
          </button>
          <button
            type="button"
            className={'app-right-rail__btn' + (dock.activePanel === 'news' ? ' app-right-rail__btn--active' : '')}
            title="Top news"
            aria-label="Top news"
            aria-expanded={dock.activePanel === 'news'}
            onClick={toggleNews}
          >
            <IcoNews />
          </button>
          <button
            type="button"
            className={
              'app-right-rail__btn app-right-rail__btn--bell' +
              (dock.activePanel === 'notifications' ? ' app-right-rail__btn--active' : '')
            }
            title="Notifications"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            aria-expanded={dock.activePanel === 'notifications'}
            onClick={toggleNotifications}
          >
            <IcoBell />
            {unreadCount > 0 ? (
              <span className="app-right-rail__notify-dot" aria-hidden />
            ) : null}
          </button>
        </div>
      </aside>
    </>
  );
}
