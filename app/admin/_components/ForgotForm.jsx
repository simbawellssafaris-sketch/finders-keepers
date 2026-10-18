'use client';

import { useActionState } from 'react';
import { requestReset } from '../actions';

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, null);
  if (state && state.sent) {
    return <p className="ad-ok" role="status">If that email belongs to a team member, a reset link is on its way. It is valid for one hour and can be used once. Check your spam folder if it does not arrive within a few minutes.</p>;
  }
  return (
    <form action={action} className="ad-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      {state && state.error ? <p className="ad-err" role="alert">{state.error}</p> : null}
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button></div>
    </form>
  );
}
