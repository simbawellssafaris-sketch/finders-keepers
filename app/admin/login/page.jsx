import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import LoginForm from '../_components/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | Admin' };

export default async function LoginPage({ searchParams }) {
  const sp = (await searchParams) || {};
  // Already signed in (checked with Supabase, not just the cookie)? Go straight to the dashboard.
  if (!sp.error && !sp.expired && !sp.reset) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data && data.user) redirect('/admin');
  }
  return (
    <main className="ad-login">
      <h1>Admin sign in</h1>
      <p className="ad-sub">Finders &amp; Keepers Safaris. Authorised staff only.</p>
      {sp.expired === '1' ? <p className="ad-banner" role="status" style={{ margin: '0 0 12px', padding: '10px 14px', textAlign: 'left' }}>You were signed out because the dashboard was left idle. Please sign in again.</p> : null}
      {sp.reset === '1' ? <p className="ad-ok" role="status">Your password was changed. Sign in with the new one.</p> : null}
      <LoginForm denied={sp.error === 'denied'} />
    </main>
  );
}
