'use client';

import { useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { useAdminUsers } from '../../hooks/useAdminUsers.js';
import '../../styles/admin.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function AdminUsersPage() {
  return (
    <AdminGate>
      <AdminUsersContent />
    </AdminGate>
  );
}

function AdminUsersContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { users, total, loading, error } = useAdminUsers({ page, search: query });

  return (
    <AdminShell title="Users" subtitle="All registered accounts with plan and activity summary.">
      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          type="search"
          className="admin-input"
          placeholder="Search email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="paper-btn paper-btn--ghost">
          Search
        </button>
      </form>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">User directory</h2>
          <span className="admin-chip admin-chip--muted">{total} total</span>
        </div>
        <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-loading">Loading users…</div>
          ) : !users.length ? (
            <div className="admin-empty">No users found.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Joined</th>
                  <th>Plan</th>
                  <th>Portfolios</th>
                  <th>Newsletter</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>{u.display_name || '—'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--paper-muted)' }}>{u.email}</div>
                      {u.is_admin ? (
                        <span className="admin-chip admin-chip--admin" style={{ marginTop: '0.25rem' }}>
                          Admin
                        </span>
                      ) : null}
                    </td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>
                      {u.plan_name || 'Free'}
                      <div style={{ fontSize: '0.78rem', color: 'var(--paper-muted)' }}>
                        {u.plan_status || 'active'}
                      </div>
                    </td>
                    <td>
                      {u.paper_account_count}
                      {u.published_portfolio_count > 0 ? (
                        <span> · {u.published_portfolio_count} public</span>
                      ) : null}
                    </td>
                    <td>
                      {u.newsletter?.is_active ? (
                        <span className="admin-chip admin-chip--active">Subscribed</span>
                      ) : (
                        <span className="admin-chip admin-chip--muted">No</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/admin/users/${u.id}`} className="admin-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="admin-pagination">
          <button
            type="button"
            className="paper-btn paper-btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {page}
            {total ? ` · ${total} users` : ''}
          </span>
          <button
            type="button"
            className="paper-btn paper-btn--ghost"
            disabled={users.length < 25}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
