import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { serverIdleMs, IDLE_COOKIE } from './lib/admin/idle';

// First gate for /admin: no valid sign-in, no page. (Every admin page and action ALSO re-checks, and the database enforces
// the same rule, so this is one of three locks, not the only one.) It also keeps the session fresh, signs out a dashboard
// that has sat unused for too long, and tells search engines and browsers never to index or cache anything under /admin.
// Not used in the static export (a plain-files site has no server); build-static.mjs sets this file aside while it builds.

// Pages that work without being signed in (the password-reset pages must, because the person has forgotten the password).
const PUBLIC = new Set(['/admin/login', '/admin/forgot', '/admin/reset']);

export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === 'production' })
        );
        Object.entries(headers || {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not put code between createServerClient and getClaims (Supabase's rule for keeping sessions stable).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data && data.claims);
  const path = request.nextUrl.pathname;
  const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/admin', secure: process.env.NODE_ENV === 'production' };

  const goTo = (to) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set('Cache-Control', 'no-store');
    redirect.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirect;
  };

  if (!signedIn && !PUBLIC.has(path)) return goTo('/admin/login');
  // (A signed-in visitor on the login page is sent on by the page itself, after it has checked the sign-in with Supabase.
  // The proxy only reads the cookie, which can outlive the account or session, and redirecting here could loop.)

  if (signedIn) {
    // Idle check: the browser sends a "still here" signal while someone is working, so a long gap means nobody is there.
    const seen = Number(request.cookies.get(IDLE_COOKIE)?.value);
    if (seen && Date.now() - seen > serverIdleMs()) {
      try {
        const { data: who } = await supabase.from('admins').select('display_name, role').eq('user_id', data.claims.sub).maybeSingle();
        if (who) {
          await supabase.from('activity_log').insert({
            actor: data.claims.sub, actor_name: who.display_name || (who.role === 'admin' ? 'Owner' : 'Staff'),
            entity_table: 'admins', entity_id: data.claims.sub, action: 'session_timed_out', details: {},
          });
        }
      } catch {
        // history is best effort; signing out matters more
      }
      await supabase.auth.signOut({ scope: 'local' });
      const out = goTo('/admin/login?expired=1');
      out.cookies.set(IDLE_COOKIE, '', { ...cookieOptions, maxAge: 0 });
      return out;
    }
    // Page prefetching is not a person being active, so it does not count.
    const prefetch = request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
    if (!prefetch) response.cookies.set(IDLE_COOKIE, String(Date.now()), { ...cookieOptions, maxAge: 60 * 60 * 24 });
  }

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
