import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID } from '../../../../lib/admin/config';
import Shell from '../../_components/Shell';
import QuotationForm from '../../_components/QuotationForm';

export const dynamic = 'force-dynamic';

export default async function NewQuotation({ searchParams }) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) || {};
  const { data: clients } = await ctx.supabase.from('clients').select('id, full_name, email').order('full_name').limit(1000);
  return (
    <Shell ctx={ctx} current="quotations">
      <Link className="ad-back" href="/admin/quotations">&larr; Back to quotations</Link>
      <h1>New quotation</h1>
      <p className="ad-sub">Starting from an enquiry? Open it and press &ldquo;Create quotation&rdquo;; it fills in the client and title for you.</p>
      <div style={{ maxWidth: 860 }}>
        <QuotationForm clients={clients || []} defaultClientId={UUID.test(String(sp.client)) ? sp.client : ''} />
      </div>
    </Shell>
  );
}
