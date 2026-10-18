'use client';

import { useActionState } from 'react';
import { setNewPassword } from '../actions';

export default function ResetForm({ twoFactor }) {
  const [state, action, pending] = useActionState(setNewPassword, null);
  return (
    <form action={action} className="ad-form" noValidate>
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required autoFocus />
      <label htmlFor="confirm">Type it again</label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      {twoFactor ? (
        <>
          <label htmlFor="code">6-digit code from your authenticator app</label>
          <input id="code" name="code" className="ad-codeinput" inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
        </>
      ) : null}
      {state && state.error ? <p className="ad-err" role="alert">{state.error}</p> : null}
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save new password'}</button></div>
    </form>
  );
}
