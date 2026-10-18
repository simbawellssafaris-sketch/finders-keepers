import { fmtDate } from '../../../lib/admin/format';
import { DOC_CATEGORY_LABELS } from '../../../lib/admin/money';
import { deleteDocument } from '../actions-docs';
import ConfirmButton from './ConfirmButton';
import UploadForm from './UploadForm';

const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Private files for a client (or one booking): passports, visas, itineraries, vouchers. Downloads go through /admin/documents/[id].
export default async function DocumentsPanel({ supabase, clientId, bookingId = '', isOwner, backTo }) {
  let query = supabase.from('documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  if (bookingId) query = query.eq('booking_id', bookingId);
  const { data: docs } = await query;
  return (
    <section className="ad-panel">
      <h2>Documents</h2>
      <p className="ad-sub" style={{ margin: '0 0 12px' }}>Stored privately. Only signed-in team members can open them, and every link expires after a minute.</p>
      {docs && docs.length ? (
        <ul className="ad-doclist">
          {docs.map((d) => (
            <li key={d.id}>
              <span><a href={`/admin/documents/${d.id}`}><strong>{d.name}</strong></a><small>{DOC_CATEGORY_LABELS[d.category]} &middot; {size(d.size_bytes)} &middot; {fmtDate(d.created_at)}</small></span>
              {isOwner ? <form action={deleteDocument.bind(null, d.id, backTo)}><ConfirmButton className="ad-btn danger" message="Delete this file permanently?">Delete</ConfirmButton></form> : null}
            </li>
          ))}
        </ul>
      ) : <p className="ad-sub" style={{ margin: 0 }}>No documents yet.</p>}
      <UploadForm clientId={clientId} bookingId={bookingId} />
    </section>
  );
}
