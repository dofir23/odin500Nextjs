export type SsrHydrateMode = 'off' | 'enhanced' | 'full';

const VALID: SsrHydrateMode[] = ['off', 'enhanced', 'full'];

/** SSR hydrate mode for `data-ssr-hydrate-mode` on <html> (CSS + debugging). */
export function getSsrHydrateMode(): SsrHydrateMode {
  const raw = String(process.env.NEXT_PUBLIC_SSR_HYDRATE_MODE || '').trim().toLowerCase();
  if (VALID.includes(raw as SsrHydrateMode)) return raw as SsrHydrateMode;
  return 'enhanced';
}
