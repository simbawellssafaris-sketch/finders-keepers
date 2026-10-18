import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import ResetForm from '../../_components/ResetForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New password | Admin' };

export default async function NewPassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data || !data.user) redirect('/admin/forgot?error=link');
  const twoFactor = (data.user.factors || []).some((f) => f.status === 'verified');
  return (
    <main className="ad-login">
      <h1>Choose a new password</h1>
      <p className="ad-sub">Use at least 12 characters. After you save it you will be asked to sign in again, on every device.</p>
      <ResetForm twoFactor={twoFactor} />
    </main>
  );
}
