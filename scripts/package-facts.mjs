// Prints the real facts of each package page (used to write its "Why this journey" copy).
import fs from 'node:fs';
import { decodeHTML } from 'entities';
import { renderPage } from '../lib/expand.mjs';
const t = (s) => decodeHTML(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const slugs = fs.readdirSync('content/pages').filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5))
  .filter((s) => fs.readFileSync(`content/pages/${s}.html`, 'utf8').includes('id="testimonials"'));
const out = {};
for (const s of slugs) {
  const raw = renderPage(fs.readFileSync(`content/pages/${s}.html`, 'utf8'));
  const title = t((raw.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]).replace(/\s*[|—-]\s*Finders.*$/i, '');
  const stats = [...raw.matchAll(/class="statstrip">([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => t(m[1]))[0] || t((raw.match(/class="hero-meta[^"]*">([\s\S]*?)<\/div>/) || [, ''])[1]);
  const tags = [...new Set([...raw.matchAll(/class="tag[^"]*">([\s\S]*?)<\/span>/g)].map((m) => t(m[1])))].slice(0, 4);
  const locs = [...new Set([...raw.matchAll(/class="location-tag"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => t(m[1])))];
  const high = [...raw.matchAll(/class="highlight"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map((m) => t(m[1]));
  const stays = [...new Set([...raw.matchAll(/class="stay-card"[\s\S]*?<h4>([\s\S]*?)<\/h4>/g)].map((m) => t(m[1])))];
  const season = [...raw.matchAll(/class="season-row"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => t(m[1])).slice(0, 3);
  const days = [...raw.matchAll(/<h3>(Day \d+[^<]*)<\/h3>/g)].map((m) => t(m[1]).replace(/^Day \d+\s*\|\s*/, ''));
  const overview = t((raw.match(/id="overview"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]).slice(0, 380);
  out[s] = { title, stats, tags, locs, high, stays, season, days: days.length, dayTitles: days.slice(0, 14), overview };
}
fs.writeFileSync('.backup/package-facts.json', JSON.stringify(out, null, 1));
console.log('packages:', Object.keys(out).length);
