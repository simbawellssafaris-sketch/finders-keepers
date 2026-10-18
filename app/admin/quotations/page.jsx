import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDay, safeSearch, todayNairobi } from '../../../lib/admin/format';
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, quoteDisplay, fmtMoney } from '../../../lib/admin/money';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;

export default async function Quotations({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const status = QUOTE_STATUSES.includes(sp.status) ? sp.status : '';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const today = todayNairobi();

  let query = ctx.supabase.from('quotation_summary').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === 'expired') query = query.eq('status', 'sent').lt('valid_until', today);
  else if (status === 'sent') query = query.eq('status', 'sent').or(`valid_until.is.null,valid_until.gte.${today}`);
  else if (status) query = query.eq('status', status);
  if (q) query = query.or(['reference', 'title', 'client_name', 'client_email'].map((c) => `${c}.ilike.%${q}%`).join(','));
  const { data: rows, count, error } = await query;

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = q || status;
  const href = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/quotations${s ? `?${s}` : ''}`;
  };

  return (
    <Shell ctx={ctx} current="quotations">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Quotations</h1>
          <p className="ad-sub">{total} quotation{total === 1 ? '' : 's'}{active ? ' match your search' : ' in total'}. Build one with line items, email it to the client, and turn it into a booking when they accept.</p>
        </div>
        <Link className="ad-btn" href="/admin/quotations/new">+ New quotation</Link>
      </div>

      <form className="ad-toolbar" method="get" action="/admin/quotations">
        <input type="search" name="q" defaultValue={q} placeholder="Search number, client, title…" aria-label="Search quotations" />
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">All statuses</option>
          {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="ad-btn" type="submit">Search</button>
        {active ? <Link className="ad-btn ghost" href="/admin/quotations">Clear</Link> : null}
        <span style={{ flex: 1 }} />
        <a className="ad-btn ghost" href="/admin/export/quotations">Download CSV</a>
      </form>

      {error ? <div className="ad-empty">Could not load the quotations. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{active ? 'Nothing matches that search.' : 'No quotations yet. Press “+ New quotation”, or open an enquiry and choose “Create quotation”.'}</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead><tr><th>Number</th><th>Client</th><th>Title</th><th>Total</th><th>Valid until</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = quoteDisplay(r, today);
                return (
                  <tr key={r.id}>
                    <td><Link href={`/admin/quotations/${r.id}`}><strong>{r.reference}</strong></Link></td>
                    <td>{r.client_name}</td>
                    <td>{r.title}</td>
                    <td>{fmtMoney(r.total, r.currency)}</td>
                    <td className="when">{r.valid_until ? fmtDay(r.valid_until) : '—'}</td>
                    <td><span className={`badge st-q-${st}`}>{QUOTE_STATUS_LABELS[st]}</span></td>
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
            {page > 1 ? <Link className="ad-btn ghost" href={href(page - 1)}>Previous</Link> : null}
            {page < pages ? <Link className="ad-btn ghost" href={href(page + 1)}>Next</Link> : null}
          </span>
        </div>
      ) : null}
    </Shell>
  );
}
