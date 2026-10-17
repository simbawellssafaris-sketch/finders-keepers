// One-off: replaces the very pale creams (which read as faint pink next to white) with one clear beige.
//   BEIGE      #EDE3CE  - page / section background (was #f4eee2, #f9f5ee, #f6f1e7, #faf8f3)
//   BEIGE_DEEP #E0D3B8  - alternating / deeper panels (was #ece3d0, #f2eee3, #e9dfc9)
//   LINE       #CFC1A3  - divider lines, darkened slightly so they still show on the beige (was #D9CFB9)
import fs from 'node:fs';
import path from 'node:path';

const BEIGE = '#EDE3CE', BEIGE_DEEP = '#E0D3B8', LINE = '#CFC1A3';
const MAP = [
  [/#(f4eee2|f9f5ee|f6f1e7|faf8f3)\b/gi, () => BEIGE],
  [/#(ece3d0|f2eee3|e9dfc9)\b/gi, () => BEIGE_DEEP],
  [/(--line\s*:\s*)#d9cfb9\b/gi, (m, pre) => pre + LINE],
];
const roots = ['content/pages', 'content/shared', 'public/assets', 'public/site.webmanifest', 'lib/why.mjs', 'app'];
const exts = /\.(html|css|js|mjs|jsx|json|webmanifest)$/i;
let files = 0, hits = 0;

function visit(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const f of fs.readdirSync(p)) visit(path.join(p, f)); return; }
  if (!exts.test(p) || st.size > 5e6) return;
  const orig = fs.readFileSync(p, 'utf8');
  let t = orig;
  for (const [re, fn] of MAP) t = t.replace(re, (...a) => { hits++; return fn(...a); });
  if (t !== orig) { fs.writeFileSync(p, t); files++; }
}
for (const r of roots) if (fs.existsSync(r)) visit(r);
console.log({ filesChanged: files, replacements: hits });
