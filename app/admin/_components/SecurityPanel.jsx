'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { enrollTotp, confirmTotp, removeTotp } from '../actions';

function ConfirmStep({ setup, onDone }) {
  const [state, action, pending] = useActionState(confirmTotp.bind(null, setup.factorId), null);
  useEffect(() => {
    if (state && state.done) onDone();
  }, [state, onDone]);
  return (
    <div>
      <ol style={{ paddingLeft: 20, lineHeight: 1.8 }}>
        <li>Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).</li>
        <li>In the app, choose <strong>Add account</strong> and <strong>scan this QR code</strong>:</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ad-qr" src={setup.qr} alt="QR code to scan with your authenticator app" />
      <p className="ad-sub" style={{ margin: '0 0 6px' }}>Can&rsquo;t scan? Type this key into the app instead:</p>
      <p style={{ margin: '0 0 18px' }}><span className="ad-secret">{setup.secret}</span></p>
      <form action={action} className="ad-form" noValidate>
        <label htmlFor="code">Then enter the 6-digit code the app shows</label>
        <input id="code" name="code" className="ad-codeinput" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
        {state && state.error ? <p className="ad-err" role="alert">{state.error}</p> : null}
        <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Checking…' : 'Turn on two-factor login'}</button></div>
      </form>
    </div>
  );
}

export default function SecurityPanel({ enabled, verified }) {
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [pending, start] = useTransition();

  const begin = () => start(async () => {
    setError('');
    const r = await enrollTotp();
    if (r.error) setError(r.error);
    else setSetup(r);
  });
  const remove = () => {
    if (!window.confirm('Turn off two-factor login for your account? Your account will be less protected.')) return;
    start(async () => { await removeTotp(); window.location.assign('/admin/security'); });
  };

  if (finished) {
    return (
      <div className="ad-panel">
        <p className="ad-ok">Two-factor login is now on. From your next sign-in you will be asked for a code.</p>
        <button className="ad-btn" onClick={() => window.location.assign('/admin/security')}>Done</button>
      </div>
    );
  }

  return (
    <div className="ad-panel" style={{ maxWidth: 640 }}>
      <h2>Two-factor login</h2>
      {enabled ? (
        <>
          <p className="ad-ok" style={{ margin: '0 0 14px' }}>It is <strong>on</strong>. After your password you enter a 6-digit code from your authenticator app.</p>
          <p className="ad-sub">Lost your phone? An owner can reset it for you from the Supabase dashboard (Authentication &rarr; Users).</p>
          {verified ? <button className="ad-btn danger" onClick={remove} disabled={pending}>Turn off two-factor login</button> : <p className="ad-sub">To change this, sign out and sign in again with your code first.</p>}
        </>
      ) : setup ? (
        <ConfirmStep setup={setup} onDone={() => { setSetup(null); setFinished(true); }} />
      ) : (
        <>
          <p>Two-factor login adds a second step when you sign in: a 6-digit code from an app on your phone. Even if someone learned your password, they could not get in without your phone.</p>
          <p className="ad-sub">It takes about two minutes. You will need an authenticator app on your phone.</p>
          {error ? <p className="ad-err" role="alert">{error}</p> : null}
          <div className="ad-actions"><button className="ad-btn" onClick={begin} disabled={pending}>{pending ? 'Starting…' : 'Set up two-factor login'}</button></div>
        </>
      )}
    </div>
  );
}
