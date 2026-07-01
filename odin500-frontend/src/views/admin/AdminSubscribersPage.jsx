'use client';

import { Link } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminTableSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { useAdminSubscribers } from '../../hooks/useAdminUsers.js';
import '../../styles/admin.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function AdminSubscribersPage() {
  return (
    <AdminGate>
      <AdminSubscribersContent />
    </AdminGate>
  );
}

function AdminSubscribersContent() {
  const { subscribers, loading, error } = useAdminSubscribers();

  return (
    <AdminShell title="Subscribers" subtitle="Newsletter subscription records from BigQuery.">
      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {loading ? (
        <AdminTableSkeleton rows={6} />
      ) : (
        <section className="admin-card">
          <div className="admin-table-wrap">
            {!subscribers.length ? (
              <div className="admin-empty">No subscription records.</div>
            ) : (
              <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Email / In-app</th>
                  <th>Subscribed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={`${s.user_id}-${s.email}`}>
                    <td>{s.email}</td>
                    <td>
                      {s.is_active ? (
                        <span className="admin-chip admin-chip--active">Active</span>
                      ) : (
                        <span className="admin-chip admin-chip--muted">Inactive</span>
                      )}
                    </td>
                    <td>
                      {s.email_opt_in ? 'Email' : '—'}
                      {s.in_app_opt_in ? ' · In-app' : ''}
                    </td>
                    <td>{fmtDate(s.subscribed_at)}</td>
                    <td>
                      {s.user_id ? (
                        <Link to={`/admin/users/${s.user_id}`} className="admin-link">
                          User
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      )}
    </AdminShell>
  );
}
