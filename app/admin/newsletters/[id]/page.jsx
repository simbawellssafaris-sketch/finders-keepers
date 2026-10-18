import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin/auth';
import { UUID } from '../../../../lib/admin/config';
import { getBusiness } from '../../../../lib/admin/business';
import { describeActivity } from '../../../../lib/admin/activity';
import { fmtDate } from '../../../../lib/admin/format';
import { startSending, retryFailed, duplicateNewsletter, deleteNewsletter } from '../../actions-news';
import { emailConfigured, hourlyLimit } from '../../../../lib/newsletter-send';
import ConfirmButton from '../../_components/ConfirmButton';
import NewsletterEditor from '../../_components/NewsletterEditor';
import SendPanel from '../../_components/SendPanel';
import TestSendForm from '../../_components/TestSendForm';
import Shell from '../../_components/Shell';

export const dynamic = 'force-dynamic';
const LABELS = { draft: 'Draft', sending: 'Sending', sent: 'Sent' };
const ERRORS = {
  'email-off': 'Email is not switched on for this server yet (the SMTP settings are missing), so nothing can be sent.',
  'not-draft': 'This issue has already been started.',
  empty: 'Write something in the issue and save it before sending.',
  'no-subscribers': 'There is nobody subscribed yet.',
  'queue-failed': 'The send could not be set up. Nothing was sent; please try again.',
  'cannot-delete': 'Only a draft can be deleted.',
};

const count = async (supabase, id, status) => (await supabase.from('newsletter_sends').select('*', { count: 'exact', head: true }).eq('newsletter_id', id).eq('status', status)).count || 0;

export default async function NewsletterPage({ params, searchParams }) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const { id } = await params;
  const sp = (await searchParams) || {};
  if (!UUID.test(String(id))) notFound();
  const { data: n } = await supabase.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (!n) notFound();
  const business = await getBusiness(supabase);
  const draft = n.status === 'draft';

  const [{ count: subscribed }, { data: history }] = await Promise.all([
    supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('subscription', 'subscribed'),
    supabase.from('activity_log').select('*').eq('entity_table', 'newsletters').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
  ]);
  let prog = null, failures = [];
  if (!draft) {
    const [queued, sending, sent, failed, skipped] = await Promise.all(['queued', 'sending', 'sent', 'failed', 'skipped'].map((s) => count(supabase, id, s)));
    prog = { queued, sending, sent, failed, skipped };
    if (failed || skipped) {
      const { data } = await supabase.from('newsletter_sends').select('id, email, status, error').eq('newsletter_id', id).in('status', ['failed', 'skipped']).order('created_at').limit(100);
      failures = data || [];
    }
  }
  const finished = prog && prog.queued === 0 && prog.sending === 0;
  const emailOn = emailConfigured();

  return (
    <Shell ctx={ctx} current="newsletters">
      <Link className="ad-back" href="/admin/newsletters">&larr; Back to newsletters</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1>{n.subject}</h1>
          <p className="ad-sub"><span className={`badge st-n-${n.status}`}>{LABELS[n.status]}</span> &nbsp;Created {fmtDate(n.created_at)}{n.sent_at ? <> &middot; finished {fmtDate(n.sent_at)}</> : null}</p>
        </div>
        <form action={duplicateNewsletter.bind(null, id)}><button className="ad-btn ghost" type="submit">Copy as a new draft</button></form>
      </div>
      {ERRORS[sp.error] ? <p className="ad-err" role="alert">{ERRORS[sp.error]}</p> : null}
      {!emailOn ? <p className="ad-banner" role="note" style={{ textAlign: 'left', margin: '0 0 16px' }}>Email is not switched on for this server, so test and real sends are unavailable here. On the live site this works.</p> : null}

      {/* the key makes the panel start afresh whenever the stored progress has changed (for example after "try again") */}
      {!draft ? <SendPanel key={`${id}-${n.status}-${prog.queued}-${prog.sending}-${prog.sent}-${prog.failed}-${prog.skipped}`} id={id} total={n.total} initial={prog} autoStart={sp.started === '1'} /> : null}
      {!draft && prog && prog.failed && finished && ctx.admin.isOwner ? (
        <form action={retryFailed.bind(null, id)} className="ad-panel">
          <h2>Some emails failed</h2>
          <p className="ad-sub" style={{ marginTop: 0 }}>Usually a mistyped address (it can never work) or a temporary mail-server refusal (it may work now). You can try the failed ones again.</p>
          <button className="ad-btn ghost" type="submit">Try the {prog.failed} failed again</button>
        </form>
      ) : null}
      {failures.length ? (
        <section className="ad-panel">
          <h2>Failed and skipped</h2>
          <div className="ad-tablewrap" style={{ boxShadow: 'none' }}>
            <table className="ad-table">
              <thead><tr><th>Email</th><th>Result</th><th>Reason</th></tr></thead>
              <tbody>{failures.map((f) => <tr key={f.id}><td>{f.email}</td><td>{f.status === 'failed' ? 'Failed' : 'Skipped'}</td><td>{f.error}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="ad-detail" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <NewsletterEditor id={id} newsletter={n} business={{ legal_name: business.legal_name, address: business.address }} editable={draft} />
      </div>

      <div className="ad-detail">
        <div>
          <section className="ad-panel">
            <h2>History</h2>
            {history && history.length ? (
              <ol className="ad-timeline">{history.map((a) => <li key={a.id}><strong>{a.actor_name || 'Someone'}</strong> {describeActivity(a)}<small>{fmtDate(a.created_at)}</small></li>)}</ol>
            ) : <p className="ad-sub" style={{ margin: 0 }}>Nothing yet.</p>}
          </section>
        </div>
        <aside>
          {draft ? <TestSendForm id={id} email={ctx.user.email} /> : null}
          {draft ? (
            <section className="ad-panel">
              <h2>Send to everyone</h2>
              {ctx.admin.isOwner ? (
                <>
                  <p className="ad-sub" style={{ marginTop: 0 }}>Sends the <strong>saved</strong> draft to the <strong>{subscribed || 0}</strong> people who are subscribed now. After this the wording is locked. To keep the mailbox healthy it sends about {hourlyLimit()} emails an hour, a few at a time while this page is open.</p>
                  <form action={startSending.bind(null, id)}><ConfirmButton className="ad-btn" message={`Send "${n.subject}" to ${subscribed || 0} subscribers? This cannot be undone.`}>Send to {subscribed || 0} subscribers</ConfirmButton></form>
                </>
              ) : <p className="ad-sub" style={{ margin: 0 }}>Only an owner can send an issue. Save your draft, send yourself a test, and ask an owner to send it.</p>}
            </section>
          ) : null}
          {draft ? (
            <form action={deleteNewsletter.bind(null, id)} className="ad-panel">
              <h2>Delete</h2>
              <p className="ad-sub" style={{ marginBottom: 12 }}>Removes this draft for good. Sent issues are kept on record.</p>
              <ConfirmButton className="ad-btn danger" message="Delete this draft?">Delete draft</ConfirmButton>
            </form>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}
