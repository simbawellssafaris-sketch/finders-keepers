'use client';

import { useActionState, useRef, useEffect } from 'react';
import { recordPayment } from '../actions-money';
import { PAYMENT_KINDS, PAYMENT_KIND_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../../lib/admin/money';

// Record a payment on a booking. Staff entries wait for an owner to confirm that the money really arrived.
export default function PaymentForm({ bookingId, currency, isOwner, today, invoices = [] }) {
  const [state, action, pending] = useActionState(recordPayment.bind(null, bookingId), null);
  const form = useRef(null);
  useEffect(() => {
    if (state && state.saved && form.current) form.current.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="ad-panel ad-form" noValidate>
      <h2>Record a payment</h2>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Payment recorded.</p> : null}
      <div className="ad-twocol">
        <div>
          <label htmlFor="amount">Amount ({currency}) *</label>
          <input id="amount" name="amount" inputMode="decimal" required placeholder="e.g. 3000" />
        </div>
        <div>
          <label htmlFor="kind">For</label>
          <select id="kind" name="kind" defaultValue="deposit">
            {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{PAYMENT_KIND_LABELS[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="method">Paid by</label>
          <select id="method" name="method" defaultValue="mpesa">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="paid_on">Date paid</label>
          <input id="paid_on" name="paid_on" type="date" defaultValue={today} max={today} />
        </div>
      </div>
      {invoices.length ? (
        <>
          <label htmlFor="invoice_id">Against invoice (optional)</label>
          <select id="invoice_id" name="invoice_id" defaultValue="">
            <option value="">Not matched to an invoice</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.reference} ({i.title})</option>)}
          </select>
        </>
      ) : null}
      <label htmlFor="reference">Reference (M-Pesa code, bank slip number…)</label>
      <input id="reference" name="reference" maxLength={120} />
      <label htmlFor="pnotes">Notes</label>
      <input id="pnotes" name="notes" maxLength={1000} />
      {isOwner ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontSize: 14, margin: '14px 0 0' }}>
          <input type="checkbox" name="confirmed" value="yes" style={{ width: 'auto' }} /> I have seen this money arrive (confirm it now)
        </label>
      ) : <p className="ad-sub" style={{ margin: '12px 0 0' }}>It will show as &ldquo;waiting for confirmation&rdquo; until an owner confirms the money has arrived.</p>}
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Record payment'}</button></div>
    </form>
  );
}
