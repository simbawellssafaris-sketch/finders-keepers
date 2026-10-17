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
//  1. the visitor must be signed in (the session is re-checked with Supabase, not just read from the cookie),
//  2. their account must be on the `admins` list (this also gives us their role: 'admin' or 'staff'), and
//  3. if they have switched on two-factor login, they must have entered their 6-digit code for this session.
// The database enforces the admins-list rule too (row level security), so a mistake here could not leak customer data.
//
// Options: { partial: true } is used only by the two-factor pages themselves, which must work before the code has been entered.
export async function requireAdmin({ partial = false } = {}) {
  const supabase = await createClient();
  const { data, error } = await withRetry(() => supabase.auth.getUser());
  if (isNetworkError(error)) throw new Error('Could not reach the sign-in service. Please reload the page.');
  if (error || !data.user) redirect('/admin/login');

  const { data: admin, error: adminError } = await withRetry(() =>
    supabase.from('admins').select('user_id, role, display_name').eq('user_id', data.user.id).maybeSingle()
  );
  if (adminError) throw new Error('Could not verify admin access. Please reload the page.');
  if (!admin) {
    await supabase.auth.signOut();
    redirect('/admin/login?error=denied');
  }

  // Is two-factor on? Read it from the fresh user record Supabase just returned (the copy stored in the session can be out of date).
  // Is this session already past the code step? That is in the session itself.
  const twoFactorOn = (data.user.factors || []).some((f) => f.status === 'verified');
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (twoFactorOn && (!aal || aal.currentLevel !== 'aal2') && !partial) redirect('/admin/verify');

  const name = admin.display_name || (admin.role === 'admin' ? 'Owner' : 'Staff');
  return { supabase, user: data.user, admin: { ...admin, name, isOwner: admin.role === 'admin' }, twoFactorOn, aal: aal ? aal.currentLevel : null };
}

// Owner-only actions (deleting, managing the team).
export async function requireOwner() {
  const ctx = await requireAdmin();
  if (!ctx.admin.isOwner) throw new Error('Only an owner can do this.');
  return ctx;
}

// Simple limit on attempts per visitor (kept in memory; resets when the server restarts): 8 per 15 minutes.
const attempts = new Map();
export function loginLimited(ip, bucket = 'login') {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < 900000);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 2000) attempts.clear();
  return recent.length > 8;
}
