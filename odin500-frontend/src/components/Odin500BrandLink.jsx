'use client';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { useDocumentTheme } from '../hooks/useDocumentTheme.js';

const LOGO_DARK_SRC = '/odin500-logo.svg';
const LOGO_LIGHT_SRC = '/odin500-logo-light.svg';

/**
 * Clickable Odin500 wordmark → /market (logo + small “Beta” label).
 * @param {{ theme?: 'light' | 'dark', className?: string, imgClassName?: string, alt?: string, title?: string }} props
 */
export function Odin500BrandLink({
  theme: themeProp,
  to = '/market',
  className = '',
  imgClassName = '',
  alt = 'Odin500',
  title = 'Go to Market',
  ...linkProps
}) {
  const { theme: documentTheme } = useDocumentTheme();
  const theme = themeProp ?? documentTheme;
  const linkClassName = ['odin-brand-link', className].filter(Boolean).join(' ');
  const imgClass = ['odin-brand-link__logo', imgClassName].filter(Boolean).join(' ');
  const logoSrc = theme === 'light' ? LOGO_LIGHT_SRC : LOGO_DARK_SRC;

  return (
    <Link
      to={to}
      className={linkClassName}
      title={title}
      aria-label={`${alt} Beta`}
      {...linkProps}
    >
      <span className="odin-brand-link__stack">
        <img src={logoSrc} alt="" className={imgClass} aria-hidden />
        <span className="odin-brand-beta">Beta</span>
      </span>
    </Link>
  );
}
