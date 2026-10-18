import Link from 'next/link';
import { signOut } from '../actions';
import { idleMinutes } from '../../../lib/admin/idle';
import IdleWatcher from './IdleWatcher';
import NavMenu from './NavMenu';

// Every section of the dashboard, grouped for the menu. Owner-only items are left out for staff.
function menuGroups(isOwner) {
  const groups = [
    { title: 'Home', links: [{ href: '/admin', label: 'Overview', key: 'overview' }] },
    { title: 'Customers', links: [
      { href: '/admin/enquiries', label: 'Enquiries', key: 'enquiries' },
      { href: '/admin/service-requests', label: 'Service requests', key: 'service_requests' },
      { href: '/admin/clients', label: 'Clients', key: 'clients' },
    ] },
    { title: 'Sales and money', links: [
      { href: '/admin/quotations', label: 'Quotations', key: 'quotations' },
      { href: '/admin/bookings', label: 'Bookings', key: 'bookings' },
      { href: '/admin/invoices', label: 'Invoices', key: 'invoices' },
      { href: '/admin/payments', label: 'Payments', key: 'payments' },
    ] },
    { title: 'Insights', links: [
      { href: '/admin/reports', label: 'Reports', key: 'reports' },
      ...(isOwner ? [{ href: '/admin/activity', label: 'Activity history', key: 'activity' }] : []),
    ] },
    { title: 'The Journal', links: [
      { href: '/admin/subscribers', label: 'Subscribers', key: 'newsletter_subscribers' },
      { href: '/admin/newsletters', label: 'Newsletters', key: 'newsletters' },
    ] },
    { title: 'Account and team', links: [
      { href: '/admin/team', label: 'Team', key: 'team' },
      ...(isOwner ? [{ href: '/admin/settings', label: 'Business settings', key: 'settings' }] : []),
      { href: '/admin/security', label: 'Security and two-factor', key: 'security' },
    ] },
  ];
  return groups;
}

// Top bar + page width for every signed-in admin screen. `ctx` is what requireAdmin() returned.
export default function Shell({ ctx, current, children }) {
  return (
    <>
      <header className="ad-bar">
        <NavMenu groups={menuGroups(ctx.admin.isOwner)} current={current} />
        <Link href="/admin" className="ad-brand">Finders &amp; Keepers<small>Admin</small></Link>
        <span className="ad-spacer" />
        <div className="ad-user">
          <span>{ctx.admin.name}</span>
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>
      </header>
      {!ctx.twoFactorOn && current !== 'security' ? (
        <div className="ad-banner" role="note">
          Protect your account with a second step at sign-in. <Link href="/admin/security">Set up two-factor login &rarr;</Link>
        </div>
      ) : null}
      <main className="ad-main">{children}</main>
      <IdleWatcher minutes={idleMinutes()} />
    </>
  );
}
