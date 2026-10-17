import Link from 'next/link';
import { signOut } from '../actions';

const NAV = [
  ['/admin', 'Overview', 'overview'],
  ['/admin/enquiries', 'Enquiries', 'enquiries'],
  ['/admin/service-requests', 'Service requests', 'service_requests'],
  ['/admin/subscribers', 'Subscribers', 'newsletter_subscribers'],
  ['/admin/team', 'Team', 'team'],
];

// Top bar + page width for every signed-in admin screen. `ctx` is what requireAdmin() returned.
export default function Shell({ ctx, current, children }) {
  return (
    <>
      <header className="ad-bar">
        <Link href="/admin" className="ad-brand">Finders &amp; Keepers<small>Admin</small></Link>
        <nav className="ad-nav" aria-label="Admin">
          {NAV.map(([href, label, key]) => (
            <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="ad-user">
          <span>{ctx.admin.name}</span>
          <Link href="/admin/security" aria-current={current === 'security' ? 'page' : undefined}>Security</Link>
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>
      </header>
      {!ctx.twoFactorOn && current !== 'security' ? (
        <div className="ad-banner" role="note">
          Protect your account with a second step at sign-in. <Link href="/admin/security">Set up two-factor login &rarr;</Link>
        </div>
      ) : null}
      <main className="ad-main">{children}</main>
    </>
  );
}
