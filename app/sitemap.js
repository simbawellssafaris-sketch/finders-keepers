import fs from 'node:fs';
import path from 'node:path';
import { site } from '../lib/site.mjs';

export const dynamic = 'force-static';

const HOME = 'finders-safaris-homepage';

// Every page on the site, rebuilt on each build (so it can never go out of date).
export default function sitemap() {
  const dir = path.join(process.cwd(), 'content', 'pages');
  const origin = `https://${site.domain}`;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
  const entries = [{ url: `${origin}/`, lastModified: fs.statSync(path.join(dir, `${HOME}.html`)).mtime, changeFrequency: 'weekly', priority: 1 }];
  for (const f of files) {
    const name = f.slice(0, -5);
    if (name === HOME) continue;
    // a page whose canonical address is another page (a duplicate we keep reachable) stays out of the sitemap
    const canonical = (fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 6000).match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (canonical && !canonical.endsWith(`/${name}.html`)) continue;
    const priority = name.startsWith('finders-safaris-') || name.startsWith('destinations') ? 0.9
      : /-experience$/.test(name) ? 0.5 : 0.7;
    entries.push({ url: `${origin}/${name}.html`, lastModified: fs.statSync(path.join(dir, f)).mtime, changeFrequency: 'monthly', priority });
  }
  return entries;
}
