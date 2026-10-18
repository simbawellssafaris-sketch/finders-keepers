import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { UUID } from '../../../../../lib/admin/config';
import { fmtDay } from '../../../../../lib/admin/format';
import { getBusiness } from '../../../../../lib/admin/business';
import DocSheet from '../../../_components/DocSheet';

export const dynamic = 'force-dynamic';

export default async function PrintInvoice({ params }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: inv } = await supabase.from('invoice_summary').select('*').eq('id', id).maybeSingle();
  if (!inv) notFound();
  const [{ data: items }, business] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
    getBusiness(supabase),
  ]);
  const issued = inv.status !== 'draft';
  const paidInFull = issued && inv.status !== 'void' && Number(inv.total) > 0 && Number(inv.outstanding) <= 0;
  return (
    <DocSheet
      business={business} kind="Invoice" reference={inv.reference || 'DRAFT'}
      stamp={inv.status === 'void' ? 'VOID' : !issued ? 'DRAFT' : paidInFull ? 'PAID' : ''}
      billTo={{ name: inv.client_name, email: inv.client_email, phone: inv.client_phone }}
      meta={[['Issue date', inv.issue_date ? fmtDay(inv.issue_date) : ''], ['Due date', inv.due_date ? fmtDay(inv.due_date) : ''], ['Booking', inv.booking_reference || '']]}
      title={inv.title} items={items || []} currency={inv.currency} total={Number(inv.total)} paid={issued && inv.status !== 'void' ? Number(inv.paid) : null}
      intro={inv.intro} terms={inv.terms} bank={inv.status === 'sent'}
    />
  );
}
