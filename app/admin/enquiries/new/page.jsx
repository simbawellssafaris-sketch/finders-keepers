import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import { getStaff } from '../../../../lib/admin/staff';
import { MANUAL_CHANNELS, CHANNEL_LABELS } from '../../../../lib/admin/config';
import Shell from '../../_components/Shell';
import NewEntryForm from '../../_components/NewEntryForm';

export const dynamic = 'force-dynamic';

export default async function NewEnquiry() {
  const ctx = await requireAdmin();
  const { staff } = await getStaff(ctx.supabase);
  return (
    <Shell ctx={ctx} current="enquiries">
      <Link className="ad-back" href="/admin/enquiries">&larr; Back to enquiries</Link>
      <h1>Log an enquiry</h1>
      <p className="ad-sub">For someone who contacted you by phone, WhatsApp, email or in person. It joins the same list as website enquiries.</p>
      <NewEntryForm staff={staff} channels={MANUAL_CHANNELS.map((c) => [c, CHANNEL_LABELS[c]])} />
    </Shell>
  );
}
