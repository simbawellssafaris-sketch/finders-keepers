import fs from 'node:fs';
import path from 'node:path';
import parse from 'html-react-parser';
import { renderPage, fragment } from './expand.mjs';
import { enrichPage } from './seo.mjs';
import { whySectionHtml } from './why.mjs';

const DIR = path.join(process.cwd(), 'content', 'pages');
const HOME = 'finders-safaris-homepage';

// Every file in content/pages/ becomes a page, built to the same file name as before (e.g. finders-safaris-kenya.html).
export function listPages() {
  let files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();
  if (process.env.PAGE_LIMIT) files = files.slice(0, Number(process.env.PAGE_LIMIT));
  return files.map((f) => f.replace(/\.html$/, ''));
}

// URL segments -> page name. "/" is the home page; "/kenya" and (in dev) "/kenya.html" both resolve to kenya.
export function pageName(segments) {
  const first = segments && segments.length ? decodeURIComponent(segments[0]) : HOME;
  return first.replace(/\.html$/, '');
}

const cache = new Map();

// Splits a page file into its <head> tags (rendered into the real <head>) and its body markup (shared pieces expanded).
export function loadPage(name) {
  if (cache.has(name)) return cache.get(name);
  // page file -> shared pieces filled in -> missing SEO tags / alt text added -> site search added to every page
  let rendered = renderPage(fs.readFileSync(path.join(DIR, `${name}.html`), 'utf8'));
  // <!--@why-journey--> marks where a package page shows its "Why this journey" section (copy in content/why/*.json)
  rendered = rendered.replace('<!--@why-journey-->', () => whySectionHtml(name, rendered));
  let raw = enrichPage(name, rendered);
  raw = raw.replace(/<\/body>/i, () => `${fragment('site-search')}\n</body>`);

  const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headEnd = raw.search(/<\/head>/i);
  const bodyStart = raw.search(/<body[\s>]/i);
  // Browsers treat <style>/<link> written between </head> and <body> as part of the head, so keep those too.
  const afterHead = headEnd >= 0 && bodyStart > headEnd ? raw.slice(headEnd + 7, bodyStart).replace(/<\/head>/gi, '') : '';
  const head = ((headMatch ? headMatch[1] : '') + afterHead)
    .replace(/<meta\s+charset=[^>]*>/gi, '')
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '');

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const page = { headNodes: parse(head, { trim: true }), bodyHtml: bodyMatch ? bodyMatch[1] : '' };
  cache.set(name, page);
  return page;
}
