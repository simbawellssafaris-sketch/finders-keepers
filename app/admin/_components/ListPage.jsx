import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin/auth';
import { TABLES } from '../../../lib/admin/config';
import { fmtDate, safeSearch } from '../../../lib/admin/format';
import { setSubscription, deleteEntry } from '../actions';
import ConfirmButton from './ConfirmButton';
import Shell from './Shell';

const PAGE_SIZE = 25;

// Search + filter + paging for one kind of submission. The database decides what this user may see (admins only).
export default async function ListPage({ table, searchParams }) {
  const cfg = TABLES[table];
  const { supabase, user } = await requireAdmin();
  const sp = (await searchParams) || {};
  const q = safeSearch(sp.q);
  const filter = cfg.filter.values.includes(sp.filter) ? sp.filter : '';
  const page = Math.max(1, parseInt(sp.page, 10) || 1);

  let query = supabase.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter) query = query.eq(cfg.filter.column, filter);
  if (q) query = query.or(cfg.search.map((c) => `${c}.ilike.%${q}%`).join(','));
  const { data: rows, count, error } = await query;

  const total = count || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filter) params.set('filter', filter);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/admin/${cfg.path}${s ? `?${s}` : ''}`;
  };
  const exportHref = `/admin/export/${cfg.path}${filter ? `?filter=${filter}` : ''}`;

  return (
    <Shell user={user} current={table}>
      <h1>{cfg.label}</h1>
      <p className="ad-sub">{total} {total === 1 ? 'entry' : 'entries'}{q || filter ? ' match your search' : ' in total'}. Newest first. Times are East Africa Time.</p>

      <form className="ad-toolbar" method="get" action={`/admin/${cfg.path}`}>
        <input type="search" name="q" defaultValue={q} placeholder="Search name, email, phone…" aria-label="Search" />
        <select name="filter" defaultValue={filter} aria-label="Filter by status">
          <option value="">All statuses</option>
          {cfg.filter.values.map((v) => <option key={v} value={v}>{cfg.filter.labels[v]}</option>)}
        </select>
        <button className="ad-btn" type="submit">Search</button>
        {(q || filter) ? <Link className="ad-btn ghost" href={`/admin/${cfg.path}`}>Clear</Link> : null}
        <span style={{ flex: 1 }} />
        <a className="ad-btn ghost" href={exportHref}>Download CSV</a>
      </form>

      {error ? <div className="ad-empty">Could not load this list. Please try again.</div> : null}
      {!error && !rows.length ? <div className="ad-empty">{q || filter ? 'Nothing matches that search.' : 'Nothing here yet. New submissions from the website will appear here.'}</div> : null}
      {!error && rows.length ? (
        <div className="ad-tablewrap">
          <table className="ad-table">
            <thead>
              <tr><th>Received</th>{cfg.columns.map((c) => <th key={c.label}>{c.label}</th>)}{table === 'newsletter_subscribers' ? <th>Actions</th> : null}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="when">{fmtDate(r.created_at)}</td>
                  {cfg.columns.map((c) => {
                    const state = c.status ? r.status : c.plainStatus ? c.plainStatus(r) : null;
                    return (
                      <td key={c.label}>
                        {state ? <span className={`badge st-${state}`}>{c.status ? cfg.filter.labels[state] : c.get(r)}</span>
                          : c.link && table !== 'newsletter_subscribers' ? <Link href={`/admin/${cfg.path}/${r.id}`}><strong>{c.get(r) || '(no name)'}</strong></Link>
                          : c.get(r)}
                      </td>
                    );
                  })}
                  {table === 'newsletter_subscribers' ? (
                    <td>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <form action={setSubscription.bind(null, r.id, r.subscription === 'unsubscribed' ? 'subscribed' : 'unsubscribed')}>
                          <button className="ad-btn ghost" type="submit">{r.subscription === 'unsubscribed' ? 'Resubscribe' : 'Unsubscribe'}</button>
                        </form>
                        <form action={deleteEntry.bind(null, table, r.id)}>
                          <ConfirmButton className="ad-btn danger" message="Delete this subscriber permanently?">Delete</ConfirmButton>
                        </form>
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
