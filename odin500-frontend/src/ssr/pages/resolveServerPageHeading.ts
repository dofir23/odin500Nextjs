import { resolveRequestMetadata } from '@/seo/metadata';
import { resolveVisiblePageH1 } from '@/seo/resolveVisiblePageH1';

export function resolveServerPageHeading(pathname: string) {
  const meta = resolveRequestMetadata(pathname);
  const visibleH1 = resolveVisiblePageH1(pathname);
  return {
    title: visibleH1 || meta.title,
    description: meta.description
  };
}
