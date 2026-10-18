import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import Shell from '../../_components/Shell';
import ClientForm from '../../_components/ClientForm';

export const dynamic = 'force-dynamic';

export default async function NewClient() {
  const ctx = await requireAdmin();
  return (
    <Shell ctx={ctx} current="clients">
      <Link className="ad-back" href="/admin/clients">&larr; Back to clients</Link>
      <h1>New client</h1>
      <p className="ad-sub">Someone you are quoting or booking. Their enquiries, bookings and payments will all be listed on their page.</p>
      <div style={{ maxWidth: 640 }}><ClientForm /></div>
    </Shell>
  );
}
