import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_ORIGIN =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  'https://odin500-1-production.up.railway.app';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  },
  async rewrites() {
    return [
      {
        source: '/api/:path((?!auth|proxy).*)',
        destination: `${API_ORIGIN.replace(/\/$/, '')}/api/:path`
      }
    ];
  },
  async redirects() {
    return [
      { source: '/tickers', destination: '/odin-signals', permanent: true },
      { source: '/ticker', destination: '/ticker/AAPL', permanent: false },
      { source: '/indices', destination: '/indices/sp500', permanent: false },
      { source: '/sector-data', destination: '/sector-data/xlk', permanent: false },
      { source: '/ticker-annual', destination: '/statistic/ticker-annual/AAPL', permanent: false },
      {
        source: '/ticker-annual/:symbol',
        destination: '/statistic/ticker-annual/:symbol',
        permanent: true
      },
      {
        source: '/ticker-quarterly',
        destination: '/statistic/ticker-quarterly/AAPL',
        permanent: false
      },
      {
        source: '/ticker-quarterly/:symbol',
        destination: '/statistic/ticker-quarterly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-monthly',
        destination: '/statistic/ticker-monthly/AAPL',
        permanent: false
      },
      {
        source: '/ticker-monthly/:symbol',
        destination: '/statistic/ticker-monthly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-weekly',
        destination: '/statistic/ticker-weekly/AAPL',
        permanent: false
      },
      {
        source: '/ticker-weekly/:symbol',
        destination: '/statistic/ticker-weekly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-daily',
        destination: '/statistic/ticker-daily/AAPL',
        permanent: false
      },
      {
        source: '/ticker-daily/:symbol',
        destination: '/statistic/ticker-daily/:symbol',
        permanent: true
      },
      {
        source: '/statistic/ticker-annual',
        destination: '/statistic/ticker-annual/AAPL',
        permanent: false
      },
      {
        source: '/statistic/ticker-quarterly',
        destination: '/statistic/ticker-quarterly/AAPL',
        permanent: false
      },
      {
        source: '/statistic/ticker-monthly',
        destination: '/statistic/ticker-monthly/AAPL',
        permanent: false
      },
      {
        source: '/statistic/ticker-weekly',
        destination: '/statistic/ticker-weekly/AAPL',
        permanent: false
      },
      {
        source: '/statistic/ticker-daily',
        destination: '/statistic/ticker-daily/AAPL',
        permanent: false
      },
      {
        source: '/relative-strength/ticker',
        destination: '/relative-performance/ticker/AAPL',
        permanent: true
      },
      {
        source: '/relative-strength/ticker/:symbol',
        destination: '/relative-performance/ticker/:symbol',
        permanent: true
      },
      {
        source: '/historical-data',
        destination: '/historical-data/aapl',
        permanent: false
      },
      {
        source: '/ticker-report',
        destination: '/ticker-report/aapl',
        permanent: false
      },
      { source: '/pricing', destination: '/premium', permanent: true }
    ];
  }
};

export default nextConfig;
