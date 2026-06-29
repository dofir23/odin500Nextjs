/** @deprecated Legacy SEO fallback shell — use ServerPageBody via PageServerShell (ssr-primary). */

import { renderServerPageBody } from '@/ssr/pages/renderServerPageBody';

type ServerPageContentProps = {
  pathname: string;
  data: unknown;
};

/**
 * Hidden duplicate SEO shell for legacy hybrid routes.
 */
export function ServerPageContent({ pathname, data }: ServerPageContentProps) {
  const body = renderServerPageBody(pathname, data);
  if (!body) return null;

  return (
    <section className="ssr-page-shell" aria-label="Market data summary" data-ssr-shell>
      <div className="ssr-page-shell__inner space-y-6 overflow-x-auto px-4 py-6">{body}</div>
    </section>
  );
}

/** @deprecated Use ServerPageContent */
export const SeoServerContent = ServerPageContent;
