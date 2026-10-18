// Emails a quotation or invoice to a client (server only). Uses the same Hostinger SMTP variables as the website forms.
import nodemailer from 'nodemailer';
import { fmtMoney, lineCents, fromCents } from './admin/money';
import { bankLines } from './admin/business';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const para = (s) => esc(s).replace(/\n/g, '<br>');

// kind: 'Quotation' | 'Invoice'. Returns { subject, text, html }.
export function renderDocumentEmail({ kind, reference, title, clientName, business, items, currency, total, paid, intro, terms, dueLabel, withBank }) {
  const rows = items.map((it) => [it.description, `${Number(it.quantity)}`, fmtMoney(it.unit_price, currency), fmtMoney(fromCents(lineCents(it)), currency)]);
  const bank = withBank ? bankLines(business) : [];
  const name = business.trading_name || business.legal_name || 'Finders & Keepers Safaris';
  const subject = `${kind} ${reference}: ${title} (${name})`;

  const text = [
    `Dear ${clientName},`, '', intro || (kind === 'Invoice' ? `Please find your invoice ${reference} below.` : `Thank you for your interest. Here is your quotation ${reference}.`), '',
    `${kind} ${reference} - ${title}`,
    ...rows.map((r) => `- ${r[0]}: ${r[1]} x ${r[2]} = ${r[3]}`),
    `Total: ${fmtMoney(total, currency)}`,
    ...(paid ? [`Paid so far: ${fmtMoney(paid, currency)}`, `Balance: ${fmtMoney(total - paid, currency)}`] : []),
    ...(dueLabel ? [dueLabel] : []),
    ...(bank.length ? ['', 'How to pay:', ...bank.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(terms ? ['', terms] : []), '', name, business.email || '',
  ].join('\n');

  const td = 'padding:8px 10px;border-bottom:1px solid #e6dcc4;vertical-align:top';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1209;max-width:620px">
<h2 style="font-weight:600;color:#8B3A2A;margin:0 0 4px">${esc(kind)} ${esc(reference)}</h2>
<p style="margin:0 0 16px;color:#6b6358">${esc(title)}</p>
<p>Dear ${esc(clientName)},</p>
<p>${para(intro || (kind === 'Invoice' ? `Please find your invoice below.` : `Thank you for your interest. Here is your quotation.`))}</p>
<table style="border-collapse:collapse;width:100%"><thead><tr style="text-align:left;color:#6b6358;font-size:12px;text-transform:uppercase"><th style="${td}">Item</th><th style="${td}">Qty</th><th style="${td}">Price</th><th style="${td};text-align:right">Amount</th></tr></thead><tbody>
${rows.map((r) => `<tr><td style="${td}">${esc(r[0])}</td><td style="${td}">${esc(r[1])}</td><td style="${td}">${esc(r[2])}</td><td style="${td};text-align:right">${esc(r[3])}</td></tr>`).join('')}
<tr><td colspan="3" style="${td};text-align:right"><strong>Total</strong></td><td style="${td};text-align:right"><strong>${esc(fmtMoney(total, currency))}</strong></td></tr>
${paid ? `<tr><td colspan="3" style="${td};text-align:right">Paid so far</td><td style="${td};text-align:right">${esc(fmtMoney(paid, currency))}</td></tr><tr><td colspan="3" style="${td};text-align:right"><strong>Balance</strong></td><td style="${td};text-align:right"><strong>${esc(fmtMoney(total - paid, currency))}</strong></td></tr>` : ''}
</tbody></table>
${dueLabel ? `<p style="margin:14px 0 0"><strong>${esc(dueLabel)}</strong></p>` : ''}
${bank.length ? `<h3 style="font-weight:600;margin:22px 0 6px">How to pay</h3><table style="border-collapse:collapse">${bank.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b6358">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
${terms ? `<p style="color:#6b6358;font-size:13px;margin-top:18px">${para(terms)}</p>` : ''}
<p style="margin-top:22px">Kind regards,<br>${esc(name)}${business.email ? `<br>${esc(business.email)}` : ''}</p></div>`;
  return { subject, text, html };
}

// Returns true when sent, false when email is not configured. Throws when the mail server refuses.
export async function sendClientEmail({ to, replyTo, subject, text, html }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return false;
  const port = Number(SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.hostinger.com', port, secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  await transporter.sendMail({ from: MAIL_FROM || `"Finders & Keepers Safaris" <${SMTP_USER}>`, to, replyTo, subject: String(subject).replace(/[\r\n]+/g, ' '), text, html });
  return true;
}
