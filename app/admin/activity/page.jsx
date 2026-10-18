import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import { getStaff } from '../../../lib/admin/staff';
import { describeActivity } from '../../../lib/admin/activity';
import { ACTIVITY_TYPES, RECORD_PATH, readFilters, applyFilters, deviceLabel } from '../../../lib/admin/audit';
import { fmtDate } from '../../../lib/admin/format';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

// Everything anyone did in the dashboard: sign-ins, changes, deletions, downloads, who opened a client file. Owners only. Entries cannot be edited or deleted.
export default async function Activity({ searchParams }) {
  const ctx = await requireAdmin();
  if (!ctx.admin.isOwner) redirect('/admin');
  const sp = (await searchParams) || {};
  const f = readFilters(sp);
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const { staff } = await getStaff(ctx.supabase);

  let query = ctx.supabase.from('activity_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = applyFilters(query, f);
  const { data: rows, count, error } = await query;

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = f.person || f.type || f.from || f.to || f.q;
  const qs = (p) => {
    const params = new URLSearchParams();
    for (const k of ['person', 'type', 'from', 'to', 'q']) if (f[k]) params.set(k, f[k]);
    if (p) params.set('page', String(p));
    const s = params.toString();
    return s ? `?${s}` : '';
  };

  return (
    <Shell ctx={ctx} current="activity">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Activity</h1>
          <p className="ad-sub">{total} entr{total === 1 ? 'y' : 'ies'}{active ? ' match your filters' : ' in total'}. Newest first. Nobody can edit or delete this history.</p>
        </div>
        <a className="ad-btn ghost" href={`/admin/export/activity${qs(0)}`}>Download CSV</a>
      </div>

      <form className="ad-toolbar" method="get" action="/admin/activity">
        <select name="person" defaultValue={f.person} aria-label="Filter by person">
          <option value="">Everyone</option>
          {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <select name="type" defaultValue={f.type} aria-label="Filter by type">
          <option value="">Everything</option>
          {Object.entries(ACTIVITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="ad-check">From <input type="date" name="from" defaultValue={f.from} /></label>
        <label className="ad-check">To <input type="date" name="to" defaultValue={f.to} /></label>
        <input type="search" name="q" defaultValue={f.q} placeholder="Search what happened…" aria-label="Search" />
        <button className="ad-btn" type="submit">Filter</button>
        {active ? <Link className="ad-btn ghost" href="/admin/activity">Clear</Link> : null}
      </form>

      {error ? <div className="ad-empty">Could not load the activity. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{active ? 'Nothing matches those filters.' : 'Nothing has been recorded yet.'}</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead><tr><th>When</th><th>Who</th><th>What happened</th><th>Area</th><th /></tr></thead>
            <tbody>
              {rows.map((a) => {
                const base = RECORD_PATH[a.entity_table];
                const d = a.details || {};
                return (
                  <tr key={a.id}>
                    <td className="when">{fmtDate(a.created_at)}</td>
                    <td><strong>{a.actor_name || 'Someone'}</strong></td>
                    <td>
                      {describeActivity(a)}
                      {a.action === 'signed_in' && (d.ip || d.device) ? <small style={{ display: 'block', color: 'var(--muted)' }}>{[deviceLabel(d.device), d.ip].filter(Boolean).join(' · ')}</small> : null}
                    </td>
                    <td><span className="ad-chip">{ACTIVITY_TYPES[a.entity_table] || a.entity_table}</span></td>
                    <td>{base && a.action !== 'deleted' ? <Link href={`${base}${a.entity_id}`}>Open</Link> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pages > 1 ? (
        <div className="ad-pager">
          <span>Page {page} of {pages}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            {page > 1 ? <Link className="ad-btn ghost" href={`/admin/activity${qs(page - 1)}`}>Previous</Link> : null}
            {page < pages ? <Link className="ad-btn ghost" href={`/admin/activity${qs(page + 1)}`}>Next</Link> : null}
          </span>
        </div>
      ) : null}
    </Shell>
  );
}
