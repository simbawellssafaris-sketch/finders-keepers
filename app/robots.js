import { site } from '../lib/site.mjs';

export const dynamic = 'force-static';

export default function robots() {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/unsubscribe'] }, sitemap: `https://${site.domain}/sitemap.xml` };
}
