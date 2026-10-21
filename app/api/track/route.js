import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isBot, deviceOf, browserOf, referrerHost, sourceOf, cleanPath, visitorCode, countryOf } from '../../../lib/visits';

// Counts a page view for the Visitors page of the dashboard (server build only; the static export has no server, so it counts nothing).
// Private by design: no cookies, no IP address and no browser details are stored, only a one-way daily code.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

// Simple limit per visitor (kept in memory, resets on restart): 120 page views per 10 minutes.
const hits = new Map();
function tooMany(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 8000) hits.clear();
  return recent.length > 120;
}

let client;
function db() {
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function POST(request) {
  // Only this site's own pages may report a visit.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ ok: false }, { status: 403 });

  const ua = request.headers.get('user-agent') || '';
  if (isBot(ua)) return NO_CONTENT();
  // Team members signed in to the dashboard are not visitors.
  if (/(^|;\s*)sb-[^=]*-auth-token/.test(request.headers.get('cookie') || '')) return NO_CONTENT();

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return NO_CONTENT();

  let body = null;
  try { body = JSON.parse(await request.text()); } catch { body = null; }
  if (!body || typeof body.p !== 'string') return NO_CONTENT();

  const path = cleanPath(body.p);
  if (/^\/(admin|api|unsubscribe|_next)(\/|$)/.test(path)) return NO_CONTENT();

  const host = referrerHost(typeof body.r === 'string' ? body.r : '');
  const row = {
    path,
    referrer_host: host,
    source: sourceOf(host, typeof body.u === 'string' ? body.u : ''),
    visitor: visitorCode(ip, ua),
    device: deviceOf(ua),
    browser: browserOf(ua),
    country: countryOf(request.headers),
  };

  const { error } = await db().from('page_views').insert(row);
  if (error) console.error('Could not record a visit:', error.message);
  return NO_CONTENT();
}
