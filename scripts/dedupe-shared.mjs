// Merges shared pieces whose text is now identical, pointing pages at one copy.
import fs from 'node:fs';
import path from 'node:path';
const SH = 'content/shared', PG = 'content/pages';
const ids = fs.readdirSync(SH).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort((a, b) => a.length - b.length || a.localeCompare(b));
const byText = new Map(), remap = {};
for (const id of ids) {
  const t = fs.readFileSync(path.join(SH, id + '.html'), 'utf8');
  if (byText.has(t)) remap[id] = byText.get(t); else byText.set(t, id);
}
const merges = Object.keys(remap).length;
if (merges) {
  for (const f of fs.readdirSync(PG).filter((x) => x.endsWith('.html'))) {
    const p = path.join(PG, f); const t = fs.readFileSync(p, 'utf8');
    const s = t.replace(/<!--@include ([a-z0-9-]+)-->/g, (m, id) => (remap[id] ? `<!--@include ${remap[id]}-->` : m));
    if (s !== t) fs.writeFileSync(p, s);
  }
  for (const id of Object.keys(remap)) fs.rmSync(path.join(SH, id + '.html'));
}
console.log('shared pieces merged:', merges, remap);
