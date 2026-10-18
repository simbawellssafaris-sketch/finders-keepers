'use client';

import { useActionState, useState } from 'react';
import { saveQuotation } from '../actions-docs';
import { CURRENCIES, DEFAULT_QUOTE_TERMS } from '../../../lib/admin/money';
import ItemsEditor from './ItemsEditor';

export default function QuotationForm({ id, quotation, items = [], clients = [], defaultClientId = '', defaultTitle = '' }) {
  const [state, action, pending] = useActionState(saveQuotation.bind(null, id || null), null);
  const q = quotation || {};
  const [currency, setCurrency] = useState(q.currency || 'USD');
  return (
    <form action={action} className="ad-panel ad-form" noValidate>
      <h2>{id ? 'Quotation' : 'New quotation'}</h2>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Saved.</p> : null}

      {!id ? (
        <>
          <label htmlFor="client_id">Client *</label>
          <select id="client_id" name="client_id" defaultValue={defaultClientId} required>
            <option value="">Choose a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.email ? ` (${c.email})` : ''}</option>)}
          </select>
          <p className="ad-sub" style={{ margin: '6px 0 0' }}>Not in the list? Add them under Clients first.</p>
        </>
      ) : null}

      <label htmlFor="title">Title *</label>
      <input id="title" name="title" defaultValue={q.title || defaultTitle} required maxLength={300} placeholder="e.g. Botswana Grand Safari for 4 travellers" />

      <div className="ad-twocol">
        <div>
          <label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="valid_until">Valid until</label>
          <input id="valid_until" name="valid_until" type="date" defaultValue={q.valid_until || ''} />
        </div>
      </div>

      <label>Lines</label>
      <ItemsEditor initial={items} currency={currency} />

      <label htmlFor="intro">Message to the client (shown above the lines)</label>
      <textarea id="intro" name="intro" defaultValue={q.intro || ''} maxLength={3000} style={{ minHeight: 90 }} />
      <label htmlFor="terms">Terms</label>
      <textarea id="terms" name="terms" defaultValue={q.terms ?? (id ? '' : DEFAULT_QUOTE_TERMS)} maxLength={5000} style={{ minHeight: 90 }} />
      <label htmlFor="notes">Private notes (never shown to the client)</label>
      <textarea id="notes" name="notes" defaultValue={q.notes || ''} maxLength={5000} style={{ minHeight: 70 }} />
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save quotation' : 'Create quotation'}</button></div>
    </form>
  );
}
