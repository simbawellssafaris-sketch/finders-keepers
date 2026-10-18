import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID } from '../../../../lib/admin/config';
import { describeActivity } from '../../../../lib/admin/activity';
import { fmtDate, fmtDay, todayNairobi } from '../../../../lib/admin/format';
import { QUOTE_STATUS_LABELS, quoteDisplay, fmtMoney } from '../../../../lib/admin/money';
import { setQuotationStatus, emailQuotation, convertQuotationToBooking, deleteQuotation } from '../../actions-docs';
import ConfirmButton from '../../_components/ConfirmButton';
import QuotationForm from '../../_components/QuotationForm';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';

const ERRORS = {
  'no-email': 'This client has no valid email address. Add one on their client page first.',
  empty: 'Add at least one line with an amount before emailing it.',
  'email-failed': 'The email could not be sent. Please try again in a moment.',
  'email-off': 'Email is not switched on for this server yet (the SMTP settings are missing).',
  'owner-only': 'Only an owner can delete a quotation that has already been sent.',
};

export default async function QuotationPage({ params, searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  const sp = (await searchParams) || {};
  if (!UUID.test(String(id))) notFound();
  const { data: q } = await supabase.from('quotation_summary').select('*').eq('id', id).maybeSingle();
  if (!q) notFound();
  const [{ data: items }, { data: history }, { data: booking }] = await Promise.all([
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position'),
    supabase.from('activity_log').select('*').eq('entity_table', 'quotations').eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
    q.booking_id ? supabase.from('bookings').select('id, reference').eq('id', q.booking_id).maybeSingle() : { data: null },
  ]);
  const today = todayNairobi();
  const st = quoteDisplay(q, today);
  const set = (status) => setQuotationStatus.bind(null, id, status);

  return (
    <Shell ctx={ctx} current="quotations">
      <Link className="ad-back" href="/admin/quotations">&larr; Back to quotations</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>{q.reference} &middot; {q.title}</h1>
          <p className="ad-sub">
            <span className={`badge st-q-${st}`}>{QUOTE_STATUS_LABELS[st]}</span> &nbsp;
            <Link href={`/admin/clients/${q.client_id}`}><strong>{q.client_name}</strong></Link>
            {q.client_email ? <> &middot; {q.client_email}</> : <> &middot; <span className="ad-due">no email on file</span></>}
            {q.valid_until ? <> &middot; valid until {fmtDay(q.valid_until)}</> : null}
            {booking ? <> &middot; <Link href={`/admin/bookings/${booking.id}`}>booking {booking.reference}</Link></> : null}
          </p>
        </div>
        <Link className="ad-btn ghost" href={`/admin/quotations/${id}/print`} target="_blank">Print / save as PDF</Link>
      </div>
      {sp.sent === '1' ? <p className="ad-ok" role="status">Emailed to {q.client_email}.</p> : null}
      {ERRORS[sp.error] ? <p className="ad-err" role="alert">{ERRORS[sp.error]}</p> : null}

      <div className="ad-grid">
        <div className="ad-card"><div className="n" style={{ fontSize: 30 }}>{fmtMoney(q.total, q.currency)}</div><div className="l">Quotation total</div></div>
      </div>

      <div className="ad-detail">
        <div>
          <QuotationForm id={id} quotation={q} items={items || []} />
          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">{history.map((a) => <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>)}</ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No changes recorded yet.</p>}
          </section>
        </div>

        <aside>
          <section className="ad-panel">
            <h2>Send and follow up</h2>
            <div className="ad-stack">
              <form action={emailQuotation.bind(null, id)}><ConfirmButton className="ad-btn" message={`Email this quotation to ${q.client_email || 'the client'} now?`}>Email to client</ConfirmButton></form>
              {q.status === 'draft' ? <form action={set('sent')}><button className="ad-btn ghost" type="submit">Mark as sent (I sent it myself)</button></form> : null}
              {q.status === 'sent' ? (
                <>
                  <form action={set('accepted')}><button className="ad-btn ghost" type="submit">Client accepted</button></form>
                  <form action={set('declined')}><button className="ad-btn ghost" type="submit">Client declined</button></form>
                </>
              ) : null}
              {q.status === 'declined' || q.status === 'accepted' ? <form action={set('draft')}><button className="ad-btn ghost" type="submit">Reopen as draft</button></form> : null}
            </div>
          </section>

          <section className="ad-panel">
            <h2>Booking</h2>
            {booking ? (
              <p style={{ margin: 0 }}>Booking <Link href={`/admin/bookings/${booking.id}`}><strong>{booking.reference}</strong></Link> was created from this quotation.</p>
            ) : (
              <>
                <p className="ad-sub" style={{ marginTop: 0 }}>When the client says yes, this opens a booking with the same title, currency and total.</p>
                <form action={convertQuotationToBooking.bind(null, id)}><button className="ad-btn" type="submit">Accept and create booking</button></form>
              </>
            )}
          </section>

          {q.status === 'draft' || ctx.admin.isOwner ? (
            <form action={deleteQuotation.bind(null, id)} className="ad-panel">
              <h2>Delete</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Removes the quotation and its lines for good.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this quotation permanently?">Delete quotation</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
