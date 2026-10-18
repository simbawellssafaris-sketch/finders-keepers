import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import { todayNairobi } from '../../../../lib/admin/format';
import { BOOKING_STATUS_LABELS, addDays } from '../../../../lib/admin/money';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Who is travelling when: departures grouped by day for one month.
export default async function Calendar({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const today = todayNairobi();
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(sp.m)) ? sp.m : today.slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const first = `${m}-01`;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const last = `${m}-${String(days).padStart(2, '0')}`;
  const shift = (n) => addDays(first, n < 0 ? -1 : 32).slice(0, 7);

  const { data: rows } = await ctx.supabase.from('booking_summary')
    .select('id,reference,journey,client_name,status,departure_date,travellers')
    .neq('status', 'cancelled').gte('departure_date', first).lte('departure_date', last).order('departure_date');
  const byDay = {};
  for (const r of rows || []) (byDay[r.departure_date] = byDay[r.departure_date] || []).push(r);
  const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <Shell ctx={ctx} current="bookings">
      <Link className="ad-back" href="/admin/bookings">&larr; Back to bookings</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h1>{MONTHS[mo - 1]} {y}</h1>
        <span style={{ display: 'flex', gap: 10 }}>
          <Link className="ad-btn ghost" href={`/admin/bookings/calendar?m=${shift(-1)}`}>&larr; Previous</Link>
          <Link className="ad-btn ghost" href="/admin/bookings/calendar">This month</Link>
          <Link className="ad-btn ghost" href={`/admin/bookings/calendar?m=${shift(1)}`}>Next &rarr;</Link>
        </span>
      </div>
      <p className="ad-sub">{(rows || []).length} departure{(rows || []).length === 1 ? '' : 's'} this month (cancelled bookings are hidden).</p>

      <div className="ad-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="ad-calhead">{d}</div>)}
        {cells.map((d, i) => {
          const date = d ? `${m}-${String(d).padStart(2, '0')}` : '';
          return (
            <div key={i} className={`ad-calcell${d ? '' : ' empty'}${date === today ? ' today' : ''}`}>
              {d ? <span className="ad-calnum">{d}</span> : null}
              {(byDay[date] || []).map((b) => (
                <Link key={b.id} href={`/admin/bookings/${b.id}`} className={`ad-calev st-${b.status}`} title={`${b.reference} · ${b.journey} · ${BOOKING_STATUS_LABELS[b.status]}`}>
                  {b.client_name}{b.travellers ? ` ×${b.travellers}` : ''}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
