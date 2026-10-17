import Link from 'next/link';
import { signOut } from '../actions';

const NAV = [
  ['/admin', 'Overview', 'overview'],
  ['/admin/enquiries', 'Enquiries', 'enquiries'],
  ['/admin/service-requests', 'Service requests', 'service_requests'],
  ['/admin/subscribers', 'Subscribers', 'newsletter_subscribers'],
];

// Top bar + page width for every signed-in admin screen.
export default function Shell({ user, current, children }) {
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
          <span>{user.email}</span>
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>
      </header>
      <main className="ad-main">{children}</main>
    </>
  );
}
