'use client';

import { useActionState } from 'react';
import { saveBooking } from '../actions-money';
import { CURRENCIES, BOOKING_STATUSES, BOOKING_STATUS_LABELS } from '../../../lib/admin/money';

// Create or edit a booking. When creating, a client must be chosen; the currency cannot change once payments exist.
export default function BookingForm({ id, booking, clients = [], staff = [], defaultClientId = '' }) {
  const [state, action, pending] = useActionState(saveBooking.bind(null, id || null), null);
  const b = booking || {};
  return (
    <form action={action} className="ad-panel ad-form" noValidate>
      <h2>{id ? 'Booking details' : 'New booking'}</h2>
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

      <label htmlFor="journey">Journey *</label>
      <input id="journey" name="journey" defaultValue={b.journey || ''} required maxLength={300} placeholder="e.g. The Botswana Grand Safari" />

      <div className="ad-twocol">
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={b.status || 'provisional'}>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="travellers">Travellers</label>
          <input id="travellers" name="travellers" type="number" min="1" max="200" defaultValue={b.travellers || ''} />
        </div>
        <div>
          <label htmlFor="departure_date">Departure date</label>
          <input id="departure_date" name="departure_date" type="date" defaultValue={b.departure_date || ''} />
        </div>
        <div>
          <label htmlFor="return_date">Return date</label>
          <input id="return_date" name="return_date" type="date" defaultValue={b.return_date || ''} />
        </div>
      </div>

      <div className="ad-twocol">
        <div>
          <label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={b.currency || 'USD'}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="total_price">Total price</label>
          <input id="total_price" name="total_price" inputMode="decimal" defaultValue={b.total_price ? String(b.total_price) : ''} placeholder="e.g. 20800" />
        </div>
        <div>
          <label htmlFor="deposit_percent">Deposit %</label>
          <input id="deposit_percent" name="deposit_percent" inputMode="decimal" defaultValue={b.deposit_percent ?? 30} />
        </div>
        <div>
          <label htmlFor="assigned_to">Looked after by</label>
          <select id="assigned_to" name="assigned_to" defaultValue={b.assigned_to || ''}>
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deposit_due_on">Deposit due on</label>
          <input id="deposit_due_on" name="deposit_due_on" type="date" defaultValue={b.deposit_due_on || ''} />
        </div>
        <div>
          <label htmlFor="balance_due_on">Balance due on</label>
          <input id="balance_due_on" name="balance_due_on" type="date" defaultValue={b.balance_due_on || ''} />
        </div>
      </div>
      <p className="ad-sub" style={{ margin: '6px 0 0' }}>Leave &ldquo;Balance due on&rdquo; empty and it is set to 60 days before departure, as promised on the website.</p>

      <label htmlFor="notes">Notes (private)</label>
      <textarea id="notes" name="notes" defaultValue={b.notes || ''} maxLength={5000} />
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save booking' : 'Create booking'}</button></div>
    </form>
  );
}
