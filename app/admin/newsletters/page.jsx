import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDate } from '../../../lib/admin/format';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const LABELS = { draft: 'Draft', sending: 'Sending', sent: 'Sent' };

export default async function Newsletters() {
  const ctx = await requireAdmin();
  const [{ data: rows, error }, { count: subscribed }] = await Promise.all([
    ctx.supabase.from('newsletters').select('id, subject, status, total, created_at, sent_at').order('created_at', { ascending: false }).limit(200),
    ctx.supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('subscription', 'subscribed'),
  ]);
  return (
    <Shell ctx={ctx} current="newsletters">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Newsletters</h1>
          <p className="ad-sub">Write an issue of the Journal, send yourself a test, then send it to everyone who is subscribed ({subscribed || 0} right now). Every email carries an unsubscribe link.</p>
        </div>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="ad-btn ghost" href="/admin/subscribers">Subscribers</Link>
          <Link className="ad-btn" href="/admin/newsletters/new">+ New issue</Link>
        </span>
      </div>
      {error ? <div className="ad-empty">Could not load the newsletters. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">No issues yet. Press &ldquo;+ New issue&rdquo; to write the first one.</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead><tr><th>Subject</th><th>Status</th><th>Recipients</th><th>Created</th><th>Finished</th></tr></thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td><Link href={`/admin/newsletters/${n.id}`}><strong>{n.subject}</strong></Link></td>
                  <td><span className={`badge st-n-${n.status}`}>{LABELS[n.status]}</span></td>
                  <td>{n.status === 'draft' ? '—' : n.total}</td>
                  <td className="when">{fmtDate(n.created_at)}</td>
                  <td className="when">{n.sent_at ? fmtDate(n.sent_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}
