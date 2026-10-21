import { createHash } from 'node:crypto';
import { site } from './site.mjs';

// Helpers for the anonymous visit counter (used by app/api/track/route.js).
// Nothing personal is stored: the visitor code below is a one-way hash that changes every day, so nobody can be followed
// from one day to the next and the original IP address and browser details cannot be recovered from it.

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|java\/|go-http|axios|node-fetch|okhttp|httpclient|scrapy|phantom|selenium|puppeteer|playwright|archive|feed|fetch|validator|checker|scanner|semrush|ahrefs|mj12|dotbot|bytespider|petalbot|yandex|baidu|duckduckbot|applebot|whatsapp|telegrambot|discord|skype|embedly|quora link|vkshare|w3c|netcraft/i;

export function isBot(ua) {
  return !ua || ua.length < 12 || BOT.test(ua);
}

export function deviceOf(ua) {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function browserOf(ua) {
  if (/edg(e|a|ios)?\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios|chromium/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

// Where the visit came from, in plain words.
const SOURCES = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(yahoo\.com|search\.yahoo\.)/, 'yahoo'],
  [/(^|\.)(ecosia\.org|startpage\.com|brave\.com|yandex\.|baidu\.com)/, 'other search'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com)$/, 'facebook'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(tiktok\.com)$/, 'tiktok'],
  [/(^|\.)(pinterest\.)/, 'pinterest'],
];

export function referrerHost(ref) {
  try {
    const host = new URL(ref).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || host === site.domain || host.endsWith(`.${site.domain}`) || host === 'localhost') return null; // our own pages are not a "source"
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

export function sourceOf(host, utm) {
  const clean = String(utm || '').toLowerCase().replace(/[^a-z0-9 _.-]/g, '').slice(0, 30);
  if (clean) return clean;
  if (!host) return 'direct';
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return 'other websites';
}

// The same page can be reached as /safari, /safari.html or /safari/; the homepage has two addresses too. Count each page once.
export function cleanPath(p) {
  let path = String(p || '/').split('?')[0].split('#')[0];
  try { path = decodeURI(path); } catch { /* keep as sent */ }
  path = path.replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  if (path === '/finders-safaris-homepage' || path === '/index') path = '/';
  if (!path.startsWith('/')) path = `/${path}`;
  return path.slice(0, 300);
}

export function visitorCode(ip, ua) {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT || process.env.NEXT_PUBLIC_SUPABASE_URL || 'finders-keepers';
  return createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex').slice(0, 32);
}

// Country, when the hosting network tells us (it is a standard header on most hosts; blank when it does not).
export function countryOf(headers) {
  for (const name of ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-country-code', 'x-geo-country', 'x-country']) {
    const v = (headers.get(name) || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== 'XX' && v !== 'T1') return v;
  }
  return null;
}
