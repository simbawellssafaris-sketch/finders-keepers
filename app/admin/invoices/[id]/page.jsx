import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID } from '../../../../lib/admin/config';
import { describeActivity } from '../../../../lib/admin/activity';
import { fmtDate, fmtDay, todayNairobi } from '../../../../lib/admin/format';
import { INVOICE_DISPLAY_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, invoiceDisplay, fmtMoney } from '../../../../lib/admin/money';
import { issueInvoice, emailInvoice, deleteInvoice } from '../../actions-docs';
import ConfirmButton from '../../_components/ConfirmButton';
import InvoiceForm from '../../_components/InvoiceForm';
import VoidInvoiceForm from '../../_components/VoidInvoiceForm';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';

const ERRORS = {
  empty: 'Add at least one line with an amount above zero before issuing.',
  'issue-failed': 'The invoice could not be issued. Please try again.',
  'not-issued': 'Issue the invoice first; only issued invoices can be emailed.',
  'no-email': 'This client has no valid email address. Add one on their client page first.',
  'email-failed': 'The email could not be sent. Please try again in a moment.',
  'email-off': 'Email is not switched on for this server yet (the SMTP settings are missing).',
  'cannot-delete': 'Only a draft invoice can be deleted. Void an issued invoice instead.',
};

export default async function InvoicePage({ params, searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  const sp = (await searchParams) || {};
  if (!UUID.test(String(id))) notFound();
  const { data: inv } = await supabase.from('invoice_summary').select('*').eq('id', id).maybeSingle();
  if (!inv) notFound();
  const [{ data: items }, { data: payments }, { data: history }] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
    supabase.from('payments').select('*').eq('invoice_id', id).order('paid_on'),
    supabase.from('activity_log').select('*').eq('entity_table', 'invoices').eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
  ]);
  const today = todayNairobi();
  const st = invoiceDisplay(inv, today);

  return (
    <Shell ctx={ctx} current="invoices">
      <Link className="ad-back" href="/admin/invoices">&larr; Back to invoices</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>{inv.reference || 'Draft invoice'} &middot; {inv.title}</h1>
          <p className="ad-sub">
            <span className={`badge st-i-${st}`}>{INVOICE_DISPLAY_LABELS[st]}</span> &nbsp;
            <Link href={`/admin/clients/${inv.client_id}`}><strong>{inv.client_name}</strong></Link>
            {inv.booking_id ? <> &middot; booking <Link href={`/admin/bookings/${inv.booking_id}`}>{inv.booking_reference}</Link></> : null}
            {inv.issue_date ? <> &middot; issued {fmtDay(inv.issue_date)}</> : null}
            {inv.due_date ? <> &middot; due <span className={st === 'overdue' ? 'ad-due' : ''}>{fmtDay(inv.due_date)}</span></> : null}
          </p>
        </div>
        {inv.status !== 'draft' ? <Link className="ad-btn ghost" href={`/admin/invoices/${id}/print`} target="_blank">Print / save as PDF</Link> : <Link className="ad-btn ghost" href={`/admin/invoices/${id}/print`} target="_blank">Preview</Link>}
      </div>
      {sp.sent === '1' ? <p className="ad-ok" role="status">Emailed to {inv.client_email}.</p> : null}
      {ERRORS[sp.error] ? <p className="ad-err" role="alert">{ERRORS[sp.error]}</p> : null}
      {inv.status === 'void' ? <p className="ad-err" role="status">This invoice was voided{inv.void_reason ? `: ${inv.void_reason}` : ''}.</p> : null}

      <div className="ad-grid">
        <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(inv.total, inv.currency)}</div><div className="l">Invoice total</div></div>
        {inv.status === 'sent' ? (
          <>
            <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(inv.paid, inv.currency)}</div><div className="l">Paid (confirmed)</div></div>
            <div className="ad-card"><div className="n" style={{ fontSize: 30, color: st === 'overdue' ? '#a63a22' : undefined }}>{fmtMoney(inv.outstanding, inv.currency)}</div><div className="l">Outstanding</div></div>
          </>
        ) : null}
      </div>

      <div className="ad-detail">
        <div>
          {inv.status !== 'void' ? <InvoiceForm id={id} invoice={inv} items={items || []} /> : (
            <section className="ad-panel"><h2>Lines</h2>
              <ul className="ad-doclist">{(items || []).map((it) => <li key={it.id}><span>{it.description}<small>{Number(it.quantity)} × {fmtMoney(it.unit_price, inv.currency)}</small></span></li>)}</ul>
            </section>
          )}

          {inv.status === 'sent' ? (
            <section className="ad-panel">
              <h2>Payments matched to this invoice</h2>
              {payments && payments.length ? (
                <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
                  <table className="ad-table">
                    <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Paid by</th><th>Status</th><th>Receipt</th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="when">{fmtDay(p.paid_on)}</td><td>{PAYMENT_KIND_LABELS[p.kind]}</td>
                          <td><strong>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, inv.currency)}</strong></td><td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                          <td>{PAYMENT_STATUS_LABELS[p.status]}</td>
                          <td>{p.receipt_no && p.status === 'confirmed' ? <Link href={`/admin/payments/${p.id}/receipt`} target="_blank">{p.receipt_no}</Link> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="ad-sub" style={{ margin: 0 }}>None yet. When you record a payment on the booking, choose this invoice in &ldquo;Against invoice&rdquo;.</p>}
              {inv.booking_id ? <div className="ad-actions"><Link className="ad-btn ghost" href={`/admin/bookings/${inv.booking_id}`}>Record a payment on the booking</Link></div> : null}
            </section>
          ) : null}

          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">{history.map((a) => <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>)}</ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No changes recorded yet.</p>}
          </section>
        </div>

        <aside>
          {inv.status === 'draft' ? (
            <section className="ad-panel">
              <h2>Issue</h2>
              {ctx.admin.isOwner ? (
                <>
                  <p className="ad-sub" style={{ marginTop: 0 }}>Issuing gives the invoice its permanent number and locks the lines. Save any changes first.</p>
                  <form action={issueInvoice.bind(null, id)}><ConfirmButton className="ad-btn" message="Issue this invoice? It gets a permanent number and the lines can no longer be edited.">Issue invoice</ConfirmButton></form>
                </>
              ) : <p className="ad-sub" style={{ margin: 0 }}>Only an owner can issue an invoice. Save your changes and ask an owner to issue it.</p>}
            </section>
          ) : null}
          {inv.status === 'sent' ? (
            <section className="ad-panel">
              <h2>Send</h2>
              <p className="ad-sub" style={{ marginTop: 0 }}>Emails the invoice with the bank details to {inv.client_email || 'the client (no email on file)'}.</p>
              <form action={emailInvoice.bind(null, id)}><ConfirmButton className="ad-btn" message={`Email this invoice to ${inv.client_email || 'the client'} now?`}>Email to client</ConfirmButton></form>
            </section>
          ) : null}
          {inv.status === 'sent' && ctx.admin.isOwner ? <VoidInvoiceForm id={id} /> : null}
          {inv.status === 'draft' ? (
            <form action={deleteInvoice.bind(null, id)} className="ad-panel">
              <h2>Delete draft</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Drafts have no number yet, so deleting one leaves no gap in your invoice numbers.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this draft invoice?">Delete draft</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
