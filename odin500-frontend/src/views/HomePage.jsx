'use client';

import { HydrationMarker } from '@/components/HydrationMarker';
import { HomePageContent } from '@/components/home/HomePageContent';
import '@/styles/home-page.css';

/**
 * Client marketing homepage enhance layer (theme toggle + instant nav).
 * Only HydrationMarker is included from the provider stack so `/` stays
 * free of useSearchParams and keeps full static HTML for no-JS visitors.
 */
export default function HomePage() {
  return (
    <>
      <HydrationMarker />
      <HomePageContent />
    </>
  );
}
