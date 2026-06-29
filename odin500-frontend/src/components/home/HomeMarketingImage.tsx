import Image from 'next/image';

const FALLBACK_SRC = '/og-default.png';

type HomeMarketingImageProps = {
  darkSrc: string;
  lightSrc: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

/**
 * Theme-aware marketing screenshot — both variants in HTML for SSR;
 * CSS toggles visibility via html[data-theme].
 */
export function HomeMarketingImage({
  darkSrc,
  lightSrc,
  alt,
  className = '',
  priority = false,
  sizes = '(max-width: 900px) 100vw, 560px'
}: HomeMarketingImageProps) {
  const dark = darkSrc || FALLBACK_SRC;
  const light = lightSrc || dark;

  return (
    <div className={'home-media-frame' + (className ? ` ${className}` : '')}>
      <Image
        src={dark}
        alt={alt}
        width={1200}
        height={630}
        priority={priority}
        sizes={sizes}
        className="home-media-frame__img home-media-frame__img--theme-dark"
      />
      <Image
        src={light}
        alt=""
        width={1200}
        height={630}
        priority={priority}
        sizes={sizes}
        className="home-media-frame__img home-media-frame__img--theme-light"
        aria-hidden
      />
    </div>
  );
}
