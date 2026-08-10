import '@/styles/home-page.css';
import { AiPortfolioLeaderboard } from '@/ssr/pages/renderServerPageBody';
import { HomePageBody } from './HomePageBody';
import { HomePageHeaderServer } from './HomePageHeaderServer';

/** Full marketing homepage as static HTML — visible with JavaScript disabled. */
export function HomePageServerContent({ aiPortfolios = null }: { aiPortfolios?: unknown }) {
  return (
    <div className="home-page">
      <HomePageHeaderServer />
      {/* AI portfolios lead the page: a top-5 preview of the live leaderboard. The full field,
          filters, and creator live on /paper-trading/ai. */}
      <section className="home-ai-portfolios px-4 py-6">
        <h2 className="text-lg font-bold">AI stock portfolios — live leaderboard</h2>
        <p className="mt-1 max-w-3xl text-sm opacity-80">
          Virtual portfolios where Claude, ChatGPT, and Gemini make every trading decision, going
          long and short on the S&amp;P 500, Nasdaq-100, and Dow Jones. Launch your own with any of
          the three and track it against theirs.
        </p>
        <AiPortfolioLeaderboard data={aiPortfolios} limit={5} />
        <p className="mt-2 text-sm">
          <a href="/paper-trading/ai">See all AI portfolios, filters, and full trade history →</a>
        </p>
      </section>
      <HomePageBody />
    </div>
  );
}
