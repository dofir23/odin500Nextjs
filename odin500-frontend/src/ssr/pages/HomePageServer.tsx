import { HomePageServerContent } from '@/components/home/HomePageServerContent';

/** Full marketing homepage HTML for crawlers, AI agents, and no-JS visitors. */
export function HomePageServer({ aiPortfolios = null }: { aiPortfolios?: unknown }) {
  return <HomePageServerContent aiPortfolios={aiPortfolios} />;
}
