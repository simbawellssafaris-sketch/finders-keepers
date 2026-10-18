import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { quickCtx, logActivity } from '../../../lib/admin/staff';
import { IDLE_COOKIE } from '../../../lib/admin/idle';

export const dynamic = 'force-dynamic';

// The dashboard sends the browser here when nobody has touched it for the idle limit: sign this device out and say why.
export async function GET(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new NextResponse('Not found', { status: 404 });
  const supabase = await createClient();
  const ctx = await quickCtx(supabase);
  if (ctx) await logActivity(supabase, ctx, 'admins', ctx.user.id, 'session_timed_out', {});
  await supabase.auth.signOut({ scope: 'local' }); // only this device; other devices keep their own timers
  const res = NextResponse.redirect(new URL('/admin/login?expired=1', request.url));
  res.cookies.set(IDLE_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/admin', maxAge: 0, secure: process.env.NODE_ENV === 'production' });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
