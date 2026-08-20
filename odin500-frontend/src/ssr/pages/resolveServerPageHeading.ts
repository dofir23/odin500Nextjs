import { resolveRequestMetadata, normalizePathname } from '@/seo/metadata';
import { resolveVisiblePageH1 } from '@/seo/resolveVisiblePageH1';

/** Company name off the ticker SSR payload, when the route ships one. */
function companyNameFromSeoData(data: unknown): string {
  const detail = (data as { tickerDetail?: Record<string, unknown> } | null)?.tickerDetail;
  if (!detail) return '';
  return String(detail.security || detail.Security || '').trim();
}

/**
 * @param pathname route being rendered
 * @param data the page's SSR payload, used only where the heading depends on fetched content
 *
 * On /ticker/<symbol> the heading becomes the company name. That does two things: it puts the
 * name a reader actually searches for into an H1 (the copy there led with the bare symbol), and
 * it matches the client view's own hero H1 — the client layer replaces the SSR layer after
 * hydration, so a different string in each meant the rendered H1 never matched the served one.
 */
export function resolveServerPageHeading(pathname: string, data?: unknown) {
  const meta = resolveRequestMetadata(pathname);
  const visibleH1 = resolveVisiblePageH1(pathname);

  const company = companyNameFromSeoData(data);
  if (company && /^\/ticker\/[A-Za-z0-9.]+$/i.test(normalizePathname(pathname))) {
    return { title: company, description: meta.description };
  }

  return {
    title: visibleH1 || meta.title,
    description: meta.description
  };
}
