import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDay, safeSearch, todayNairobi } from '../../../lib/admin/format';
import { INVOICE_DISPLAY_LABELS, invoiceDisplay, fmtMoney, totalsByCurrency, fmtTotals } from '../../../lib/admin/money';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const FILTERS = ['draft', 'sent', 'overdue', 'paid', 'void'];

export default async function Invoices({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const status = FILTERS.includes(sp.status) ? sp.status : '';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const today = todayNairobi();

  let query = ctx.supabase.from('invoice_summary').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status === 'draft' || status === 'void') query = query.eq('status', status);
  if (status === 'paid') query = query.eq('status', 'sent').gt('total', 0).lte('outstanding', 0);
  if (status === 'overdue') query = query.eq('status', 'sent').gt('outstanding', 0).lt('due_date', today);
  if (status === 'sent') query = query.eq('status', 'sent').gt('outstanding', 0).or(`due_date.is.null,due_date.gte.${today}`);
  if (q) query = query.or(['reference', 'title', 'client_name', 'client_email', 'booking_reference'].map((c) => `${c}.ilike.%${q}%`).join(','));
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
    return `/admin/invoices${s ? `?${s}` : ''}`;
  };
  const live = (rows || []).filter((r) => r.status === 'sent');

  return (
    <Shell ctx={ctx} current="invoices">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Invoices</h1>
          <p className="ad-sub">{total} invoice{total === 1 ? '' : 's'}{active ? ' match your search' : ' in total'}. Invoices are created from a booking, so payments can be matched to them. Only an owner can issue one.</p>
        </div>
        <a className="ad-btn ghost" href="/admin/export/invoices">Download CSV</a>
      </div>

      <form className="ad-toolbar" method="get" action="/admin/invoices">
        <input type="search" name="q" defaultValue={q} placeholder="Search number, client, booking…" aria-label="Search invoices" />
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">All invoices</option>
          {FILTERS.map((s) => <option key={s} value={s}>{INVOICE_DISPLAY_LABELS[s]}</option>)}
        </select>
        <button className="ad-btn" type="submit">Search</button>
        {active ? <Link className="ad-btn ghost" href="/admin/invoices">Clear</Link> : null}
      </form>

      {error ? <div className="ad-empty">Could not load the invoices. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{active ? 'Nothing matches that search.' : 'No invoices yet. Open a booking and choose “Create invoice”.'}</div> : null}
      {!error && rows.length ? (
        <>
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead><tr><th>Number</th><th>Client</th><th>Booking</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const st = invoiceDisplay(r, today);
                  return (
                    <tr key={r.id} style={st === 'void' ? { opacity: 0.55 } : undefined}>
                      <td><Link href={`/admin/invoices/${r.id}`}><strong>{r.reference || 'Draft'}</strong></Link></td>
                      <td>{r.client_name}</td>
                      <td>{r.booking_id ? <Link href={`/admin/bookings/${r.booking_id}`}>{r.booking_reference}</Link> : '—'}</td>
                      <td>{fmtMoney(r.total, r.currency)}</td>
                      <td>{r.status === 'sent' ? fmtMoney(r.paid, r.currency) : '—'}</td>
                      <td>{r.status === 'sent' ? fmtMoney(r.outstanding, r.currency) : '—'}</td>
                      <td className={st === 'overdue' ? 'ad-due' : 'when'}>{r.due_date ? fmtDay(r.due_date) : '—'}</td>
                      <td><span className={`badge st-i-${st}`}>{INVOICE_DISPLAY_LABELS[st]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {live.length ? <p className="ad-sub" style={{ marginTop: 10 }}>Issued on this page: invoiced {fmtTotals(totalsByCurrency(live, (r) => r.total))} &middot; paid {fmtTotals(totalsByCurrency(live, (r) => r.paid))} &middot; outstanding {fmtTotals(totalsByCurrency(live, (r) => r.outstanding))}</p> : null}
        </>
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
