import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Providers } from './providers';
import './globals.css';
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE } from '@/seo/siteConfig.js';
import { defaultOgImages } from '@/seo/ogImages';
import { GoogleAnalytics } from '@/seo/GoogleAnalytics';
import { JsonLdSitewide } from '@/seo/JsonLd';

export const revalidate = 300;

export const metadata: Metadata = {
  title: DEFAULT_SITE_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  metadataBase: new URL('https://www.odin500.com'),
  openGraph: {
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    url: 'https://www.odin500.com/',
    siteName: 'Odin500',
    type: 'website',
    images: defaultOgImages()
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: defaultOgImages().map((img) => img.url)
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>
      <body suppressHydrationWarning>
        <GoogleAnalytics />
        <JsonLdSitewide />
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
