import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import { getStaff } from '../../../../lib/admin/staff';
import { UUID } from '../../../../lib/admin/config';
import Shell from '../../_components/Shell';
import BookingForm from '../../_components/BookingForm';

export const dynamic = 'force-dynamic';

export default async function NewBooking({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const [{ staff }, { data: clients }] = await Promise.all([
    getStaff(ctx.supabase),
    ctx.supabase.from('clients').select('id, full_name, email').order('full_name').limit(1000),
  ]);
  return (
    <Shell ctx={ctx} current="bookings">
      <Link className="ad-back" href="/admin/bookings">&larr; Back to bookings</Link>
      <h1>New booking</h1>
      <p className="ad-sub">Starting from an enquiry? Open it and press &ldquo;Convert to booking&rdquo; instead; it fills most of this in for you.</p>
      <div style={{ maxWidth: 760 }}>
        <BookingForm clients={clients || []} staff={staff} defaultClientId={UUID.test(String(sp.client)) ? sp.client : ''} />
      </div>
    </Shell>
  );
}
