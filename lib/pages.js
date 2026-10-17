import fs from 'node:fs';
import path from 'node:path';
import parse from 'html-react-parser';
import { renderPage, fragment } from './expand.mjs';
import { enrichPage } from './seo.mjs';
import { whySectionHtml } from './why.mjs';

const DIR = path.join(process.cwd(), 'content', 'pages');

// Accessibility basics added to every page without changing how it looks:
//  - a visible ring around whatever has keyboard focus (nothing changes for mouse users)
//  - visitors who ask their device for reduced motion get no animations and no auto-playing video
//  - the same goes for visitors with Data Saver on, so they do not download the hero videos
const A11Y_STYLE = '<style id="fs-a11y">:focus-visible{outline:2px solid #fff!important;outline-offset:2px;box-shadow:0 0 0 4px #8B3A2A!important;}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}</style>';
const A11Y_SCRIPT = '<script>(function(){var r=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,s=navigator.connection&&navigator.connection.saveData;if(!r&&!s)return;function calm(v){v.removeAttribute("autoplay");v.preload="none";try{v.pause()}catch(e){}}var o=new MutationObserver(function(m){m.forEach(function(x){x.addedNodes.forEach(function(n){if(n.nodeName==="VIDEO")calm(n);else if(n.querySelectorAll)n.querySelectorAll("video").forEach(calm)})})});o.observe(document,{childList:true,subtree:true});document.addEventListener("DOMContentLoaded",function(){o.disconnect();document.querySelectorAll("video").forEach(calm)})})();</script>';
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
  const head = ((headMatch ? headMatch[1] : '') + afterHead + A11Y_STYLE)
    .replace(/<meta\s+charset=[^>]*>/gi, '')
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '');

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const page = { headNodes: parse(head, { trim: true }), bodyHtml: A11Y_SCRIPT + (bodyMatch ? bodyMatch[1] : '') };
  cache.set(name, page);
  return page;
}
