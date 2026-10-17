import fs from 'node:fs';
const dir = 'out';
const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && !['404.html', 'index.html'].includes(f));
const names = pages.map((f) => f.slice(0, -5));
const get = (h, re) => (h.match(re) || [, ''])[1];
console.log('pages:', pages.length);
const has = (re) => names.filter((n) => re.test(n));
console.log('contact/faq/privacy/terms/cookie/blog/testimonial/about/careers pages:', has(/contact|faq|privacy|terms|cookie|blog|journal|testimonial|review|careers|press|sitemap|policy|policies|conditions/));

let noDesc = 0, noOg = 0, noCanon = 0, noH1 = 0, multiH1 = 0, shortDesc = 0, longTitle = 0, imgNoAlt = 0, imgTotal = 0;
const titles = {}, hashLinks = {}, forms = {}, ext = {};
for (const f of pages) {
  const h = fs.readFileSync(`${dir}/${f}`, 'utf8');
  const head = get(h, /<head[^>]*>([\s\S]*?)<\/head>/i), body = get(h, /<body[^>]*>([\s\S]*)<\/body>/i);
  const t = get(head, /<title>([\s\S]*?)<\/title>/i).trim(); (titles[t] ||= []).push(f);
  if (t.length > 65) longTitle++;
  const d = get(head, /name="description" content="([^"]*)"/i); if (!d) noDesc++; else if (d.length < 70) shortDesc++;
  if (!/property="og:image"/i.test(head)) noOg++;
  if (!/rel="canonical"/i.test(head)) noCanon++;
  const h1 = (body.match(/<h1[\s>]/g) || []).length; if (!h1) noH1++; if (h1 > 1) multiH1++;
  for (const m of body.matchAll(/<img\b[^>]*>/g)) { imgTotal++; if (!/\balt="[^"]+"/.test(m[0])) imgNoAlt++; }
  for (const m of body.matchAll(/<a\b[^>]*href="#"[^>]*>([\s\S]{0,60}?)<\/a>/g)) { const cls = (m[0].match(/class="([^"]*)"/) || [, ''])[1]; if (/js-fs-|fs-subscribe|js-/.test(cls)) continue; const txt = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); hashLinks[txt] = (hashLinks[txt] || 0) + 1; }
  for (const m of body.matchAll(/<form\b([^>]*)>/g)) { const id = (m[1].match(/id="([^"]*)"/) || [, '(no id)'])[1] + ' action=' + ((m[1].match(/action="([^"]*)"/) || [, 'none'])[1]); forms[id] = (forms[id] || 0) + 1; }
  for (const m of h.matchAll(/(?:src|href)="https?:\/\/([^\/"]+)/g)) ext[m[1]] = (ext[m[1]] || 0) + 1;
}
console.log({ noDescription: noDesc, shortDescription: shortDesc, noOgImage: noOg, noCanonical: noCanon, noH1, multipleH1: multiH1, titlesOver65chars: longTitle, images: imgTotal, imagesWithoutAlt: imgNoAlt });
const dup = Object.entries(titles).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log('duplicate titles:', dup.length, dup.slice(0, 4).map(([t, v]) => `${v.length}x "${t.slice(0, 50)}"`));
console.log('placeholder "#" links (text -> count):', Object.entries(hashLinks).sort((a, b) => b[1] - a[1]).slice(0, 14));
console.log('forms:', forms);
console.log('external hosts:', Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 10));
const sm = fs.readFileSync(`${dir}/sitemap.xml`, 'utf8'); const inSm = new Set([...sm.matchAll(/<loc>[^<]*\/([^\/<]+)\.html<\/loc>/g)].map((m) => m[1]));
console.log('sitemap entries:', inSm.size, ' pages missing from sitemap:', names.filter((n) => !inSm.has(n)).length, names.filter((n) => !inSm.has(n)).slice(0, 8), ' sitemap entries with no page:', [...inSm].filter((n) => !names.includes(n)).slice(0, 6));
console.log('robots.txt:', fs.readFileSync(`${dir}/robots.txt`, 'utf8').replace(/\n/g, ' | '));
const nf = fs.readFileSync(`${dir}/404.html`, 'utf8'); console.log('404 page text:', get(nf, /<body[^>]*>([\s\S]*)<\/body>/i).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100));
