import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { UUID } from '../../../../../lib/admin/config';
import { fmtDay } from '../../../../../lib/admin/format';
import { BOOKING_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, fmtMoney, toCents, fromCents } from '../../../../../lib/admin/money';
import PrintButton from '../../../_components/PrintButton';

export const dynamic = 'force-dynamic';

// A clean one-page booking summary: print it or save it as a PDF from the browser.
export default async function PrintBooking({ params }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: b } = await supabase.from('booking_summary').select('*').eq('id', id).maybeSingle();
  if (!b) notFound();
  const [{ data: payments }, { data: rows }] = await Promise.all([
    supabase.from('payments').select('*').eq('booking_id', id).eq('status', 'confirmed').order('paid_on'),
    supabase.from('business_settings').select('key,value'),
  ]);
  const s = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
  const deposit = fromCents(Math.round(toCents(b.total_price) * Number(b.deposit_percent) / 100));
  const bank = [['Account name', s.account_name], ['Bank', s.bank_name], ['Branch', s.bank_branch], ['Account type', s.account_type], ['Account number', s.account_number], ['SWIFT / BIC', s.swift_code]].filter(([, v]) => v);

  return (
    <div className="ad-print">
      <div className="ad-noprint" style={{ marginBottom: 20 }}><PrintButton /></div>
      <header>
        <h1>{s.legal_name || 'Finders Keepers Safaris Limited'}</h1>
        <p>{[s.address, s.phone, s.email].filter(Boolean).join(' · ')}{s.kra_pin ? ` · KRA PIN ${s.kra_pin}` : ''}</p>
      </header>
      <h2>Booking summary &middot; {b.reference}</h2>
      <table className="ad-ptable">
        <tbody>
          <tr><th>Client</th><td>{b.client_name}{b.client_email ? ` · ${b.client_email}` : ''}{b.client_phone ? ` · ${b.client_phone}` : ''}</td></tr>
          <tr><th>Journey</th><td>{b.journey}</td></tr>
          <tr><th>Travellers</th><td>{b.travellers || '—'}</td></tr>
          <tr><th>Dates</th><td>{b.departure_date ? fmtDay(b.departure_date) : 'To be agreed'}{b.return_date ? ` to ${fmtDay(b.return_date)}` : ''}</td></tr>
          <tr><th>Status</th><td>{BOOKING_STATUS_LABELS[b.status]}</td></tr>
          <tr><th>Total price</th><td><strong>{fmtMoney(b.total_price, b.currency)}</strong></td></tr>
          <tr><th>Deposit ({Number(b.deposit_percent)}%)</th><td>{fmtMoney(deposit, b.currency)}{b.deposit_due_on ? ` · due ${fmtDay(b.deposit_due_on)}` : ''}</td></tr>
          <tr><th>Balance due</th><td>{b.balance_due_on ? fmtDay(b.balance_due_on) : 'To be agreed'}</td></tr>
          <tr><th>Paid so far</th><td>{fmtMoney(b.paid, b.currency)}</td></tr>
          <tr><th>Outstanding</th><td><strong>{fmtMoney(b.outstanding, b.currency)}</strong></td></tr>
        </tbody>
      </table>

      {payments && payments.length ? (
        <>
          <h3>Payments received</h3>
          <table className="ad-ptable">
            <thead><tr><th>Date</th><th>For</th><th>Paid by</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDay(p.paid_on)}</td><td>{PAYMENT_KIND_LABELS[p.kind]}</td><td>{PAYMENT_METHOD_LABELS[p.method]}</td><td>{p.reference || ''}</td>
                  <td style={{ textAlign: 'right' }}>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {bank.length ? (
        <>
          <h3>How to pay</h3>
          <table className="ad-ptable"><tbody>{bank.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
          <p style={{ fontSize: 13 }}>Please quote <strong>{b.reference}</strong> as the payment reference.</p>
        </>
      ) : null}
    </div>
  );
}
