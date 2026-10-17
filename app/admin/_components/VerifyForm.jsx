'use client';

import { useActionState } from 'react';
import { verifyCode, signOut } from '../actions';

export default function VerifyForm() {
  const [state, action, pending] = useActionState(verifyCode, null);
  return (
    <>
      <form action={action} className="ad-form" noValidate>
        <label htmlFor="code">6-digit code</label>
        <input id="code" name="code" className="ad-codeinput" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
        {state && state.error ? <p className="ad-err" role="alert">{state.error}</p> : null}
        <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Checking…' : 'Continue'}</button></div>
      </form>
      <form action={signOut} style={{ marginTop: 18 }}><button className="ad-btn ghost" type="submit">Sign out</button></form>
    </>
  );
}
