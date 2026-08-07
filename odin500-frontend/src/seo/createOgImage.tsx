import { ImageResponse } from 'next/og';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = 'image/png';

export function createBrandOgImage(title: string, subtitle: string) {
  const headline = String(title || 'Odin500').slice(0, 48);
  const sub = String(subtitle || 'U.S. stock market data & charts').slice(0, 72);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: 48
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          {/* SVG, not the CSS border-triangle trick — Satori ignores transparent borders and
              would render the mark as a solid square. */}
          <svg width="56" height="48" viewBox="0 0 56 48" fill="none">
            <polygon points="28,0 56,48 0,48" fill="#59A9FF" />
          </svg>
          {/* display:flex is required by Satori on any element with more than one child —
              without it ImageResponse throws and the route returns no body at all. */}
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: '#59A9FF' }}>odin</span>
            <span style={{ color: '#ffffff' }}>500</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#59A9FF',
            textAlign: 'center',
            lineHeight: 1.15,
            maxWidth: '92%'
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 26,
            marginTop: 20,
            color: '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.35,
            maxWidth: '88%'
          }}
        >
          {sub}
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE }
  );
}
