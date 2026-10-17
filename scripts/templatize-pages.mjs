// One-off: replaces brand/contact text inside content/pages/*.html with {{placeholders}} from lib/site.mjs,
// so a rename or a new phone number is a one-line change in lib/site.mjs.
import fs from 'node:fs';
const R = [
  ['FINDERS & KEEPERS SAFARIS', '{{BRAND}}'], ['Finders & Keepers Safaris', '{{brand}}'],
  ['FINDERS & KEEPERS', '{{BRANDSHORT}}'], ['Finders & Keepers', '{{brandShort}}'],
  ['A Life Of Making Memories', '{{tagline}}'], ['+254 700 000 000', '{{phone}}'],
  ['info@findersandkeepers.com', '{{email}}'], ['findersandkeepers.com', '{{domain}}'],
];
let changed = 0, hits = 0;
for (const f of fs.readdirSync('content/pages').filter((x) => x.endsWith('.html'))) {
  const p = 'content/pages/' + f; let t = fs.readFileSync(p, 'utf8'); const o = t;
  for (const [a, b] of R) { const n = t.split(a).length - 1; if (n) { hits += n; t = t.split(a).join(b); } }
  if (t !== o) { fs.writeFileSync(p, t); changed++; }
}
console.log('pages updated:', changed, ' replacements:', hits);
