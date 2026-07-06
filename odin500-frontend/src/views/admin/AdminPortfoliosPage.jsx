'use client';

import { useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminTableSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { useAdminPortfolios } from '../../hooks/useAdminUsers.js';
import '../../styles/admin.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

export default function AdminPortfoliosPage() {
  return (
    <AdminGate>
      <AdminPortfoliosContent />
    </AdminGate>
  );
}

function AdminPortfoliosContent() {
  const { portfolios, loading, error, unpublish } = useAdminPortfolios();
  const [busyId, setBusyId] = useState('');

  async function handleUnpublish(id) {
    setBusyId(id);
    try {
      await unpublish(id);
    } finally {
      setBusyId('');
    }
  }

  return (
    <AdminShell title="Published portfolios" subtitle="All public virtual portfolios across users.">
      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {loading ? (
        <AdminTableSkeleton rows={5} />
      ) : (
        <section className="admin-card">
          <div className="admin-table-wrap">
            {!portfolios.length ? (
              <div className="admin-empty">No published portfolios.</div>
            ) : (
              <table className="admin-table">
              <thead>
                <tr>
                  <th>Portfolio</th>
                  <th>Owner</th>
                  <th>Equity</th>
                  <th>Return</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {portfolios.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/paper-trading/public/${p.id}`} className="admin-link">
                        {p.name}
                      </Link>
                    </td>
                    <td>
                      <div>{p.owner_label}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--paper-muted)' }}>{p.owner_email}</div>
                    </td>
                    <td>{money(p.equity)}</td>
                    <td>{money(p.total_return)}</td>
                    <td>{fmtDate(p.published_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="paper-btn paper-btn--danger"
                        disabled={busyId === p.id}
                        onClick={() => void handleUnpublish(p.id)}
                      >
                        Unpublish
                      </button>
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
