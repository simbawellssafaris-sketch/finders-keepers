// Checks the built site (BUILD_DIR, default .next/server/app; use BUILD_DIR=out after build:static).
//  1. every page's content matches the saved original apart from the intended fixes (images, alt text, search box)
//  2. every page now has title, description, canonical, share image tags, alt text and no remote placeholder images
//  3. sitemap lists every page and nothing else
import fs from 'node:fs';
import { parse, serialize } from 'parse5';
import { decodeHTML } from 'entities';

const DIR = process.env.BUILD_DIR || '.next/server/app';
const find = (n, t) => { if (t(n)) return n; for (const c of n.childNodes || []) { const r = find(c, t); if (r) return r; } return null; };
const isNextScript = (c) => c.nodeName === 'script' && ((c.attrs || []).some((a) => a.name === 'src' && a.value.startsWith('/_next')) || /__next_f|\$R[CSX]|_next/.test((c.childNodes[0] && c.childNodes[0].value) || ''));
const strip = (n) => { if (!n.childNodes) return; n.childNodes = n.childNodes.filter((c) => !isNextScript(c)); n.childNodes.forEach(strip); };

// A page "skeleton": tags, classes, ids, links and text. Picture sources, alt text and styles are left out, because those are what we meant to change.
function skeleton(node, out = []) {
  if (node.nodeName === '#text') { const t = node.value.replace(/\s+/g, ' ').trim(); if (t) out.push(t); return out; }
  if (node.nodeName === '#comment') return out;
  if (node.tagName) {
    const a = Object.fromEntries((node.attrs || []).map((x) => [x.name, x.value]));
    out.push(`<${node.tagName}${a.class ? '.' + a.class : ''}${a.id ? '#' + a.id : ''}${a.href ? '→' + a.href : ''}>`);
  }
  for (const c of node.childNodes || []) skeleton(c, out);
  return out;
}

const problems = [];
let pages = 0;
const names = [];
for (const f of fs.readdirSync('.backup/pages').filter((x) => x.endsWith('.html'))) {
  pages++; names.push(f.slice(0, -5));
  const orig = parse(fs.readFileSync('.backup/pages/' + f, 'utf8'));
  let html = fs.readFileSync(`${DIR}/${f}`, 'utf8');
  html = html.replace(/<!-- FS-SEARCH:START -->[\s\S]*?<!-- FS-SEARCH:END -->/, '');
  const built = parse(html);
  const wrapper = find(built, (x) => x.attrs && x.attrs.some((a) => a.name === 'id' && a.value === 'fs-page'));
  if (!wrapper) { problems.push(`${f}: page body missing`); continue; }
  strip(wrapper);
  const kids = (n) => n.childNodes.flatMap((c) => skeleton(c)).join('\n').trimEnd();
  const a = kids(find(orig, (x) => x.nodeName === 'body'));
  const b = kids(wrapper);
  if (a !== b) {
    const A = a.split('\n'), B = b.split('\n'); let i = 0; while (i < A.length && A[i] === B[i]) i++;
    problems.push(`${f}: content differs near "${(A[i] || '').slice(0, 50)}" vs "${(B[i] || '').slice(0, 50)}"`);
  }

  // SEO + accessibility completeness
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1];
  const need = [[/<title>[^<]+<\/title>/, 'title'], [/name="description" content="[^"]{40,}"/, 'description'], [/rel="canonical"/, 'canonical'], [/property="og:image" content="https:\/\/[^"]+"/, 'og:image'], [/property="og:title"/, 'og:title'], [/name="twitter:image"/, 'twitter:image']];
  for (const [re, label] of need) if (!re.test(head)) problems.push(`${f}: missing ${label}`);
  const title = decodeHTML((head.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]);
  if (title.length > 70) problems.push(`${f}: title still long (${title.length})`);
  if (/images\.unsplash\.com/.test(html)) problems.push(`${f}: still uses Unsplash`);
  const bodyHtml = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const noAlt = (bodyHtml.match(/<img\b(?![^>]*\balt=)[^>]*>/g) || []).length;
  if (noAlt) problems.push(`${f}: ${noAlt} image(s) without alt text`);
}

// sitemap
const smFile = fs.existsSync(`${DIR}/sitemap.xml.body`) ? `${DIR}/sitemap.xml.body` : `${DIR}/sitemap.xml`;
const sm = fs.readFileSync(smFile, 'utf8');
const inMap = new Set([...sm.matchAll(/<loc>[^<]*\/([^\/<]*)<\/loc>/g)].map((m) => m[1].replace(/\.html$/, '')));
const expected = new Set(names.filter((n) => n !== 'finders-safaris-homepage'));
const missing = [...expected].filter((n) => !inMap.has(n)), extra = [...inMap].filter((n) => n && !expected.has(n));
if (missing.length || extra.length) problems.push(`sitemap: ${missing.length} pages missing, ${extra.length} unknown entries ${extra.slice(0, 3)}`);

console.log(`checked ${pages} pages + sitemap (${inMap.size} entries) in ${DIR}, problems: ${problems.length}`);
problems.slice(0, 20).forEach((p) => console.log(' -', p));
