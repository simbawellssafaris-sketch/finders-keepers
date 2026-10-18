'use client';

import { useEffect, useRef, useState } from 'react';

// Signs the dashboard out after `minutes` without any mouse, keyboard, touch or scroll activity, with a warning shortly before.
// While someone is working it quietly tells the server "still here" (at most every 2 minutes) so a long form is never lost.
export default function IdleWatcher({ minutes }) {
  const last = useRef(Date.now());
  const pinged = useRef(Date.now());
  const warned = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    const limit = minutes * 60000;
    const warnAt = limit - Math.min(120000, limit / 2);

    const ping = () => {
      pinged.current = Date.now();
      fetch('/admin/ping', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
        .then((r) => { if (r.redirected || r.status !== 204) window.location.assign('/admin/login?expired=1'); })
        .catch(() => {}); // offline for a moment: the next check will try again
    };
    const active = () => {
      const now = Date.now();
      last.current = now;
      if (warned.current) { warned.current = false; setSecondsLeft(null); }
      if (now - pinged.current > 120000) ping();
    };
    const check = () => {
      // a page that is busy on someone's behalf (the newsletter sender) counts as activity
      if (window.__fsBusy && Date.now() - window.__fsBusy < 90000) { last.current = Date.now(); if (Date.now() - pinged.current > 120000) ping(); }
      const idle = Date.now() - last.current;
      if (idle >= limit) { window.location.assign('/admin/idle'); return; }
      if (idle >= warnAt) { warned.current = true; setSecondsLeft(Math.max(1, Math.ceil((limit - idle) / 1000))); }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, active));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [minutes]);

  if (secondsLeft === null) return null;
  const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
  return (
    <div className="ad-idle" role="alertdialog" aria-live="assertive" aria-label="Signing out soon">
      <span>You will be signed out in {m}:{String(s).padStart(2, '0')} because nothing has been touched for a while.</span>
      <button type="button" className="ad-btn" onClick={() => { last.current = Date.now(); warned.current = false; setSecondsLeft(null); fetch('/admin/ping', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }).catch(() => {}); }}>Stay signed in</button>
    </div>
  );
}
