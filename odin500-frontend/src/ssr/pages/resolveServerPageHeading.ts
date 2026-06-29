import { resolveRequestMetadata } from '@/seo/metadata';

export function resolveServerPageHeading(pathname: string) {
  const meta = resolveRequestMetadata(pathname);
  return {
    title: meta.title,
    description: meta.description
  };
}
