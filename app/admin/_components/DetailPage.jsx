import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import { TABLES, UUID, STATUSES, STATUS_LABELS } from '../../../lib/admin/config';
import { fmtDate, whatsappDigits } from '../../../lib/admin/format';
import { updateEntry, deleteEntry } from '../actions';
import ConfirmButton from './ConfirmButton';
import Shell from './Shell';

const humanise = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// One enquiry or service request: everything the customer sent, plus status, private notes and quick reply buttons.
export default async function DetailPage({ table, params }) {
  const cfg = TABLES[table];
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: row } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (!row) notFound();

  const wa = whatsappDigits(row.phone);
  const details = row.details && typeof row.details === 'object' ? Object.entries(row.details) : [];
  const save = updateEntry.bind(null, table, id);
  const remove = deleteEntry.bind(null, table, id);

  return (
    <Shell user={user} current={table}>
      <Link className="ad-back" href={`/admin/${cfg.path}`}>&larr; Back to {cfg.label.toLowerCase()}</Link>
      <h1>{row.name || cfg.singular}</h1>
      <p className="ad-sub">
        <span className={`badge st-${row.status}`}>{STATUS_LABELS[row.status]}</span> &nbsp; Received {fmtDate(row.created_at)}
        {row.updated_at && row.updated_at !== row.created_at ? <> &middot; last changed {fmtDate(row.updated_at)}</> : null}
      </p>

      <div className="ad-detail">
        <section className="ad-panel">
          <h2>What they sent</h2>
          <div className="ad-quick">
            {row.email ? <a className="ad-btn" href={`mailto:${encodeURIComponent(row.email)}`}>Reply by email</a> : null}
            {wa ? <a className="ad-btn ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">Open WhatsApp</a> : null}
          </div>
          <dl className="ad-fields">
            {cfg.fields.map(([label, get]) => {
              const v = get(row);
              return v === null || v === undefined || v === '' ? null : (<Fragment key={label}><dt>{label}</dt><dd>{String(v)}</dd></Fragment>);
            })}
            {details.map(([k, v]) => (
              <Fragment key={k}><dt>{humanise(k)}</dt><dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd></Fragment>
            ))}
          </dl>
        </section>

        <aside>
          <form key={`${row.status}-${row.updated_at}`} action={save} className="ad-panel ad-form">
            <h2>Follow-up</h2>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={row.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <label htmlFor="admin_notes">Private notes (customers never see these)</label>
            <textarea id="admin_notes" name="admin_notes" defaultValue={row.admin_notes || ''} maxLength={5000} />
            <div className="ad-actions"><button className="ad-btn" type="submit">Save</button></div>
          </form>
          <form action={remove} className="ad-panel">
            <h2>Delete</h2>
            <p className="ad-sub" style={{ marginBottom: 12 }}>Removes this entry permanently. Mark it as Spam instead if you may want to review it later.</p>
            <ConfirmButton className="ad-btn danger" message="Delete this entry permanently? This cannot be undone.">Delete permanently</ConfirmButton>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
