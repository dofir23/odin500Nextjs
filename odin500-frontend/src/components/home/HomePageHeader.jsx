'use client';

import { Odin500BrandLink } from '@/components/Odin500BrandLink.jsx';
import { HOME_NAV_PRODUCT } from '@/content/homePageContent';
import { HomeThemeToggle } from './HomeThemeToggle.jsx';

export function HomePageHeader() {
  return (
    <header className="home-header">
      <div className="home-header__inner">
        <Odin500BrandLink to="/" title="Odin500 home" className="home-header__brand" />
        <nav className="home-header__nav" aria-label="Product navigation">
          {HOME_NAV_PRODUCT.map((item) => (
            <a key={item.href} href={item.href} className="home-header__nav-link">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="home-header__actions">
          <HomeThemeToggle />
          <a href="/login" className="home-header__login">
            Log in
          </a>
          <a href="/signup" className="home-header__signup">
            <span className="home-header__signup-full">Sign up for free</span>
            <span className="home-header__signup-short">Sign up</span>
          </a>
        </div>
      </div>
    </header>
  );
}
