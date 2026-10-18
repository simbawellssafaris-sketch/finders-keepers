'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { requireAdmin, requireOwner, loginLimited } from '../../lib/admin/auth';
import { getStaff, logActivity, quickCtx } from '../../lib/admin/staff';
import { TABLES, TABLE_NAMES, STATUSES, UUID, DATE, MANUAL_CHANNELS } from '../../lib/admin/config';

const clientIp = async () => ((await headers()).get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- sign in / out -------------------------------------------------------------------------------------------------
export async function signIn(prev, formData) {
  if (loginLimited(await clientIp())) return { error: 'Too many attempts. Please wait a few minutes and try again.' };

  const email = String(formData.get('email') || '').trim().slice(0, 254);
  const password = String(formData.get('password') || '').slice(0, 200);
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'Incorrect email or password.' };

  const { data: admin } = await supabase.from('admins').select('user_id, role, display_name').eq('user_id', data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: 'This account does not have admin access.' };
  }
  const ua = String((await headers()).get('user-agent') || '').slice(0, 160);
  await logActivity(supabase, { user: data.user, admin: { name: admin.display_name || (admin.role === 'admin' ? 'Owner' : 'Staff') } }, 'admins', data.user.id, 'signed_in', { ip: await clientIp(), device: ua });
  redirect('/admin'); // requireAdmin sends people with two-factor on to the code screen
}

export async function signOut() {
  const supabase = await createClient();
  const ctx = await quickCtx(supabase);
  if (ctx) await logActivity(supabase, ctx, 'admins', ctx.user.id, 'signed_out', {});
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ---- forgotten password --------------------------------------------------------------------------------------------
// Always answers the same way, so nobody can use this form to find out which email addresses have an account.
const SITE = () => (process.env.NODE_ENV === 'production' ? 'https://finderskeeperssafaris.com' : null);

export async function requestReset(prev, formData) {
  const ip = await clientIp();
  if (loginLimited(ip, 'reset')) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  const email = String(formData.get('email') || '').trim().slice(0, 254);
  if (!EMAIL.test(email)) return { error: 'Please enter the email address you sign in with.' };
  const h = await headers();
  const origin = SITE() || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host') || 'localhost:3010'}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/admin/reset` });
  if (error && /rate limit|too many/i.test(error.message || '')) return { error: 'A reset email was requested a moment ago. Please wait a few minutes before asking again.' };
  return { sent: true };
}

// The link in the email lands on a page with a button (not straight into the app), so mail scanners that open links cannot use up the one-time link.
export async function continueReset(formData) {
  const supabase = await createClient();
  const tokenHash = String(formData.get('token_hash') || '').slice(0, 200);
  const code = String(formData.get('code') || '').slice(0, 200);
  let error = null;
  if (tokenHash) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }));
  else if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else error = new Error('missing');
  if (error) redirect('/admin/forgot?error=link');
  redirect('/admin/reset/new');
}

export async function setNewPassword(prev, formData) {
  if (loginLimited(await clientIp(), 'code')) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) redirect('/admin/forgot?error=link');

  const password = String(formData.get('password') || '').slice(0, 200);
  if (password.length < 12) return { error: 'Please use at least 12 characters. A few random words joined together is easy to remember and hard to guess.' };
  if (password !== String(formData.get('confirm') || '').slice(0, 200)) return { error: 'The two passwords do not match.' };

  // If two-factor is on, the code must be entered here too: a reset link alone is not enough to take over an account.
  if ((u.user.factors || []).some((f) => f.status === 'verified')) {
    const code = String(formData.get('code') || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.totp || [])[0];
    if (factor) {
      const { error: codeError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (codeError) return { error: 'That code did not work. Use the newest code in your authenticator app.' };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/same|different from the old/i.test(error.message || '')) return { error: 'Please choose a password you have not used before.' };
    if (/weak|pwned|compromised|easy to guess/i.test(error.message || '')) return { error: 'That password is too easy to guess or has appeared in a data leak. Please choose another.' };
    return { error: 'The password could not be changed. Please try again, or request a new reset link.' };
  }
  const ctx = await quickCtx(supabase);
  if (ctx) await logActivity(supabase, ctx, 'admins', ctx.user.id, 'password_changed', { via: 'reset link' });
  await supabase.auth.signOut({ scope: 'global' }); // every device signs in again with the new password
  redirect('/admin/login?reset=1');
}

// ---- two-factor login (authenticator app) --------------------------------------------------------------------------
export async function verifyCode(prev, formData) {
  await requireAdmin({ partial: true });
  if (loginLimited(await clientIp(), 'code')) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  const code = String(formData.get('code') || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = (factors?.totp || [])[0];
  if (!factor) redirect('/admin');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code did not work. Check you are using the newest code, and that your phone's clock is set automatically." };
  redirect('/admin');
}

export async function enrollTotp() {
  const { supabase, twoFactorOn } = await requireAdmin({ partial: true });
  if (twoFactorOn) return { error: 'Two-factor login is already on. Remove it first if you want to set it up again.' };
  // clear half-finished attempts so the list stays tidy
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all || []) if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Phone ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).slice(2, 6)}` });
  if (error || !data) return { error: 'Could not start the setup. Please try again.' };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotp(factorId, prev, formData) {
  const ctx = await requireAdmin({ partial: true });
  if (!UUID.test(String(factorId))) return { error: 'Please start the setup again.' };
  if (loginLimited(await clientIp(), 'code')) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  const code = String(formData.get('code') || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: 'That code did not work. Try the newest code in your app.' };
  await logActivity(supabase, ctx, 'admins', ctx.user.id, 'two_factor_on', {});
  revalidatePath('/admin/security');
  return { done: true };
}

export async function removeTotp() {
  const ctx = await requireAdmin(); // needs a fully verified (two-factor) session
  const { supabase } = ctx;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all || []) await supabase.auth.mfa.unenroll({ factorId: f.id });
  await logActivity(supabase, ctx, 'admins', ctx.user.id, 'two_factor_off', {});
  await supabase.auth.refreshSession(); // brings the stored session up to date
  revalidatePath('/admin/security');
  revalidatePath('/admin');
}

// ---- working with submissions --------------------------------------------------------------------------------------
function target(table, id) {
  if (!TABLE_NAMES.includes(table) || !UUID.test(String(id))) throw new Error('Bad request');
  return TABLES[table];
}

const excerpt = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);

export async function updateEntry(table, id, formData) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const cfg = target(table, id);
  const { names } = await getStaff(supabase);

  const { data: before } = await supabase.from(table).select('status, admin_notes, follow_up_on, assigned_to').eq('id', id).maybeSingle();
  if (!before) throw new Error('Not found');

  const changes = { updated_at: new Date().toISOString() };
  if (cfg.filter.column === 'status') {
    const status = String(formData.get('status') || '');
    if (!STATUSES.includes(status)) throw new Error('Bad status');
    changes.status = status;
  }
  if (cfg.hasNotes) changes.admin_notes = String(formData.get('admin_notes') || '').trim().slice(0, 5000) || null;

  const due = String(formData.get('follow_up_on') || '').trim();
  if (due && !DATE.test(due)) throw new Error('Bad date');
  changes.follow_up_on = due || null;

  const assignee = String(formData.get('assigned_to') || '').trim();
  if (assignee && (!UUID.test(assignee) || !names[assignee])) throw new Error('Bad assignee');
  changes.assigned_to = assignee || null;

  const { error } = await supabase.from(table).update(changes).eq('id', id);
  if (error) throw new Error('Could not save');

  if (changes.status && changes.status !== before.status) await logActivity(supabase, ctx, table, id, 'status_changed', { from: before.status, to: changes.status });
  if (cfg.hasNotes && (changes.admin_notes || '') !== (before.admin_notes || '')) await logActivity(supabase, ctx, table, id, 'note_edited', { excerpt: excerpt(changes.admin_notes) });
  if ((changes.follow_up_on || null) !== (before.follow_up_on || null)) await logActivity(supabase, ctx, table, id, 'follow_up_set', { date: changes.follow_up_on });
  if ((changes.assigned_to || null) !== (before.assigned_to || null)) await logActivity(supabase, ctx, table, id, 'assigned', { to: changes.assigned_to ? names[changes.assigned_to] : null });

  revalidatePath(`/admin/${cfg.path}`);
  revalidatePath(`/admin/${cfg.path}/${id}`);
  revalidatePath('/admin');
}

// Log an enquiry that arrived by phone, WhatsApp, email or in person, so everything is in one place.
export async function createEntry(prev, formData) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { names } = await getStaff(supabase);

  const name = String(formData.get('name') || '').trim().slice(0, 200);
  const phone = String(formData.get('phone') || '').trim().slice(0, 60);
  const email = String(formData.get('email') || '').trim().slice(0, 254);
  const channel = String(formData.get('channel') || '');
  if (!name) return { error: 'Please enter their name.' };
  if (!phone && !email) return { error: 'Please enter a phone / WhatsApp number or an email address.' };
  if (email && !EMAIL.test(email)) return { error: 'That email address does not look right.' };
  if (!MANUAL_CHANNELS.includes(channel)) return { error: 'Please choose how they contacted you.' };

  const travellersRaw = String(formData.get('travellers') || '').trim();
  const travellers = travellersRaw ? parseInt(travellersRaw, 10) : null;
  if (travellersRaw && !(travellers >= 1 && travellers <= 100)) return { error: 'Travellers must be a number from 1 to 100.' };
  const due = String(formData.get('follow_up_on') || '').trim();
  if (due && !DATE.test(due)) return { error: 'That follow-up date does not look right.' };
  const assignee = String(formData.get('assigned_to') || '').trim();
  if (assignee && (!UUID.test(assignee) || !names[assignee])) return { error: 'Please choose someone from the list.' };

  const row = {
    name, phone: phone || 'Not given', email: email || null, channel, travellers,
    interest: String(formData.get('interest') || '').trim().slice(0, 200) || null,
    package: String(formData.get('package') || '').trim().slice(0, 300) || null,
    notes: String(formData.get('notes') || '').trim().slice(0, 5000) || null,
    follow_up_on: due || null,
    assigned_to: assignee || null,
    source_page: null,
  };
  const { data, error } = await supabase.from('enquiries').insert(row).select('id').single();
  if (error || !data) return { error: 'Could not save this entry. Please try again.' };

  await logActivity(supabase, ctx, 'enquiries', data.id, 'created_manually', { channel });
  revalidatePath('/admin/enquiries');
  revalidatePath('/admin');
  redirect(`/admin/enquiries/${data.id}`);
}

export async function deleteEntry(table, id) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  const cfg = target(table, id);
  const { data: row } = await supabase.from(table).select('name, email').eq('id', id).maybeSingle();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error('Could not delete');
  await logActivity(supabase, ctx, table, id, 'deleted', { name: row ? row.name || row.email : null });
  revalidatePath('/admin');
  redirect(`/admin/${cfg.path}`);
}

export async function setSubscription(id, subscription) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  target('newsletter_subscribers', id);
  if (!['subscribed', 'unsubscribed'].includes(subscription)) throw new Error('Bad request');
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ subscription, unsubscribed_at: subscription === 'unsubscribed' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error('Could not save');
  await logActivity(supabase, ctx, 'newsletter_subscribers', id, subscription === 'unsubscribed' ? 'unsubscribed' : 'resubscribed');
  revalidatePath('/admin/subscribers');
  revalidatePath('/admin');
}

// ---- team (owners only) --------------------------------------------------------------------------------------------
export async function updateStaff(userId, formData) {
  const ctx = await requireOwner();
  const { supabase, user } = ctx;
  if (!UUID.test(String(userId))) throw new Error('Bad request');
  const role = String(formData.get('role') || '');
  if (!['admin', 'staff'].includes(role)) throw new Error('Bad role');
  const display_name = String(formData.get('display_name') || '').trim().slice(0, 80) || null;
  if (role === 'staff') {
    const { count } = await supabase.from('admins').select('*', { count: 'exact', head: true }).eq('role', 'admin').neq('user_id', userId);
    if (!count) throw new Error('There must always be at least one owner.');
  }
  const { data: before } = await supabase.from('admins').select('role, display_name').eq('user_id', userId).maybeSingle();
  const { error } = await supabase.from('admins').update({ role, display_name }).eq('user_id', userId);
  if (error) throw new Error('Could not save');
  if (before && before.role !== role) await logActivity(supabase, ctx, 'admins', userId, 'role_changed', { name: display_name || before.display_name, from: before.role, to: role });
  else if (before && (before.display_name || null) !== display_name) await logActivity(supabase, ctx, 'admins', userId, 'team_renamed', { from: before.display_name, to: display_name });
  revalidatePath('/admin/team');
  revalidatePath('/admin');
  if (userId === user.id && role === 'staff') redirect('/admin');
}

export async function removeStaff(userId) {
  const ctx = await requireOwner();
  const { supabase, user } = ctx;
  if (!UUID.test(String(userId)) || userId === user.id) throw new Error('You cannot remove yourself.');
  const { data: before } = await supabase.from('admins').select('role, display_name').eq('user_id', userId).maybeSingle();
  const { error } = await supabase.from('admins').delete().eq('user_id', userId);
  if (error) throw new Error('Could not remove');
  await logActivity(supabase, ctx, 'admins', userId, 'team_removed', { name: before ? before.display_name : null, role: before ? before.role : null });
  revalidatePath('/admin/team');
}
