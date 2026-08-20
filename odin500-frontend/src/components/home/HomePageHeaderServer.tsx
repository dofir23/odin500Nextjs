import { HOME_NAV_PRODUCT } from '@/content/homePageContent';

/**
 * Pure server header for the marketing homepage (plain anchors + static logo).
 * No client hooks — safe for no-JS HTML.
 */
export function HomePageHeaderServer() {
  return (
    <header className="home-header">
      <div className="home-header__inner">
        <a href="/market" title="Odin500 market dashboard" className="odin-brand-link home-header__brand" aria-label="Odin500 Beta">
          <span className="odin-brand-link__stack">
            <img
              src="/odin500-logo.svg"
              alt=""
              className="odin-brand-link__logo home-header__logo--dark"
              aria-hidden
            />
            <img
              src="/odin500-logo-light.svg"
              alt=""
              className="odin-brand-link__logo home-header__logo--light"
              aria-hidden
            />
            <span className="odin-brand-beta">Beta</span>
          </span>
        </a>
        <nav className="home-header__nav" aria-label="Product navigation">
          {/* A <ul> so assistive tech announces "list, N items" and offers skip-the-group.
              Bare sibling anchors are read as N unrelated links (WCAG 1.3.1). */}
          <ul className="home-header__nav-list">
            {HOME_NAV_PRODUCT.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="home-header__nav-link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="home-header__actions">
          <span className="app-main-topbar__theme home-header__theme" aria-hidden>
            <span className="app-main-topbar__theme-track">
              <span className="app-main-topbar__theme-knob" />
            </span>
          </span>
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
