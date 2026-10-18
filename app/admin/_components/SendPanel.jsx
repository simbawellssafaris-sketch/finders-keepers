'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBatch } from '../actions-news';

// Sends a queued issue in small batches while this page stays open, and shows live progress.
// It is safe to close the page: come back and press "Continue sending" and it picks up where it stopped.
export default function SendPanel({ id, total, initial, autoStart }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState('');
  const stop = useRef(false);
  const started = useRef(false);

  const finished = (x) => x.queued === 0 && x.sending === 0;
  const run = async () => {
    if (running) return;
    stop.current = false;
    setRunning(true);
    setNote('');
    try {
      for (let guard = 0; guard < 5000 && !stop.current; guard++) {
        window.__fsBusy = Date.now(); // tells the idle timer that work is in progress, so a long send is not cut off
        const r = await sendBatch(id);
        window.__fsBusy = Date.now();
        if (r.error) { setNote(r.error); break; }
        setP((old) => ({ ...old, queued: r.queued, sending: r.sending, sent: r.sent, failed: r.failed, skipped: r.skipped }));
        if (r.done) { setNote('All done.'); router.refresh(); break; } // refresh so the status badge and the list of failures update
        if (r.paused) {
          const when = new Date(r.until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          setNote(`Paused: the mailbox may send ${r.limit} emails per hour. Press "Continue sending" after ${when} (this page can stay open or be closed).`);
          break;
        }
      }
    } catch {
      setNote('The connection dropped. Press "Continue sending" to carry on; nothing is sent twice.');
    }
    setRunning(false);
  };

  useEffect(() => {
    if (autoStart && !started.current && !finished(initial)) { started.current = true; run(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = p.sent + p.failed + p.skipped;
  const pct = total ? Math.round((done / total) * 100) : 100;
  return (
    <section className="ad-panel">
      <h2>{finished(p) ? 'Sending finished' : 'Sending'}</h2>
      <div className="ad-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      <p style={{ margin: '10px 0 0' }}><strong>{p.sent}</strong> sent &middot; <strong>{p.queued + p.sending}</strong> waiting &middot; <strong style={p.failed ? { color: '#a63a22' } : undefined}>{p.failed}</strong> failed{p.skipped ? <> &middot; {p.skipped} skipped</> : null} &middot; {total} in total</p>
      {note ? <p className="ad-sub" role="status" style={{ margin: '8px 0 0' }}>{note}</p> : null}
      {!finished(p) ? (
        <div className="ad-actions">
          {running ? <button className="ad-btn ghost" type="button" onClick={() => { stop.current = true; }}>Pause</button> : <button className="ad-btn" type="button" onClick={run}>{done ? 'Continue sending' : 'Start sending'}</button>}
        </div>
      ) : null}
      {running ? <p className="ad-sub" style={{ margin: '10px 0 0' }}>Keep this page open while it sends.</p> : null}
    </section>
  );
}
