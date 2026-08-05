'use client';
import { useToastStore } from '../store/toastStore.js';

function resolveMessage(input, fallback) {
  if (input instanceof Error) return input.message || fallback;
  const str = String(input ?? '').trim();
  return str || fallback;
}

function push(type, input, opts, fallback) {
  const message = resolveMessage(input, fallback);
  if (!message) return null;
  return useToastStore.getState().push({ type, message, duration: opts?.duration });
}

/**
 * Global toast helper — safe to call from components, hooks, or plain modules.
 * `<ToastStack />` (mounted once in app/providers.tsx) renders whatever is queued.
 *
 * @example toast.success('Portfolio created');
 * @example toast.error(err); // accepts an Error, uses err.message
 */
export const toast = {
  success: (input, opts) => push('success', input, opts, 'Success'),
  error: (input, opts) => push('error', input, opts, 'Something went wrong'),
  info: (input, opts) => push('info', input, opts, ''),
  dismiss: (id) => useToastStore.getState().dismiss(id)
};
