import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID, STATUS_LABELS } from '../../../../lib/admin/config';
import { describeActivity } from '../../../../lib/admin/activity';
import { fmtDate, fmtDay } from '../../../../lib/admin/format';
import { BOOKING_STATUS_LABELS, fmtMoney, totalsByCurrency, fmtTotals } from '../../../../lib/admin/money';
import { deleteClient } from '../../actions-money';
import ConfirmButton from '../../_components/ConfirmButton';
import ClientForm from '../../_components/ClientForm';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params, searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  const sp = (await searchParams) || {};
  if (!UUID.test(String(id))) notFound();
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (!client) notFound();

  const [{ data: bookings }, { data: enquiries }, { data: history }] = await Promise.all([
    supabase.from('booking_summary').select('id,reference,journey,status,currency,total_price,paid,outstanding,departure_date').eq('client_id', id).order('departure_date', { ascending: false, nullsFirst: true }),
    supabase.from('enquiries').select('id,created_at,package,interest,status').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*').eq('entity_table', 'clients').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const live = (bookings || []).filter((b) => b.status !== 'cancelled');

  return (
    <Shell ctx={ctx} current="clients">
      <Link className="ad-back" href="/admin/clients">&larr; Back to clients</Link>
      <h1>{client.full_name}</h1>
      <p className="ad-sub">Added {fmtDate(client.created_at)} &middot; booked {fmtTotals(totalsByCurrency(live, (b) => b.total_price))} &middot; paid {fmtTotals(totalsByCurrency(live, (b) => b.paid))} &middot; outstanding {fmtTotals(totalsByCurrency(live, (b) => b.outstanding))}</p>
      {sp.error === 'has-bookings' ? <p className="ad-err" role="alert">This client still has bookings, so they cannot be deleted.</p> : null}

      <div className="ad-detail">
        <div>
          <section className="ad-panel">
            <h2>Bookings</h2>
            {bookings && bookings.length ? (
              <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
                <table className="ad-table">
                  <thead><tr><th>Ref</th><th>Journey</th><th>Departs</th><th>Total</th><th>Outstanding</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td><Link href={`/admin/bookings/${b.id}`}><strong>{b.reference}</strong></Link></td>
                        <td>{b.journey}</td>
                        <td className="when">{b.departure_date ? fmtDay(b.departure_date) : '—'}</td>
                        <td>{fmtMoney(b.total_price, b.currency)}</td>
                        <td>{fmtMoney(b.outstanding, b.currency)}</td>
                        <td><span className={`badge st-${b.status}`}>{BOOKING_STATUS_LABELS[b.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No bookings yet.</p>}
            <div className="ad-actions"><Link className="ad-btn ghost" href={`/admin/bookings/new?client=${id}`}>+ New booking for {client.full_name.split(' ')[0]}</Link></div>
          </section>

          <section className="ad-panel">
            <h2>Enquiries</h2>
            {enquiries && enquiries.length ? (
              <ol className="ad-timeline">
                {enquiries.map((e) => (
                  <li key={e.id}><Link href={`/admin/enquiries/${e.id}`}><strong>{e.package || e.interest || 'Enquiry'}</strong></Link> <span className={`badge st-${e.status}`}>{STATUS_LABELS[e.status]}</span><small>{fmtDate(e.created_at)}</small></li>
                ))}
              </ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No linked enquiries. Converting an enquiry to a booking links it here.</p>}
          </section>

          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">{history.map((a) => <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>)}</ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>No changes recorded yet.</p>}
          </section>
        </div>

        <aside>
          <ClientForm id={id} client={client} />
          {ctx.admin.isOwner ? (
            <form action={deleteClient.bind(null, id)} className="ad-panel">
              <h2>Delete</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Only possible while the client has no bookings.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this client permanently?">Delete client</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
