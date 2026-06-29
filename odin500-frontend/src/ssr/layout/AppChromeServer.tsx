import Link from 'next/link';
import { SERVER_NAV_LINKS } from './navLinks';

/**
 * Server-rendered app navigation — visible in HTML before client shell hydrates.
 */
export function AppChromeServer() {
  return (
    <nav className="ssr-app-chrome" aria-label="Site navigation" data-ssr-nav>
      <div className="ssr-app-chrome__brand">
        <Link href="/" className="ssr-app-chrome__brand-link">
          Odin500
        </Link>
      </div>
      <ul className="ssr-app-chrome__links">
        {SERVER_NAV_LINKS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="ssr-app-chrome__link">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
