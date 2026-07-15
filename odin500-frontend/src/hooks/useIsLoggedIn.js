'use client';
import { useAuthStore } from '../store/authStore.js';

/** Reactive logged-in flag (updates on sign-in / sign-out via authStore). */
export function useIsLoggedIn() {
  return useAuthStore((s) => s.isLoggedIn);
}
