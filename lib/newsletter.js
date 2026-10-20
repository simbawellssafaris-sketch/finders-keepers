// Turns what someone types in the newsletter editor into a finished email (HTML and plain text). Pure functions: used by the
// editor's live preview in the browser and by the sender on the server, so what you preview is what subscribers receive.
//
// What the editor understands (everything else is shown exactly as typed; nothing typed can inject HTML):
//   a blank line starts a new paragraph          # Big heading        ## Smaller heading
//   - a bullet point                              ---  (a divider line)
//   **bold**     [link text](https://example.com)     ![picture description](https://example.com/photo.jpg)
//   [[Button text|https://example.com]]           {{first_name}}  (the subscriber's first name, or "there")

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const URL_OK = /^(https:\/\/|http:\/\/|mailto:)[^\s"<>]+$/i;
const IMG_OK = /^https:\/\/[^\s"<>]+$/i;

const RUST = '#8B3A2A';
const INK = '#1a1209';
const MUTED = '#6b6358';

export const firstNameOf = (name) => String(name ?? '').trim().split(/\s+/)[0].slice(0, 60);

// inline: bold, links, pictures, {{first_name}} (works on already-escaped text)
function inline(safe, firstName) {
  return safe
    .replace(/\{\{\s*first_name\s*\}\}/g, esc(firstName || 'there'))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => (IMG_OK.test(unesc(url)) ? `<img src="${url}" alt="${alt}" width="520" style="max-width:100%;height:auto;border:0;display:block;margin:14px 0">` : m))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => (URL_OK.test(unesc(url)) ? `<a href="${url}" style="color:${RUST}">${label}</a>` : m))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
const unesc = (s) => s.replace(/&amp;/g, '&');

// The body as HTML blocks.
export function bodyToHtml(body, firstName = '') {
  const blocks = String(body ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^---+$/.test(block)) { out.push(`<hr style="border:0;border-top:1px solid #e6dcc4;margin:26px 0">`); continue; }
    const button = block.match(/^\[\[\s*([^|\]]+?)\s*\|\s*([^\]\s]+)\s*\]\]$/);
    if (button && URL_OK.test(button[2])) {
      out.push(`<p style="margin:22px 0"><a href="${esc(button[2])}" style="background:${RUST};color:#ffffff;text-decoration:none;padding:12px 26px;display:inline-block;font-size:14px;letter-spacing:.08em;text-transform:uppercase">${esc(button[1])}</a></p>`);
      continue;
    }
    if (lines.every((l) => /^- /.test(l))) {
      out.push(`<ul style="margin:0 0 16px;padding-left:22px">${lines.map((l) => `<li style="margin:0 0 6px">${inline(esc(l.slice(2)), firstName)}</li>`).join('')}</ul>`);
      continue;
    }
    if (lines.length === 1 && /^# /.test(block)) { out.push(`<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:${INK};margin:28px 0 12px">${inline(esc(block.slice(2)), firstName)}</h2>`); continue; }
    if (lines.length === 1 && /^## /.test(block)) { out.push(`<h3 style="font-family:Georgia,serif;font-weight:normal;font-size:20px;line-height:1.3;color:${RUST};margin:24px 0 10px">${inline(esc(block.slice(3)), firstName)}</h3>`); continue; }
    out.push(`<p style="margin:0 0 16px">${lines.map((l) => inline(esc(l), firstName)).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// The same content as plain text (for email programs that do not show HTML, and as the spam-filter-friendly twin).
export function bodyToText(body, firstName = '') {
  return String(body ?? '').replace(/\r\n?/g, '\n')
    .replace(/\{\{\s*first_name\s*\}\}/g, firstName || 'there')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => (alt ? `${alt}: ${url}` : url))
    .replace(/\[\[\s*([^|\]]+?)\s*\|\s*([^\]\s]+)\s*\]\]/g, '$1: $2')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,2} /gm, '')
    .replace(/^---+$/gm, '--------')
    .trim();
}

// The finished email. `business` is the Settings record (legal name, address); `unsubscribeUrl` is that subscriber's own link
// (null in the editor preview and in test sends).
export function renderNewsletter({ subject, preview, body, firstName = '', unsubscribeUrl = null, business = {} }) {
  const company = business.legal_name || 'Finders Keepers Safaris Limited';
  const address = business.address || '';
  const unsub = unsubscribeUrl
    ? `<a href="${esc(unsubscribeUrl)}" style="color:${MUTED}">Unsubscribe</a>`
    : `<span style="color:${MUTED}">Unsubscribe link appears here in the real send</span>`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EDE3CE">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EDE3CE">${esc(preview || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDE3CE"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td style="background:${RUST};padding:22px 32px;font-family:Georgia,serif;font-size:22px;letter-spacing:.04em;color:#ffffff">Finders &amp; Keepers Safaris<span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#f0cdb8;margin-left:12px">The Journal</span></td></tr>
<tr><td style="padding:30px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${INK}">
${bodyToHtml(body, firstName)}
</td></tr>
<tr><td style="padding:18px 32px 30px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid #e6dcc4">
You are receiving this because you subscribed to our Journal at finderskeeperssafaris.com.<br>
${esc(company)}${address ? ` &middot; ${esc(address)}` : ''}<br>${unsub}
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    bodyToText(body, firstName), '', '--',
    'You are receiving this because you subscribed to our Journal at finderskeeperssafaris.com.',
    `${company}${address ? `, ${address}` : ''}`,
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : 'Unsubscribe link appears here in the real send',
  ].join('\n');
  return { html, text };
}
