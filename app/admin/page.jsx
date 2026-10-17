import Link from 'next/link';
import { requireAdmin } from '../../lib/admin/auth';
import { getStaff } from '../../lib/admin/staff';
import { fmtDate, fmtDay, todayNairobi } from '../../lib/admin/format';
import { serviceLabel, STATUS_LABELS, OPEN_STATUSES } from '../../lib/admin/config';
import Shell from './_components/Shell';

export const dynamic = 'force-dynamic';

const count = async (q) => (await q).count || 0;

export default async function Overview() {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  const { names } = await getStaff(supabase);
  const today = todayNairobi();
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const head = (t) => supabase.from(t).select('*', { count: 'exact', head: true });

  const [newEnq, newSvc, subs, enq7, svc7, subs7, mineEnq, mineSvc, dueEnq, dueSvc, recentEnq, recentSvc] = await Promise.all([
    count(head('enquiries').eq('status', 'new')),
    count(head('service_requests').eq('status', 'new')),
    count(head('newsletter_subscribers').eq('subscription', 'subscribed')),
    count(head('enquiries').gte('created_at', week)),
    count(head('service_requests').gte('created_at', week)),
    count(head('newsletter_subscribers').gte('created_at', week)),
    count(head('enquiries').eq('assigned_to', user.id).in('status', OPEN_STATUSES)),
    count(head('service_requests').eq('assigned_to', user.id).in('status', OPEN_STATUSES)),
    supabase.from('enquiries').select('id,name,status,follow_up_on,assigned_to').not('follow_up_on', 'is', null).lte('follow_up_on', today).in('status', OPEN_STATUSES).order('follow_up_on').limit(12),
    supabase.from('service_requests').select('id,name,service,status,follow_up_on,assigned_to').not('follow_up_on', 'is', null).lte('follow_up_on', today).in('status', OPEN_STATUSES).order('follow_up_on').limit(12),
    supabase.from('enquiries').select('id,name,package,interest,status,created_at,channel').order('created_at', { ascending: false }).limit(6),
    supabase.from('service_requests').select('id,name,service,status,created_at').order('created_at', { ascending: false }).limit(6),
  ]);

  const due = [
    ...(dueEnq.data || []).map((r) => ({ ...r, kind: 'Enquiry', href: `/admin/enquiries/${r.id}` })),
    ...(dueSvc.data || []).map((r) => ({ ...r, kind: serviceLabel(r.service), href: `/admin/service-requests/${r.id}` })),
  ].sort((a, b) => a.follow_up_on.localeCompare(b.follow_up_on)).slice(0, 12);

  const recent = [
    ...(recentEnq.data || []).map((r) => ({ ...r, kind: 'Enquiry', href: `/admin/enquiries/${r.id}`, about: r.package || r.interest || '' })),
    ...(recentSvc.data || []).map((r) => ({ ...r, kind: 'Service request', href: `/admin/service-requests/${r.id}`, about: serviceLabel(r.service) })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  return (
    <Shell ctx={ctx} current="overview">
      <h1>Overview</h1>
      <p className="ad-sub">What needs your attention, and what has come in this week.</p>

      <div className="ad-grid">
        <div className="ad-card"><div className="n">{newEnq}</div><div className="l">New enquiries</div><Link href="/admin/enquiries?filter=new">Review them &rarr;</Link></div>
        <div className="ad-card"><div className="n">{newSvc}</div><div className="l">New service requests</div><Link href="/admin/service-requests?filter=new">Review them &rarr;</Link></div>
        <div className="ad-card"><div className="n">{mineEnq + mineSvc}</div><div className="l">Open and assigned to you</div><Link href="/admin/enquiries?assignee=me">See yours &rarr;</Link></div>
        <div className="ad-card"><div className="n">{subs}</div><div className="l">Newsletter subscribers</div><Link href="/admin/subscribers">View list &rarr;</Link></div>
      </div>

      <div className="ad-panel">
        <h2>Follow-ups due</h2>
        {due.length ? (
          <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
            <table className="ad-table">
              <thead><tr><th>Follow up</th><th>Who</th><th>Type</th><th>Assigned</th><th>Status</th></tr></thead>
              <tbody>
                {due.map((r) => (
                  <tr key={`${r.kind}${r.id}`}>
                    <td className={r.follow_up_on < today ? 'ad-due' : ''}>{fmtDay(r.follow_up_on)}{r.follow_up_on < today ? ' (overdue)' : ' (today)'}</td>
                    <td><Link href={r.href}><strong>{r.name || '(no name)'}</strong></Link></td>
                    <td>{r.kind}</td>
                    <td>{r.assigned_to ? <span className="ad-chip">{names[r.assigned_to] || 'Former staff'}</span> : <span style={{ color: 'var(--muted)' }}>&mdash;</span>}</td>
                    <td><span className={`badge st-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ margin: 0, color: 'var(--muted)' }}>Nothing is due. Set a &ldquo;Follow up on&rdquo; date on an enquiry and it will appear here when the day comes.</p>}
      </div>

      <div className="ad-panel">
        <h2>Last 7 days</h2>
        <p style={{ margin: 0 }}><strong>{enq7}</strong> enquiries &nbsp;&middot;&nbsp; <strong>{svc7}</strong> service requests &nbsp;&middot;&nbsp; <strong>{subs7}</strong> new subscribers</p>
      </div>

      <div className="ad-panel">
        <h2>Latest activity</h2>
        {recent.length ? (
          <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
            <table className="ad-table">
              <thead><tr><th>Received</th><th>Type</th><th>Name</th><th>About</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={`${r.kind}${r.id}`}>
                    <td className="when">{fmtDate(r.created_at)}</td>
                    <td>{r.kind}</td>
                    <td><Link href={r.href}><strong>{r.name || '(no name)'}</strong></Link></td>
                    <td>{r.about}</td>
                    <td><span className={`badge st-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ margin: 0, color: 'var(--muted)' }}>Nothing yet. New enquiries and requests from the website will appear here.</p>}
      </div>
    </Shell>
  );
}
