// "Why this journey" section: the editable copy lives in content/why/*.json (one entry per package);
// this turns an entry into the page section. "When to go" is read from the page's own seasonal pricing.
import fs from 'node:fs';
import path from 'node:path';
import { decodeHTML } from 'entities';

const DIR = path.join(process.cwd(), 'content', 'why');
let cache = null;

function all() {
  if (!cache) {
    cache = {};
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
      Object.assign(cache, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
    }
  }
  return cache;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html) => decodeHTML(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function seasons(raw) {
  const rows = [];
  for (const m of raw.matchAll(/class="season-row"[^>]*>([\s\S]*?)<span class="season-price">/g)) {
    const label = (m[1].match(/class="season-label">([\s\S]*?)<\/span>/) || [, ''])[1];
    const badge = (m[1].match(/class="season-badge[^"]*">([\s\S]*?)<\/span>/) || [, ''])[1];
    const tag = (m[1].match(/class="season-tag">([\s\S]*?)<\/span>/) || [, ''])[1];
    if (label) rows.push({ months: text(label), kind: text(badge), note: text(tag) });
  }
  return rows.slice(0, 3);
}

const CSS = `<style>
.wj{padding:84px 0;background:var(--cream,#EDE3CE);border-top:1px solid var(--line,#CFC1A3);}
.wj .eyebrow{display:block;margin-bottom:14px;}
.wj h2{font-size:clamp(28px,3.4vw,40px);line-height:1.15;margin:0 0 18px;max-width:760px;}
.wj-lead{font-size:18px;line-height:1.7;color:var(--ink-soft,#5C5750);max-width:780px;margin:0 0 44px;}
.wj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
.wj-card{background:#fff;border-top:3px solid var(--terracotta,#B5572F);padding:30px 28px 32px;}
.wj-num{display:block;font-family:var(--serif,'Fraunces',Georgia,serif);font-size:34px;color:var(--terracotta,#B5572F);line-height:1;margin-bottom:16px;}
.wj-card h3{font-size:21px;line-height:1.25;margin:0 0 12px;}
.wj-card p{font-size:15.5px;line-height:1.75;color:var(--ink-soft,#5C5750);margin:0;}
.wj-when{margin-top:34px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;}
.wj-when>div{border:1px solid var(--line,#CFC1A3);padding:16px 18px;background:rgba(255,255,255,.55);}
.wj-when small{display:block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--terracotta-dark,#9C4926);font-weight:600;margin-bottom:6px;}
.wj-when b{display:block;font-size:16px;font-weight:600;margin-bottom:4px;}
.wj-when span{font-size:13.5px;line-height:1.55;color:var(--ink-soft,#5C5750);}
.wj-foot{margin-top:36px;display:flex;flex-wrap:wrap;gap:20px 36px;align-items:center;justify-content:space-between;}
.wj-for{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}
.wj-for>span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft,#5C5750);margin-right:4px;}
.wj-chip{font-size:13px;padding:8px 15px;border:1px solid var(--line,#CFC1A3);background:#fff;color:var(--ink,#2C2A26);}
@media(max-width:900px){.wj{padding:60px 0;}.wj-grid{grid-template-columns:1fr;}.wj-foot{flex-direction:column;align-items:flex-start;}}
</style>`;

export function whySectionHtml(name, raw) {
  const w = all()[name];
  if (!w) return '';
  const when = seasons(raw);
  const cards = w.reasons.map((r, i) => `<article class="wj-card"><span class="wj-num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(r.t)}</h3><p>${esc(r.d)}</p></article>`).join('');
  const whenHtml = when.length
    ? `<div class="wj-when">${when.map((s) => `<div><small>${esc(s.kind || 'Season')}</small><b>${esc(s.months)}</b><span>${esc(s.note)}</span></div>`).join('')}</div>`
    : '';
  const chips = (w.bestFor || []).map((c) => `<span class="wj-chip">${esc(c)}</span>`).join('');
  return `${CSS}
<section class="wj" id="why-journey">
  <div class="wrap">
    <span class="eyebrow">Why This Journey</span>
    <h2>What sets this journey apart</h2>
    <p class="wj-lead">${esc(w.lead)}</p>
    <div class="wj-grid">${cards}</div>
    ${whenHtml}
    <div class="wj-foot">
      <div class="wj-for"><span>Best for</span>${chips}</div>
      <a href="#" class="btn js-fs-enquire">Plan this journey with us &rarr;</a>
    </div>
  </div>
</section>`;
}
