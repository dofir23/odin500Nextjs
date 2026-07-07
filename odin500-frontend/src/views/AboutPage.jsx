import { AboutPageServer } from '@/ssr/pages/AboutPageServer';

/** Mirrors SSR content after hydration (about page is static). */
export default function AboutPage() {
  return <AboutPageServer />;
}
