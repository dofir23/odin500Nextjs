import { MethodologyPageServer } from '@/ssr/pages/MethodologyPageServer';

/** Mirrors SSR content after hydration (methodology is static). */
export default function MethodologyPage() {
  return <MethodologyPageServer />;
}
