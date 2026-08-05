'use client';

import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore.js';
import '../styles/toast.css';

const ICONS = { success: '✓', error: '!', info: 'i' };

function ToastItem({ toastEntry, onDismiss }) {
  const { id, type, message, duration } = toastEntry;

  useEffect(() => {
    if (!duration) return undefined;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      className={`odin-toast odin-toast--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <span className="odin-toast__icon" aria-hidden>
        {ICONS[type] || ICONS.info}
      </span>
      <p className="odin-toast__message">{message}</p>
      <button
        type="button"
        className="odin-toast__close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        &times;
      </button>
    </div>
  );
}

/** Mounted once (app/providers.tsx) — renders whatever `toast.*()` pushes. */
export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="odin-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} toastEntry={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
