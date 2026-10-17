// One-off: replaces brand/contact text inside content/shared/*.html with {{placeholders}} read from lib/site.mjs.
import fs from 'node:fs';
const R = [
  ['FINDERS & KEEPERS SAFARIS', '{{BRAND}}'], ['Finders & Keepers Safaris', '{{brand}}'],
  ['FINDERS & KEEPERS', '{{BRANDSHORT}}'], ['Finders & Keepers', '{{brandShort}}'],
  ['A Life Of Making Memories', '{{tagline}}'], ['+254 700 000 000', '{{phone}}'], ['tel:+254700000000', 'tel:{{phoneHref}}'],
  ['254768886836', '{{whatsapp}}'], ['info@findersandkeepers.com', '{{email}}'], ['findersandkeepers.com', '{{domain}}'],
  ['Mon–Fri 8am–6pm EAT', '{{hours}}'], ['© 2026', '© {{year}}'],
];
let changed = 0;
for (const f of fs.readdirSync('content/shared').filter((x) => x.endsWith('.html'))) {
  const p = 'content/shared/' + f; let t = fs.readFileSync(p, 'utf8'); const o = t;
  for (const [a, b] of R) t = t.split(a).join(b);
  if (t !== o) { fs.writeFileSync(p, t); changed++; }
}
console.log('fragments updated:', changed);
