'use client';

import { useActionState } from 'react';
import { saveInvoice } from '../actions-docs';
import ItemsEditor from './ItemsEditor';

// Editing an invoice. A draft can be changed freely; once issued only the due date and the private note can change.
export default function InvoiceForm({ id, invoice, items = [] }) {
  const [state, action, pending] = useActionState(saveInvoice.bind(null, id), null);
  const locked = invoice.status !== 'draft';
  return (
    <form action={action} className="ad-panel ad-form" noValidate>
      <h2>{locked ? 'Due date and notes' : 'Invoice details'}</h2>
      {locked ? <p className="ad-sub" style={{ marginTop: 0 }}>This invoice has been issued, so its lines cannot change. To correct it, void it and make a new one.</p> : null}
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Saved.</p> : null}

      {!locked ? (
        <>
          <label htmlFor="title">Title *</label>
          <input id="title" name="title" defaultValue={invoice.title} required maxLength={300} />
        </>
      ) : null}
      <label htmlFor="due_date">Due date</label>
      <input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date || ''} style={{ maxWidth: 220 }} />

      {!locked ? (
        <>
          <label>Lines ({invoice.currency})</label>
          <ItemsEditor initial={items} currency={invoice.currency} />
          <label htmlFor="intro">Message to the client</label>
          <textarea id="intro" name="intro" defaultValue={invoice.intro || ''} maxLength={3000} style={{ minHeight: 80 }} />
          <label htmlFor="terms">Terms</label>
          <textarea id="terms" name="terms" defaultValue={invoice.terms || ''} maxLength={5000} style={{ minHeight: 80 }} />
        </>
      ) : null}
      <label htmlFor="notes">Private notes (never shown to the client)</label>
      <textarea id="notes" name="notes" defaultValue={invoice.notes || ''} maxLength={5000} style={{ minHeight: 70 }} />
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button></div>
    </form>
  );
}
