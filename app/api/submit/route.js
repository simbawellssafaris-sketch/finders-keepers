import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { sendSubmissionEmail, sendWelcomeEmail } from '../../../lib/notify-email';

// Server route (server build only): saves a website form to Supabase, then emails the business.
// The browser tries this first and falls back to saving straight to Supabase when it is not available
// (for example on the static export), so a submission is never lost.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only these columns can be written; anything else the browser sends (status, id, ...) is dropped.
const COLUMNS = {
  enquiries: ['name', 'phone', 'email', 'travellers', 'preferred_date', 'interest', 'package', 'notes', 'source_page'],
  service_requests: ['service', 'name', 'email', 'phone', 'travellers', 'details', 'source_page'],
  newsletter_subscribers: ['email', 'first_name', 'last_name', 'source', 'source_page'],
};

// Checks that keep spam out of the inbox: a hidden trap field (filtered in the browser), submitting too fast after the page
// opened, and Cloudflare Turnstile when its keys are configured. A refused check answers 403; the browser then still saves the
// row to Supabase (so a real person is never lost) but nothing is emailed.
const MIN_AGE_MS = 1500;

async function passesTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured: rely on the other checks
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: String(token), ...(ip !== 'unknown' ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('Turnstile check unavailable, letting the submission through:', e && e.message);
    return true; // Cloudflare unreachable: do not block real customers
  }
}

// Simple per-visitor limit (kept in memory, resets on restart): 8 submissions per 10 minutes.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

export async function POST(request) {
  // Browsers label requests started by another website "cross-site"; only this site's own pages may use the route.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ ok: false }, { status: 403 });
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const table = body && body.table;
  const row = body && body.row;
  if (!COLUMNS[table] || !row || typeof row !== 'object') return NextResponse.json({ ok: false }, { status: 400 });

  if (typeof body.age !== 'number' || body.age < MIN_AGE_MS) return NextResponse.json({ ok: false, error: 'Too fast' }, { status: 403 });
  if (!(await passesTurnstile(body.ts, ip))) return NextResponse.json({ ok: false, error: 'Verification failed' }, { status: 403 });

  const clean = {};
  for (const key of COLUMNS[table]) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') clean[key] = row[key];
  }

  const supabase = await createClient();
  let { error } = await supabase.from(table).insert(clean);
  // a network hiccup between this server and Supabase has no database error code: try once more before giving up
  if (error && !error.code) ({ error } = await supabase.from(table).insert(clean));
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, saved: true, duplicate: true }); // already subscribed
    const refused = /^(22|23|42)/.test(error.code || ''); // the database will never accept this data
    console.error('Submission not saved:', error.message);
    return NextResponse.json({ ok: false }, { status: refused ? 400 : 502 });
  }

  let emailed = false;
  try {
    emailed = await sendSubmissionEmail(table, clean);
  } catch (e) {
    console.error('Email failed (submission is saved):', e && e.message);
  }
  // a brand-new subscriber gets a short welcome (repeat sign-ups returned above, so nobody can be emailed twice)
  let welcomed = false;
  if (table === 'newsletter_subscribers') {
    try {
      welcomed = await sendWelcomeEmail(clean.email, clean.first_name);
    } catch (e) {
      console.error('Welcome email failed (subscriber is saved):', e && e.message);
    }
  }
  return NextResponse.json({ ok: true, saved: true, emailed, welcomed });
}
