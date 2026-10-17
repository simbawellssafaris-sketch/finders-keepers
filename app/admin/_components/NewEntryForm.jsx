'use client';

import { useActionState } from 'react';
import { createEntry } from '../actions';

// Log an enquiry that arrived outside the website (phone call, WhatsApp, email, in person).
export default function NewEntryForm({ staff, channels }) {
  const [state, action, pending] = useActionState(createEntry, null);
  return (
    <form action={action} className="ad-panel ad-form" noValidate>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      <div className="ad-twocol">
        <div><label htmlFor="name">Name *</label><input id="name" name="name" required maxLength={200} /></div>
        <div>
          <label htmlFor="channel">How did they contact you? *</label>
          <select id="channel" name="channel" defaultValue="whatsapp">
            {channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div><label htmlFor="phone">Phone / WhatsApp</label><input id="phone" name="phone" maxLength={60} /></div>
        <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" maxLength={254} /></div>
        <div><label htmlFor="travellers">Travellers</label><input id="travellers" name="travellers" type="number" min="1" max="100" /></div>
        <div><label htmlFor="interest">Interested in</label><input id="interest" name="interest" maxLength={200} placeholder="e.g. Safari, beach, honeymoon" /></div>
      </div>
      <label htmlFor="package">Journey they asked about</label>
      <input id="package" name="package" maxLength={300} placeholder="e.g. The Botswana Grand Safari" />
      <label htmlFor="notes">What they said</label>
      <textarea id="notes" name="notes" maxLength={5000} />
      <div className="ad-twocol">
        <div>
          <label htmlFor="assigned_to">Assigned to</label>
          <select id="assigned_to" name="assigned_to" defaultValue="">
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
        </div>
        <div><label htmlFor="follow_up_on">Follow up on</label><input id="follow_up_on" name="follow_up_on" type="date" /></div>
      </div>
      <p className="ad-sub" style={{ margin: '14px 0 0' }}>Give a phone number or an email, so you can reach them again.</p>
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save enquiry'}</button></div>
    </form>
  );
}
