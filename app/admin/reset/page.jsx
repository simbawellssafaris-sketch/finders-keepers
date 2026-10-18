import Link from 'next/link';
import { continueReset } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password | Admin' };

// The reset email links here. A button is needed to carry on, so a mail program that merely opens the link cannot use it up.
export default async function Reset({ searchParams }) {
  const sp = (await searchParams) || {};
  const tokenHash = typeof sp.token_hash === 'string' && sp.type === 'recovery' ? sp.token_hash.slice(0, 200) : '';
  const code = typeof sp.code === 'string' ? sp.code.slice(0, 200) : '';
  const bad = typeof sp.error_code === 'string' || (!tokenHash && !code);
  return (
    <main className="ad-login">
      <h1>Choose a new password</h1>
      {bad ? (
        <>
          <p className="ad-err" role="alert">This link is not valid any more. Reset links last one hour and work once.</p>
          <p style={{ marginTop: 18 }}><Link className="ad-btn" href="/admin/forgot">Request a new link</Link></p>
        </>
      ) : (
        <form action={continueReset} className="ad-form">
          <p className="ad-sub">Your link is ready. Press the button to carry on.</p>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="code" value={code} />
          <div className="ad-actions"><button className="ad-btn" type="submit">Continue</button></div>
        </form>
      )}
    </main>
  );
}
