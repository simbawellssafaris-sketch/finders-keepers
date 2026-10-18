// Emails the business when a website form is submitted (server only, used by app/api/submit/route.js).
// Reads the same Hostinger variables as the other Next.js site:
//   SMTP_HOST (smtp.hostinger.com), SMTP_PORT (465), SMTP_SECURE (true), SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO
// Without SMTP_USER and SMTP_PASS nothing is sent (the submission is still saved).
import nodemailer from 'nodemailer';
import { site } from './site.mjs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVICE_LABELS = {
  'private-jets': 'Private jet charter',
  'layover-safari': 'Layover safari',
  'flight-arrangements': 'Flight arrangements',
  'city-tour': 'City tour',
  'airport-fast-track': 'Airport fast-track',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const humanise = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function summarise(table, r) {
  const fields = [];
  const add = (label, v) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
    if (s) fields.push([label, s]);
  };
  const replyTo = typeof r.email === 'string' && EMAIL.test(r.email) ? r.email : undefined;

  if (table === 'enquiries') {
    add('Name', r.name); add('Phone / WhatsApp', r.phone); add('Email', r.email); add('Travellers', r.travellers);
    add('Preferred date', r.preferred_date); add('Interested in', r.interest); add('Package', r.package); add('Notes', r.notes);
    add('Page', r.source_page);
    const about = r.package || r.interest || 'general';
    return { subject: `New enquiry: ${oneLine(r.name)} (${oneLine(about)})`, heading: 'New enquiry', fields, replyTo };
  }
  if (table === 'service_requests') {
    const label = SERVICE_LABELS[r.service] ?? String(r.service);
    add('Service', label); add('Name', r.name); add('Email', r.email); add('Phone / WhatsApp', r.phone); add('Travellers', r.travellers);
    for (const [k, v] of Object.entries(r.details || {})) add(humanise(k), v);
    add('Page', r.source_page);
    return { subject: `New ${label.toLowerCase()} request: ${oneLine(r.name)}`, heading: `New ${label.toLowerCase()} request`, fields, replyTo };
  }
  add('Email', r.email); add('Name', [r.first_name, r.last_name].filter(Boolean).join(' ')); add('Signed up via', r.source); add('Page', r.source_page);
  return { subject: `New newsletter sign-up: ${oneLine(r.email)}`, heading: 'New newsletter sign-up', fields, replyTo };
}

export function render(s, receivedAt) {
  const hint = s.replyTo ? 'Reply to this email to answer the customer directly.' : '';
  const text = `${s.heading}\n\n${s.fields.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nReceived: ${receivedAt}\n${hint}`;
  const rows = s.fields
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#6b6358;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#1a1209">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;max-width:560px"><h2 style="font-weight:600;color:#8B3A2A;margin:0 0 14px">${esc(s.heading)}</h2><table style="border-collapse:collapse">${rows}</table><p style="color:#6b6358;font-size:13px;margin-top:18px">Received ${esc(receivedAt)}${hint ? `<br>${hint}` : ''}</p></div>`;
  return { text, html };
}

function mailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('Email not sent: SMTP_USER / SMTP_PASS are not set.');
    return null;
  }
  const port = Number(SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// A short thank-you to a new Journal subscriber (sent once per address; repeat sign-ups are not emailed again).
// Returns true when sent, false when email is not configured. Throws if the mail server refuses.
export function renderWelcome(firstName, contact) {
  const hello = oneLine(firstName) ? `Hello ${oneLine(firstName)},` : 'Hello,';
  const text = [
    hello, '',
    'Thank you for subscribing to the Finders & Keepers Safaris Journal.',
    'From time to time we will send you field notes from our guides, migration updates, new camps as we find them, and offers we share with subscribers first.',
    '',
    `Planning a journey? Just reply to this email, or write to ${contact}, and one of us will help you.`,
    '',
    'You are receiving this because this address was entered on finderskeeperssafaris.com. If that was not you, or you would rather not hear from us, reply with the word "unsubscribe" and we will remove you straight away.',
    '', 'Finders & Keepers Safaris', 'A Life Of Making Memories',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1209;max-width:560px;line-height:1.55">
<h2 style="font-weight:600;color:#8B3A2A;margin:0 0 14px">Welcome to the Journal</h2>
<p>${esc(hello)}</p>
<p>Thank you for subscribing to the Finders &amp; Keepers Safaris Journal. From time to time we will send you field notes from our guides, migration updates, new camps as we find them, and offers we share with subscribers first.</p>
<p>Planning a journey? Just reply to this email, or write to <a href="mailto:${esc(contact)}" style="color:#8B3A2A">${esc(contact)}</a>, and one of us will help you.</p>
<p style="color:#6b6358;font-size:13px;margin-top:22px">You are receiving this because this address was entered on finderskeeperssafaris.com. If that was not you, or you would rather not hear from us, reply with the word &ldquo;unsubscribe&rdquo; and we will remove you straight away.</p>
<p style="margin-top:18px">Finders &amp; Keepers Safaris<br><span style="color:#6b6358">A Life Of Making Memories</span></p></div>`;
  return { text, html };
}

export async function sendWelcomeEmail(email, firstName) {
  const transporter = mailer();
  if (!transporter || !EMAIL.test(String(email || ''))) return false;
  const { SMTP_USER } = process.env;
  const { text, html } = renderWelcome(firstName, site.email);
  await transporter.sendMail({
    from: `"Finders & Keepers Safaris" <${SMTP_USER}>`, // a customer-facing name, not the "Website" label used for the internal notices
    to: email,
    replyTo: site.email,
    subject: 'Welcome to the Finders & Keepers Safaris Journal',
    text,
    html,
  });
  return true;
}

// Returns true when an email was sent, false when email is not configured. Throws if the mail server refuses.
export async function sendSubmissionEmail(table, row) {
  const { SMTP_USER, MAIL_FROM, MAIL_TO } = process.env;
  const transporter = mailer();
  if (!transporter) return false;
  const summary = summarise(table, row);
  const { text, html } = render(summary, new Date().toUTCString());
  await transporter.sendMail({
    from: MAIL_FROM || `"Finders & Keepers Website" <${SMTP_USER}>`,
    to: MAIL_TO || SMTP_USER,
    replyTo: summary.replyTo,
    subject: summary.subject,
    text,
    html,
  });
  return true;
}
