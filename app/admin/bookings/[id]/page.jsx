import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin/auth';
import { getStaff } from '../../../../lib/admin/staff';
import { UUID } from '../../../../lib/admin/config';
import { describeActivity } from '../../../../lib/admin/activity';
import { fmtDate, fmtDay, todayNairobi } from '../../../../lib/admin/format';
import { BOOKING_STATUS_LABELS, ACTIVE_BOOKING_STATUSES, INVOICE_DISPLAY_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, invoiceDisplay, fmtMoney, toCents, fromCents } from '../../../../lib/admin/money';
import { setPaymentStatus, deleteBooking } from '../../actions-money';
import { createInvoiceFromBooking } from '../../actions-docs';
import DocumentsPanel from '../../_components/DocumentsPanel';
import ConfirmButton from '../../_components/ConfirmButton';
import BookingForm from '../../_components/BookingForm';
import PaymentForm from '../../_components/PaymentForm';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';

export default async function BookingPage({ params, searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  const sp = (await searchParams) || {};
  if (!UUID.test(String(id))) notFound();
  const { data: b } = await supabase.from('booking_summary').select('*').eq('id', id).maybeSingle();
  if (!b) notFound();

  const [{ staff }, { data: payments }, { data: history }, { data: enquiry }, { data: invoices }] = await Promise.all([
    getStaff(supabase),
    supabase.from('payments').select('*').eq('booking_id', id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*').eq('entity_table', 'bookings').eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
    b.enquiry_id ? supabase.from('enquiries').select('id').eq('id', b.enquiry_id).maybeSingle() : { data: null },
    supabase.from('invoice_summary').select('id,reference,title,status,total,paid,outstanding,due_date,currency').eq('booking_id', id).order('created_at'),
  ]);
  const openInvoices = (invoices || []).filter((i) => i.status === 'sent');
  const today = todayNairobi();
  const staffName = (uid) => (staff.find((s) => s.user_id === uid) || {}).name || '';
  const depositAmount = fromCents(Math.round(toCents(b.total_price) * Number(b.deposit_percent) / 100));
  const late = ACTIVE_BOOKING_STATUSES.includes(b.status) && b.balance_due_on && b.balance_due_on < today && Number(b.outstanding) > 0;

  return (
    <Shell ctx={ctx} current="bookings">
      <Link className="ad-back" href="/admin/bookings">&larr; Back to bookings</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>{b.reference} &middot; {b.journey}</h1>
          <p className="ad-sub">
            <span className={`badge st-${b.status}`}>{BOOKING_STATUS_LABELS[b.status]}</span> &nbsp;
            <Link href={`/admin/clients/${b.client_id}`}><strong>{b.client_name}</strong></Link>
            {b.client_phone || b.client_email ? <> &middot; {[b.client_phone, b.client_email].filter(Boolean).join(' · ')}</> : null}
            {enquiry ? <> &middot; <Link href={`/admin/enquiries/${enquiry.id}`}>from an enquiry</Link></> : null}
          </p>
        </div>
        <Link className="ad-btn ghost" href={`/admin/bookings/${id}/print`} target="_blank">Print summary</Link>
      </div>
      {sp.error === 'has-payments' ? <p className="ad-err" role="alert">This booking has payments, invoices or documents on record, so it cannot be deleted. Mark it as Cancelled instead.</p> : null}

      <div className="ad-grid">
        <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(b.total_price, b.currency)}</div><div className="l">Total price</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(b.paid, b.currency)}</div><div className="l">Paid (confirmed)</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 30, color: late ? '#a63a22' : undefined }}>{fmtMoney(b.outstanding, b.currency)}</div><div className="l">Outstanding</div></div>
        <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(b.pending_amount, b.currency)}</div><div className="l">Waiting for confirmation</div></div>
      </div>
      <p className="ad-sub" style={{ marginTop: -14 }}>
        Deposit ({Number(b.deposit_percent)}%): <strong>{fmtMoney(depositAmount, b.currency)}</strong>{b.deposit_due_on ? <> due {fmtDay(b.deposit_due_on)}</> : null}
        &nbsp;&middot;&nbsp; Balance due: <strong className={late ? 'ad-due' : ''}>{b.balance_due_on ? fmtDay(b.balance_due_on) : 'not set'}{late ? ' (overdue)' : ''}</strong>
        {b.departure_date ? <>&nbsp;&middot;&nbsp; Departs <strong>{fmtDay(b.departure_date)}</strong></> : null}
      </p>

      <div className="ad-detail">
        <div>
          <section className="ad-panel">
            <h2>Payments</h2>
            {payments && payments.length ? (
              <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
                <table className="ad-table">
                  <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Paid by</th><th>Reference</th><th>Status</th><th>Receipt</th>{ctx.admin.isOwner ? <th>Action</th> : null}</tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={p.status === 'failed' ? { opacity: 0.55 } : undefined}>
                        <td className="when">{fmtDay(p.paid_on)}</td>
                        <td>{PAYMENT_KIND_LABELS[p.kind]}</td>
                        <td><strong>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, b.currency)}</strong></td>
                        <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                        <td>{p.reference || ''}<small style={{ display: 'block', color: 'var(--muted)' }}>{staffName(p.recorded_by) ? `entered by ${staffName(p.recorded_by)}` : ''}</small></td>
                        <td><span className={`badge st-${p.status === 'confirmed' ? 'won' : p.status === 'pending' ? 'quoted' : 'spam'}`}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                        <td>{p.receipt_no && p.status === 'confirmed' ? <Link href={`/admin/payments/${p.id}/receipt`} target="_blank">{p.receipt_no}</Link> : ''}</td>
                        {ctx.admin.isOwner ? (
                          <td>
                            {p.status === 'pending' ? (
                              <span style={{ display: 'flex', gap: 6 }}>
                                <form action={setPaymentStatus.bind(null, p.id, id, 'confirmed')}><button className="ad-btn" type="submit">Confirm</button></form>
                                <form action={setPaymentStatus.bind(null, p.id, id, 'failed')}><ConfirmButton className="ad-btn danger" message="Mark this payment as failed / entered by mistake? It will not count as paid.">Not received</ConfirmButton></form>
                              </span>
                            ) : p.status === 'confirmed' ? (
                              <form action={setPaymentStatus.bind(null, p.id, id, 'failed')}><ConfirmButton className="ad-btn ghost" message="This payment was confirmed. Mark it as entered by mistake? It will stop counting as paid.">Entered by mistake</ConfirmButton></form>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No payments yet.</p>}
          </section>

          <PaymentForm bookingId={id} currency={b.currency} isOwner={ctx.admin.isOwner} today={today} invoices={openInvoices} />

          <section className="ad-panel">
            <h2>Invoices</h2>
            {invoices && invoices.length ? (
              <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
                <table className="ad-table">
                  <thead><tr><th>Number</th><th>Title</th><th>Total</th><th>Outstanding</th><th>Status</th></tr></thead>
                  <tbody>
                    {invoices.map((i) => {
                      const st = invoiceDisplay(i, today);
                      return (
                        <tr key={i.id} style={st === 'void' ? { opacity: 0.55 } : undefined}>
                          <td><Link href={`/admin/invoices/${i.id}`}><strong>{i.reference || 'Draft'}</strong></Link></td>
                          <td>{i.title}</td><td>{fmtMoney(i.total, i.currency)}</td>
                          <td>{i.status === 'sent' ? fmtMoney(i.outstanding, i.currency) : '—'}</td>
                          <td><span className={`badge st-i-${st}`}>{INVOICE_DISPLAY_LABELS[st]}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No invoices yet.</p>}
            <div className="ad-actions">
              <form action={createInvoiceFromBooking.bind(null, id, 'deposit')}><button className="ad-btn ghost" type="submit">Invoice the deposit</button></form>
              <form action={createInvoiceFromBooking.bind(null, id, 'balance')}><button className="ad-btn ghost" type="submit">Invoice the balance</button></form>
              <form action={createInvoiceFromBooking.bind(null, id, 'full')}><button className="ad-btn ghost" type="submit">Invoice the full amount</button></form>
            </div>
            <p className="ad-sub" style={{ margin: '10px 0 0' }}>Each one opens a draft you can adjust. An owner issues it to give it its number.</p>
          </section>

          <DocumentsPanel supabase={supabase} clientId={b.client_id} bookingId={id} isOwner={ctx.admin.isOwner} backTo={`/admin/bookings/${id}`} />

          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">{history.map((a) => <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>)}</ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No changes recorded yet.</p>}
          </section>
        </div>

        <aside>
          <BookingForm id={id} booking={b} staff={staff} />
          {ctx.admin.isOwner ? (
            <form action={deleteBooking.bind(null, id)} className="ad-panel">
              <h2>Delete</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Only possible while no payments have been recorded. Otherwise mark the booking as Cancelled.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this booking permanently?">Delete booking</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
