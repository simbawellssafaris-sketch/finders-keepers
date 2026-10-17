'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { requireAdmin, loginLimited } from '../../lib/admin/auth';
import { TABLES, TABLE_NAMES, STATUSES, UUID } from '../../lib/admin/config';

// ---- sign in / out -------------------------------------------------------------------------------------------------
export async function signIn(prev, formData) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (loginLimited(ip)) return { error: 'Too many attempts. Please wait a few minutes and try again.' };

  const email = String(formData.get('email') || '').trim().slice(0, 254);
  const password = String(formData.get('password') || '').slice(0, 200);
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'Incorrect email or password.' };

  const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: 'This account does not have admin access.' };
  }
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ---- working with submissions --------------------------------------------------------------------------------------
function target(table, id) {
  if (!TABLE_NAMES.includes(table) || !UUID.test(String(id))) throw new Error('Bad request');
  return TABLES[table];
}

export async function updateEntry(table, id, formData) {
  const { supabase } = await requireAdmin();
  const cfg = target(table, id);
  const changes = { updated_at: new Date().toISOString() };
  if (cfg.filter.column === 'status') {
    const status = String(formData.get('status') || '');
    if (!STATUSES.includes(status)) throw new Error('Bad status');
    changes.status = status;
  }
  if (cfg.hasNotes) {
    const notes = String(formData.get('admin_notes') || '').trim().slice(0, 5000);
    changes.admin_notes = notes || null;
  }
  const { error } = await supabase.from(table).update(changes).eq('id', id);
  if (error) throw new Error('Could not save');
  revalidatePath(`/admin/${cfg.path}`);
  revalidatePath(`/admin/${cfg.path}/${id}`);
  revalidatePath('/admin');
}

export async function deleteEntry(table, id) {
  const { supabase } = await requireAdmin();
  const cfg = target(table, id);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error('Could not delete');
  revalidatePath('/admin');
  redirect(`/admin/${cfg.path}`);
}

export async function setSubscription(id, subscription) {
  const { supabase } = await requireAdmin();
  target('newsletter_subscribers', id);
  if (!['subscribed', 'unsubscribed'].includes(subscription)) throw new Error('Bad request');
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ subscription, unsubscribed_at: subscription === 'unsubscribed' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error('Could not save');
  revalidatePath('/admin/subscribers');
  revalidatePath('/admin');
}
