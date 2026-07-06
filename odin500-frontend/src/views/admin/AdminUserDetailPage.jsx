'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@/navigation/appRouterCompat.jsx';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal.jsx';
import { AdminGate } from '../../components/admin/AdminGate.jsx';
import { AdminShell } from '../../components/admin/AdminShell.jsx';
import { AdminUserDetailSkeleton } from '../../components/admin/AdminSkeletons.jsx';
import {
  ADMIN_PLAN_NAMES,
  ADMIN_PLAN_STATUSES,
  defaultRenewalFromJoinDate,
  renewalDateInputValue
} from '../../constants/adminPlanOptions.js';
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
  const navigate = useNavigate();
  const params = useParams();
  const userId = String(params?.userId || '');
  const [tab, setTab] = useState('profile');
  const [planName, setPlanName] = useState('Free');
  const [planStatus, setPlanStatus] = useState('active');
  const [planRenewal, setPlanRenewal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const {
    detail,
    loading,
    error,
    updatePlan,
    setAdmin,
    unsubscribeNewsletter,
    unpublishPortfolio,
    deletePortfolio,
    deleteWatchlist,
    deleteUser
  } = useAdminUserDetail(userId);

  const user = detail?.user;

  useEffect(() => {
    if (!user) return;
    setPlanName(user.plan_name || 'Free');
    setPlanStatus(user.plan_status || 'active');
    setPlanRenewal(
      renewalDateInputValue(user.plan_renewal_at) || defaultRenewalFromJoinDate(user.created_at)
    );
  }, [user]);

  function closeConfirm() {
    if (confirmBusy) return;
    setConfirm(null);
    setConfirmError('');
  }

  async function runAction(fn, { successMessage = 'Saved.' } = {}) {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(successMessage);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  function openConfirm({ title, message, confirmLabel = 'Confirm', onConfirm }) {
    setConfirmError('');
    setConfirm({
      title,
      message,
      confirmLabel,
      onConfirm: async () => {
        setConfirmBusy(true);
        setConfirmError('');
        try {
          await onConfirm();
          setConfirm(null);
        } catch (err) {
          setConfirmError(err instanceof Error ? err.message : 'Action failed');
        } finally {
          setConfirmBusy(false);
        }
      }
    });
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
        <AdminUserDetailSkeleton />
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
                    className="paper-btn paper-btn--danger"
                    disabled={busy || confirmBusy}
                    onClick={() => void runAction(() => setAdmin(false))}
                  >
                    Remove admin
                  </button>
                ) : (
                  <button
                    type="button"
                    className="paper-btn paper-btn--ghost"
                    disabled={busy || confirmBusy}
                    onClick={() => void runAction(() => setAdmin(true))}
                  >
                    Make admin
                  </button>
                )}
                <button
                  type="button"
                  className="paper-btn paper-btn--danger"
                  disabled={busy || confirmBusy}
                  onClick={() =>
                    openConfirm({
                      title: 'Delete user',
                      confirmLabel: 'Delete',
                      message: (
                        <>
                          Permanently delete <strong>{user.email || user.display_name}</strong>? This
                          removes their portfolios, watchlists, plan data, and account. This cannot be
                          undone.
                        </>
                      ),
                      onConfirm: async () => {
                        await deleteUser();
                        navigate('/admin/users');
                      }
                    })
                  }
                >
                  Delete user
                </button>
              </div>
            </section>
          ) : null}

          {tab === 'plan' ? (
            <section className="admin-card">
              <p className="admin-card__hint">
                New signups default to <strong>Free</strong> with status <strong>active</strong>. Renewal
                defaults to one month after join date.
              </p>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction(() =>
                    updatePlan({
                      plan_name: planName,
                      plan_status: planStatus,
                      plan_renewal_at: planRenewal || defaultRenewalFromJoinDate(user.created_at)
                    })
                  );
                }}
              >
                <div className="admin-field">
                  <label htmlFor="planName">Plan name</label>
                  <select
                    id="planName"
                    className="admin-input admin-select"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  >
                    {ADMIN_PLAN_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="planStatus">Plan status</label>
                  <select
                    id="planStatus"
                    className="admin-input admin-select"
                    value={planStatus}
                    onChange={(e) => setPlanStatus(e.target.value)}
                  >
                    {ADMIN_PLAN_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
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
                <button type="submit" className="paper-btn paper-btn--primary" disabled={busy || confirmBusy}>
                  Save plan
                </button>
              </form>
            </section>
          ) : null}

          {tab === 'portfolios' ? (
            <section className="admin-card">
              <div className="admin-table-wrap">
                {!detail.paper_accounts?.length ? (
                  <div className="admin-empty">No virtual portfolio accounts.</div>
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
                            <div className="admin-row-actions">
                              {a.is_published ? (
                                <button
                                  type="button"
                                  className="paper-btn paper-btn--ghost"
                                  disabled={busy || confirmBusy}
                                  onClick={() => void runAction(() => unpublishPortfolio(a.id))}
                                >
                                  Unpublish
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="paper-btn paper-btn--danger"
                                disabled={busy || confirmBusy}
                                onClick={() =>
                                  openConfirm({
                                    title: 'Delete portfolio',
                                    confirmLabel: 'Delete',
                                    message: (
                                      <>
                                        Permanently delete <strong>{a.name}</strong>? All positions,
                                        orders, fills, and history for this account will be removed.
                                      </>
                                    ),
                                    onConfirm: async () => {
                                      await deletePortfolio(a.id);
                                      setMsg('Portfolio deleted.');
                                    }
                                  })
                                }
                              >
                                Delete
                              </button>
                            </div>
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
                    className="paper-btn paper-btn--danger"
                    disabled={busy || confirmBusy}
                    onClick={() =>
                      openConfirm({
                        title: 'Unsubscribe from newsletter',
                        confirmLabel: 'Unsubscribe',
                        message: (
                          <>
                            Force <strong>{user.email}</strong> off the newsletter? They will stop
                            receiving email and in-app newsletter updates.
                          </>
                        ),
                        onConfirm: async () => {
                          await unsubscribeNewsletter();
                          setMsg('User unsubscribed.');
                        }
                      })
                    }
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
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.watchlists.map((w) => (
                        <tr key={w.id}>
                          <td>{w.name}</td>
                          <td>{w.item_count}</td>
                          <td>{fmtDate(w.created_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="paper-btn paper-btn--danger"
                              disabled={busy || confirmBusy}
                              onClick={() =>
                                openConfirm({
                                  title: 'Delete watchlist',
                                  confirmLabel: 'Delete',
                                  message: (
                                    <>
                                      Delete watchlist <strong>{w.name}</strong> and all of its tickers?
                                    </>
                                  ),
                                  onConfirm: async () => {
                                    await deleteWatchlist(w.id);
                                    setMsg('Watchlist deleted.');
                                  }
                                })
                              }
                            >
                              Delete
                            </button>
                          </td>
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

      <AdminConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        busy={confirmBusy}
        error={confirmError}
        onClose={closeConfirm}
        onConfirm={confirm?.onConfirm || (() => {})}
      />
    </AdminShell>
  );
}
