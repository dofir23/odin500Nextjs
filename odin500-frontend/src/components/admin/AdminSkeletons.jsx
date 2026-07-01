'use client';

import '../../styles/admin.css';

function Shimmer({ className = '', style }) {
  return <span className={`admin-skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function AdminGateSkeleton() {
  return (
    <div className="admin-page odin-content-page admin-skeleton-page" aria-busy="true" aria-label="Loading admin">
      <AdminShellSkeletonBody variant="dashboard" />
    </div>
  );
}

function AdminShellSkeletonBody({ variant = 'table' }) {
  return (
    <>
      <header className="admin-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Shimmer className="admin-skeleton--eyebrow" />
          <Shimmer className="admin-skeleton--title" />
          <Shimmer className="admin-skeleton--subtitle" />
        </div>
        <Shimmer className="admin-skeleton--btn" />
      </header>

      <nav className="admin-nav" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="admin-skeleton--nav-pill" />
        ))}
      </nav>

      {variant === 'dashboard' ? <AdminDashboardSkeletonBody /> : null}
      {variant === 'table' ? <AdminTableSkeletonBody rows={6} /> : null}
      {variant === 'table-toolbar' ? (
        <>
          <div className="admin-toolbar">
            <Shimmer className="admin-skeleton--search" />
            <Shimmer className="admin-skeleton--btn" />
          </div>
          <AdminTableSkeletonBody rows={8} />
        </>
      ) : null}
      {variant === 'detail' ? <AdminUserDetailSkeletonBody /> : null}
    </>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="admin-skeleton-wrap" aria-busy="true" aria-label="Loading dashboard">
      <AdminDashboardSkeletonBody />
      <section className="admin-card">
        <div className="admin-card__head">
          <Shimmer className="admin-skeleton--card-title" />
        </div>
        <div style={{ padding: '1rem' }}>
          <Shimmer className="admin-skeleton--line" style={{ width: '70%' }} />
        </div>
      </section>
    </div>
  );
}

function AdminDashboardSkeletonBody() {
  return (
    <section className="admin-stats" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <article key={i} className="admin-stat admin-stat--skeleton">
          <Shimmer className="admin-skeleton--stat-label" />
          <Shimmer className="admin-skeleton--stat-value" />
        </article>
      ))}
    </section>
  );
}

export function AdminTableSkeleton({ rows = 6, withToolbar = false }) {
  return (
    <div className="admin-skeleton-wrap" aria-busy="true" aria-label="Loading table">
      {withToolbar ? (
        <div className="admin-toolbar">
          <Shimmer className="admin-skeleton--search" />
          <Shimmer className="admin-skeleton--btn" />
        </div>
      ) : null}
      <AdminTableSkeletonBody rows={rows} />
    </div>
  );
}

function AdminTableSkeletonBody({ rows = 6 }) {
  return (
    <section className="admin-card">
      <div className="admin-card__head">
        <Shimmer className="admin-skeleton--card-title" />
        <Shimmer className="admin-skeleton--chip" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table--skeleton">
          <thead>
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i}>
                  <Shimmer className="admin-skeleton--th" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row}>
                {Array.from({ length: 5 }).map((_, col) => (
                  <td key={col}>
                    <Shimmer
                      className="admin-skeleton--td"
                      style={{ width: col === 0 ? '85%' : col === 4 ? '4.5rem' : '60%' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <Shimmer className="admin-skeleton--btn" />
        <Shimmer className="admin-skeleton--line" style={{ width: '6rem' }} />
        <Shimmer className="admin-skeleton--btn" />
      </div>
    </section>
  );
}

export function AdminUserDetailSkeleton() {
  return (
    <div className="admin-skeleton-wrap" aria-busy="true" aria-label="Loading user">
      <Shimmer className="admin-skeleton--line" style={{ width: '6rem', marginBottom: '1rem' }} />
      <AdminUserDetailSkeletonBody />
    </div>
  );
}

function AdminUserDetailSkeletonBody() {
  return (
    <>
      <div className="admin-tabs" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="admin-skeleton--tab" />
        ))}
      </div>
      <section className="admin-card">
        <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-skeleton-meta-row">
              <Shimmer className="admin-skeleton--meta-label" />
              <Shimmer className="admin-skeleton--meta-value" style={{ width: `${40 + (i % 3) * 15}%` }} />
            </div>
          ))}
        </div>
        <div className="admin-actions">
          <Shimmer className="admin-skeleton--btn" />
          <Shimmer className="admin-skeleton--btn admin-skeleton--btn-danger" />
        </div>
      </section>
    </>
  );
}

export function AdminRouteSkeleton({ variant = 'table' }) {
  return (
    <div className="admin-page odin-content-page admin-skeleton-page" aria-busy="true" aria-label="Loading admin">
      <AdminShellSkeletonBody variant={variant} />
    </div>
  );
}
