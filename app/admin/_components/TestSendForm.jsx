'use client';

import { useActionState } from 'react';
import { sendTest } from '../actions-news';

// "Send me a test": a copy of the saved draft to the signed-in person's own address.
export default function TestSendForm({ id, email }) {
  const [state, action, pending] = useActionState(sendTest.bind(null, id), null);
  return (
    <form action={action} className="ad-panel">
      <h2>Send yourself a test</h2>
      <p className="ad-sub" style={{ marginTop: 0 }}>Sends the <strong>saved</strong> draft to {email}, so you can see it in a real inbox. Save any changes first.</p>
      {state && state.error ? <p className="ad-err" role="alert">{state.error}</p> : null}
      {state && state.ok ? <p className="ad-ok" role="status">{state.ok}</p> : null}
      <button className="ad-btn ghost" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send me a test'}</button>
    </form>
  );
}
