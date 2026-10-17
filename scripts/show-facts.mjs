import fs from 'node:fs';
const f = JSON.parse(fs.readFileSync('.backup/package-facts.json', 'utf8'));
const ASIA = ['bali-', 'cambodia-', 'china-', 'japan-', 'malaysia-', 'malayan-', 'philippines-', 'singapore-', 'thailand-', 'vietnam-'];
const IO = ['maldives-', 'mauritius-', 'seychelles-', 'srilanka-', 'zanzibar-'];
const EU = ['croatia-', 'france-', 'greece-', 'italy-', 'netherlands-', 'spain-', 'switzerland-', 'turkey-'];
const region = (s) => /^egypt-/.test(s) ? 'egypt' : /^morocco-/.test(s) ? 'morocco' : ASIA.some((p) => s.startsWith(p)) ? 'asia' : IO.some((p) => s.startsWith(p)) ? 'io' : EU.some((p) => s.startsWith(p)) ? 'europe' : /^dubai-/.test(s) ? 'dubai' : /^new-zealand/.test(s) ? 'oceania' : 'africa';
const want = process.argv[2], from = +process.argv[3] || 0, to = +process.argv[4] || 999;
const list = Object.keys(f).filter((s) => region(s) === want).slice(from, to);
console.log(`${want}: ${Object.keys(f).filter((s) => region(s) === want).length} total, showing ${from}-${Math.min(to, from + list.length)}`);
for (const s of list) {
  const p = f[s]; const g = (p.tags.find((x) => /GROUP|PRIVATE|FAMILY|HONEYMOON|ADVENTURE|CONSERVATION|PHOTOGRAPHY|EXPEDITION|ROMANCE|CULTURE|WELLNESS|ISLANDS|SAFARI/i.test(x) && !/OFFERS/.test(x)) || '');
  console.log(`\n## ${s} | ${p.title} | ${p.stats} | ${g} | ${p.days} days`);
  console.log('route: ' + p.locs.join(' > '));
  console.log('stays: ' + p.stays.join('; '));
  p.high.slice(0, 6).forEach((h) => console.log(' *', h.slice(0, 120)));
  console.log('days: ' + p.dayTitles.slice(0, 8).map((d) => d.slice(0, 48)).join(' / '));
}
