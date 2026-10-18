import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDay } from '../../../lib/admin/format';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_KIND_LABELS, PAYMENT_STATUS_LABELS, fmtMoney, totalsByCurrency, fmtTotals } from '../../../lib/admin/money';
import { setPaymentStatus } from '../actions-money';
import ConfirmButton from '../_components/ConfirmButton';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 30;
const STATUSES = ['pending', 'confirmed', 'failed'];

export default async function Payments({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const status = STATUSES.includes(sp.status) ? sp.status : '';
  const method = PAYMENT_METHODS.includes(sp.method) ? sp.method : '';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);

  let query = ctx.supabase.from('payments')
    .select('*, bookings(id, reference, currency, journey, clients(full_name))', { count: 'exact' })
    .order('paid_on', { ascending: false }).order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq('status', status);
  if (method) query = query.eq('method', method);
  const { data: rows, count, error } = await query;
  const list = (rows || []).map((p) => ({ ...p, currency: p.bookings ? p.bookings.currency : 'USD' }));

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = status || method;
  const href = (p) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (method) params.set('method', method);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/payments${s ? `?${s}` : ''}`;
  };
  const signed = (p) => (p.kind === 'refund' ? -Number(p.amount) : Number(p.amount));
  const confirmedHere = list.filter((p) => p.status === 'confirmed');
  const pendingHere = list.filter((p) => p.status === 'pending');

  return (
    <Shell ctx={ctx} current="payments">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Payments</h1>
          <p className="ad-sub">{total} payment{total === 1 ? '' : 's'}{active ? ' match' : ' recorded'}. Payments are added from inside a booking. They count as paid only once an owner has confirmed the money arrived.</p>
        </div>
        <a className="ad-btn ghost" href="/admin/export/payments">Download CSV</a>
      </div>

      <form className="ad-toolbar" method="get" action="/admin/payments">
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
        </select>
        <select name="method" defaultValue={method} aria-label="Filter by method">
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
        </select>
        <button className="ad-btn" type="submit">Filter</button>
        {active ? <Link className="ad-btn ghost" href="/admin/payments">Clear</Link> : null}
      </form>

      {error ? <div className="ad-empty">Could not load the payments. Please try again.</div> : null}
      {!error && !list.length ? <div className="ad-empty">{active ? 'No payments match that filter.' : 'No payments yet. Open a booking and use “Record a payment”.'}</div> : null}
      {!error && list.length ? (
        <>
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead><tr><th>Date</th><th>Booking</th><th>Client</th><th>For</th><th>Amount</th><th>Paid by</th><th>Reference</th><th>Status</th>{ctx.admin.isOwner ? <th>Action</th> : null}</tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} style={p.status === 'failed' ? { opacity: 0.55 } : undefined}>
                    <td className="when">{fmtDay(p.paid_on)}</td>
                    <td>{p.bookings ? <Link href={`/admin/bookings/${p.bookings.id}`}><strong>{p.bookings.reference}</strong></Link> : '—'}</td>
                    <td>{p.bookings && p.bookings.clients ? p.bookings.clients.full_name : ''}</td>
                    <td>{PAYMENT_KIND_LABELS[p.kind]}</td>
                    <td><strong>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, p.currency)}</strong></td>
                    <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td>{p.reference || ''}</td>
                    <td><span className={`badge st-${p.status === 'confirmed' ? 'won' : p.status === 'pending' ? 'quoted' : 'spam'}`}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                    {ctx.admin.isOwner ? (
                      <td>
                        {p.status === 'pending' ? (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <form action={setPaymentStatus.bind(null, p.id, p.booking_id, 'confirmed')}><button className="ad-btn" type="submit">Confirm</button></form>
                            <form action={setPaymentStatus.bind(null, p.id, p.booking_id, 'failed')}><ConfirmButton className="ad-btn danger" message="Mark this payment as not received? It will not count as paid.">Not received</ConfirmButton></form>
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ad-sub" style={{ marginTop: 10 }}>On this page: confirmed {fmtTotals(totalsByCurrency(confirmedHere, signed))} &middot; waiting for confirmation {fmtTotals(totalsByCurrency(pendingHere, signed))}</p>
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
