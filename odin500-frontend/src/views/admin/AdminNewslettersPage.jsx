'use client';

import { Link } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminTableSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import { useAdminNewsletters } from '../../hooks/useAdminUsers.js';
import '../../styles/admin.css';

export default function AdminNewslettersPage() {
  return (
    <AdminGate>
      <AdminNewslettersContent />
    </AdminGate>
  );
}

function AdminNewslettersContent() {
  const { issues, loading, error } = useAdminNewsletters();

  return (
    <AdminShell title="Newsletters" subtitle="Published weekly newsletter issues.">
      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {loading ? (
        <AdminTableSkeleton rows={5} />
      ) : (
        <section className="admin-card">
          <div className="admin-table-wrap">
            {!issues.length ? (
              <div className="admin-empty">No newsletter issues.</div>
            ) : (
              <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Week</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.slug}>
                    <td>{issue.title}</td>
                    <td>{issue.weekLabel || issue.slug}</td>
                    <td>{issue.publishedAt || '—'}</td>
                    <td>
                      <Link to={`/newsletter/${issue.slug}`} className="admin-link">
                        View
                      </Link>
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
