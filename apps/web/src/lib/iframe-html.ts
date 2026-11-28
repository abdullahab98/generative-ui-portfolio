import type { PortfolioThemeSpec } from '@portfolio/shared';

/**
 * Prepare AI-generated HTML for fast, responsive iframe rendering:
 * - Preconnects to font & icon CDNs
 * - Ensures Google Fonts use `display=swap` so text renders immediately
 * - Adds `loading="lazy" decoding="async"` to images
 * - Injects theme-matched scrollbar and mobile navigation drawer CSS
 */
export function preparePortfolioIframeHtml(
  html: string | null | undefined,
  theme?: PortfolioThemeSpec,
): string | null | undefined {
  if (!html) return html;

  const surface = theme?.surface || '#07090e';
  const ink = theme?.ink || '#f1f5f9';
  const accent = theme?.accent || '#06b6d4';
  const accent2 = theme?.accent2 || accent;
  const accentInk = theme?.accentInk || '#020617';

  // Ensure Google Fonts stylesheets use display=swap so text paints immediately
  let optimized = html.replace(
    /(https:\/\/fonts\.googleapis\.com\/css2\?[^"'>\s]+)/gi,
    (url) => (/display=/i.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}display=swap`),
  );

  // Add lazy loading & async decoding to any <img> missing loading=
  optimized = optimized.replace(
    /<img\b(?![^>]*\bloading=)/gi,
    '<img loading="lazy" decoding="async"',
  );

  const preconnects = [
    '<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />',
    '<link rel="preconnect" href="https://cdn.simpleicons.org" crossorigin />',
    /fonts\.googleapis\.com/i.test(optimized) && !/rel=["']preconnect["'][^>]*fonts\.googleapis\.com/i.test(optimized)
      ? '<link rel="preconnect" href="https://fonts.googleapis.com" />'
      : '',
    /fonts\.googleapis\.com/i.test(optimized) && !/rel=["']preconnect["'][^>]*fonts\.gstatic\.com/i.test(optimized)
      ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />'
      : '',
  ]
    .filter(Boolean)
    .join('');

  const scrollbarCss = `<style id="portfolio-slim-scrollbar">
    html, body, * {
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, ${accent} 55%, transparent) ${surface};
    }
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: ${surface};
    }
    ::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, color-mix(in srgb, ${accent} 70%, transparent), color-mix(in srgb, ${accent2} 70%, transparent));
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, ${accent}, ${accent2});
    }
    html, body {
      max-width: 100%;
      overflow-x: hidden;
    }
    .portfolio-mobile-toggle {
      display: none;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 0.75rem;
      border: 1px solid color-mix(in srgb, ${accent} 40%, transparent);
      background: color-mix(in srgb, ${accent} 14%, ${surface});
      color: ${ink};
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 4px 14px color-mix(in srgb, ${accent} 22%, transparent);
      transition: all 0.2s ease;
      padding: 0;
    }
    .portfolio-mobile-toggle:hover {
      background: ${accent};
      color: ${accentInk};
    }
    @media (max-width: 768px) {
      .portfolio-mobile-toggle {
        display: inline-flex !important;
      }
      .portfolio-has-mobile-toggle {
        max-width: calc(100vw - 1rem) !important;
        flex-wrap: wrap !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 0.5rem !important;
      }
      .portfolio-has-mobile-toggle .portfolio-nav-links {
        display: none !important;
      }
      .portfolio-has-mobile-toggle[data-mobile-open="true"] .portfolio-nav-links {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        width: 100% !important;
        gap: 0.45rem !important;
        margin-top: 0.75rem !important;
        padding: 0.75rem !important;
        border: 1px solid color-mix(in srgb, ${accent} 28%, transparent) !important;
        background: color-mix(in srgb, ${surface} 94%, ${ink} 4%) !important;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 1rem !important;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.38) !important;
      }
      .portfolio-has-mobile-toggle[data-mobile-open="true"] .portfolio-nav-links a {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 0.72rem 0.95rem !important;
        border-radius: 0.7rem !important;
        font-size: 0.92rem !important;
        font-weight: 600 !important;
        text-decoration: none !important;
        color: ${ink} !important;
        background: color-mix(in srgb, ${ink} 4%, transparent) !important;
        border: 1px solid color-mix(in srgb, ${ink} 9%, transparent) !important;
        transition: all 0.18s ease !important;
      }
      .portfolio-has-mobile-toggle[data-mobile-open="true"] .portfolio-nav-links a::after {
        content: '→';
        color: ${accent};
        font-size: 0.9rem;
        opacity: 0.85;
      }
      .portfolio-has-mobile-toggle[data-mobile-open="true"] .portfolio-nav-links a:hover,
      .portfolio-has-mobile-toggle[data-mobile-open="true"] .portfolio-nav-links a:active {
        background: color-mix(in srgb, ${accent} 16%, transparent) !important;
        border-color: color-mix(in srgb, ${accent} 45%, transparent) !important;
        color: ${accent} !important;
      }
    }
    [data-portfolio-drawer-open="true"] {
      transform: translateX(0) translateY(0) !important;
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      z-index: 999 !important;
    }
  </style>`;

  const headInject = `${preconnects}${scrollbarCss}`;
  return /<\/head>/i.test(optimized)
    ? optimized.replace(/<\/head>/i, `${headInject}</head>`)
    : `${headInject}${optimized}`;
}
