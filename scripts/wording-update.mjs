// One-off wording change: "Speak To Us" and "Find Your Journey" everywhere (pages, shared pieces).
import fs from 'node:fs';
import path from 'node:path';
export const RULES = [
  [/SPEAK TO A (?:SAFARI |TRAVEL |CHINA )?SPECIALIST/g, 'SPEAK TO US'],
  [/Speak to a (?:safari|China) specialist/g, 'Speak to us'],
  [/Speak to a Destination Expert/g, 'Speak To Us'],
  [/>Ask a Specialist</g, '>Speak To Us<'],
  [/Our Safaris/g, 'Our Journeys'],
  [/Find Your Safari/g, 'Find Your Journey'],
  [/SPEAK TO US \| 0700 000 000/g, 'SPEAK TO US | {{phone}}'],
  [/Speak To A Specialist/g, 'Speak To Us'],
  [/([Ss])peak to a specialist/g, '$1peak to us'],
];
export const apply = (t) => RULES.reduce((s, [re, to]) => s.replace(re, to), t);

if (process.argv[1]?.endsWith('wording-update.mjs')) {
  const counts = Object.fromEntries(RULES.map(([re]) => [String(re), 0]));
  let files = 0;
  for (const dir of ['content/pages', 'content/shared']) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
      const p = path.join(dir, f); const t = fs.readFileSync(p, 'utf8'); let s = t;
      for (const [re, to] of RULES) { const n = (s.match(re) || []).length; counts[String(re)] += n; s = s.replace(re, to); }
      if (s !== t) { fs.writeFileSync(p, s); files++; }
    }
  }
  console.log('files changed:', files);
  console.log(counts);
}
