import { getSsrHydrateMode } from '@/seo/ssrHydrateMode';

/** Sets `data-ssr-hydrate-mode` on <html> before React paints (for CSS + debugging). */
export function SsrHydrateBootstrap() {
  const mode = getSsrHydrateMode();
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.dataset.ssrHydrateMode='${mode}';`
      }}
    />
  );
}
