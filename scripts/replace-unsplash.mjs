// One-off: replaces every remote Unsplash picture with one of the site's own photos.
import fs from 'node:fs';
const P = (f) => `content/pages/${f}.html`;
const A = 'assets/img/';
const read = (f) => fs.readFileSync(P(f), 'utf8');
const write = (f, t) => fs.writeFileSync(P(f), t);
const UN = /https:\/\/images\.unsplash\.com\/[^'")\s]*/g;
const report = [];

// 1. Journey cards -> the real hero photo of the journey each card links to
function heroOf(slug) {
  if (!fs.existsSync(P(slug))) return null;
  if (fs.existsSync(`public/${A}packages/${slug}.jpg`)) return `${A}packages/${slug}.jpg`;
  const t = read(slug);
  const m = t.match(/\.hero\{[^}]*url\(['"]?(assets\/[^'")]+)/) || t.match(/class="hero"[^>]*url\(['"]?(assets\/[^'")]+)/);
  return m ? m[1] : null;
}
for (const f of fs.readdirSync('content/pages').filter((x) => x.endsWith('.html')).map((x) => x.slice(0, -5))) {
  let t = read(f); let n = 0;
  t = t.replace(/<article class="jf-card[\s\S]*?<\/article>/g, (card) => {
    if (!/images\.unsplash\.com/.test(card)) return card;
    const slug = (card.match(/class="jf-go" href="([a-z0-9-]+)\.html"/) || [])[1];
    const hero = slug && heroOf(slug);
    if (!hero) { report.push(`NO PHOTO for card in ${f}: ${slug}`); return card; }
    n++; return card.replace(UN, hero);
  });
  if (n) { write(f, t); report.push(`${f}: ${n} journey cards now use their own journey photo`); }
}

// 2. Specific pictures, matched by page + alt text (new alt describes the real photo)
const byAlt = {
  birthday: [['A giraffe at golden hour', A + 'family-adventures/birthday.jpg', 'A child learning a flute from a Maasai guide on a family safari']],
  'bucket-list': [[/^A traveller at a mountain summit/, A + 'family-adventures/bucket-list.jpg', 'A Maasai warrior and a young traveller on the plains at sunset']],
  'defining-moments': [[/^A rhino family crossing/, A + 'family-adventures/defining-moments.jpg', 'A family beside a safari vehicle under an acacia at golden hour']],
  'family-vacation': [['Travellers together on a journey', A + 'family-adventures/family-vacation.jpg', 'A family sitting with Maasai guides on the savannah']],
  graduation: [['Rift Valley landscape at dusk', A + 'family-adventures/graduation.jpg', 'Travellers watching the sunrise from a safari vehicle']],
  'couples-escapes': [
    [/^A private deck/, A + 'couples-escapes/hero-3.jpg', 'A private deck at a safari lodge'],
    [/^A quiet lakeside/, A + 'couples-escapes/overview-1.jpg', 'Relaxing on a private dhow at sea'],
    [/^Still water/, A + 'couples-escapes/overview-2.jpg', 'A couple on a wooden dhow over calm water'],
    [/^A pale lagoon/, A + 'couples-escapes/overview-3.jpg', 'A private beach dinner for two'],
  ],
  'city-tour': [['Local food being prepared', A + 'experiences/hawker-centre-food-tour-local-guide-experience.jpg', 'Local food being prepared at a food market']],
  'layover-safaris': [
    [/^Acacia and open savannah/, A + 'packages/itinerary/africa/3.jpg', 'Acacia and open savannah seen from a safari lodge at sunset'],
    [/^Wildlife grazing/, A + 'packages/itinerary/africa/2.jpg', 'Zebras in the wild plains of Kenya'],
    [/^Volcanic cliffs/, A + 'helicopter/lake-alice-michaelson-helicopter.jpg', 'A crater lake beneath volcanic cliffs in the Great Rift Valley'],
    [/^Rift Valley lake/, A + 'helicopter/lake-logipi-helicopter.jpg', 'Flamingos on a Rift Valley lake'],
  ],
  brochures: [
    [/Journeys .*Experiences, 2026/, A + 'cottars/cottars-maasai-campfire.jpg'],
    ['Tailor-Made Journeys', A + 'travel-style/tailor-made/1.jpg'], ['Small Group Journeys', A + 'travel-style/small-group/1.jpg'],
    ['Solo Travel', A + 'travel-style/solo-travel/1.jpg'], ['By Road', A + 'travel-style/by-road/1.jpg'],
    ['Fly-In Safaris', A + 'travel-style/fly-in/1.jpg'], ['Kenya', A + 'destinations/kenya.jpg'],
    ['Tanzania', A + 'destinations/tanzania.jpg'], ['Beach & Islands', A + 'destinations/maldives.jpg'],
  ],
};
for (const [f, rules] of Object.entries(byAlt)) {
  let t = read(f); let n = 0;
  t = t.replace(/<img\b[^>]*src="https:\/\/images\.unsplash\.com[^>]*>/g, (img) => {
    const alt = ((img.match(/alt="([^"]*)"/) || [, ''])[1]).replace(/&amp;/g, '&');
    const rule = rules.find(([k]) => (k instanceof RegExp ? k.test(alt) : alt === k));
    if (!rule) { report.push(`UNMATCHED img in ${f}: alt="${alt}"`); return img; }
    n++;
    let out = img.replace(UN, rule[1]);
    if (rule[2]) out = out.replace(/alt="[^"]*"/, `alt="${rule[2]}"`);
    return out;
  });
  write(f, t); report.push(`${f}: ${n} pictures replaced`);
}

// 3. Background bands (decorative) -> a fitting real photo
const BG = {
  beach: 'packages/itinerary/indian-ocean/1.jpg', 'journey-finder': 'packages/itinerary/africa/4.jpg', safari: 'packages/itinerary/africa/3.jpg',
  birthday: 'packages/itinerary/africa/3.jpg', 'bucket-list': 'packages/itinerary/africa/4.jpg', 'defining-moments': 'cottars/cottars-maasai-campfire.jpg',
  'family-vacation': 'packages/itinerary/africa/1.jpg', graduation: 'packages/itinerary/africa/2.jpg', 'solo-travel': 'travel-style/solo-travel/1.jpg',
  'small-group-journeys': 'travel-style/small-group/2.jpg', 'by-road-safaris': 'travel-style/by-road/2.jpg', 'fly-in-safaris': 'travel-style/fly-in/2.jpg',
  'tailor-made-safaris': 'travel-style/tailor-made/2.jpg', 'tailor-your-journey': 'travel-style/tailor-made/3.jpg', brochures: 'packages/itinerary/africa/4.jpg',
  'finders-safaris-homepage': 'packages/itinerary/africa/3.jpg',
};
for (const [f, img] of Object.entries(BG)) {
  let t = read(f); let n = 0;
  t = t.replace(/(style="[^"]*url\(['"]?)https:\/\/images\.unsplash\.com\/[^'")\s]*/g, (m, pre) => { n++; return pre + A + img; });
  if (n) { write(f, t); report.push(`${f}: ${n} background band(s) replaced`); }
}

// 4. Dubai page CSS backgrounds
{
  let t = read('finders-safaris-dubai'); let n = 0;
  const DUB = ['packages/itinerary/dubai/1.jpg', 'packages/itinerary/dubai/2.jpg', 'packages/itinerary/dubai/1.jpg'];
  t = t.replace(UN, () => A + DUB[n++ % 3]);
  write('finders-safaris-dubai', t); report.push(`finders-safaris-dubai: ${n} CSS backgrounds replaced`);
}

// 5. Anything still pointing at Unsplash (share-preview tags are handled by the SEO step)
let left = 0; const where = new Set();
for (const f of fs.readdirSync('content/pages').filter((x) => x.endsWith('.html'))) {
  const t = fs.readFileSync('content/pages/' + f, 'utf8').replace(/<meta[^>]*(?:og|twitter):image[^>]*>/g, '');
  const c = (t.match(UN) || []).length; if (c) { left += c; where.add(f); }
}
console.log(report.join('\n')); console.log(`\nremaining Unsplash references (excluding share-preview tags): ${left}`, [...where]);
