// Emails the business when a website form is submitted (server only, used by app/api/submit/route.js).
// Reads the same Hostinger variables as the other Next.js site:
//   SMTP_HOST (smtp.hostinger.com), SMTP_PORT (465), SMTP_SECURE (true), SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO
// Without SMTP_USER and SMTP_PASS nothing is sent (the submission is still saved).
import nodemailer from 'nodemailer';

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

// Returns true when an email was sent, false when email is not configured. Throws if the mail server refuses.
export async function sendSubmissionEmail(table, row) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('Email not sent: SMTP_USER / SMTP_PASS are not set.');
    return false;
  }
  const port = Number(SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
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
