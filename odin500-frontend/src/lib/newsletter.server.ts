import 'server-only';
import { cache } from 'react';
import {
  fetchNewsletterSummariesFromApi,
  fetchNewsletterBySlugFromApi,
  fetchNewsletterSlugsFromApi
} from './newsletter.api.server';
import type { NewsletterIssue } from './newsletter.shared';

/** All published issues (summaries), newest first — fast list for index/sitemap. */
export const getAllNewsletters = cache(async (): Promise<NewsletterIssue[]> => {
  return fetchNewsletterSummariesFromApi();
});

export const getNewsletterSlugs = cache(async (): Promise<string[]> => {
  return fetchNewsletterSlugsFromApi();
});

export const getNewsletterBySlug = cache(async (slug: string): Promise<NewsletterIssue | null> => {
  return fetchNewsletterBySlugFromApi(slug);
});
