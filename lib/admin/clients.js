// Shared by the booking and quotation actions (server only).
import { logActivity } from './staff';

const digits = (s) => String(s || '').replace(/\D/g, '');

// Find an existing client with the same email or phone, otherwise create one.
export async function findOrCreateClient(ctx, { name, email, phone }) {
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
