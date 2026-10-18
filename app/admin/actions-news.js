'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireOwner, loginLimited } from '../../lib/admin/auth';
import { logActivity } from '../../lib/admin/staff';
import { UUID } from '../../lib/admin/config';
import { getBusiness } from '../../lib/admin/business';
import { firstNameOf } from '../../lib/newsletter';
import { newsletterTransport, hourlyLimit, sendIssue, sendTestIssue } from '../../lib/newsletter-send';

const text = (v, max) => String(v ?? '').trim().slice(0, max);
const BATCH = 10;
const clientIp = async () => ((await headers()).get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
const originOf = async () => {
  const h = await headers();
  return `${h.get('x-forwarded-proto') || 'http'}://${h.get('host') || 'localhost:3010'}`;
};

// ---- writing ----------------------------------------------------------------------------------------------------------
export async function saveNewsletter(id, prev, formData) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (id && !UUID.test(String(id))) return { error: 'Not found.' };
  const subject = text(formData.get('subject'), 200);
  if (!subject) return { error: 'Please give the issue a subject line.' };
  const row = { subject, preview: text(formData.get('preview'), 200) || null, body: text(formData.get('body'), 30000) };

  if (id) {
    const { error } = await supabase.from('newsletters').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft');
    if (error) return { error: 'Could not save. Only drafts can be edited.' };
    revalidatePath(`/admin/newsletters/${id}`);
    revalidatePath('/admin/newsletters');
    return { saved: true };
  }
  const { data, error } = await supabase.from('newsletters').insert({ ...row, created_by: user.id }).select('id').single();
  if (error || !data) return { error: 'Could not create the issue. Please try again.' };
  await logActivity(supabase, ctx, 'newsletters', data.id, 'newsletter_created', {});
  revalidatePath('/admin/newsletters');
  redirect(`/admin/newsletters/${data.id}`);
}

export async function duplicateNewsletter(id) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: n } = await supabase.from('newsletters').select('subject, preview, body').eq('id', id).maybeSingle();
  if (!n) throw new Error('Not found');
  const { data, error } = await supabase.from('newsletters').insert({ subject: text(`Copy of ${n.subject}`, 200), preview: n.preview, body: n.body, created_by: user.id }).select('id').single();
  if (error || !data) throw new Error('Could not copy');
  await logActivity(supabase, ctx, 'newsletters', data.id, 'newsletter_created', { from: 'copy' });
  redirect(`/admin/newsletters/${data.id}`);
}

export async function deleteNewsletter(id) {
  const ctx = await requireAdmin();
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: n } = await ctx.supabase.from('newsletters').select('subject').eq('id', id).eq('status', 'draft').maybeSingle();
  if (!n) redirect(`/admin/newsletters/${id}?error=cannot-delete`);
  await ctx.supabase.from('newsletters').delete().eq('id', id).eq('status', 'draft');
  await logActivity(ctx.supabase, ctx, 'newsletters', id, 'deleted', { name: n.subject });
  revalidatePath('/admin/newsletters');
  redirect('/admin/newsletters');
}

// A test copy to the signed-in person's own address only.
export async function sendTest(id, prev) {
  const ctx = await requireAdmin();
  const { supabase, user } = ctx;
  if (!UUID.test(String(id))) return { error: 'Not found.' };
  if (loginLimited(await clientIp(), 'ntest')) return { error: 'Too many test emails. Please wait a few minutes.' };
  const transporter = newsletterTransport();
  if (!transporter) return { error: 'Email is not switched on for this server yet (the SMTP settings are missing).' };
  const { data: news } = await supabase.from('newsletters').select('subject, preview, body').eq('id', id).maybeSingle();
  if (!news) return { error: 'Issue not found.' };
  if (!news.body.trim()) return { error: 'Write something in the issue first, then save it.' };
  try {
    await sendTestIssue(transporter, { news, to: user.email, firstName: firstNameOf(ctx.admin.name), business: await getBusiness(supabase) });
  } catch (e) {
    console.error('Test newsletter failed:', e && e.message);
    return { error: 'The test email could not be sent. Please try again in a moment.' };
  } finally {
    transporter.close();
  }
  await logActivity(supabase, ctx, 'newsletters', id, 'newsletter_test_sent', {});
  return { ok: `A test copy was sent to ${user.email}. Check your inbox (and spam folder).` };
}

// ---- sending (owners only) --------------------------------------------------------------------------------------------
async function allSubscribers(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('newsletter_subscribers').select('id, email').eq('subscription', 'subscribed').order('created_at').range(from, from + 999);
    if (error) throw new Error('Could not read the subscriber list');
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Freezes the issue and queues one email per current subscriber. The emails themselves go out in small batches (sendBatch).
export async function startSending(id) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const back = (flag) => redirect(`/admin/newsletters/${id}?${flag}`);
  if (!newsletterTransport()) back('error=email-off');
  const { data: news } = await supabase.from('newsletters').select('status, subject, body').eq('id', id).maybeSingle();
  if (!news || news.status !== 'draft') back('error=not-draft');
  if (!news.body.trim()) back('error=empty');
  const subs = await allSubscribers(supabase);
  if (!subs.length) back('error=no-subscribers');

  const { data: claimed } = await supabase.from('newsletters').update({ status: 'sending', total: subs.length, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft').select('id');
  if (!claimed || !claimed.length) back('error=not-draft');
  for (let i = 0; i < subs.length; i += 500) {
    const chunk = subs.slice(i, i + 500).map((s) => ({ newsletter_id: id, subscriber_id: s.id, email: s.email }));
    const { error } = await supabase.from('newsletter_sends').insert(chunk);
    if (error) {
      await supabase.from('newsletter_sends').delete().eq('newsletter_id', id);
      await supabase.from('newsletters').update({ status: 'draft', total: 0 }).eq('id', id);
      back('error=queue-failed');
    }
  }
  await logActivity(supabase, ctx, 'newsletters', id, 'newsletter_send_started', { recipients: subs.length, subject: news.subject });
  revalidatePath('/admin/newsletters');
  redirect(`/admin/newsletters/${id}?started=1`);
}

const countBy = async (supabase, id, status) => {
  const { count } = await supabase.from('newsletter_sends').select('*', { count: 'exact', head: true }).eq('newsletter_id', id).eq('status', status);
  return count || 0;
};
async function progress(supabase, id) {
  const [queued, sending, sent, failed, skipped] = await Promise.all(['queued', 'sending', 'sent', 'failed', 'skipped'].map((s) => countBy(supabase, id, s)));
  return { queued, sending, sent, failed, skipped };
}

// Sends the next few emails of an issue. The page calls this again and again until it reports `done` or `paused`.
export async function sendBatch(id) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) return { error: 'Not found.' };
  const { data: news } = await supabase.from('newsletters').select('id, subject, preview, body, status').eq('id', id).maybeSingle();
  if (!news) return { error: 'Issue not found.' };
  if (news.status === 'draft') return { error: 'This issue has not been started yet.' };
  if (news.status === 'sent') return { done: true, ...(await progress(supabase, id)) };
  const transporter = newsletterTransport();
  if (!transporter) return { error: 'Email is not switched on for this server yet (the SMTP settings are missing).' };

  try {
    // emails claimed more than 10 minutes ago by a batch that never finished go back in the queue
    await supabase.from('newsletter_sends').update({ status: 'queued', claimed_at: null }).eq('newsletter_id', id).eq('status', 'sending').lt('claimed_at', new Date(Date.now() - 600000).toISOString());

    // the mailbox may only send so many emails per hour
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: lastHour } = await supabase.from('newsletter_sends').select('*', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', hourAgo);
    const allowed = hourlyLimit() - (lastHour || 0);
    if (allowed <= 0) {
      const { data: oldest } = await supabase.from('newsletter_sends').select('sent_at').eq('status', 'sent').gte('sent_at', hourAgo).order('sent_at').limit(1).maybeSingle();
      const until = oldest ? new Date(new Date(oldest.sent_at).getTime() + 3600000).toISOString() : new Date(Date.now() + 600000).toISOString();
      return { paused: true, until, limit: hourlyLimit(), ...(await progress(supabase, id)) };
    }

    const { data: next } = await supabase.from('newsletter_sends').select('id, subscriber_id').eq('newsletter_id', id).eq('status', 'queued').order('created_at').limit(Math.min(BATCH, allowed));
    const ids = (next || []).map((r) => r.id);
    let claimed = [];
    if (ids.length) {
      const { data } = await supabase.from('newsletter_sends').update({ status: 'sending', claimed_at: new Date().toISOString() }).in('id', ids).eq('status', 'queued').select('id, subscriber_id, email');
      claimed = data || [];
    }

    if (claimed.length) {
      const { data: subs } = await supabase.from('newsletter_subscribers').select('id, email, first_name, unsubscribe_token, subscription').in('id', claimed.map((c) => c.subscriber_id).filter(Boolean));
      const bySub = new Map((subs || []).map((s) => [s.id, s]));
      const business = await getBusiness(supabase);
      const origin = await originOf();
      for (const c of claimed) {
        const sub = bySub.get(c.subscriber_id);
        if (!sub || sub.subscription !== 'subscribed') {
          await supabase.from('newsletter_sends').update({ status: 'skipped', error: sub ? 'Unsubscribed before this was sent' : 'Subscriber removed' }).eq('id', c.id);
          continue;
        }
        try {
          await sendIssue(transporter, { news, sub, business, origin });
          await supabase.from('newsletter_sends').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', c.id);
        } catch (e) {
          await supabase.from('newsletter_sends').update({ status: 'failed', error: text((e && e.message) || 'Send failed', 280) }).eq('id', c.id);
        }
        await new Promise((r) => setTimeout(r, 250)); // be gentle with the mail server
      }
    }

    const p = await progress(supabase, id);
    if (p.queued === 0 && p.sending === 0) {
      await supabase.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id).eq('status', 'sending');
      await logActivity(supabase, ctx, 'newsletters', id, 'newsletter_send_finished', { sent: p.sent, failed: p.failed, skipped: p.skipped });
      revalidatePath('/admin/newsletters');
      revalidatePath(`/admin/newsletters/${id}`);
      return { done: true, ...p };
    }
    return { ...p, done: false };
  } finally {
    transporter.close();
  }
}

// Puts failed emails back in the queue to try again (after fixing a mail problem, or for a temporary refusal).
export async function retryFailed(id) {
  const ctx = await requireOwner();
  const { supabase } = ctx;
  if (!UUID.test(String(id))) throw new Error('Bad request');
  const { data: retried } = await supabase.from('newsletter_sends').update({ status: 'queued', error: null, claimed_at: null }).eq('newsletter_id', id).eq('status', 'failed').select('id');
  if (retried && retried.length) {
    await supabase.from('newsletters').update({ status: 'sending' }).eq('id', id).eq('status', 'sent');
    await logActivity(supabase, ctx, 'newsletters', id, 'newsletter_retry', { emails: retried.length });
  }
  revalidatePath(`/admin/newsletters/${id}`);
  redirect(`/admin/newsletters/${id}?started=1`);
}
