import fs from 'node:fs';
import path from 'node:path';
import parse from 'html-react-parser';
import { renderPage, fragment } from './expand.mjs';
import { site } from './site.mjs';
import { enrichPage } from './seo.mjs';
import { whySectionHtml } from './why.mjs';

const DIR = path.join(process.cwd(), 'content', 'pages');

// Accessibility basics added to every page without changing how it looks:
//  - a visible ring around whatever has keyboard focus (nothing changes for mouse users)
//  - visitors who ask their device for reduced motion get no animations and no auto-playing video
//  - the same goes for visitors with Data Saver on, so they do not download the hero videos
const A11Y_STYLE = '<style id="fs-a11y">:focus-visible{outline:2px solid #fff!important;outline-offset:2px;box-shadow:0 0 0 4px #8B3A2A!important;}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}</style>';
// Package-page header name: the same plain wording and typeface as the homepage, not the old heavy, widely spaced one.
const LOGO_STYLE = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400&display=swap" rel="stylesheet"><style id="fs-logo">.topbar{background:#2E5B45!important}.mainnav .logo{font-family:"EB Garamond",Georgia,serif!important;font-size:22px!important;font-weight:400!important;letter-spacing:.06em!important;white-space:nowrap}@media (max-width:640px){.mainnav .logo{font-size:17px!important}}</style>';
const A11Y_SCRIPT ='<script>(function(){var r=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,s=navigator.connection&&navigator.connection.saveData;if(!r&&!s)return;function calm(v){v.removeAttribute("autoplay");v.preload="none";try{v.pause()}catch(e){}}var o=new MutationObserver(function(m){m.forEach(function(x){x.addedNodes.forEach(function(n){if(n.nodeName==="VIDEO")calm(n);else if(n.querySelectorAll)n.querySelectorAll("video").forEach(calm)})})});o.observe(document,{childList:true,subtree:true});document.addEventListener("DOMContentLoaded",function(){o.disconnect();document.querySelectorAll("video").forEach(calm)})})();</script>';
const SOCIAL_LINKS = `<div class="fs-social" style="display:flex;justify-content:center;align-items:center;gap:22px;padding:14px 0 18px;"><a href="${site.instagram}" target="_blank" rel="noopener" aria-label="Finders &amp; Keepers Safaris on Instagram" style="display:inline-flex;align-items:center;color:inherit;opacity:.85;text-decoration:none;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg></a><a href="${site.x}" target="_blank" rel="noopener" aria-label="Finders &amp; Keepers Safaris on X" style="display:inline-flex;align-items:center;color:inherit;opacity:.85;text-decoration:none;"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a></div>`;
// Pages that show icons (fs-ico) but forgot to load the icon stylesheet get it here, so no icon ever shows as an empty circle.
const ICON_CSS = (html) => (/fs-ico/.test(html) && !/fs-icons.css/.test(html) ? '<link rel="stylesheet" href="/assets/fs-icons.css?v=2">' : '');
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
  // Instagram and X icons at the foot of every page (one place; the addresses live in lib/site.mjs)
  const lastFooter = raw.toLowerCase().lastIndexOf('</footer>');
  if (lastFooter >= 0) raw = raw.slice(0, lastFooter) + SOCIAL_LINKS + raw.slice(lastFooter);

  const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headEnd = raw.search(/<\/head>/i);
  const bodyStart = raw.search(/<body[\s>]/i);
  // Browsers treat <style>/<link> written between </head> and <body> as part of the head, so keep those too.
  const afterHead = headEnd >= 0 && bodyStart > headEnd ? raw.slice(headEnd + 7, bodyStart).replace(/<\/head>/gi, '') : '';
  const head = ((headMatch ? headMatch[1] : '') + afterHead + A11Y_STYLE + LOGO_STYLE + ICON_CSS(raw))
    .replace(/<meta\s+charset=[^>]*>/gi, '')
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '');

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const page = { headNodes: parse(head, { trim: true }), bodyHtml: A11Y_SCRIPT + (bodyMatch ? bodyMatch[1] : '') };
  cache.set(name, page);
  return page;
}
