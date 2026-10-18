import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { UUID } from '../../../../../lib/admin/config';
import { fmtDay, todayNairobi } from '../../../../../lib/admin/format';
import { QUOTE_STATUS_LABELS, quoteDisplay } from '../../../../../lib/admin/money';
import { getBusiness } from '../../../../../lib/admin/business';
import DocSheet from '../../../_components/DocSheet';

export const dynamic = 'force-dynamic';

export default async function PrintQuotation({ params }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: q } = await supabase.from('quotation_summary').select('*').eq('id', id).maybeSingle();
  if (!q) notFound();
  const [{ data: items }, business] = await Promise.all([
    supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position'),
    getBusiness(supabase),
  ]);
  const st = quoteDisplay(q, todayNairobi());
  return (
    <DocSheet
      business={business} kind="Quotation" reference={q.reference}
      stamp={st === 'expired' || st === 'declined' ? QUOTE_STATUS_LABELS[st].toUpperCase() : q.status === 'draft' ? 'DRAFT' : ''}
      billLabel="Prepared for" billTo={{ name: q.client_name, email: q.client_email, phone: q.client_phone }}
      meta={[['Date', fmtDay(q.created_at.slice(0, 10))], ['Valid until', q.valid_until ? fmtDay(q.valid_until) : '']]}
      title={q.title} items={items || []} currency={q.currency} total={Number(q.total)} intro={q.intro} terms={q.terms}
    />
  );
}
