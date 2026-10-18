'use client';

import { useActionState } from 'react';
import { saveClient } from '../actions-money';

// Add or edit a client.
export default function ClientForm({ id, client }) {
  const [state, action, pending] = useActionState(saveClient.bind(null, id || null), null);
  const c = client || {};
  return (
    <form action={action} className="ad-panel ad-form" noValidate>
      <h2>{id ? 'Client details' : 'New client'}</h2>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Saved.</p> : null}
      <label htmlFor="full_name">Full name *</label>
      <input id="full_name" name="full_name" defaultValue={c.full_name || ''} required maxLength={200} />
      <div className="ad-twocol">
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={c.email || ''} maxLength={254} /></div>
        <div><label htmlFor="phone">Phone / WhatsApp</label><input id="phone" name="phone" defaultValue={c.phone || ''} maxLength={60} /></div>
      </div>
      <label htmlFor="country">Country</label>
      <input id="country" name="country" defaultValue={c.country || ''} maxLength={100} />
      <label htmlFor="notes">Notes (private)</label>
      <textarea id="notes" name="notes" defaultValue={c.notes || ''} maxLength={5000} />
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save' : 'Add client'}</button></div>
    </form>
  );
}
