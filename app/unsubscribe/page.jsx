import { confirmUnsubscribe } from './actions';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The unsubscribe link in a newsletter opens this page. A button is needed to finish, so a mail scanner that merely opens
// the link cannot unsubscribe anyone by accident.
export default async function Unsubscribe({ searchParams }) {
  const sp = (await searchParams) || {};
  const token = typeof sp.t === 'string' && UUID.test(sp.t) ? sp.t : '';

  if (sp.done === '1') {
    return (
      <main className="box">
        <h1>You&rsquo;ve been unsubscribed</h1>
        <p>We&rsquo;ve removed you from the Finders &amp; Keepers Safaris Journal. You won&rsquo;t receive any more newsletters from us.</p>
        <p style={{ marginBottom: 0 }}>Changed your mind? You can sign up again any time at <a href="/">finderskeeperssafaris.com</a>.</p>
      </main>
    );
  }
  if (!token) {
    return (
      <main className="box">
        <h1>{sp.error === 'busy' ? 'Please try again in a few minutes' : 'This link is not valid'}</h1>
        <p>{sp.error === 'busy' ? 'There were too many attempts from your connection.' : 'The unsubscribe link may be incomplete. Please use the link at the bottom of the newsletter, or reply to the email and we will remove you straight away.'}</p>
        <p style={{ marginBottom: 0 }}><a href="/">Back to the website</a></p>
      </main>
    );
  }
  return (
    <main className="box">
      <h1>Unsubscribe from the Journal?</h1>
      <p>Press the button and we will stop sending you our newsletter.</p>
      {sp.error === 'failed' ? <p style={{ color: '#a63a22' }}>Something went wrong. Please try again.</p> : null}
      <form action={confirmUnsubscribe}>
        <input type="hidden" name="t" value={token} />
        <button type="submit">Unsubscribe me</button>
      </form>
    </main>
  );
}
