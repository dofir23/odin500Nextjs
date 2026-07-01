'use client';

import { Link } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminDashboardSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { useAdminOverview } from '../../hooks/useAdmin.js';
import '../../styles/admin.css';

export default function AdminDashboardPage() {
  return (
    <AdminGate>
      <AdminDashboardContent />
    </AdminGate>
  );
}

function AdminDashboardContent() {
  const { overview, loading, error } = useAdminOverview();

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Overview of users, subscriptions, and published content."
    >
      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {loading ? (
        <AdminDashboardSkeleton />
      ) : (
        <>
          <section className="admin-stats" aria-label="Site metrics">
            <article className="admin-stat">
              <span className="admin-stat__label">Total users</span>
              <strong className="admin-stat__value">{overview?.total_users ?? '—'}</strong>
            </article>
            <article className="admin-stat">
              <span className="admin-stat__label">Signups (7 days)</span>
              <strong className="admin-stat__value">{overview?.recent_signups_7d ?? '—'}</strong>
            </article>
            <article className="admin-stat">
              <span className="admin-stat__label">Newsletter subscribers</span>
              <strong className="admin-stat__value">
                {overview?.active_newsletter_subscribers ?? '—'}
              </strong>
            </article>
            <article className="admin-stat">
              <span className="admin-stat__label">Published portfolios</span>
              <strong className="admin-stat__value">{overview?.published_portfolios ?? '—'}</strong>
            </article>
            <article className="admin-stat">
              <span className="admin-stat__label">Newsletter issues</span>
              <strong className="admin-stat__value">{overview?.newsletter_issues ?? '—'}</strong>
            </article>
          </section>

          <section className="admin-card">
            <div className="admin-card__head">
              <h2 className="admin-card__title">Quick links</h2>
            </div>
            <div className="admin-card__body" style={{ padding: '1rem' }}>
              <p style={{ margin: 0 }}>
                <Link to="/admin/users" className="admin-link">
                  Manage users
                </Link>
                {' · '}
                <Link to="/admin/content/portfolios" className="admin-link">
                  Published portfolios
                </Link>
                {' · '}
                <Link to="/admin/subscribers" className="admin-link">
                  Subscribers
                </Link>
              </p>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
