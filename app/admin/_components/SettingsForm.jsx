'use client';

import { useActionState } from 'react';
import { saveSettings } from '../actions-money';

const GROUPS = [
  ['Company', [['legal_name', 'Legal name'], ['trading_name', 'Trading name'], ['email', 'Email on documents'], ['phone', 'Phone'], ['address', 'Postal / physical address'], ['kra_pin', 'KRA PIN']]],
  ['Bank details (shown on booking summaries)', [['account_name', 'Account name'], ['bank_name', 'Bank'], ['bank_branch', 'Branch'], ['account_type', 'Account type'], ['account_number', 'Account number'], ['swift_code', 'SWIFT / BIC']]],
];

export default function SettingsForm({ values }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="ad-form" noValidate>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Settings saved.</p> : null}
      {GROUPS.map(([title, fields]) => (
        <section className="ad-panel" key={title}>
          <h2>{title}</h2>
          <div className="ad-twocol">
            {fields.map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`s_${key}`}>{label}</label>
                <input id={`s_${key}`} name={key} defaultValue={values[key] || ''} maxLength={500} placeholder={values[key] ? '' : 'Not set yet'} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="ad-panel">
        <h2>Tax</h2>
        <label htmlFor="s_vat">Registered for VAT?</label>
        <select id="s_vat" name="vat_registered" defaultValue={values.vat_registered === 'yes' ? 'yes' : 'no'} style={{ maxWidth: 220 }}>
          <option value="no">No, not yet</option>
          <option value="yes">Yes</option>
        </select>
      </section>
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  );
}
