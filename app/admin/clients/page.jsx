import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDate, safeSearch } from '../../../lib/admin/format';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;

export default async function Clients({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  let query = ctx.supabase.from('clients').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(['full_name', 'email', 'phone', 'country'].map((c) => `${c}.ilike.%${q}%`).join(','));
  const { data: rows, count, error } = await query;
  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p) => `/admin/clients?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <Shell ctx={ctx} current="clients">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Clients</h1>
          <p className="ad-sub">{total} {total === 1 ? 'client' : 'clients'}{q ? ' match your search' : ' in total'}. Everyone you have quoted or booked, with their history in one place.</p>
        </div>
        <Link className="ad-btn" href="/admin/clients/new">+ New client</Link>
      </div>
      <form className="ad-toolbar" method="get" action="/admin/clients">
        <input type="search" name="q" defaultValue={q} placeholder="Search name, email, phone, country…" aria-label="Search clients" />
        <button className="ad-btn" type="submit">Search</button>
        {q ? <Link className="ad-btn ghost" href="/admin/clients">Clear</Link> : null}
        <span style={{ flex: 1 }} />
        <a className="ad-btn ghost" href="/admin/export/clients">Download CSV</a>
      </form>
      {error ? <div className="ad-empty">Could not load the clients. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{q ? 'Nobody matches that search.' : 'No clients yet. They are added automatically when you convert an enquiry to a booking, or you can add one by hand.'}</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead><tr><th>Added</th><th>Name</th><th>Contact</th><th>Country</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="when">{fmtDate(r.created_at)}</td>
                  <td><Link href={`/admin/clients/${r.id}`}><strong>{r.full_name}</strong></Link></td>
                  <td>{[r.phone, r.email].filter(Boolean).join(' · ')}</td>
                  <td>{r.country || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {pages > 1 ? (
        <div className="ad-pager">
          <span>Page {page} of {pages}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            {page > 1 ? <Link className="ad-btn ghost" href={href(page - 1)}>Previous</Link> : null}
            {page < pages ? <Link className="ad-btn ghost" href={href(page + 1)}>Next</Link> : null}
          </span>
        </div>
      ) : null}
    </Shell>
  );
}
