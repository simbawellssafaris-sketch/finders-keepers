// Small helpers for the admin dashboard.

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
}

// Search text goes into a database filter, so keep only harmless characters (no commas, brackets, percent signs...).
export function safeSearch(q) {
  return String(q || '').replace(/[^\p{L}\p{N} @.+_-]/gu, '').trim().slice(0, 80);
}

// phone number -> digits only for a wa.me link; null when it does not look like a number
export function whatsappDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

// A spreadsheet treats cells starting with = + - @ as formulas, which customers could abuse; prefix them so they stay plain text.
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// A plain calendar date (YYYY-MM-DD) shown as 20 Oct 2026
export function fmtDay(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Today's date in Nairobi as YYYY-MM-DD (used for 'follow-up due' checks)
export const todayNairobi = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
