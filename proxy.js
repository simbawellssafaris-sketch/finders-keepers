import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// First gate for /admin: no valid sign-in, no page. (Every admin page and action ALSO re-checks, and the database enforces
// the same rule, so this is one of three locks, not the only one.) It also keeps the session fresh and tells search engines
// and browsers never to index or cache anything under /admin.
// Not used in the static export (a plain-files site has no server); build-static.mjs sets this file aside while it builds.
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

  const goTo = (to) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set('Cache-Control', 'no-store');
    redirect.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return redirect;
  };

  if (!signedIn && path !== '/admin/login') return goTo('/admin/login');
  if (signedIn && path === '/admin/login') return goTo('/admin');

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
