// Tells Bing (and the other IndexNow search engines) which pages are new or changed, so they are crawled quickly.
// Usage:   node scripts/indexnow.mjs            (sends every page in the live sitemap)
//          node scripts/indexnow.mjs <url> ...  (sends only the pages you list)
// Needs the key file in /public (the 32-character .txt file) to be live on the site first.
import fs from 'node:fs';
import path from 'node:path';

const HOST = 'finderskeeperssafaris.com';
const keyFile = fs.readdirSync('public').find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file found in /public');
const key = keyFile.replace(/\.txt$/, '');
const keyLocation = `https://${HOST}/${keyFile}`;

// 1. the key file must be reachable, otherwise the search engines will refuse the request
const check = await fetch(keyLocation);
if (!check.ok || (await check.text()).trim() !== key) {
  console.error(`The key file is not live yet at ${keyLocation} (HTTP ${check.status}). Deploy the site first.`);
  process.exit(1);
}

// 2. which pages to send
let urls = process.argv.slice(2);
if (!urls.length) {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
urls = urls.filter((u) => u.startsWith(`https://${HOST}/`)).slice(0, 10000);
if (!urls.length) throw new Error('No pages to send');

// 3. send
const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList: urls }),
});
console.log(`Sent ${urls.length} pages. Answer: HTTP ${res.status} ${res.statusText}`);
console.log(res.status === 200 || res.status === 202 ? 'Accepted. Bing will crawl them soon.' : 'Not accepted: ' + (await res.text()));
