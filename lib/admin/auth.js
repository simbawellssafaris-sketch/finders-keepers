import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

// A network hiccup between this server and Supabase is not the same as "not signed in": retry once, and if it still fails,
// show an error page instead of throwing a signed-in admin back to the login screen.
const isNetworkError = (error) => Boolean(error) && (error.name === 'AuthRetryableFetchError' || /fetch failed|network|timeout/i.test(error.message || ''));

async function withRetry(run) {
  let result = await run();
  if (isNetworkError(result.error)) result = await run();
  return result;
}

// Every admin page, action and download calls this first. It is the real lock on the dashboard:
//  1. the visitor must be signed in (the session is re-checked with Supabase, not just read from the cookie), and
//  2. their account must be on the `admins` list.
// The database enforces the same rule with row level security, so even a mistake here could not leak customer data.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await withRetry(() => supabase.auth.getUser());
  if (isNetworkError(error)) throw new Error('Could not reach the sign-in service. Please reload the page.');
  if (error || !data.user) redirect('/admin/login');

  const { data: admin, error: adminError } = await withRetry(() => supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle());
  if (adminError) throw new Error('Could not verify admin access. Please reload the page.');
  if (!admin) {
    await supabase.auth.signOut();
    redirect('/admin/login?error=denied');
  }
  return { supabase, user: data.user };
}

// Simple limit on login attempts per visitor (kept in memory; resets when the server restarts): 8 per 15 minutes.
const attempts = new Map();
export function loginLimited(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < 900000);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 2000) attempts.clear();
  return recent.length > 8;
}
