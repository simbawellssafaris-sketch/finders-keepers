import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { fmtDay, safeSearch, todayNairobi } from '../../../lib/admin/format';
import { BOOKING_STATUSES, BOOKING_STATUS_LABELS, ACTIVE_BOOKING_STATUSES, fmtMoney, addDays, totalsByCurrency, fmtTotals } from '../../../lib/admin/money';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;

export default async function Bookings({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const status = BOOKING_STATUSES.includes(sp.status) ? sp.status : '';
  const overdue = sp.overdue === '1';
  const upcoming = sp.upcoming === '1';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const today = todayNairobi();

  let query = ctx.supabase.from('booking_summary').select('*', { count: 'exact' })
    .order(upcoming || overdue ? 'departure_date' : 'created_at', { ascending: upcoming || overdue })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq('status', status);
  if (overdue) query = query.in('status', ACTIVE_BOOKING_STATUSES).lt('balance_due_on', today).gt('outstanding', 0);
  if (upcoming) query = query.in('status', ACTIVE_BOOKING_STATUSES).gte('departure_date', today).lte('departure_date', addDays(today, 60));
  if (q) query = query.or(['reference', 'journey', 'client_name', 'client_email'].map((c) => `${c}.ilike.%${q}%`).join(','));
  const { data: rows, count, error } = await query;

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = q || status || overdue || upcoming;
  const href = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (overdue) params.set('overdue', '1');
    if (upcoming) params.set('upcoming', '1');
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/bookings${s ? `?${s}` : ''}`;
  };

  return (
    <Shell ctx={ctx} current="bookings">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Bookings</h1>
          <p className="ad-sub">{total} {total === 1 ? 'booking' : 'bookings'}{active ? ' match your search' : ' in total'}. Money is always shown in each booking&rsquo;s own currency and never added across currencies.</p>
        </div>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="ad-btn ghost" href="/admin/bookings/calendar">Departure calendar</Link>
          <Link className="ad-btn" href="/admin/bookings/new">+ New booking</Link>
        </span>
      </div>

      <form className="ad-toolbar" method="get" action="/admin/bookings">
        <input type="search" name="q" defaultValue={q} placeholder="Search reference, client, journey…" aria-label="Search bookings" />
        <select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>)}
        </select>
        <label className="ad-check"><input type="checkbox" name="upcoming" value="1" defaultChecked={upcoming} /> Leaving in the next 60 days</label>
        <label className="ad-check"><input type="checkbox" name="overdue" value="1" defaultChecked={overdue} /> Balance overdue</label>
        <button className="ad-btn" type="submit">Search</button>
        {active ? <Link className="ad-btn ghost" href="/admin/bookings">Clear</Link> : null}
        <span style={{ flex: 1 }} />
        <a className="ad-btn ghost" href="/admin/export/bookings">Download CSV</a>
      </form>

      {error ? <div className="ad-empty">Could not load the bookings. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{active ? 'Nothing matches that search.' : 'No bookings yet. Open an enquiry and press “Convert to booking”, or start one with “+ New booking”.'}</div> : null}
      {!error && rows.length ? (
        <>
          <div className="ad-tablewrap">
            <table className="ad-table">
              <thead><tr><th>Ref</th><th>Client</th><th>Journey</th><th>Departs</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Balance due</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((b) => {
                  const late = ACTIVE_BOOKING_STATUSES.includes(b.status) && b.balance_due_on && b.balance_due_on < today && Number(b.outstanding) > 0;
                  return (
                    <tr key={b.id}>
                      <td><Link href={`/admin/bookings/${b.id}`}><strong>{b.reference}</strong></Link></td>
                      <td>{b.client_name}</td>
                      <td>{b.journey}</td>
                      <td className="when">{b.departure_date ? fmtDay(b.departure_date) : '—'}</td>
                      <td>{fmtMoney(b.total_price, b.currency)}</td>
                      <td>{fmtMoney(b.paid, b.currency)}</td>
                      <td>{fmtMoney(b.outstanding, b.currency)}</td>
                      <td className={late ? 'ad-due' : 'when'}>{b.balance_due_on ? fmtDay(b.balance_due_on) : '—'}{late ? ' (overdue)' : ''}</td>
                      <td><span className={`badge st-${b.status}`}>{BOOKING_STATUS_LABELS[b.status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ad-sub" style={{ marginTop: 10 }}>On this page: total {fmtTotals(totalsByCurrency(rows, (b) => b.total_price))} &middot; paid {fmtTotals(totalsByCurrency(rows, (b) => b.paid))} &middot; outstanding {fmtTotals(totalsByCurrency(rows.filter((b) => b.status !== 'cancelled'), (b) => b.outstanding))}</p>
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
