import type { ReactNode } from 'react';
import { ServerPageBody } from '@/ssr/pages/ServerPageBody';

type SeoServerSupplementProps = {
  pathname: string;
  data?: unknown;
  serverContent?: ReactNode;
};

/**
 * Crawlable server tables/charts kept in the document without a visible duplicate UI.
 * Rendered sr-only in unified hydration mode so Google never sees display:none on main content.
 */
export function SeoServerSupplement({ pathname, data = null, serverContent }: SeoServerSupplementProps) {
  const body = serverContent ?? <ServerPageBody pathname={pathname} data={data} />;

  return (
    <aside className="seo-server-supplement sr-only" aria-hidden="true" data-seo-server-supplement>
      {body}
    </aside>
  );
}
