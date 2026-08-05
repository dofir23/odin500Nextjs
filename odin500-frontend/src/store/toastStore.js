'use client';
import { create } from 'zustand';

let idCounter = 0;

/**
 * Global toast notifications. Push from anywhere (components, hooks, plain
 * modules) via the `toast` helper in utils/toast.js — this store just holds
 * the queue that <ToastStack /> renders.
 */
export const useToastStore = create((set, get) => ({
  /** @type {Array<{ id: number, type: 'success'|'error'|'info', message: string, duration: number }>} */
  toasts: [],

  push: ({ type = 'info', message, duration = 4000 }) => {
    const id = ++idCounter;
    set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }));
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] })
}));
