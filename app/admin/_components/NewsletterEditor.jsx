'use client';

import { useActionState, useState } from 'react';
import { saveNewsletter } from '../actions-news';
import { renderNewsletter } from '../../../lib/newsletter';

const STARTER = `# A note from the field

Hello {{first_name}},

Write your update here. A blank line starts a new paragraph.

## What's new

- A new camp we love
- Migration update: the herds are on the move

[[See the journeys|https://finderskeeperssafaris.com]]
`;

// Write an issue with a live preview of exactly what subscribers will see.
export default function NewsletterEditor({ id, newsletter, business, editable = true }) {
  const [state, action, pending] = useActionState(saveNewsletter.bind(null, id || null), null);
  const n = newsletter || {};
  const [subject, setSubject] = useState(n.subject || '');
  const [preview, setPreview] = useState(n.preview || '');
  const [body, setBody] = useState(id ? n.body || '' : STARTER);
  const mail = renderNewsletter({ subject, preview, body, firstName: 'Amina', unsubscribeUrl: null, business });
  return (
    <div className="ad-news">
      <form action={action} className="ad-panel ad-form" noValidate>
        <h2>{id ? 'Write the issue' : 'New issue'}</h2>
        {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
        {state && state.saved ? <p className="ad-ok" role="status">Saved.</p> : null}
        <label htmlFor="subject">Subject line *</label>
        <input id="subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required disabled={!editable} placeholder="e.g. The Great Migration has begun" />
        <label htmlFor="preview">Preview text (the grey line next to the subject in an inbox)</label>
        <input id="preview" name="preview" value={preview} onChange={(e) => setPreview(e.target.value)} maxLength={200} disabled={!editable} />
        <label htmlFor="body">Message</label>
        <textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={30000} disabled={!editable} style={{ minHeight: 320, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 13.5 }} />
        <details className="ad-help">
          <summary>How to format</summary>
          <ul>
            <li>A blank line starts a new paragraph.</li>
            <li><code># Big heading</code> and <code>## Smaller heading</code> on a line of their own.</li>
            <li><code>- </code> at the start of each line makes a bullet list.</li>
            <li><code>**bold**</code> and <code>[link text](https://...)</code>.</li>
            <li><code>[[Button text|https://...]]</code> on a line of its own makes a button.</li>
            <li><code>![describe the picture](https://...jpg)</code> shows a picture from a web address (https only).</li>
            <li><code>---</code> on a line of its own draws a divider.</li>
            <li><code>{'{{first_name}}'}</code> becomes the subscriber&rsquo;s first name, or &ldquo;there&rdquo; if we don&rsquo;t have one.</li>
          </ul>
          <p style={{ margin: '6px 0 0' }}>The footer with your company details and the unsubscribe link is added automatically.</p>
        </details>
        {editable ? <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : id ? 'Save draft' : 'Create draft'}</button></div> : null}
      </form>
      <div className="ad-panel">
        <h2>Preview</h2>
        <p className="ad-sub" style={{ margin: '0 0 10px' }}>Subject: <strong>{subject || '(no subject yet)'}</strong></p>
        <iframe title="Newsletter preview" className="ad-preview" sandbox="" srcDoc={mail.html} />
      </div>
    </div>
  );
}
