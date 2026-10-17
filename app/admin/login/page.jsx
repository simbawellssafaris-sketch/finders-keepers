import LoginForm from '../_components/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | Admin' };

export default async function LoginPage({ searchParams }) {
  const sp = (await searchParams) || {};
  return (
    <main className="ad-login">
      <h1>Admin sign in</h1>
      <p className="ad-sub">Finders &amp; Keepers Safaris. Authorised staff only.</p>
      <LoginForm denied={sp.error === 'denied'} />
    </main>
  );
}
