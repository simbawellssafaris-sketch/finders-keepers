// After you INTENTIONALLY change page text or pictures, run this so verify-final.mjs treats the new pages as the reference.
import fs from 'node:fs';
import { renderPage } from '../lib/expand.mjs';
import { whySectionHtml } from '../lib/why.mjs';
let n = 0;
for (const f of fs.readdirSync('content/pages').filter((x) => x.endsWith('.html'))) {
  let html = renderPage(fs.readFileSync('content/pages/' + f, 'utf8'));
  html = html.replace('<!--@why-journey-->', () => whySectionHtml(f.replace(/\.html$/, ''), html));
  fs.writeFileSync('.backup/pages/' + f, html);
  n++;
}
console.log(`baseline refreshed for ${n} pages`);
