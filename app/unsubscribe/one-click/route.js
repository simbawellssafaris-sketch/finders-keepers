import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { loginLimited } from '../../../lib/admin/auth';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Gmail's and Apple Mail's own "Unsubscribe" button POSTs here (the List-Unsubscribe-Post header, RFC 8058).
export async function POST(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (loginLimited(ip, 'unsub')) return new NextResponse(null, { status: 429 });
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!UUID.test(token)) return new NextResponse(null, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unsubscribe_by_token', { t: token });
  if (error) return new NextResponse(null, { status: 502 });
  return new NextResponse(null, { status: data ? 200 : 404 });
}

// Opening the address in a browser just shows the normal confirm page.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('t') || '';
  return NextResponse.redirect(new URL(`/unsubscribe${UUID.test(token) ? `?t=${token}` : ''}`, request.url), 303);
}
