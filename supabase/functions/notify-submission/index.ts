// Emails the business when a website form is submitted.
//
// Called by a database trigger (see the notify_on_new_submission migration) with { table, id }. The function
// loads the row, emails it through the business mailbox over SMTP, and marks it notified. It needs no login
// because the "notified_at" marker lets each row trigger at most one email, and an unknown id does nothing.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   SMTP_USER      mailbox address, e.g. bookings@finderskeeperssafaris.com  (also the sender)
//   SMTP_PASS      that mailbox's password
//   NOTIFY_TO      optional, where notifications go (defaults to SMTP_USER)
//   SMTP_HOST      optional, defaults to smtp.hostinger.com
//   SMTP_PORT      optional, defaults to 465 (SSL)
//   SMTP_FROM_NAME optional, defaults to "Finders & Keepers Website"
import nodemailer from 'npm:nodemailer@6.9.16';
import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVICE_LABELS: Record<string, string> = {
  'private-jets': 'Private jet charter',
  'layover-safari': 'Layover safari',
  'flight-arrangements': 'Flight arrangements',
  'city-tour': 'City tour',
  'airport-fast-track': 'Airport fast-track',
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const humanise = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

type Row = Record<string, unknown>;
type Summary = { subject: string; heading: string; fields: [string, string][]; replyTo?: string };

function summarise(table: string, r: Row): Summary {
  const f: [string, string][] = [];
  const add = (label: string, v: unknown) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
    if (s) f.push([label, s]);
  };
  const replyTo = typeof r.email === 'string' && EMAIL.test(r.email) ? r.email : undefined;

  if (table === 'enquiries') {
    add('Name', r.name); add('Phone / WhatsApp', r.phone); add('Email', r.email); add('Travellers', r.travellers);
    add('Preferred date', r.preferred_date); add('Interested in', r.interest); add('Package', r.package); add('Notes', r.notes);
    add('Page', r.source_page);
    const about = r.package || r.interest || 'general';
    return { subject: `New enquiry: ${oneLine(r.name)} (${oneLine(about)})`, heading: 'New enquiry', fields: f, replyTo };
  }
  if (table === 'service_requests') {
    const label = SERVICE_LABELS[String(r.service)] ?? String(r.service);
    add('Service', label); add('Name', r.name); add('Email', r.email); add('Phone / WhatsApp', r.phone); add('Travellers', r.travellers);
    for (const [k, v] of Object.entries((r.details as Row) ?? {})) add(humanise(k), v);
    add('Page', r.source_page);
    return { subject: `New ${label.toLowerCase()} request: ${oneLine(r.name)}`, heading: `New ${label.toLowerCase()} request`, fields: f, replyTo };
  }
  add('Email', r.email); add('Name', [r.first_name, r.last_name].filter(Boolean).join(' ')); add('Signed up via', r.source); add('Page', r.source_page);
  return { subject: `New newsletter sign-up: ${oneLine(r.email)}`, heading: 'New newsletter sign-up', fields: f, replyTo };
}

function render(s: Summary, receivedAt: string) {
  const text = `${s.heading}\n\n${s.fields.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nReceived: ${receivedAt}\n${s.replyTo ? 'Reply to this email to answer the customer directly.' : ''}`;
  const rows = s.fields
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#6b6358;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#1a1209">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;max-width:560px"><h2 style="font-weight:600;color:#8B3A2A;margin:0 0 14px">${esc(s.heading)}</h2><table style="border-collapse:collapse">${rows}</table><p style="color:#6b6358;font-size:13px;margin-top:18px">Received ${esc(receivedAt)}${s.replyTo ? '<br>Reply to this email to answer the customer directly.' : ''}</p></div>`;
  return { text, html };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const host = Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com';
  const port = Number(Deno.env.get('SMTP_PORT') ?? 465);

  // GET: connectivity check only. Opens a TLS connection to the mail server and returns its greeting line.
  if (req.method === 'GET') {
    try {
      const conn = await Deno.connectTls({ hostname: host, port });
      const buf = new Uint8Array(256);
      const n = await conn.read(buf);
      conn.close();
      // names only, never values: shows whether the mailbox secrets reached the function
      const custom = Object.keys(Deno.env.toObject()).filter((k) => !/^(SUPABASE_|SB_|DENO_|EDGE_|NODE_|HOME|PATH|LANG|TZ)/.test(k)).sort();
      return json({ ok: true, host, port, greeting: new TextDecoder().decode(buf.subarray(0, n ?? 0)).trim(), smtpUserSet: !!Deno.env.get('SMTP_USER'), smtpPassSet: !!Deno.env.get('SMTP_PASS'), customSecretNames: custom });
    } catch (e) {
      return json({ ok: false, host, port, error: String(e) }, 502);
    }
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const { table, id } = await req.json().catch(() => ({} as Row));
  if (!['enquiries', 'service_requests', 'newsletter_subscribers'].includes(table) || !UUID.test(String(id))) {
    return json({ error: 'bad request' }, 400);
  }

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Claim the row: only the first call for a given row gets it, so repeated calls can never send repeat emails.
  const { data: row, error: claimError } = await db
    .from(table).update({ notified_at: new Date().toISOString() }).eq('id', id).is('notified_at', null).select().maybeSingle();
  if (claimError) return json({ error: 'database error', detail: claimError.message }, 500);
  if (!row) return json({ ok: true, skipped: 'unknown id or already notified' });

  const release = () => db.from(table).update({ notified_at: null }).eq('id', id);

  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  if (!user || !pass) {
    await release();
    return json({ error: 'SMTP_USER / SMTP_PASS are not set in the Edge Function secrets' }, 503);
  }

  try {
    const summary = summarise(table, row as Row);
    const { text, html } = render(summary, new Date(String(row.created_at)).toUTCString());
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from: `"${oneLine(Deno.env.get('SMTP_FROM_NAME') ?? 'Finders & Keepers Website')}" <${user}>`,
      to: Deno.env.get('NOTIFY_TO') ?? user,
      replyTo: summary.replyTo,
      subject: summary.subject,
      text,
      html,
    });
    return json({ ok: true, sent: true });
  } catch (e) {
    await release();
    console.error('email failed:', String(e));
    return json({ error: 'email failed', detail: String(e) }, 500);
  }
});
