'use client';

import { useActionState, useEffect, useRef } from 'react';
import { uploadDocument } from '../actions-docs';
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS } from '../../../lib/admin/money';

export default function UploadForm({ clientId, bookingId = '' }) {
  const [state, action, pending] = useActionState(uploadDocument.bind(null, clientId, bookingId), null);
  const form = useRef(null);
  useEffect(() => { if (state && state.saved && form.current) form.current.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="ad-form" style={{ marginTop: 14 }}>
      {state && state.error ? <p className="ad-err" role="alert" style={{ marginTop: 0 }}>{state.error}</p> : null}
      {state && state.saved ? <p className="ad-ok" role="status">Uploaded.</p> : null}
      <div className="ad-twocol">
        <div>
          <label htmlFor={`file-${bookingId || 'c'}`}>File (PDF, JPG, PNG, WebP or Word, up to 10 MB)</label>
          <input id={`file-${bookingId || 'c'}`} name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" required />
        </div>
        <div>
          <label htmlFor={`cat-${bookingId || 'c'}`}>What is it?</label>
          <select id={`cat-${bookingId || 'c'}`} name="category" defaultValue="other">
            {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{DOC_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
      </div>
      <div className="ad-actions"><button className="ad-btn" type="submit" disabled={pending}>{pending ? 'Uploading…' : 'Upload'}</button></div>
    </form>
  );
}
