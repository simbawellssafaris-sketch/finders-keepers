import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { STATUS_LABELS, STATUSES, CHANNEL_LABELS } from '../../../lib/admin/config';
import { fmtDay, todayNairobi } from '../../../lib/admin/format';
import { CURRENCIES, ACTIVE_BOOKING_STATUSES, BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS, QUOTE_STATUS_LABELS, QUOTE_STATUSES, addDays, fmtMoney, fmtTotals, toCents } from '../../../lib/admin/money';
import { PERIODS, periodRange, startOf, endExclusive, sumBy, groupSum, daysLate, AGE_BUCKETS } from '../../../lib/admin/reports';
import Shell from '../_components/Shell';

export const dynamic = 'force-dynamic';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const signed = (p) => (p.kind === 'refund' ? -Number(p.amount) : Number(p.amount));
const cur = (p) => (p.bookings ? p.bookings.currency : 'USD');

// A row of horizontal bars (plain CSS, no chart library).
function Bars({ rows, currency }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="ad-bars">
      {rows.map((r) => (
        <div className="ad-barrow" key={r.label}>
          <span className="ad-barlabel">{r.label}</span>
          <span className="ad-bartrack"><span className="ad-barfill" style={{ width: `${Math.max(r.value ? 2 : 0, (Math.abs(r.value) / max) * 100)}%` }} /></span>
          <span className="ad-barvalue">{fmtMoney(r.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Reports({ searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const sp = (await searchParams) || {};
  const today = todayNairobi();
  const per = periodRange(sp, today);
  const year = per.to.slice(0, 4);
  const range = (q, col) => q.gte(col, startOf(per.from)).lt(col, endExclusive(per.to));

  const [pays, yearPays, pending, bookingsNew, activeBk, invIssued, invOpen, departing, enquiries, quotes] = await Promise.all([
    supabase.from('payments').select('amount,kind,method,paid_on,bookings(currency)').eq('status', 'confirmed').gte('paid_on', per.from).lte('paid_on', per.to).limit(20000),
    supabase.from('payments').select('amount,kind,paid_on,bookings(currency)').eq('status', 'confirmed').gte('paid_on', `${year}-01-01`).lte('paid_on', `${year}-12-31`).limit(20000),
    supabase.from('payments').select('amount,kind,bookings(currency)').eq('status', 'pending').limit(5000),
    range(supabase.from('booking_summary').select('id,journey,status,currency,total_price,enquiry_id,created_at').limit(20000), 'created_at'),
    supabase.from('booking_summary').select('id,reference,client_name,journey,currency,outstanding,balance_due_on,departure_date,status').in('status', ACTIVE_BOOKING_STATUSES).gt('outstanding', 0).limit(5000),
    supabase.from('invoice_summary').select('id,currency,total,paid,status,issue_date').eq('status', 'sent').gte('issue_date', per.from).lte('issue_date', per.to).limit(20000),
    supabase.from('invoice_summary').select('id,reference,client_name,currency,outstanding,due_date').eq('status', 'sent').gt('outstanding', 0).limit(5000),
    supabase.from('booking_summary').select('id,reference,client_name,journey,currency,outstanding,departure_date,travellers,status').in('status', ACTIVE_BOOKING_STATUSES).gte('departure_date', today).lte('departure_date', addDays(today, 90)).order('departure_date').limit(60),
    range(supabase.from('enquiries').select('status,channel,created_at').limit(20000), 'created_at'),
    range(supabase.from('quotation_summary').select('status,currency,total,valid_until,created_at').limit(20000), 'created_at'),
  ]);
  const failed = [pays, yearPays, bookingsNew, activeBk, invOpen, enquiries, quotes].some((r) => r.error);

  const payRows = pays.data || [];
  const collected = sumBy(payRows, cur, signed);
  const pendingTotals = sumBy(pending.data || [], cur, signed);
  const newBookings = (bookingsNew.data || []).filter((b) => b.status !== 'cancelled');
  const booked = sumBy(newBookings, (b) => b.currency, (b) => b.total_price);
  const owing = sumBy(activeBk.data || [], (b) => b.currency, (b) => b.outstanding);
  const invoiced = sumBy(invIssued.data || [], (i) => i.currency, (i) => i.total);
  const byMethod = groupSum(payRows.filter((p) => p.kind !== 'refund'), (p) => p.method, cur, (p) => p.amount);
  const byMonth = groupSum(yearPays.data || [], (p) => Number(p.paid_on.slice(5, 7)), cur, signed);
  const byJourney = groupSum(newBookings, (b) => b.journey, (b) => b.currency, (b) => b.total_price);

  const enq = enquiries.data || [];
  const enqByStatus = Object.fromEntries(STATUSES.map((s) => [s, enq.filter((e) => e.status === s).length]));
  const enqByChannel = {};
  for (const e of enq) if (e.status !== 'spam') enqByChannel[e.channel || 'website'] = (enqByChannel[e.channel || 'website'] || 0) + 1;
  const genuine = enq.length - enqByStatus.spam;
  const fromEnquiries = newBookings.filter((b) => b.enquiry_id).length;

  const q = quotes.data || [];
  const qStatus = (x) => (x.status === 'sent' && x.valid_until && x.valid_until < today ? 'expired' : x.status);
  const quoteBy = groupSum(q, (x) => qStatus(x), (x) => x.currency, (x) => x.total);
  const qCount = (s) => q.filter((x) => qStatus(x) === s).length;
  const decided = qCount('accepted') + qCount('declined');

  const ageRows = (activeBk.data || []).map((b) => ({ cur: b.currency, amount: b.outstanding, due: b.balance_due_on }));
  const invAge = (invOpen.data || []).map((i) => ({ cur: i.currency, amount: i.outstanding, due: i.due_date }));
  const bucketTotals = (rows) => AGE_BUCKETS.map(([label, test]) => ({ label, totals: sumBy(rows.filter((r) => test(r.due ? daysLate(r.due, today) : 0)), (r) => r.cur, (r) => r.amount) }));

  const topJourneys = (c) => [...byJourney.entries()].filter(([, e]) => e[c]).sort((a, b) => b[1][c] - a[1][c]).slice(0, 8);
  const csvHref = `/admin/export/payments?from=${per.from}&to=${per.to}`;

  return (
    <Shell ctx={ctx} current="reports">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>Reports</h1>
          <p className="ad-sub">{per.label}: {fmtDay(per.from)} to {fmtDay(per.to)}. Money is never added across currencies; each currency has its own figures.</p>
        </div>
        <a className="ad-btn ghost" href={csvHref}>Download these payments (CSV)</a>
      </div>

      <div className="ad-toolbar">
        {PERIODS.map(([k, label]) => <Link key={k} className={`ad-btn ${per.key === k ? '' : 'ghost'}`} href={`/admin/reports?period=${k}`}>{label}</Link>)}
        <form method="get" action="/admin/reports" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="ad-check">From <input type="date" name="from" defaultValue={per.key === 'custom' ? per.from : ''} /></label>
          <label className="ad-check">To <input type="date" name="to" defaultValue={per.key === 'custom' ? per.to : ''} /></label>
          <button className="ad-btn ghost" type="submit">Use these dates</button>
        </form>
      </div>
      {failed ? <p className="ad-err" role="alert">Some figures could not be loaded. Please reload the page.</p> : null}

      <div className="ad-grid">
        <div className="ad-card"><div className="n" style={{ fontSize: 26 }}>{fmtTotals(collected)}</div><div className="l">Money received (confirmed, after refunds)</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 26 }}>{fmtTotals(booked)}</div><div className="l">New bookings value ({newBookings.length} booking{newBookings.length === 1 ? '' : 's'})</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 26 }}>{fmtTotals(invoiced)}</div><div className="l">Invoices issued ({(invIssued.data || []).length})</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 26 }}>{fmtTotals(owing)}</div><div className="l">Still to collect on active bookings (today)</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 26 }}>{fmtTotals(pendingTotals)}</div><div className="l">Waiting for an owner to confirm (today)</div></div>
      </div>

      {CURRENCIES.map((c) => {
        const months = MONTHS.map((label, i) => ({ label, value: (byMonth.get(i + 1) || {})[c] || 0 }));
        const any = months.some((m) => m.value !== 0);
        if (!any) return null;
        return (
          <section className="ad-panel" key={c}>
            <h2>Money received each month in {year} ({c})</h2>
            <Bars rows={months} currency={c} />
          </section>
        );
      })}

      <div className="ad-detail">
        <div>
          <section className="ad-panel">
            <h2>Received by payment method</h2>
            {byMethod.size ? (
              <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
                <table className="ad-table">
                  <thead><tr><th>Method</th>{CURRENCIES.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {[...byMethod.entries()].map(([m, e]) => <tr key={m}><td>{PAYMENT_METHOD_LABELS[m] || m}</td>{CURRENCIES.map((c) => <td key={c}>{e[c] !== undefined ? fmtMoney(e[c], c) : '—'}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No payments in this period.</p>}
          </section>

          <section className="ad-panel">
            <h2>Best-selling journeys (new bookings)</h2>
            {CURRENCIES.map((c) => {
              const rows = topJourneys(c);
              if (!rows.length) return null;
              return (
                <div key={c} style={{ marginBottom: 14 }}>
                  <strong>{c}</strong>
                  <ol className="ad-timeline">{rows.map(([j, e]) => <li key={j}>{j}<small>{fmtMoney(e[c], c)}</small></li>)}</ol>
                </div>
              );
            })}
            {!newBookings.length ? <p className="ad-sub" style={{ margin: 0 }}>No new bookings in this period.</p> : null}
          </section>

          <section className="ad-panel">
            <h2>Money still to collect, by how late it is</h2>
            <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
              <table className="ad-table">
                <thead><tr><th>Booking balances</th><th>Amount</th></tr></thead>
                <tbody>{bucketTotals(ageRows).map((b) => <tr key={b.label}><td>{b.label}</td><td>{fmtTotals(b.totals)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="ad-tablewrap" style={{ boxShadow: 'none', marginTop: 14 }}>
              <table className="ad-table">
                <thead><tr><th>Issued invoices</th><th>Amount</th></tr></thead>
                <tbody>{bucketTotals(invAge).map((b) => <tr key={b.label}><td>{b.label}</td><td>{fmtTotals(b.totals)}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="ad-sub" style={{ margin: '10px 0 0' }}>Measured against each booking&rsquo;s balance due date and each invoice&rsquo;s due date, as at today.</p>
          </section>
        </div>

        <aside>
          <section className="ad-panel">
            <h2>Enquiries received</h2>
            <p style={{ margin: '0 0 10px' }}><strong>{enq.length}</strong> in this period{enqByStatus.spam ? ` (${enqByStatus.spam} spam)` : ''}</p>
            <ul className="ad-doclist">
              {STATUSES.map((s) => <li key={s}><span>{STATUS_LABELS[s]}</span><strong>{enqByStatus[s]}</strong></li>)}
            </ul>
            {genuine > 0 ? <p className="ad-sub" style={{ margin: '12px 0 0' }}>{fromEnquiries} of the new bookings came from an enquiry, about {Math.round((fromEnquiries / genuine) * 100)}% of the {genuine} real enquiries.</p> : null}
          </section>

          <section className="ad-panel">
            <h2>Where enquiries come from</h2>
            {Object.keys(enqByChannel).length ? (
              <ul className="ad-doclist">{Object.entries(enqByChannel).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k}><span>{CHANNEL_LABELS[k] || (k === 'website' ? 'Website form' : k)}</span><strong>{n}</strong></li>)}</ul>
            ) : <p className="ad-sub" style={{ margin: 0 }}>None in this period.</p>}
          </section>

          <section className="ad-panel">
            <h2>Quotations</h2>
            {q.length ? (
              <>
                <ul className="ad-doclist">
                  {QUOTE_STATUSES.map((s) => <li key={s}><span>{QUOTE_STATUS_LABELS[s]}<small>{fmtTotals(quoteBy.get(s) || {})}</small></span><strong>{qCount(s)}</strong></li>)}
                </ul>
                {decided ? <p className="ad-sub" style={{ margin: '12px 0 0' }}>{Math.round((qCount('accepted') / decided) * 100)}% of answered quotations were accepted.</p> : null}
              </>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No quotations created in this period.</p>}
          </section>

          <section className="ad-panel">
            <h2>Bookings by status (new in period)</h2>
            <ul className="ad-doclist">
              {Object.keys(BOOKING_STATUS_LABELS).map((s) => <li key={s}><span>{BOOKING_STATUS_LABELS[s]}</span><strong>{(bookingsNew.data || []).filter((b) => b.status === s).length}</strong></li>)}
            </ul>
          </section>
        </aside>
      </div>

      <section className="ad-panel">
        <h2>Departing in the next 90 days</h2>
        {departing.data && departing.data.length ? (
          <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
            <table className="ad-table">
              <thead><tr><th>Departs</th><th>Booking</th><th>Client</th><th>Journey</th><th>Travellers</th><th>Still to pay</th></tr></thead>
              <tbody>
                {departing.data.map((b) => (
                  <tr key={b.id}>
                    <td className="when">{fmtDay(b.departure_date)}</td>
                    <td><Link href={`/admin/bookings/${b.id}`}><strong>{b.reference}</strong></Link></td>
                    <td>{b.client_name}</td><td>{b.journey}</td><td>{b.travellers || '—'}</td>
                    <td className={toCents(b.outstanding) > 0 ? 'ad-due' : ''}>{fmtMoney(b.outstanding, b.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="ad-sub" style={{ margin: 0 }}>Nothing departs in the next 90 days.</p>}
      </section>
    </Shell>
  );
}
