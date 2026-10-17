// Two ways to build this site:
//   npm run build         -> server version (needed once you add APIs, a database, payments, an admin page)
//   npm run build:static  -> plain files in /out that work on ANY hosting (no Node needed)
const STATIC = process.env.STATIC_EXPORT === '1';

const nextConfig = {
  ...(STATIC ? { output: 'export' } : {}),
  agentRules: false,
  trailingSlash: false,
  images: { unoptimized: true }, // the pages use plain <img> tags with already-compressed files
  poweredByHeader: false,
  reactStrictMode: false,
  experimental: { globalNotFound: true }, // lets app/global-not-found.jsx be the branded "page not found" screen
};

if (!STATIC) {
  // The existing pages link to each other as "kenya.html"; this keeps every old address working.
  nextConfig.rewrites = async () => ({
    beforeFiles: [{ source: '/:page([a-zA-Z0-9_-]+).html', destination: '/:page' }],
  });
  // Browsers may keep images, video and PDFs for a month.
  nextConfig.headers = async () => [
    { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
    { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
  ];
}

export default nextConfig;
