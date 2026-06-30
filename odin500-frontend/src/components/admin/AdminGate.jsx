'use client';

import { useEffect } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { useAdmin } from '../../hooks/useAdmin.js';

export function AdminGate({ children }) {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/market', { replace: true });
    }
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="admin-page odin-content-page" aria-busy="true">
        <div className="admin-loading">Checking admin access…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page odin-content-page">
        <div className="admin-loading">Access denied. Redirecting…</div>
      </div>
    );
  }

  return children;
}
