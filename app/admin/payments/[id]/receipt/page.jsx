import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { UUID } from '../../../../../lib/admin/config';
import { fmtDay } from '../../../../../lib/admin/format';
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, fmtMoney } from '../../../../../lib/admin/money';
import { getBusiness } from '../../../../../lib/admin/business';
import DocSheet from '../../../_components/DocSheet';

export const dynamic = 'force-dynamic';

// Receipt for one payment. The number (RC-0001...) is given by the database the moment an owner confirms the money arrived.
export default async function Receipt({ params }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(String(id))) notFound();
  const { data: p } = await supabase.from('payments').select('*, bookings(reference, journey, currency, total_price, clients(full_name, email, phone))').eq('id', id).maybeSingle();
  if (!p || !p.bookings || p.kind === 'refund') notFound();
  const business = await getBusiness(supabase);
  const b = p.bookings;
  const c = b.clients || {};
  const valid = p.status === 'confirmed' && p.receipt_no;

  let invoiceRef = '';
  if (p.invoice_id) {
    const { data: inv } = await supabase.from('invoices').select('reference').eq('id', p.invoice_id).maybeSingle();
    invoiceRef = inv ? inv.reference : '';
  }
  return (
    <DocSheet
      business={business} kind="Receipt" reference={p.receipt_no || 'Not issued'}
      stamp={valid ? 'PAID' : p.status === 'failed' ? 'VOID' : 'NOT YET CONFIRMED'}
      billLabel="Received from" billTo={{ name: c.full_name || '', email: c.email, phone: c.phone }}
      meta={[['Date received', fmtDay(p.paid_on)], ['Booking', b.reference], ['Invoice', invoiceRef]]}
      title={`Payment received: ${b.journey}`}
      rows={[
        ['Amount received', fmtMoney(p.amount, b.currency)],
        ['For', PAYMENT_KIND_LABELS[p.kind]],
        ['Paid by', PAYMENT_METHOD_LABELS[p.method]],
        ...(p.reference ? [['Payment reference', p.reference]] : []),
      ]}
      footnote={valid ? 'Thank you. This receipt confirms the payment above has been received.' : 'This is not a valid receipt until the payment has been confirmed by an owner.'}
    />
  );
}
