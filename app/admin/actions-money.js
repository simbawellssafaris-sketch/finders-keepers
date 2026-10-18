'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireOwner } from '../../lib/admin/auth';
import { getStaff, logActivity } from '../../lib/admin/staff';
import { UUID, DATE } from '../../lib/admin/config';
import { CURRENCIES, BOOKING_STATUSES, PAYMENT_METHODS, PAYMENT_KINDS, SETTING_KEYS, parseMoney, addDays, fmtMoney } from '../../lib/admin/money';
import { todayNairobi } from '../../lib/admin/format';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const digits = (s) => String(s || '').replace(/\D/g, '');

// ---- clients -------------------------------------------------------------------------------------------------------
function readClient(formData) {
  const full_name = text(formData.get('full_name'), 200);
  const email = text(formData.get('email'), 254);
  const phone = text(formData.get('phone'), 60);
  if (!full_name) return { error: 'Please enter the client’s name.' };
  if (email && !EMAIL.test(email)) return { error: 'That email address does not look right.' };
  return { row: { full_name, email: email || null, phone: phone || null, country: text(formData.get('country'), 100) || null, notes: text(formData.get('notes'), 5000) || null } };
}

export async function saveClient(id, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  const { row, error: bad } = readClient(formData);
  if (bad) return { error: bad };
  if (id && !UUID.test(String(id))) return { error: 'Not found.' };

  if (id) {
    const { error } = await supabase.from('clients').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: error.code === '23505' ? 'Another client already uses that email address.' : 'Could not save. Please try again.' };
    await logActivity(supabase, ctx, 'clients', id, 'client_updated', {});
    revalidatePath(`/admin/clients/${id}`);
    revalidatePath('/admin/clients');
    return { saved: true };
  }
  const { data, error } = await supabase.from('clients').insert({ ...row, created_by: user.id }).select('id').single();
  if (error || !data) return { error: error && error.code === '23505' ? 'A client with that email address already exists. Search for them in the list.' : 'Could not save. Please try again.' };
  await logActivity(supabase, ctx, 'clients', data.id, 'client_created', {});
  revalidatePath('/admin/clients');
  redirect(`/admin/clients/${data.id}`);
}

export async function deleteClient(id) {
  const ctx = await requireOwner();
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { error } = await ctx.supabase.from('clients').delete().eq('id', id);
  if (error) redirect(`/admin/clients/${id}?error=has-bookings`); // the database refuses while bookings exist
  revalidatePath('/admin/clients');
  redirect('/admin/clients');
}

// Find an existing client with the same email or phone, otherwise create one.
async function findOrCreateClient(ctx, { name, email, phone }) {
  const { supabase, user } = ctx;
  if (email) {
    const { data } = await supabase.from('clients').select('id').ilike('email', email).maybeSingle();
    if (data) return data.id;
  }
  const d = digits(phone);
  if (d.length >= 8) {
    const { data } = await supabase.from('clients').select('id, phone').not('phone', 'is', null).limit(500);
    const hit = (data || []).find((c) => digits(c.phone).endsWith(d.slice(-9)) && digits(c.phone).length >= 8);
    if (hit) return hit.id;
  }
  const { data, error } = await supabase.from('clients').insert({ full_name: name || 'Unnamed client', email: email || null, phone: phone && phone !== 'Not given' ? phone : null, created_by: user.id }).select('id').single();
  if (error || !data) throw new Error('Could not create the client');
  await logActivity(supabase, ctx, 'clients', data.id, 'client_created', { from: 'enquiry' });
  return data.id;
}

// "Convert to booking" on an enquiry: finds or creates the client, opens a provisional booking, links them.
export async function convertToBooking(enquiryId) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(enquiryId))) throw new Error('Bad request');

  const { data: existing } = await supabase.from('bookings').select('id').eq('enquiry_id', enquiryId).maybeSingle();
  if (existing) redirect(`/admin/bookings/${existing.id}`);

  const { data: enq } = await supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle();
  if (!enq) throw new Error('Enquiry not found');
  const clientId = enq.client_id || (await findOrCreateClient(ctx, { name: enq.name, email: enq.email, phone: enq.phone }));

  const { data: booking, error } = await supabase.from('bookings').insert({
    client_id: clientId, enquiry_id: enq.id,
    journey: text(enq.package || enq.interest || 'Safari', 300),
    travellers: enq.travellers || null,
    assigned_to: enq.assigned_to || user.id,
    notes: enq.notes ? `From the enquiry: ${text(enq.notes, 1500)}` : null,
    created_by: user.id,
  }).select('id, reference').single();
  if (error || !booking) throw new Error('Could not create the booking');

  await supabase.from('enquiries').update({ client_id: clientId, status: enq.status === 'new' || enq.status === 'contacted' ? 'quoted' : enq.status, updated_at: new Date().toISOString() }).eq('id', enq.id);
  await logActivity(supabase, ctx, 'enquiries', enq.id, 'converted_to_booking', { reference: booking.reference });
  await logActivity(supabase, ctx, 'bookings', booking.id, 'booking_created', { from: 'enquiry' });
  revalidatePath('/admin/enquiries');
  revalidatePath('/admin/bookings');
  redirect(`/admin/bookings/${booking.id}`);
}

// ---- bookings ------------------------------------------------------------------------------------------------------
export async function saveBooking(id, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  const { names } = await getStaff(supabase);
  if (id && !UUID.test(String(id))) return { error: 'Not found.' };

  const journey = text(formData.get('journey'), 300);
  if (!journey) return { error: 'Please enter the journey (for example "The Botswana Grand Safari").' };
  const status = String(formData.get('status') || 'provisional');
  if (!BOOKING_STATUSES.includes(status)) return { error: 'Please choose a status.' };
  const currency = String(formData.get('currency') || 'USD');
  if (!CURRENCIES.includes(currency)) return { error: 'Please choose USD or KES.' };

  const total = String(formData.get('total_price') || '').trim() === '' ? 0 : parseMoney(formData.get('total_price'), { allowZero: true });
  if (total === null) return { error: 'The total price must be a number such as 20800 or 1250.50.' };
  const pct = Number(String(formData.get('deposit_percent') || '30').replace(',', '.'));
  if (!(pct >= 0 && pct <= 100)) return { error: 'The deposit percentage must be between 0 and 100.' };

  const dep = text(formData.get('departure_date'), 10), ret = text(formData.get('return_date'), 10);
  let depositDue = text(formData.get('deposit_due_on'), 10), balanceDue = text(formData.get('balance_due_on'), 10);
  for (const d of [dep, ret, depositDue, balanceDue]) if (d && !DATE.test(d)) return { error: 'One of the dates does not look right.' };
  if (dep && ret && ret < dep) return { error: 'The return date cannot be before the departure date.' };
  if (!balanceDue && dep) balanceDue = addDays(dep, -60); // your promise: the balance is due 60 days before departure

  const tr = text(formData.get('travellers'), 4);
  const travellers = tr ? parseInt(tr, 10) : null;
  if (tr && !(travellers >= 1 && travellers <= 200)) return { error: 'Travellers must be a number from 1 to 200.' };
  const assignee = text(formData.get('assigned_to'), 40);
  if (assignee && (!UUID.test(assignee) || !names[assignee])) return { error: 'Please choose someone from the list.' };

  const row = {
    journey, status, currency, total_price: total, deposit_percent: pct,
    departure_date: dep || null, return_date: ret || null, deposit_due_on: depositDue || null, balance_due_on: balanceDue || null,
    travellers, assigned_to: assignee || null, notes: text(formData.get('notes'), 5000) || null,
  };

  if (id) {
    const { data: before } = await supabase.from('bookings').select('status, total_price, currency, departure_date').eq('id', id).maybeSingle();
    if (!before) return { error: 'Booking not found.' };
    if (before.currency !== currency) {
      const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('booking_id', id);
      if (count) return { error: 'The currency cannot be changed once payments have been recorded.' };
    }
    const { error } = await supabase.from('bookings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Could not save. Please check the details and try again.' };
    if (before.status !== status) await logActivity(supabase, ctx, 'bookings', id, 'booking_status_changed', { from: before.status, to: status });
    if (Number(before.total_price) !== total) await logActivity(supabase, ctx, 'bookings', id, 'price_changed', { from: fmtMoney(before.total_price, before.currency), to: fmtMoney(total, currency) });
    if ((before.departure_date || '') !== (dep || '')) await logActivity(supabase, ctx, 'bookings', id, 'departure_changed', { to: dep || null });
    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bookings');
    revalidatePath('/admin');
    return { saved: true };
  }

  const clientId = text(formData.get('client_id'), 40);
  if (!UUID.test(clientId)) return { error: 'Please choose a client (or add one first).' };
  const { data, error } = await supabase.from('bookings').insert({ ...row, client_id: clientId, created_by: user.id }).select('id').single();
  if (error || !data) return { error: 'Could not create the booking. Please check the details.' };
  await logActivity(supabase, ctx, 'bookings', data.id, 'booking_created', {});
  revalidatePath('/admin/bookings');
  revalidatePath('/admin');
  redirect(`/admin/bookings/${data.id}`);
}

export async function deleteBooking(id) {
  const ctx = await requireOwner();
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { error } = await ctx.supabase.from('bookings').delete().eq('id', id);
  if (error) redirect(`/admin/bookings/${id}?error=has-payments`); // refused while payments exist
  revalidatePath('/admin/bookings');
  redirect('/admin/bookings');
}

// ---- payments ------------------------------------------------------------------------------------------------------
export async function recordPayment(bookingId, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user, admin } = ctx;
  if (!UUID.test(String(bookingId))) return { error: 'Booking not found.' };
  const { data: booking } = await supabase.from('bookings').select('id, currency, reference').eq('id', bookingId).maybeSingle();
  if (!booking) return { error: 'Booking not found.' };

  const amount = parseMoney(formData.get('amount'));
  if (amount === null) return { error: 'Enter the amount as a number, for example 3000 or 1250.50.' };
  const kind = String(formData.get('kind') || '');
  const method = String(formData.get('method') || '');
  if (!PAYMENT_KINDS.includes(kind)) return { error: 'Please choose what this payment is for.' };
  if (!PAYMENT_METHODS.includes(method)) return { error: 'Please choose how it was paid.' };
  const paidOn = text(formData.get('paid_on'), 10) || todayNairobi();
  if (!DATE.test(paidOn) || paidOn > addDays(todayNairobi(), 1)) return { error: 'The payment date cannot be in the future.' };

  // Staff record payments as "waiting for confirmation"; an owner confirms once the money is seen in the account / M-Pesa.
  const wantConfirmed = formData.get('confirmed') === 'yes' && admin.isOwner;
  const row = {
    booking_id: bookingId, kind, amount, method, paid_on: paidOn,
    reference: text(formData.get('reference'), 120) || null, notes: text(formData.get('notes'), 1000) || null,
    status: wantConfirmed ? 'confirmed' : 'pending', recorded_by: user.id,
    ...(wantConfirmed ? { confirmed_by: user.id, confirmed_at: new Date().toISOString() } : {}),
  };
  const { error } = await supabase.from('payments').insert(row);
  if (error) return { error: 'Could not record the payment. Please try again.' };
  await logActivity(supabase, ctx, 'bookings', bookingId, 'payment_recorded', { amount: fmtMoney(amount, booking.currency), kind, method, status: row.status });
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
  return { saved: true };
}

// Owners only: confirm that the money really arrived, or mark an entry as failed / entered by mistake.
export async function setPaymentStatus(paymentId, bookingId, status) {
  const ctx = await requireOwner();
  const { supabase, user } = ctx;
  if (!UUID.test(String(paymentId)) || !['confirmed', 'failed'].includes(status)) throw new Error('Bad request');
  const { data: pay } = await supabase.from('payments').select('amount, status, bookings(currency, id)').eq('id', paymentId).maybeSingle();
  if (!pay) throw new Error('Payment not found');
  const changes = status === 'confirmed' ? { status, confirmed_by: user.id, confirmed_at: new Date().toISOString() } : { status, confirmed_by: null, confirmed_at: null };
  const { error } = await supabase.from('payments').update(changes).eq('id', paymentId);
  if (error) throw new Error('Could not save');
  await logActivity(supabase, ctx, 'bookings', pay.bookings.id, status === 'confirmed' ? 'payment_confirmed' : 'payment_failed', { amount: fmtMoney(pay.amount, pay.bookings.currency) });
  revalidatePath(`/admin/bookings/${pay.bookings.id}`);
  revalidatePath('/admin/payments');
  revalidatePath('/admin');
}

// ---- business settings (owners) ------------------------------------------------------------------------------------
export async function saveSettings(prev, formData) {
  const { supabase } = await requireOwner();
  const rows = SETTING_KEYS.map((key) => ({ key, value: text(formData.get(key), 500), updated_at: new Date().toISOString() }));
  const vat = rows.find((r) => r.key === 'vat_registered');
  vat.value = vat.value === 'yes' ? 'yes' : 'no';
  const { error } = await supabase.from('business_settings').upsert(rows, { onConflict: 'key' });
  if (error) return { error: 'Could not save the settings. Please try again.' };
  revalidatePath('/admin/settings');
  return { saved: true };
}
