'use client';

import { useEffect, useState } from 'react';
import { Link, useParams } from '@/navigation/appRouterCompat.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { useAdminUserDetail } from '../../hooks/useAdminUsers.js';
import '../../styles/admin.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

const TABS = ['profile', 'plan', 'portfolios', 'newsletter', 'watchlists'];

export default function AdminUserDetailPage() {
  return (
    <AdminGate>
      <AdminUserDetailContent />
    </AdminGate>
  );
}

function AdminUserDetailContent() {
  const params = useParams();
  const userId = String(params?.userId || '');
  const [tab, setTab] = useState('profile');
  const [planName, setPlanName] = useState('');
  const [planStatus, setPlanStatus] = useState('');
  const [planRenewal, setPlanRenewal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const {
    detail,
    loading,
    error,
    updatePlan,
    setAdmin,
    unsubscribeNewsletter,
    unpublishPortfolio
  } = useAdminUserDetail(userId);

  const user = detail?.user;

  useEffect(() => {
    if (!user) return;
    setPlanName(user.plan_name || 'Free');
    setPlanStatus(user.plan_status || 'active');
    setPlanRenewal(user.plan_renewal_at ? String(user.plan_renewal_at).slice(0, 10) : '');
  }, [user]);

  async function runAction(fn) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title={user?.display_name || user?.email || 'User'}
      subtitle={user?.email || 'Loading user…'}
    >
      <p style={{ margin: '0 0 1rem' }}>
        <Link to="/admin/users" className="admin-link">
          ← All users
        </Link>
      </p>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}
      {msg ? <div className="paper-alert">{msg}</div> : null}

      {loading ? (
        <div className="admin-loading">Loading user…</div>
      ) : !user ? (
        <div className="admin-empty">User not found.</div>
      ) : (
        <>
          <div className="admin-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                className={'admin-tab' + (tab === t ? ' admin-tab--active' : '')}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'profile' ? (
            <section className="admin-card">
              <dl className="admin-meta-list">
                <li>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </li>
                <li>
                  <dt>Username</dt>
                  <dd>{user.display_name || '—'}</dd>
                </li>
                <li>
                  <dt>User ID</dt>
                  <dd>{user.id}</dd>
                </li>
                <li>
                  <dt>Joined</dt>
                  <dd>{fmtDate(user.created_at)}</dd>
                </li>
                <li>
                  <dt>Last sign-in</dt>
                  <dd>{fmtDate(user.last_sign_in_at)}</dd>
                </li>
                <li>
                  <dt>Admin</dt>
                  <dd>{user.is_admin ? 'Yes' : 'No'}</dd>
                </li>
                <li>
                  <dt>Watchlists</dt>
                  <dd>{user.watchlist_count}</dd>
                </li>
              </dl>
              <div className="admin-actions">
                {user.is_admin ? (
                  <button
                    type="button"
                    className="paper-btn paper-btn--ghost admin-btn-danger"
                    disabled={busy}
                    onClick={() => void runAction(() => setAdmin(false))}
                  >
                    Remove admin
                  </button>
                ) : (
                  <button
                    type="button"
                    className="paper-btn paper-btn--ghost"
                    disabled={busy}
                    onClick={() => void runAction(() => setAdmin(true))}
                  >
                    Make admin
                  </button>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'plan' ? (
            <section className="admin-card">
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction(() =>
                    updatePlan({
                      plan_name: planName,
                      plan_status: planStatus,
                      plan_renewal_at: planRenewal || null
                    })
                  );
                }}
              >
                <div className="admin-field">
                  <label htmlFor="planName">Plan name</label>
                  <input
                    id="planName"
                    className="admin-input"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="planStatus">Plan status</label>
                  <input
                    id="planStatus"
                    className="admin-input"
                    value={planStatus}
                    onChange={(e) => setPlanStatus(e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="planRenewal">Renewal date</label>
                  <input
                    id="planRenewal"
                    type="date"
                    className="admin-input"
                    value={planRenewal}
                    onChange={(e) => setPlanRenewal(e.target.value)}
                  />
                </div>
                <button type="submit" className="paper-btn paper-btn--primary" disabled={busy}>
                  Save plan
                </button>
              </form>
            </section>
          ) : null}

          {tab === 'portfolios' ? (
            <section className="admin-card">
              <div className="admin-table-wrap">
                {!detail.paper_accounts?.length ? (
                  <div className="admin-empty">No paper accounts.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Equity</th>
                        <th>Positions</th>
                        <th>Published</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.paper_accounts.map((a) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>{money(a.equity)}</td>
                          <td>{a.positions_count}</td>
                          <td>
                            {a.is_published ? (
                              <span className="admin-chip admin-chip--active">Public</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {a.is_published ? (
                              <button
                                type="button"
                                className="paper-btn paper-btn--ghost admin-btn-danger"
                                disabled={busy}
                                onClick={() => void runAction(() => unpublishPortfolio(a.id))}
                              >
                                Unpublish
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'newsletter' ? (
            <section className="admin-card">
              <dl className="admin-meta-list">
                <li>
                  <dt>Subscribed</dt>
                  <dd>{detail.newsletter?.isActive ? 'Yes' : 'No'}</dd>
                </li>
                <li>
                  <dt>Email opt-in</dt>
                  <dd>{detail.newsletter?.emailOptIn ? 'Yes' : 'No'}</dd>
                </li>
                <li>
                  <dt>In-app opt-in</dt>
                  <dd>{detail.newsletter?.inAppOptIn ? 'Yes' : 'No'}</dd>
                </li>
                <li>
                  <dt>Subscribed at</dt>
                  <dd>{fmtDate(detail.newsletter?.subscribedAt)}</dd>
                </li>
              </dl>
              {detail.newsletter?.isActive ? (
                <div className="admin-actions">
                  <button
                    type="button"
                    className="paper-btn paper-btn--ghost admin-btn-danger"
                    disabled={busy}
                    onClick={() => void runAction(unsubscribeNewsletter)}
                  >
                    Force unsubscribe
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === 'watchlists' ? (
            <section className="admin-card">
              <div className="admin-table-wrap">
                {!detail.watchlists?.length ? (
                  <div className="admin-empty">No watchlists.</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Items</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.watchlists.map((w) => (
                        <tr key={w.id}>
                          <td>{w.name}</td>
                          <td>{w.item_count}</td>
                          <td>{fmtDate(w.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
