// Sends newsletter emails through the Hostinger mailbox (server only). Used by the dashboard's newsletter actions.
import nodemailer from 'nodemailer';
import { renderNewsletter, firstNameOf } from './newsletter';
import { site } from './site.mjs';

// One connection reused for a whole batch. Returns null when email is not set up (SMTP_USER / SMTP_PASS missing).
export function newsletterTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.hostinger.com', port, secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }, pool: true, maxConnections: 1, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
}

// Is the mailbox connection configured? (Does not open a connection.)
export const emailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

// How many newsletter emails may go out per hour (Hostinger limits how fast a mailbox may send). Change with NEWSLETTER_HOURLY_LIMIT.
export function hourlyLimit() {
  const n = parseInt(process.env.NEWSLETTER_HOURLY_LIMIT, 10);
  return n >= 1 && n <= 5000 ? n : 60;
}

// The web address the unsubscribe links point at.
export const unsubscribeBase = (fallbackOrigin) => (process.env.NODE_ENV === 'production' ? `https://${site.domain}` : fallbackOrigin);

// Sends one newsletter to one subscriber. `sub` is { email, first_name, unsubscribe_token }. Throws when the mail server refuses.
export async function sendIssue(transporter, { news, sub, business, origin }) {
  const base = unsubscribeBase(origin);
  const link = `${base}/unsubscribe?t=${sub.unsubscribe_token}`;
  const { html, text } = renderNewsletter({ subject: news.subject, preview: news.preview, body: news.body, firstName: firstNameOf(sub.first_name), unsubscribeUrl: link, business });
  await transporter.sendMail({
    from: `"Finders & Keepers Safaris" <${process.env.SMTP_USER}>`,
    to: sub.email,
    replyTo: site.email,
    subject: String(news.subject).replace(/[\r\n]+/g, ' '),
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${base}/unsubscribe/one-click?t=${sub.unsubscribe_token}>, <mailto:${site.email}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Precedence': 'bulk',
    },
  });
}

// A test copy to the person who is signed in (never to anyone else). Has no real unsubscribe link.
export async function sendTestIssue(transporter, { news, to, firstName, business }) {
  const { html, text } = renderNewsletter({ subject: news.subject, preview: news.preview, body: news.body, firstName, unsubscribeUrl: null, business });
  await transporter.sendMail({
    from: `"Finders & Keepers Safaris" <${process.env.SMTP_USER}>`,
    to, replyTo: site.email, subject: `[TEST] ${String(news.subject).replace(/[\r\n]+/g, ' ')}`, text, html,
  });
}
