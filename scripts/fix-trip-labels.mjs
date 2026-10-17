// One-off content fix: makes every package page tell the same story about who travels.
//  1. page hero tag + price-bar label follow the badge the journey carries on its hub cards
//  2. "Group Size" row and "Guaranteed Departures" text say private OR small group (trips run either way)
//  3. "Fully private" claims reworded to match
import fs from 'node:fs';
const dir = 'content/pages';
const files = fs.readdirSync(dir).filter((x) => x.endsWith('.html'));
const SKIP = new Set(['the-1923']); // genuinely private-only, says so itself

// slug -> badge on hub cards (only when all cards agree)
const cardTag = {};
for (const f of files) {
  const t = fs.readFileSync(`${dir}/${f}`, 'utf8');
  for (const m of t.matchAll(/<div class="aj-card[^"]*"[^>]*>([\s\S]*?)<a href="([a-z0-9-]+)\.html" class="aj-card-link">/g)) {
    const b = (m[1].match(/aj-badge-type">([^<]*)</) || [, ''])[1];
    if (b) (cardTag[m[2]] ||= new Set()).add(b);
  }
}
const LABEL = { 'SMALL GROUP JOURNEY': 'Small Group', 'FAMILY SAFARI': 'Family Safari', 'SOLO SAFARI': 'Solo Safari', 'PRIVATE JOURNEY': 'Private' };

const GROUP_ROW = [
  ['Private — just you and your party', 'Private or small group — your party, or join a small departure'],
  ['Private &mdash; guided throughout', 'Private or small group &mdash; guided throughout'],
  ['Private &mdash; expert-guided throughout', 'Private or small group &mdash; expert-guided throughout'],
  ['Private — just the two of you', 'Private (just the two of you) or small group'],
  ['Private &mdash; just the two of you', 'Private (just the two of you) or small group'],
];
const CLAIMS = [
  ['Fully private journeys with a dedicated chauffeur-guide and butler service throughout', 'Private or small-group journeys with a dedicated chauffeur-guide and butler service throughout'],
  ['Fully private experience — your party, your pace, your safari vehicle throughout', 'Private or small-group departures — your pace, with an expert guide and safari vehicle throughout'],
  ['Fully private — your party, your vehicle, your pace through every wilderness area', 'Private or small-group — your pace, with a dedicated guide and vehicle through every wilderness area'],
  ['Fully private — just you and your party, with no fixed departure date', 'Private or small-group — you choose the dates, with no fixed departure date'],
  ['Fully private — your party only, moving at your pace, with your dedicated guide throughout', 'Private or small-group — moving at your pace, with your dedicated guide throughout'],
  ['Fully private experience — your party, your pace, your private vehicle and guide throughout', 'Private or small-group departures — your pace, with a dedicated vehicle and guide throughout'],
];

const n = { tag: 0, label: 0, row: 0, dep: 0, claim: 0, solo: 0 };
for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  if (SKIP.has(slug)) continue;
  const p = `${dir}/${f}`;
  const orig = fs.readFileSync(p, 'utf8');
  let t = orig;

  // 1. tag + price-bar label follow the hub cards (single agreed badge only)
  const cards = cardTag[slug] ? [...cardTag[slug]] : [];
  const own = (t.match(/<span class="tag offer">([^<]*)<\/span>/) || [, ''])[1];
  if (cards.length === 1 && own && cards[0] !== own && LABEL[cards[0]]) {
    t = t.replace(`<span class="tag offer">${own}</span>`, () => `<span class="tag offer">${cards[0]}</span>`);
    n.tag++;
    t = t.replace(/(class="floatcard"><div class="info"><span>[^<]*<\/span><div class="div"><\/div><span>)[^<]*(<\/span>)/, (m, a, b) => { n.label++; return a + LABEL[cards[0]] + b; });
  }

  // singapore-solo-escape is a single-traveller trip: no 7-guest minimum
  if (slug === 'singapore-solo-escape') {
    t = t.replace('Guaranteed to operate with a minimum of 7 guests', () => { n.solo++; return 'Private, tailor-made departures on your dates'; });
  } else {
    // 2. group size + departures
    for (const [a, b] of GROUP_ROW) { const cell = `<td>Group Size</td><td>${a}</td>`; if (t.includes(cell)) { n.row++; t = t.split(cell).join(`<td>Group Size</td><td>${b}</td>`); } }
    t = t.replace('<h4>Guaranteed Departures</h4><p>This is a solo, tailor-made journey</p>', () => { n.dep++; return '<h4>Guaranteed Departures</h4><p>Private, tailor-made departures on your dates, or join a small group</p>'; });
    t = t.replace('<h4>Guaranteed Departures</h4><p>This is a private, tailor-made journey</p>', () => { n.dep++; return '<h4>Guaranteed Departures</h4><p>Private, tailor-made departures on your dates, or join a small group</p>'; });
  }
  // 3. claims
  for (const [a, b] of CLAIMS) if (t.includes(a)) { t = t.split(a).join(b); n.claim++; }

  if (t !== orig) fs.writeFileSync(p, t);
}
console.log(n);
