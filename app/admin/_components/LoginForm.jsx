'use client';

import { useActionState } from 'react';
import { signIn } from '../actions';

export default function LoginForm({ denied }) {
  const [state, action, pending] = useActionState(signIn, null);
  const error = (state && state.error) || (denied ? 'This account does not have admin access.' : '');
  return (
    <form action={action} className="ad-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error ? <p className="ad-err" role="alert">{error}</p> : null}
      <div className="ad-actions">
        <button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </div>
    </form>
  );
}
