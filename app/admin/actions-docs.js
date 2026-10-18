'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireOwner } from '../../lib/admin/auth';
import { logActivity } from '../../lib/admin/staff';
import { UUID, DATE } from '../../lib/admin/config';
import { CURRENCIES, DOC_CATEGORIES, DOC_MAX_BYTES, DEFAULT_QUOTE_TERMS, DEFAULT_INVOICE_TERMS, itemsTotal, toCents, fromCents, fmtMoney, addDays } from '../../lib/admin/money';
import { readItems, replaceItems } from '../../lib/admin/items';
import { getBusiness } from '../../lib/admin/business';
import { findOrCreateClient } from '../../lib/admin/clients';
import { renderDocumentEmail, sendClientEmail } from '../../lib/doc-email';
import { todayNairobi } from '../../lib/admin/format';

const text = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const touch = () => ({ updated_at: new Date().toISOString() });

// ================= quotations =================
function readQuoteFields(formData) {
  const title = text(formData.get('title'), 300);
  if (!title) return { error: 'Please give the quotation a title, for example "Botswana Grand Safari for 4".' };
  const currency = String(formData.get('currency') || 'USD');
  if (!CURRENCIES.includes(currency)) return { error: 'Please choose USD or KES.' };
  const valid = text(formData.get('valid_until'), 10);
  if (valid && !DATE.test(valid)) return { error: 'The "valid until" date does not look right.' };
  const parsed = readItems(formData.get('items'));
  if (parsed.error) return { error: parsed.error };
  return {
    parsed,
    row: { title, currency, valid_until: valid || null, intro: text(formData.get('intro'), 3000) || null, terms: text(formData.get('terms'), 5000) || null, notes: text(formData.get('notes'), 5000) || null },
  };
}

export async function saveQuotation(id, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (id && !UUID.test(String(id))) return { error: 'Not found.' };
  const { row, parsed, error } = readQuoteFields(formData);
  if (error) return { error };

  if (id) {
    const { error: e1 } = await supabase.from('quotations').update({ ...row, ...touch() }).eq('id', id);
    if (e1) return { error: 'Could not save. Please check the details and try again.' };
    if (!(await replaceItems(supabase, 'quotation_items', 'quotation_id', id, parsed.items))) return { error: 'The lines could not be saved. Nothing was changed; please try again.' };
    await logActivity(supabase, ctx, 'quotations', id, 'quotation_updated', { total: fmtMoney(parsed.total, row.currency) });
    revalidatePath(`/admin/quotations/${id}`);
    revalidatePath('/admin/quotations');
    return { saved: true };
  }

  const clientId = text(formData.get('client_id'), 40);
  if (!UUID.test(clientId)) return { error: 'Please choose a client (or add one first).' };
  const { data, error: e2 } = await supabase.from('quotations').insert({ ...row, client_id: clientId, created_by: user.id, terms: row.terms ?? DEFAULT_QUOTE_TERMS }).select('id').single();
  if (e2 || !data) return { error: 'Could not create the quotation. Please check the details.' };
  if (!(await replaceItems(supabase, 'quotation_items', 'quotation_id', data.id, parsed.items))) {
    await supabase.from('quotations').delete().eq('id', data.id);
    return { error: 'The lines could not be saved. Please try again.' };
  }
  await logActivity(supabase, ctx, 'quotations', data.id, 'quotation_created', {});
  revalidatePath('/admin/quotations');
  redirect(`/admin/quotations/${data.id}`);
}

// "Create quotation" on an enquiry: finds or creates the client and opens a draft with the enquiry's package as the title.
export async function quoteFromEnquiry(enquiryId) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(enquiryId))) throw new Error('Bad request');
  const { data: enq } = await supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle();
  if (!enq) throw new Error('Enquiry not found');
  const clientId = enq.client_id || (await findOrCreateClient(ctx, { name: enq.name, email: enq.email, phone: enq.phone }));
  const { data: q, error } = await supabase.from('quotations').insert({
    client_id: clientId, enquiry_id: enq.id, title: text(enq.package || enq.interest || 'Safari', 300),
    terms: DEFAULT_QUOTE_TERMS, valid_until: addDays(todayNairobi(), 14), created_by: user.id,
  }).select('id').single();
  if (error || !q) throw new Error('Could not create the quotation');
  await supabase.from('enquiries').update({ client_id: clientId, ...touch() }).eq('id', enq.id);
  await logActivity(supabase, ctx, 'enquiries', enq.id, 'quotation_started', {});
  await logActivity(supabase, ctx, 'quotations', q.id, 'quotation_created', { from: 'enquiry' });
  redirect(`/admin/quotations/${q.id}`);
}

export async function setQuotationStatus(id, status) {
  const ctx = await requireAdmin();
  if (!UUID.test(String(id)) || !['draft', 'sent', 'accepted', 'declined'].includes(status)) throw new Error('Bad request');
  const { data: before } = await ctx.supabase.from('quotations').select('status').eq('id', id).maybeSingle();
  if (!before) throw new Error('Not found');
  const { error } = await ctx.supabase.from('quotations').update({ status, ...touch() }).eq('id', id);
  if (error) throw new Error('Could not save');
  await logActivity(ctx.supabase, ctx, 'quotations', id, 'quotation_status_changed', { from: before.status, to: status });
  revalidatePath(`/admin/quotations/${id}`);
  revalidatePath('/admin/quotations');
}

export async function emailQuotation(id) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: q } = await supabase.from('quotation_summary').select('*').eq('id', id).maybeSingle();
  if (!q) throw new Error('Not found');
  const back = (flag) => redirect(`/admin/quotations/${id}?${flag}`);
  if (!q.client_email || !EMAIL.test(q.client_email)) back('error=no-email');
  const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position');
  if (!items || !items.length || Number(q.total) <= 0) back('error=empty');
  const business = await getBusiness(supabase);
  const mail = renderDocumentEmail({
    kind: 'Quotation', reference: q.reference, title: q.title, clientName: q.client_name, business, items, currency: q.currency, total: Number(q.total),
    intro: q.intro, terms: q.terms, dueLabel: q.valid_until ? `Valid until ${q.valid_until}` : '', withBank: false,
  });
  let sent = false;
  try { sent = await sendClientEmail({ to: q.client_email, replyTo: business.email || undefined, ...mail }); } catch (e) { console.error('Quotation email failed:', e && e.message); back('error=email-failed'); }
  if (!sent) back('error=email-off');
  if (q.status === 'draft') await supabase.from('quotations').update({ status: 'sent', ...touch() }).eq('id', id);
  await logActivity(supabase, ctx, 'quotations', id, 'quotation_emailed', { to: q.client_email });
  revalidatePath(`/admin/quotations/${id}`);
  back('sent=1');
}

export async function convertQuotationToBooking(id) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: q } = await supabase.from('quotation_summary').select('*').eq('id', id).maybeSingle();
  if (!q) throw new Error('Not found');
  if (q.booking_id) redirect(`/admin/bookings/${q.booking_id}`);
  const { data: booking, error } = await supabase.from('bookings').insert({
    client_id: q.client_id, enquiry_id: q.enquiry_id, journey: q.title, currency: q.currency, total_price: Number(q.total),
    assigned_to: user.id, notes: `From quotation ${q.reference}`, created_by: user.id,
  }).select('id, reference').single();
  if (error || !booking) throw new Error('Could not create the booking');
  await supabase.from('quotations').update({ status: 'accepted', booking_id: booking.id, ...touch() }).eq('id', id);
  await logActivity(supabase, ctx, 'quotations', id, 'quotation_converted', { reference: booking.reference });
  await logActivity(supabase, ctx, 'bookings', booking.id, 'booking_created', { from: 'quotation', quotation: q.reference });
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/quotations');
  redirect(`/admin/bookings/${booking.id}`);
}

export async function deleteQuotation(id) {
  const ctx = await requireAdmin();
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: q } = await ctx.supabase.from('quotations').select('status').eq('id', id).maybeSingle();
  if (q && q.status !== 'draft' && !ctx.admin.isOwner) redirect(`/admin/quotations/${id}?error=owner-only`);
  await ctx.supabase.from('quotations').delete().eq('id', id);
  revalidatePath('/admin/quotations');
  redirect('/admin/quotations');
}

// ================= invoices =================
// "Create invoice" on a booking: kind is deposit, balance or full. The invoice starts as a draft you can adjust.
export async function createInvoiceFromBooking(bookingId, kind) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(bookingId)) || !['deposit', 'balance', 'full'].includes(kind)) throw new Error('Bad request');
  const { data: b } = await supabase.from('booking_summary').select('*').eq('id', bookingId).maybeSingle();
  if (!b) throw new Error('Booking not found');

  const total = toCents(b.total_price);
  const deposit = Math.round((total * Number(b.deposit_percent)) / 100);
  const lines = {
    deposit: [`Deposit (${Number(b.deposit_percent)}%): ${b.journey}`, deposit, b.deposit_due_on],
    balance: [`Balance: ${b.journey}`, total - deposit, b.balance_due_on],
    full: [`${b.journey}`, total, b.balance_due_on],
  }[kind];
  const { data: inv, error } = await supabase.from('invoices').insert({
    client_id: b.client_id, booking_id: bookingId, title: b.journey, currency: b.currency, due_date: lines[2] || null,
    terms: DEFAULT_INVOICE_TERMS, created_by: user.id,
  }).select('id').single();
  if (error || !inv) throw new Error('Could not create the invoice');
  const { error: e2 } = await supabase.from('invoice_items').insert({ invoice_id: inv.id, position: 0, description: lines[0], quantity: 1, unit_price: fromCents(lines[1]) });
  if (e2) {
    await supabase.from('invoices').delete().eq('id', inv.id);
    throw new Error('Could not create the invoice lines');
  }
  await logActivity(supabase, ctx, 'invoices', inv.id, 'invoice_created', { booking: b.reference });
  await logActivity(supabase, ctx, 'bookings', bookingId, 'invoice_drafted', {});
  revalidatePath('/admin/invoices');
  redirect(`/admin/invoices/${inv.id}`);
}

export async function saveInvoice(id, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) return { error: 'Not found.' };
  const { data: inv } = await supabase.from('invoices').select('status, currency').eq('id', id).maybeSingle();
  if (!inv) return { error: 'Invoice not found.' };

  const due = text(formData.get('due_date'), 10);
  if (due && !DATE.test(due)) return { error: 'The due date does not look right.' };
  const notes = text(formData.get('notes'), 5000) || null;

  if (inv.status === 'sent') { // issued: only the due date and the private note can change
    const { error } = await supabase.from('invoices').update({ due_date: due || null, notes, ...touch() }).eq('id', id);
    if (error) return { error: 'Could not save. Please try again.' };
    await logActivity(supabase, ctx, 'invoices', id, 'invoice_updated', {});
    revalidatePath(`/admin/invoices/${id}`);
    return { saved: true };
  }
  if (inv.status !== 'draft') return { error: 'A voided invoice cannot be changed.' };

  const title = text(formData.get('title'), 300);
  if (!title) return { error: 'Please give the invoice a title.' };
  const parsed = readItems(formData.get('items'));
  if (parsed.error) return { error: parsed.error };
  const { error } = await supabase.from('invoices').update({
    title, due_date: due || null, intro: text(formData.get('intro'), 3000) || null, terms: text(formData.get('terms'), 5000) || null, notes, ...touch(),
  }).eq('id', id);
  if (error) return { error: 'Could not save. Please check the details.' };
  if (!(await replaceItems(supabase, 'invoice_items', 'invoice_id', id, parsed.items))) return { error: 'The lines could not be saved. Nothing was changed; please try again.' };
  await logActivity(supabase, ctx, 'invoices', id, 'invoice_updated', { total: fmtMoney(parsed.total, inv.currency) });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/admin/invoices');
  return { saved: true };
}

// Owners only. Gives the invoice its permanent number (the database assigns it) and locks the lines.
export async function issueInvoice(id) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: inv } = await supabase.from('invoice_summary').select('status, total').eq('id', id).maybeSingle();
  if (!inv || inv.status !== 'draft') redirect(`/admin/invoices/${id}`);
  if (Number(inv.total) <= 0) redirect(`/admin/invoices/${id}?error=empty`);
  const { error } = await supabase.from('invoices').update({ status: 'sent', ...touch() }).eq('id', id).eq('status', 'draft');
  if (error) redirect(`/admin/invoices/${id}?error=issue-failed`);
  const { data: after } = await supabase.from('invoices').select('reference').eq('id', id).maybeSingle();
  await logActivity(supabase, ctx, 'invoices', id, 'invoice_issued', { reference: after ? after.reference : '' });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/admin/invoices');
  redirect(`/admin/invoices/${id}`);
}

export async function voidInvoice(id, prev, formData) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) return { error: 'Not found.' };
  const reason = text(formData.get('reason'), 500);
  if (!reason) return { error: 'Please say why the invoice is being voided.' };
  const { error } = await supabase.from('invoices').update({ status: 'void', void_reason: reason, ...touch() }).eq('id', id).eq('status', 'sent');
  if (error) return { error: 'Could not void the invoice.' };
  await logActivity(supabase, ctx, 'invoices', id, 'invoice_voided', { reason });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath('/admin/invoices');
  return { saved: true };
}

export async function emailInvoice(id) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: inv } = await supabase.from('invoice_summary').select('*').eq('id', id).maybeSingle();
  if (!inv) throw new Error('Not found');
  const back = (flag) => redirect(`/admin/invoices/${id}?${flag}`);
  if (inv.status !== 'sent') back('error=not-issued');
  if (!inv.client_email || !EMAIL.test(inv.client_email)) back('error=no-email');
  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position');
  const business = await getBusiness(supabase);
  const mail = renderDocumentEmail({
    kind: 'Invoice', reference: inv.reference, title: inv.title, clientName: inv.client_name, business, items: items || [], currency: inv.currency,
    total: Number(inv.total), paid: Number(inv.paid), intro: inv.intro, terms: inv.terms, dueLabel: inv.due_date ? `Due ${inv.due_date}` : '', withBank: true,
  });
  let sent = false;
  try { sent = await sendClientEmail({ to: inv.client_email, replyTo: business.email || undefined, ...mail }); } catch (e) { console.error('Invoice email failed:', e && e.message); back('error=email-failed'); }
  if (!sent) back('error=email-off');
  await logActivity(supabase, ctx, 'invoices', id, 'invoice_emailed', { to: inv.client_email });
  revalidatePath(`/admin/invoices/${id}`);
  back('sent=1');
}

export async function deleteInvoice(id) {
  const ctx = await requireAdmin();
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { error } = await ctx.supabase.from('invoices').delete().eq('id', id).eq('status', 'draft');
  if (error) redirect(`/admin/invoices/${id}?error=cannot-delete`);
  revalidatePath('/admin/invoices');
  redirect('/admin/invoices');
}

// ================= private documents =================
const TYPES = {
  'application/pdf': { ext: 'pdf', magic: (b) => b.subarray(0, 4).toString('latin1') === '%PDF' },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', magic: (b) => b.subarray(0, 2).toString('latin1') === 'PK' },
};

export async function uploadDocument(clientId, bookingId, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(clientId)) || (bookingId && !UUID.test(String(bookingId)))) return { error: 'Not found.' };
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) return { error: 'Please choose a file to upload.' };
  if (file.size > DOC_MAX_BYTES) return { error: 'That file is larger than 10 MB. Please compress it or send a smaller scan.' };
  const kind = TYPES[file.type];
  if (!kind) return { error: 'Only PDF, JPG, PNG, WebP and Word (.docx) files can be uploaded.' };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!kind.magic(bytes)) return { error: 'That file does not look like a real ' + kind.ext.toUpperCase() + ' file.' };
  const category = DOC_CATEGORIES.includes(formData.get('category')) ? formData.get('category') : 'other';
  const name = text(String(file.name || 'document').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_'), 200) || 'document';

  const path = `${clientId}/${randomUUID()}.${kind.ext}`;
  const { error: up } = await supabase.storage.from('client-documents').upload(path, bytes, { contentType: file.type, upsert: false });
  if (up) return { error: 'The file could not be uploaded. Please try again.' };
  const { data: doc, error } = await supabase.from('documents').insert({
    client_id: clientId, booking_id: bookingId || null, category, name, storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: user.id,
  }).select('id').single();
  if (error || !doc) {
    await supabase.storage.from('client-documents').remove([path]);
    return { error: 'The file was uploaded but could not be recorded. Please try again.' };
  }
  await logActivity(supabase, ctx, 'clients', clientId, 'document_added', { name, category });
  revalidatePath(`/admin/clients/${clientId}`);
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
  return { saved: true };
}

export async function deleteDocument(id, backTo) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: doc } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
  if (doc) {
    await supabase.storage.from('client-documents').remove([doc.storage_path]);
    await supabase.from('documents').delete().eq('id', id);
    await logActivity(supabase, ctx, 'clients', doc.client_id, 'document_removed', { name: doc.name });
  }
  const to = typeof backTo === 'string' && /^\/admin\/(clients|bookings)\/[0-9a-f-]{36}$/.test(backTo) ? backTo : '/admin/clients';
  revalidatePath(to);
  redirect(to);
}
