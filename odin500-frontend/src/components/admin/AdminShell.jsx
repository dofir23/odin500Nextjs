'use client';

import { Link, NavLink } from '@/navigation/appRouterCompat.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/content/portfolios', label: 'Published portfolios' },
  { to: '/admin/subscribers', label: 'Subscribers' },
  { to: '/admin/content/newsletters', label: 'Newsletters' },
  { to: '/admin/social', label: 'Social drafts' }
];

export function AdminShell({ title, subtitle, children }) {
  return (
    <div className="admin-page odin-content-page">
      <header className="admin-header">
        <div>
          <p className="admin-header__eyebrow">Site administration</p>
          <h1 className="admin-header__title">{title}</h1>
          {subtitle ? <p className="admin-header__sub">{subtitle}</p> : null}
        </div>
        <div className="admin-header__actions">
          <Link to="/market" className="paper-btn paper-btn--ghost">
            Back to app
          </Link>
        </div>
      </header>

      <nav className="admin-nav" aria-label="Admin sections">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              'admin-nav__link' + (isActive ? ' admin-nav__link--active' : '')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {children}
    </div>
  );
}
