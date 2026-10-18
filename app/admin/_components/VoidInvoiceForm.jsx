'use client';

import { useActionState } from 'react';
import { voidInvoice } from '../actions-docs';

export default function VoidInvoiceForm({ id }) {
  const [state, action, pending] = useActionState(voidInvoice.bind(null, id), null);
  return (
    <form action={action} className="ad-panel ad-form" onSubmit={(e) => { if (!window.confirm('Void this invoice? It stays on record, marked void, and cannot be undone.')) e.preventDefault(); }}>
      <h2>Void this invoice</h2>
      <p className="ad-sub" style={{ marginTop: 0 }}>For a mistake. The invoice stays on record (its number is never reused), marked void.</p>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      <label htmlFor="reason">Reason *</label>
      <input id="reason" name="reason" maxLength={500} required />
      <div className="ad-actions"><button className="ad-btn danger" type="submit" disabled={pending}>{pending ? 'Voiding…' : 'Void invoice'}</button></div>
    </form>
  );
}
