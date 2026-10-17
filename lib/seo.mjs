// Fills in what pages are missing for search engines and social sharing, and fixes accessibility gaps.
// It only ADDS: a tag the page already has is never changed, except share images that pointed at Unsplash
// and over-long titles. Pages can still write their own tags and they win.
import { decodeHTML } from 'entities';
import { site } from './site.mjs';

const HOME = 'finders-safaris-homepage';
export const DEFAULT_OG_IMAGE = 'assets/img/og-default.jpg';

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => decodeHTML(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const origin = () => `https://${site.domain}`;

export const pageUrl = (name) => (name === HOME ? `${origin()}/` : `${origin()}/${name}.html`);

const headOf = (raw) => (raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1];
const metaContent = (head, key) => {
  const m = head.match(new RegExp(`<meta[^>]*(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i')) ||
            head.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`, 'i'));
  return m ? decodeHTML(m[1]) : '';
};

export function titleOf(raw) {
  const m = headOf(raw).match(/<title>([\s\S]*?)<\/title>/i);
  return m ? decodeHTML(m[1]).trim() : '';
}

// "Page name | Finders & Keepers Safaris" -> "Page name | Finders & Keepers" (or just "Page name") when too long for Google.
export function shortTitle(title) {
  if (title.length <= 65) return title;
  const suffix = /\s*[|—–-]\s*(?:Finders & Keepers Safaris|Finders &amp; Keepers Safaris)\s*$/i;
  const hadSuffix = suffix.test(title);
  const core = hadSuffix ? title.replace(suffix, '').trim() : title;
  if (hadSuffix && `${core} | ${site.brandShort}`.length <= 65) return `${core} | ${site.brandShort}`;
  if (core.length <= 65) return core;
  // Still too long: keep the part before the dash, else cut at a word.
  const beforeDash = core.split(/\s+[—–]\s+/)[0];
  if (beforeDash.length >= 25 && beforeDash.length <= 65) return beforeDash;
  return core.slice(0, 62).replace(/\s+\S*$/, '') + '…';
}

// First proper paragraph of the page's own content (skipping menus, pop-ups and footers).
export function describe(raw, title) {
  const body = raw.slice(raw.search(/<body/i));
  const start = [body.search(/<main[\s>]/i), body.search(/<section[\s>]/i), body.search(/class="[^"]*hero/i)].filter((i) => i >= 0);
  let region = body.slice(start.length ? Math.min(...start) : 0);
  const cut = region.search(/<footer[\s>]|id="enqOverlay"/i);
  if (cut > 0) region = region.slice(0, cut);
  const priority = [/<p[^>]*class="[^"]*(?:lead|intro|sub|summary)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi, /<p[^>]*>([\s\S]*?)<\/p>/gi];
  for (const re of priority) {
    for (const m of region.matchAll(re)) {
      const t = text(m[1]).replace(/^(?:Overview|Introduction)\s+/i, '');
      if (t.length >= 70 && !/^[ⓘ©]/.test(t) && !/^prices are/i.test(t)) return clip(t, 158);
    }
  }
  return clip(`${title.replace(/\s*[|—–-]\s*Finders.*$/i, '')}. Private, tailor-made journeys across Africa and beyond with ${site.brand}.`, 158);
}

function clip(t, max) {
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sentence = cut.match(/^(.{80,}?[.!?])\s/);
  const s = sentence ? sentence[1] : cut.replace(/\s+\S*$/, '');
  return s.length >= 80 && s.length <= max ? (/[.!?]$/.test(s) ? s : s + '…') : cut.replace(/\s+\S*$/, '') + '…';
}

// Best picture for a share preview: the page's own hero, else its first real photo, else the site default.
export function pickImage(raw) {
  const head = headOf(raw);
  const body = raw.slice(raw.search(/<body/i));
  const local = (u) => u && /^assets\/img\//.test(u) && !/logo|icon|favicon|og-default/i.test(u);
  const tryRe = (src, re) => { for (const m of src.matchAll(re)) if (local(m[1])) return m[1]; return null; };
  return (
    tryRe(body, /class="hero"[^>]*url\(['"]?(assets\/[^'")]+)/g) ||
    tryRe(head, /\.hero\{[^}]*url\(['"]?(assets\/[^'")]+)/g) ||
    tryRe(body, /class="[^"]*hero[^"]*"[^>]*style="[^"]*url\(['"]?(assets\/[^'")]+)/g) ||
    tryRe(body, /<img[^>]*class="[^"]*hero[^"]*"[^>]*src="(assets\/[^"]+)"/g) ||
    tryRe(body, /<img[^>]*src="(assets\/img\/[^"]+)"/g) ||
    tryRe(body, /url\(['"]?(assets\/img\/[^'")]+)/g) ||
    DEFAULT_OG_IMAGE
  );
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

// Alt text for pictures that have none: the card title that follows, else the page heading.
function fixAlt(body, pageTitle) {
  // never touch text inside <script> / <style> blocks (it may be code that builds markup)
  return body.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/i).map((part, i) => (i % 2 ? part : fixAltIn(part, pageTitle))).join('');
}

function fixAltIn(segment, pageTitle) {
  const pageName = pageTitle.replace(/\s*[|—–-]\s*Finders.*$/i, '').trim();
  return segment.replace(/<img\b([^>]*?)(\/?)>/g, (tag, attrs, slash, offset) => {
    if (/\balt=/.test(attrs) || /aria-hidden="true"/.test(attrs)) return tag;
    const after = segment.slice(offset + tag.length, offset + tag.length + 900);
    const before = segment.slice(Math.max(0, offset - 600), offset);
    const h = after.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i) || [...before.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].pop();
    let alt = h ? text(h[1]) : pageName;
    if (!alt) alt = site.brand;
    alt = alt.slice(0, 120);
    return `<img${attrs} alt="${esc(alt)}"${slash}>`;
  });
}

export function enrichPage(name, raw) {
  const headEnd = raw.search(/<\/head>/i);
  if (headEnd < 0) return raw;
  let head = raw.slice(0, headEnd);
  let rest = raw.slice(headEnd);

  // 1. title (only when too long)
  const title = titleOf(raw);
  const short = shortTitle(title);
  if (short !== title) head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(short)}</title>`);
  const finalTitle = short || title;

  // 2. share image: use the page's own photo; never a remote placeholder
  const img = pickImage(raw);
  const imgUrl = `${origin()}/${encPath(img)}`;
  const desc = metaContent(headOf(raw), 'description') || describe(raw, finalTitle);
  const url = pageUrl(name);
  const has = (re) => re.test(head);

  // replace remote placeholder images in existing share tags
  head = head.replace(/(<meta[^>]*(?:og:image|twitter:image)[^>]*content=["'])https:\/\/images\.unsplash\.com[^"']*(["'])/gi, `$1${imgUrl}$2`);

  // social sites need a full web address for share images
  head = head.replace(/(<meta[^>]*(?:og:image|twitter:image)[^>]*content=["'])(?!https?:\/\/)([^"']+)(["'])/gi, (m, pre, src, post) => `${pre}${origin()}/${encPath(src.replace(/^\//, ''))}${post}`);

  const add = [];
  if (!has(/<meta[^>]*name=["']description["']/i)) add.push(`<meta name="description" content="${esc(desc)}">`);
  if (name === HOME) head = head.replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, '');
  if (!has(/<link[^>]*rel=["']canonical["']/i)) add.push(`<link rel="canonical" href="${esc(url)}">`);
  const og = (p, c) => { if (!has(new RegExp(`<meta[^>]*property=["']${p}["']`, 'i'))) add.push(`<meta property="${p}" content="${esc(c)}">`); };
  og('og:type', 'website'); og('og:site_name', site.brand); og('og:title', finalTitle); og('og:description', desc); og('og:url', url); og('og:image', imgUrl);
  const tw = (n, c) => { if (!has(new RegExp(`<meta[^>]*name=["']${n}["']`, 'i'))) add.push(`<meta name="${n}" content="${esc(c)}">`); };
  tw('twitter:card', 'summary_large_image'); tw('twitter:title', finalTitle); tw('twitter:description', desc); tw('twitter:image', imgUrl);
  if (name === HOME) head = head.replace(/(<meta[^>]*property=["']og:url["'][^>]*content=["'])[^"']*(["'])/i, `$1${esc(url)}$2`);

  head += add.join('\n');

  // 3. alt text
  rest = fixAlt(rest, finalTitle);
  return head + rest;
}

// Title / description / picture for a page, as used by the search index and the sitemap.
export function pageMeta(name, raw) {
  const title = shortTitle(titleOf(raw));
  const description = metaContent(headOf(raw), 'description') || describe(raw, title);
  return { title, description, image: pickImage(raw) };
}
