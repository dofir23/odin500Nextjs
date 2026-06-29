import type { ReactNode } from 'react';

type FullSsrPageProps = {
  /** Server-rendered page — visible without JavaScript. */
  server: ReactNode;
  /** Interactive client view — shown after hydration. */
  client: ReactNode;
  className?: string;
};

/**
 * Full SSR page: server HTML in document flow; client layer shown after `data-app-hydrated`.
 */
export function FullSsrPage({ server, client, className }: FullSsrPageProps) {
  return (
    <div className={className ?? 'full-ssr-page'} data-full-ssr-page>
      <div className="full-ssr-page__server" data-ssr-primary>
        {server}
      </div>
      <div className="full-ssr-page__client client-page-enhance">{client}</div>
    </div>
  );
}
