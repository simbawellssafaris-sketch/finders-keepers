// One-off tool: finds the menu/footer/popup chunks that were copied into many pages and moves each into
// content/shared/<id>.html, leaving <!--@include id--> in the page. Originals stay in .backup/pages.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseDocument } from 'htmlparser2';

const SRC = '.backup/pages';
const OUT_PAGES = 'content/pages';
const OUT_SHARED = 'content/shared';
const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const norm = (s) => s.replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/> </g, '><').trim();

const MARKERS = { 'FS-ENQ-MODAL': 'enquiry-modal', 'FS-SUB-MODAL': 'subscribe-modal', 'FS-PRINT': 'print-styles', 'FS-FLOATCARD-DOCK': 'floatcard-dock', 'FS-FOOT-SUB': 'footer-subscribe-script', 'FS-WAYS-LINKS': 'ways-links-script' };
const NAMED_KEYS = new Set(['div.topbar', 'nav.nav', 'div.mainnav', 'div.fs-quicknav', 'footer', 'div.mega-overlay', 'button.speak-btn']);
const MIN_COUNT = 8, MIN_LEN = 150;

const bodyOf = (t) => { const s = t.indexOf('>', t.indexOf('<body')) + 1; const e = t.lastIndexOf('</body>'); return { pre: t.slice(0, s), body: t.slice(s, e), post: t.slice(e) }; };
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));

// ---- pass 0: marker blocks -------------------------------------------------------------------
const markerRe = /<!--\s*(FS-[A-Z-]+):START\s*-->([\s\S]*?)<!--\s*\1:END\s*-->/g;
const markerGroups = {}; // marker -> hash -> {count, text}
const pages = {};
for (const f of files) {
  const t = fs.readFileSync(path.join(SRC, f), 'utf8');
  const parts = bodyOf(t);
  pages[f] = parts;
  let m; markerRe.lastIndex = 0;
  while ((m = markerRe.exec(parts.body))) {
    if (!MARKERS[m[1]]) continue;
    const g = (markerGroups[m[1]] ||= {}); const h = hash(m[0]);
    (g[h] ||= { count: 0, text: m[0] }).count++;
  }
}
const shared = {}; // id -> {text, count, key}
const markerIds = {}; // marker -> hash -> id
for (const [marker, groups] of Object.entries(markerGroups)) {
  const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  sorted.forEach(([h, g], i) => {
    if (g.count < 2) return;
    const id = MARKERS[marker] + (i ? `-${String.fromCharCode(97 + i)}` : '');
    (markerIds[marker] ||= {})[h] = id;
    shared[id] = { text: g.text, count: g.count, key: marker };
  });
}
for (const f of files) {
  pages[f].body = pages[f].body.replace(markerRe, (full, marker) => {
    const id = markerIds[marker] && markerIds[marker][hash(full)];
    return id ? `<!--@include ${id}-->` : full;
  });
}

// ---- pass 1: top-level segments ----------------------------------------------------------------
const segs = {}; // groupKey -> {count, variants:{hash:{count,text}}, key}
const pageSegs = {};
for (const f of files) {
  const body = pages[f].body;
  const doc = parseDocument(body, { withStartIndices: true, withEndIndices: true });
  pageSegs[f] = [];
  for (const n of doc.children) {
    if (!['tag', 'script', 'style'].includes(n.type)) continue;
    const text = body.slice(n.startIndex, n.endIndex + 1);
    const isNamedKey = NAMED_KEYS.has(`${n.name}${n.attribs.class ? "." + n.attribs.class.split(" ")[0] : ""}`);
    if (text.length < (isNamedKey ? 40 : MIN_LEN)) continue;
    const key = `${n.name}${n.attribs.class ? '.' + n.attribs.class.split(' ')[0] : ''}${n.attribs.id ? '#' + n.attribs.id : ''}`;
    const baseKey = `${n.name}${n.attribs.class ? '.' + n.attribs.class.split(' ')[0] : ''}`;
    const named = NAMED_KEYS.has(baseKey);
    const group = `E|${hash(text)}`; // exact match only: pages never change by even a space
    const g = (segs[group] ||= { count: 0, variants: {}, key: named ? baseKey : key, named });
    g.count++;
    const vh = hash(text);
    (g.variants[vh] ||= { count: 0, text }).count++;
    pageSegs[f].push({ start: n.startIndex, end: n.endIndex + 1, group, text });
  }
}
const nameFor = (g, idx, taken) => {
  const canon = Object.values(g.variants).sort((a, b) => b.count - a.count)[0].text;
  let base;
  const SNIFF = [[/REGION_DATA/, "mega-menu-script"], [/Collapse an expanded day/, "itinerary-expand-script"], [/const tabnav ?= ?document/, "package-tabnav-script"], [/yearToggle/, "year-toggle-script"], [/offer-more/, "offers-more-script"], [/jd-toggle/, "journey-details-script"], [/.fs-quicknav{/, "quicknav-styles"], [/fsBackLink/, "quicknav-script"], [/elevation-rule/, "elevation-divider"], [/id="tabbar"/, "lodge-tabbar"], [/heroTrack/, "lodge-hero-script"], [/id="tabnav"/, "package-tabnav"], [/class="statstrip"/, "package-stat-strip"], [/class="ctaband"/, "package-cta-band"], [/class="floatcard"/, "package-floatcard"]];
  const hit = NAMED_KEYS.has(g.key) ? null : SNIFF.find(([re]) => re.test(canon));
  if (hit) base = hit[1];
  else
  if (g.key === 'div.mega-overlay') base = 'mega-menu-panels';
  else if (g.key === 'div.topbar') base = canon.includes('topbar-left') ? 'topbar-menu-pages' : 'topbar-detail-pages';
  else if (g.key === 'nav.nav') base = 'nav-menu-pages';
  else if (g.key === 'div.mainnav') base = 'nav-detail-pages';
  else if (g.key === 'div.fs-quicknav') base = 'quicknav';
  else if (g.key === 'button.speak-btn') base = 'speak-button';
  else if (g.key === 'footer') base = canon.includes('footer-top') ? 'footer-site' : canon.includes('foot-grid') ? 'footer-newsletter' : 'footer-brand-line';
  else if (g.key.startsWith('script')) base = 'script';
  else if (g.key.startsWith('style')) base = 'styles';
  else base = g.key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'block';
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
};
const taken = new Set(Object.keys(shared));
const groupIds = {};
Object.entries(segs).filter(([, g]) => g.count >= MIN_COUNT).sort((a, b) => b[1].count * b[1].variants.length - a[1].count).forEach(([gk, g]) => {
  const id = nameFor(g, 0, taken);
  const canon = Object.values(g.variants).sort((a, b) => b.count - a.count)[0].text;
  groupIds[gk] = id;
  shared[id] = { text: canon, count: g.count, key: g.key };
});

// ---- write ---------------------------------------------------------------------------------------
fs.mkdirSync(OUT_SHARED, { recursive: true });
for (const old of fs.readdirSync(OUT_SHARED)) if (old.endsWith('.html')) fs.rmSync(path.join(OUT_SHARED, old)); // keeps README.md
for (const [id, s] of Object.entries(shared)) fs.writeFileSync(path.join(OUT_SHARED, `${id}.html`), s.text);
let replaced = 0, savedBytes = 0;
for (const f of files) {
  let body = pages[f].body;
  // segments were measured on the body AFTER marker replacement, so offsets still match
  for (const s of pageSegs[f].filter((x) => groupIds[x.group]).sort((a, b) => b.start - a.start)) {
    body = body.slice(0, s.start) + `<!--@include ${groupIds[s.group]}-->` + body.slice(s.end);
    replaced++; savedBytes += s.text.length;
  }
  fs.writeFileSync(path.join(OUT_PAGES, f), pages[f].pre + body + pages[f].post);
}
const index = Object.fromEntries(Object.entries(shared).sort((a, b) => b[1].count - a[1].count).map(([id, s]) => [id, { pages: s.count, bytes: s.text.length, from: s.key }]));
fs.writeFileSync(path.join(OUT_SHARED, '_index.json'), JSON.stringify(index, null, 1));
console.log('shared fragments:', Object.keys(shared).length, ' segments replaced in pages:', replaced);
for (const [id, s] of Object.entries(index).slice(0, 45)) console.log(String(s.pages).padStart(4), String(s.bytes).padStart(6), id.padEnd(30), s.from);
