// Builds the list the site search looks through (served as /search-index.json at build time).
import fs from 'node:fs';
import path from 'node:path';
import { decodeHTML } from 'entities';
import { renderPage } from './expand.mjs';
import { pageMeta } from './seo.mjs';

const HOME = 'finders-safaris-homepage';
const REGIONS = {
  Africa: ['Botswana', 'Egypt', 'Kenya', 'Morocco', 'Namibia', 'Rwanda', 'South Africa', 'Tanzania', 'Uganda', 'Zimbabwe'],
  'Indian Ocean': ['Maldives', 'Mauritius', 'Seychelles', 'Sri Lanka', 'Zanzibar'],
  Asia: ['Cambodia', 'China', 'Indonesia', 'Bali', 'Japan', 'Malaysia', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'],
  Europe: ['Croatia', 'France', 'Greece', 'Italy', 'Netherlands', 'Spain', 'Switzerland', 'Turkey'],
  'Middle East': ['Dubai'],
  Oceania: ['New Zealand', 'Fiji'],
};
const COUNTRIES = Object.entries(REGIONS).flatMap(([region, list]) => list.map((c) => [c, region]));
const plain = (s) => decodeHTML(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

function classify(name, raw) {
  if (name.startsWith('finders-safaris-')) return 'Destination';
  if (name.endsWith('-experience')) return 'Experience';
  if (raw.includes('id="itinerary"') && raw.includes('overview-img')) return 'Journey';
  if (raw.includes('id="tabbar"')) return 'Stay';
  return 'Guide';
}

export function buildIndex() {
  const dir = path.join(process.cwd(), 'content', 'pages');
  const out = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const name = file.slice(0, -5);
    if (name === HOME) continue;
    const raw = renderPage(fs.readFileSync(path.join(dir, file), 'utf8'));
    const { title, description } = pageMeta(name, raw);
    const type = classify(name, raw);
    const cleanTitle = title.replace(/\s*[|—–-]\s*Finders.*$/i, '').replace(/^Luxury Safaris in /, '').trim();

    // countries mentioned in the first part of the page's own content (not the site-wide menu)
    const startAt = [raw.search(/<main[\s>]/i), raw.search(/class="[^"]*hero/i)].filter((i) => i >= 0);
    const from = startAt.length ? Math.min(...startAt) : 0;
    const core = plain(raw.slice(from, from + 9000).replace(/<(script|style)[\s\S]*?<\/(script|style)>/gi, ' '));
    const hay = `${cleanTitle} ${name.replace(/-/g, ' ')} ${description} ${core}`.toLowerCase();

    const kw = new Set(name.split('-'));
    for (const [country, region] of COUNTRIES) {
      if (new RegExp('\\b' + country.toLowerCase() + '\\b').test(hay)) { kw.add(country); kw.add(region); }
    }
    // everyday words people type, matched against the page's own wording
    const SYNONYMS = [
      [/romanc|couple|honeymoon|proposal|anniversar/, 'honeymoon romantic couples'],
      [/family|kids|children|child/, 'family kids children'],
      [/beach|island|lagoon|atoll|resort|coral/, 'beach island'],
      [/big five|lion|elephant|rhino|leopard|buffalo|cheetah/, 'big five wildlife'],
      [/balloon/, 'hot air balloon'], [/gorilla|chimp/, 'gorilla primates'], [/migration|wildebeest/, 'great migration'],
    ];
    const titleHay = `${cleanTitle} ${name.replace(/-/g, ' ')}`.toLowerCase();
    const alias = new Set(); // everyday words that the page title itself implies rank higher
    for (const [re, words] of SYNONYMS) {
      if (re.test(hay)) words.split(' ').forEach((w) => kw.add(w));
      if (re.test(titleHay)) words.split(' ').forEach((w) => alias.add(w));
    }
    for (const m of raw.matchAll(/class="location-tag"[^>]*>([\s\S]*?)<\/div>/g)) kw.add(plain(m[1]));
    const eyebrow = raw.match(/class="eyebrow"[^>]*>([^<]{3,60})</);
    if (eyebrow) kw.add(plain(eyebrow[1]));
    const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) kw.add(plain(h1[1]));

    let sub = clip(description, 110);
    if (type === 'Journey') {
      const days = raw.match(/>(\d+)\s*Days?</i) || raw.match(/(\d+)\s*Days/);
      const price = raw.match(/from\s*\$\s*([\d,]+)\s*pp/i);
      if (days) sub = `${days[1]} days${price ? ` · from $${price[1]} pp` : ''} — ${clip(description, 80)}`;
    }
    if (type === 'Destination') kw.add('destination');
    if (type === 'Stay') ['lodge', 'hotel', 'camp', 'accommodation'].forEach((k) => kw.add(k));
    if (type === 'Journey') ['package', 'itinerary', 'safari'].forEach((k) => kw.add(k));
    const entry = { t: cleanTitle || name, u: `${name}.html`, y: type, d: sub, k: [...kw].filter(Boolean).join(' ') };
    if (alias.size) entry.a = [...alias].join(' ');
    out.push(entry);
  }
  return out;
}
