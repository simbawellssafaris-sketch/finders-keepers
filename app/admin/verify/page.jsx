import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import VerifyForm from '../_components/VerifyForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enter your code | Admin' };

// Second step of signing in, shown only to people who have switched on two-factor login.
export default async function Verify() {
  const { twoFactorOn, aal } = await requireAdmin({ partial: true });
  if (!twoFactorOn || aal === 'aal2') redirect('/admin');
  return (
    <main className="ad-login">
      <h1>Enter your code</h1>
      <p className="ad-sub">Open your authenticator app and type the 6-digit code for Finders &amp; Keepers.</p>
      <VerifyForm />
    </main>
  );
}
