import Link from 'next/link';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '@/utils/tickerUrlSync.js';

const DESTINATIONS = [
  {
    href: '/market',
    title: 'Market',
    description: 'Dashboard, sectors, movers, and heatmaps',
  },
  {
    href: '/indices/sp500',
    title: 'Indices',
    description: 'S&P 500, Dow Jones, and Nasdaq-100 hubs',
  },
  {
    href: `/ticker/${DEFAULT_TICKER_ROUTE_SYMBOL.toLowerCase()}`,
    title: 'Ticker',
    description: 'Charts, returns, signals, and downloads',
  },
  {
    href: '/statistic-data',
    title: 'Statistic',
    description: 'Statistic data exports and research tables',
  },
] as const;

const SECONDARY = [
  { href: '/indices/dow-jones', label: 'Dow Jones' },
  { href: '/indices/nasdaq-100', label: 'Nasdaq-100' },
  { href: '/return-table', label: 'Return table' },
  { href: '/odin-signals', label: 'Odin signals' },
] as const;

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b1220] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(89, 169, 255, 0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(37, 99, 235, 0.12), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 80%, rgba(14, 165, 233, 0.08), transparent 45%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
          title="Odin500 home"
          aria-label="Odin500 Beta home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/odin500-logo.svg"
            alt=""
            className="h-7 w-auto sm:h-8"
            aria-hidden
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
            Beta
          </span>
        </Link>
        <Link
          href="/market"
          className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          Go to Market
        </Link>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 text-center sm:px-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">
          Error 404
        </p>
        <h1 className="mt-3 text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-none tracking-tight text-white">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400 sm:text-[1.05rem]">
          That URL isn&apos;t on Odin500. Head back home or jump to one of these core research
          pages.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#59a9ff] px-5 text-sm font-semibold text-[#0b1220] transition hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Back to home
          </Link>
          <Link
            href="/market"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-900/50 px-5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Open market
          </Link>
        </div>

        <nav
          className="mt-14 w-full"
          aria-label="Important pages"
        >
          <p className="mb-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Popular destinations
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {DESTINATIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-xl border border-slate-700/70 bg-slate-900/40 px-4 py-4 text-left transition hover:border-sky-500/40 hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  <span className="text-sm font-semibold text-white group-hover:text-sky-300">
                    {item.title}
                  </span>
                  <span className="mt-1 text-xs leading-snug text-slate-400">
                    {item.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-400">
            {SECONDARY.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="underline-offset-4 transition hover:text-sky-300 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
