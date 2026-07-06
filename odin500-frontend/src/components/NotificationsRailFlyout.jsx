'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useNotifications } from '../hooks/useNotifications.js';

function IcoClose({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Slide-out notifications panel (same shell as watchlist).
 * @param {{ open: boolean, onClose: () => void, docked?: boolean }} props
 */
export function NotificationsRailFlyout({ open, onClose, docked = false }) {
  const { notifications, unreadCount, busy, error, reload, markRead, markAllRead } = useNotifications({
    enabled: open,
    panelOpen: open
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {docked ? null : <div className="wl-flyout__backdrop" aria-hidden onClick={onClose} />}
      <div
        className={'wl-flyout rail-notifications-flyout' + (docked ? ' wl-flyout--docked' : '')}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : 'true'}
        aria-labelledby="rail-notifications-flyout-title"
      >
        <div className="wl-flyout__head">
          <h2 id="rail-notifications-flyout-title" className="wl-flyout__title">
            Notifications
            {unreadCount > 0 ? (
              <span className="rail-notifications-flyout__count"> ({unreadCount})</span>
            ) : null}
          </h2>
          <div className="wl-flyout__head-actions">
            {unreadCount > 0 ? (
              <button
                type="button"
                className="rail-notifications-flyout__mark-all"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
            <button type="button" className="wl-flyout__iconbtn" onClick={onClose} title="Close" aria-label="Close">
              <IcoClose className="wl-flyout__iconbtn-svg" />
            </button>
          </div>
        </div>

        <p className="rail-notifications-flyout__hint">Odin500 Weekly and account alerts</p>

        {error ? <p className="wl-flyout__err">{error}</p> : null}

        <div className="rail-notifications-flyout__scroll" aria-busy={busy}>
          {busy && notifications.length === 0 ? (
            <p className="rail-notifications-flyout__placeholder">Loading…</p>
          ) : null}

          {!busy && notifications.length === 0 && !error ? (
            <p className="rail-notifications-flyout__placeholder">No notifications yet.</p>
          ) : null}

          <ul className="rail-notifications-flyout__list">
            {notifications.map((n) => {
              const href = n.linkPath || (n.newsletterSlug ? `/newsletter/${n.newsletterSlug}` : '/newsletter');
              return (
                <li
                  key={n.id}
                  className={
                    'rail-notifications-flyout__item' + (n.unread ? ' rail-notifications-flyout__item--unread' : '')
                  }
                >
                  <Link
                    href={href}
                    className="rail-notifications-flyout__link"
                    onClick={() => {
                      if (n.unread) void markRead(n.id);
                      onClose();
                    }}
                  >
                    <span className="rail-notifications-flyout__title">{n.title}</span>
                    {n.body ? <span className="rail-notifications-flyout__body">{n.body}</span> : null}
                    <span className="rail-notifications-flyout__time">{formatWhen(n.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <button type="button" className="rail-notifications-flyout__refresh" onClick={() => void reload()}>
          Refresh
        </button>
      </div>
    </>
  );
}
