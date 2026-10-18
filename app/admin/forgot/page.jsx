import Link from 'next/link';
import ForgotForm from '../_components/ForgotForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password | Admin' };

export default async function Forgot({ searchParams }) {
  const sp = (await searchParams) || {};
  return (
    <main className="ad-login">
      <h1>Forgot your password?</h1>
      <p className="ad-sub">Enter the email you sign in with and we will send you a link to choose a new one.</p>
      {sp.error === 'link' ? <p className="ad-err" role="alert">That link has expired or was already used. Request a new one below.</p> : null}
      <ForgotForm />
      <p style={{ marginTop: 18, fontSize: 14 }}><Link href="/admin/login">&larr; Back to sign in</Link></p>
    </main>
  );
}
