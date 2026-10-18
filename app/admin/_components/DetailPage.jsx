import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin/auth';
import { getStaff } from '../../../lib/admin/staff';
import { TABLES, UUID, STATUSES, STATUS_LABELS } from '../../../lib/admin/config';
import { fmtDate, fmtDay, whatsappDigits, todayNairobi } from '../../../lib/admin/format';
import { updateEntry, deleteEntry } from '../actions';
import { convertToBooking } from '../actions-money';
import { quoteFromEnquiry } from '../actions-docs';
import { describeActivity } from '../../../lib/admin/activity';
import ConfirmButton from './ConfirmButton';
import Shell from './Shell';

const humanise = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// One enquiry or service request: everything the customer sent, plus follow-up controls and the history.
export default async function DetailPage({ table, params }) {
  const cfg = TABLES[table];
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: row } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  const [{ staff }, { data: history }] = await Promise.all([
    getStaff(supabase),
    supabase.from('activity_log').select('*').eq('entity_table', table).eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
  ]);

  const { data: linkedBooking } = table === 'enquiries' ? await supabase.from('bookings').select('id, reference').eq('enquiry_id', id).maybeSingle() : { data: null };
  const { data: quotes } = table === 'enquiries' ? await supabase.from('quotations').select('id, reference, title').eq('enquiry_id', id).order('created_at') : { data: null };
  const wa = whatsappDigits(row.phone);
  const details = row.details && typeof row.details === 'object' ? Object.entries(row.details) : [];
  const save = updateEntry.bind(null, table, id);
  const remove = deleteEntry.bind(null, table, id);
  const overdue = row.follow_up_on && row.follow_up_on <= todayNairobi() && ['new', 'contacted', 'quoted'].includes(row.status);

  return (
    <Shell ctx={ctx} current={table}>
      <Link className="ad-back" href={`/admin/${cfg.path}`}>&larr; Back to {cfg.label.toLowerCase()}</Link>
      <h1>{row.name || cfg.singular}</h1>
      <p className="ad-sub">
        <span className={`badge st-${row.status}`}>{STATUS_LABELS[row.status]}</span> &nbsp; Received {fmtDate(row.created_at)}
        {row.updated_at && row.updated_at !== row.created_at ? <> &middot; last changed {fmtDate(row.updated_at)}</> : null}
        {row.follow_up_on ? <> &middot; <span className={overdue ? 'ad-due' : ''}>follow-up {fmtDay(row.follow_up_on)}{overdue ? ' (due)' : ''}</span></> : null}
      </p>

      <div className="ad-detail">
        <div>
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

          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">
                {history.map((a) => (
                  <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>
                ))}
              </ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No changes yet. Anything you change here is recorded with your name and the time.</p>}
          </section>
        </div>

        <aside>
          <form key={`${row.status}-${row.updated_at}`} action={save} className="ad-panel ad-form">
            <h2>Follow-up</h2>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={row.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <div className="ad-twocol">
              <div>
                <label htmlFor="assigned_to">Assigned to</label>
                <select id="assigned_to" name="assigned_to" defaultValue={row.assigned_to || ''}>
                  <option value="">Nobody yet</option>
                  {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="follow_up_on">Follow up on</label>
                <input id="follow_up_on" name="follow_up_on" type="date" defaultValue={row.follow_up_on || ''} />
              </div>
            </div>
            <label htmlFor="admin_notes">Private notes (customers never see these)</label>
            <textarea id="admin_notes" name="admin_notes" defaultValue={row.admin_notes || ''} maxLength={5000} />
            <div className="ad-actions"><button className="ad-btn" type="submit">Save</button></div>
          </form>
          {table === 'enquiries' ? (
            <div className="ad-panel">
              <h2>Quotation</h2>
              {quotes && quotes.length ? (
                <ul className="ad-doclist">
                  {quotes.map((x) => <li key={x.id}><span><Link href={`/admin/quotations/${x.id}`}><strong>{x.reference}</strong></Link><small>{x.title}</small></span></li>)}
                </ul>
              ) : null}
              <form action={quoteFromEnquiry.bind(null, id)}>
                <p className="ad-sub" style={{ margin: '0 0 12px' }}>Prepare a priced quotation with line items. The client is created (or found) for you.</p>
                <button className="ad-btn ghost" type="submit">Create quotation</button>
              </form>
            </div>
          ) : null}
          {table === 'enquiries' ? (
            <div className="ad-panel">
              <h2>Booking</h2>
              {linkedBooking ? (
                <p style={{ margin: 0 }}>This enquiry became booking <Link href={`/admin/bookings/${linkedBooking.id}`}><strong>{linkedBooking.reference}</strong></Link>.</p>
              ) : (
                <form action={convertToBooking.bind(null, id)}>
                  <p className="ad-sub" style={{ marginBottom: 12 }}>The customer said yes? Turn this into a booking. The client is created (or found) for you, and the 30% deposit and balance dates are worked out automatically.</p>
                  <button className="ad-btn" type="submit">Convert to booking</button>
                </form>
              )}
            </div>
          ) : null}
          {ctx.admin.isOwner ? (
            <form action={remove} className="ad-panel">
              <h2>Delete</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Removes this entry permanently. Mark it as Spam instead if you may want to review it later.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this entry permanently? This cannot be undone.">Delete permanently</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
