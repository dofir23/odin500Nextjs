import { Suspense, type ReactNode } from 'react';
import { ClientReadyMarker } from './ClientReadyMarker';

type FullSsrPageProps = {
  /** Server-rendered page — visible without JavaScript. */
  server: ReactNode;
  /** Interactive client view — shown after hydration. */
  client: ReactNode;
  className?: string;
};

/**
 * Full SSR page: server HTML in document flow; client layer swaps in once this page's own client
 * subtree mounts (see ClientReadyMarker) rather than on a global hydration flag.
 * Client is wrapped in Suspense so useSearchParams does not bail the whole route to CSR.
 */
export function FullSsrPage({ server, client, className }: FullSsrPageProps) {
  return (
    <div className={className ?? 'full-ssr-page'} data-full-ssr-page>
      <div className="full-ssr-page__server" data-ssr-primary>
        {server}
      </div>
      <div className="full-ssr-page__client client-page-enhance">
        <Suspense fallback={null}>
          {client}
          <ClientReadyMarker />
        </Suspense>
      </div>
    </div>
  );
}
