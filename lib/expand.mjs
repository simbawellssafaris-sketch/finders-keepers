import fs from 'node:fs';
import path from 'node:path';
import { site } from './site.mjs';

const DIR = path.join(process.cwd(), 'content', 'shared');
const cache = new Map();

// {{brand}} -> "Finders & Keepers Safaris", {{BRAND}} -> same in capitals, {{phone}}, {{email}}, ... (see lib/site.mjs)
export function fill(html) {
  return html.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    if (key in site) return site[key];
    const match = Object.keys(site).find((k) => k.toLowerCase() === key.toLowerCase());
    if (match && key === key.toUpperCase()) return site[match].toUpperCase();
    throw new Error(`Unknown placeholder ${placeholder} (add it to lib/site.mjs)`);
  });
}

export function fragment(id) {
  if (!cache.has(id)) {
    const file = path.join(DIR, `${id}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing shared fragment "${id}" (content/shared/${id}.html)`);
    cache.set(id, fill(fs.readFileSync(file, 'utf8')));
  }
  return cache.get(id);
}

export function expandIncludes(html) {
  return html.replace(/<!--@include ([a-z0-9-]+)-->/g, (match, id) => fragment(id));
}

// A whole page file -> final HTML: business-detail placeholders filled, shared pieces inserted.
export function renderPage(raw) {
  return expandIncludes(fill(raw));
}
