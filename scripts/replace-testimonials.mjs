// One-off: removes the placeholder testimonials from every page and puts a "Why this journey" marker in their place.
import fs from 'node:fs';
import path from 'node:path';

const SECTION = /<section class="testimonials" id="testimonials">[\s\S]*?<\/section>/;
let sections = 0, links = 0, scripts = 0, tabs = 0, shared = 0;

for (const dir of ['content/pages', 'content/shared']) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const p = path.join(dir, f);
    const orig = fs.readFileSync(p, 'utf8');
    let t = orig;
    if (SECTION.test(t)) { t = t.replace(SECTION, '<!--@why-journey-->'); sections++; }
    t = t.replace(/[ \t]*<link rel="stylesheet" href="assets\/fs-testimonials\.css">[ \t]*\r?\n?/g, () => { links++; return ''; });
    t = t.replace(/[ \t]*<script src="assets\/fs-testimonials\.js"><\/script>[ \t]*\r?\n?/g, () => { scripts++; return ''; });
    t = t.replace(/href="#testimonials"([^>]*)>Testimonials</g, () => { tabs++; return 'href="#why-journey" class="tab">Why This Journey<'; });
    if (t !== orig) { fs.writeFileSync(p, t); if (dir.endsWith('shared')) shared++; }
  }
}
for (const a of ['public/assets/fs-testimonials.js', 'public/assets/fs-testimonials.css']) if (fs.existsSync(a)) fs.rmSync(a);
console.log({ sectionsRemoved: sections, cssLinksRemoved: links, scriptTagsRemoved: scripts, tabLabelsChanged: tabs, sharedFilesChanged: shared });

// any trace left?
let left = 0;
for (const dir of ['content/pages', 'content/shared']) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/<style[\s\S]*?<\/style>/g, '');
  if (/testimonial/i.test(t)) { left++; console.log('still mentions testimonial:', f); }
}
console.log('files still mentioning testimonials (outside CSS):', left);
