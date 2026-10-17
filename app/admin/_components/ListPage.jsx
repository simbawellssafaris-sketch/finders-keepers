import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { getStaff } from '../../../lib/admin/staff';
import { TABLES, CHANNELS, CHANNEL_LABELS, OPEN_STATUSES, UUID } from '../../../lib/admin/config';
import { fmtDate, fmtDay, safeSearch, todayNairobi } from '../../../lib/admin/format';
import { setSubscription, deleteEntry } from '../actions';
import ConfirmButton from './ConfirmButton';
import Shell from './Shell';

const PAGE_SIZE = 25;

// Search + filter + paging for one kind of submission. The database decides what this person may see (staff only).
export default async function ListPage({ table, searchParams }) {
  const cfg = TABLES[table];
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  const { staff, names } = await getStaff(supabase);
  const worksOn = table !== 'newsletter_subscribers'; // enquiries and service requests have channels, owners and follow-ups
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const filter = cfg.filter.values.includes(sp.filter) ? sp.filter : '';
  const channel = worksOn && CHANNELS.includes(sp.channel) ? sp.channel : '';
  const assignee = worksOn ? (sp.assignee === 'me' ? user.id : sp.assignee === 'none' ? 'none' : UUID.test(String(sp.assignee)) && names[sp.assignee] ? sp.assignee : '') : '';
  const due = worksOn && sp.due === '1';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const today = todayNairobi();

  let query = supabase.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter) query = query.eq(cfg.filter.column, filter);
  if (channel) query = query.eq('channel', channel);
  if (assignee === 'none') query = query.is('assigned_to', null);
  else if (assignee) query = query.eq('assigned_to', assignee);
  if (due) query = query.not('follow_up_on', 'is', null).lte('follow_up_on', today).in('status', OPEN_STATUSES);
  if (q) query = query.or(cfg.search.map((c) => `${c}.ilike.%${q}%`).join(','));
  const { data: rows, count, error } = await query;

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = q || filter || channel || assignee || due;
  const href = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filter) params.set('filter', filter);
    if (channel) params.set('channel', channel);
    if (sp.assignee && assignee) params.set('assignee', sp.assignee);
    if (due) params.set('due', '1');
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/${cfg.path}${s ? `?${s}` : ''}`;
  };
  const exportHref = `/admin/export/${cfg.path}${filter ? `?filter=${filter}` : ''}`;
  const isSubs = table === 'newsletter_subscribers';

  return (
    <Shell ctx={ctx} current={table}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>{cfg.label}</h1>
          <p className="ad-sub">{total} {total === 1 ? 'entry' : 'entries'}{active ? ' match your search' : ' in total'}. Newest first. Times are East Africa Time.</p>
        </div>
        {table === 'enquiries' ? <Link className="ad-btn" href="/admin/enquiries/new">+ Log an enquiry</Link> : null}
      </div>

      <form className="ad-toolbar" method="get" action={`/admin/${cfg.path}`}>
        <input type="search" name="q" defaultValue={q} placeholder="Search name, email, phone…" aria-label="Search" />
        <select name="filter" defaultValue={filter} aria-label="Filter by status">
          <option value="">{isSubs ? 'All subscribers' : 'All statuses'}</option>
          {cfg.filter.values.map((v) => <option key={v} value={v}>{cfg.filter.labels[v]}</option>)}
        </select>
        {worksOn ? (
          <>
            <select name="channel" defaultValue={channel} aria-label="Filter by channel">
              <option value="">Any channel</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
            <select name="assignee" defaultValue={sp.assignee && assignee ? sp.assignee : ''} aria-label="Filter by owner">
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
              {staff.filter((s) => s.user_id !== user.id).map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
            <label className="ad-check"><input type="checkbox" name="due" value="1" defaultChecked={due} /> Follow-up due</label>
          </>
        ) : null}
        <button className="ad-btn" type="submit">Search</button>
        {active ? <Link className="ad-btn ghost" href={`/admin/${cfg.path}`}>Clear</Link> : null}
        <span style={{ flex: 1 }} />
        <a className="ad-btn ghost" href={exportHref}>Download CSV</a>
      </form>

      {error ? <div className="ad-empty">Could not load this list. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{active ? 'Nothing matches that search.' : 'Nothing here yet. New submissions from the website will appear here.'}</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr><th>Received</th>{cfg.columns.map((c) => <th key={c.label}>{c.label}</th>)}{isSubs ? <th>Actions</th> : null}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="when">{fmtDate(r.created_at)}</td>
                  {cfg.columns.map((c) => {
                    if (c.followUp) {
                      const overdue = r.follow_up_on && r.follow_up_on <= today && OPEN_STATUSES.includes(r.status);
                      return <td key={c.label} className={overdue ? 'ad-due' : ''}>{r.follow_up_on ? fmtDay(r.follow_up_on) : <span style={{ color: 'var(--muted)' }}>&mdash;</span>}</td>;
                    }
                    if (c.assignee) return <td key={c.label}>{r.assigned_to ? <span className="ad-chip">{names[r.assigned_to] || 'Former staff'}</span> : <span style={{ color: 'var(--muted)' }}>&mdash;</span>}</td>;
                    const state = c.status ? r.status : c.plainStatus ? c.plainStatus(r) : null;
                    return (
                      <td key={c.label}>
                        {state ? <span className={`badge st-${state}`}>{c.status ? cfg.filter.labels[state] : c.get(r)}</span>
                          : c.link && !isSubs ? <Link href={`/admin/${cfg.path}/${r.id}`}><strong>{c.get(r) || '(no name)'}</strong></Link>
                          : c.get(r)}
                      </td>
                    );
                  })}
                  {isSubs ? (
                    <td>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <form action={setSubscription.bind(null, r.id, r.subscription === 'unsubscribed' ? 'subscribed' : 'unsubscribed')}>
                          <button className="ad-btn ghost" type="submit">{r.subscription === 'unsubscribed' ? 'Resubscribe' : 'Unsubscribe'}</button>
                        </form>
                        {ctx.admin.isOwner ? (
                          <form action={deleteEntry.bind(null, table, r.id)}>
                            <ConfirmButton className="ad-btn danger" message="Delete this subscriber permanently?">Delete</ConfirmButton>
                          </form>
                        ) : null}
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pages > 1 ? (
        <div className="ad-pager">
          <span>Page {page} of {pages}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            {page > 1 ? <Link className="ad-btn ghost" href={href(page - 1)}>Previous</Link> : null}
            {page < pages ? <Link className="ad-btn ghost" href={href(page + 1)}>Next</Link> : null}
          </span>
        </div>
      ) : null}
    </Shell>
  );
}
