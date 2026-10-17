import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client for route handlers and server actions (server build only).
// Not imported by any page yet: using cookies() would make a page dynamic, and the pages are pre-built for speed
// and for the static export. Use it for the admin page and server-side emails when those are added.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component, where cookies are read-only; safe to ignore without auth sessions
        }
      },
    },
  });
}
