// Two ways to build this site:
//   npm run build         -> server version (needed once you add APIs, a database, payments, an admin page)
//   npm run build:static  -> plain files in /out that work on ANY hosting (no Node needed)
const STATIC = process.env.STATIC_EXPORT === '1';

// What the site loads from other places: Google Fonts (typefaces), Supabase (saving forms) and Cloudflare Turnstile (spam check).
// Everything else is the site's own files. 'unsafe-inline' is needed because the pages carry their own inline scripts and styles.
// Keep docs/htaccess-for-static-hosting.txt in step with this list.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig = {
  ...(STATIC ? { output: 'export' } : {}),
  agentRules: false,
  trailingSlash: false,
  images: { unoptimized: true }, // the pages use plain <img> tags with already-compressed files
  poweredByHeader: false,
  reactStrictMode: false,
  // globalNotFound lets app/global-not-found.jsx be the branded "page not found" screen.
  // bodySizeLimit lets admins upload client documents of up to 10 MB (the default for form posts is 1 MB).
  experimental: { globalNotFound: true, serverActions: { bodySizeLimit: '12mb' } },
};

if (!STATIC) {
  // The existing pages link to each other as "kenya.html"; this keeps every old address working.
  nextConfig.rewrites = async () => ({
    beforeFiles: [{ source: '/:page([a-zA-Z0-9_-]+).html', destination: '/:page' }],
  });
  // Browsers may keep images, video and PDFs for a month.
  nextConfig.headers = async () => [
    // security headers on every page (production only: the development server needs looser rules)
    ...(process.env.NODE_ENV === 'production' ? [{ source: '/:path*', headers: SECURITY_HEADERS }] : []),
    { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
    { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
  ];
}

export default nextConfig;
