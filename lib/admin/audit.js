// Filters shared by the Activity page and its CSV download.
import { UUID, DATE } from './config';
import { safeSearch } from './format';
import { addDays } from './money';

export const ACTIVITY_TYPES = {
  enquiries: 'Enquiries', service_requests: 'Service requests', newsletter_subscribers: 'Subscribers', clients: 'Clients', bookings: 'Bookings',
  quotations: 'Quotations', invoices: 'Invoices', documents: 'Documents', admins: 'Team and sign-ins',
};

// Where to open the record an entry is about (when it still exists).
export const RECORD_PATH = {
  enquiries: '/admin/enquiries/', service_requests: '/admin/service-requests/', clients: '/admin/clients/', bookings: '/admin/bookings/',
  quotations: '/admin/quotations/', invoices: '/admin/invoices/',
};

// "Chrome on Windows" from a browser's user-agent text.
export function deviceLabel(ua) {
  const s = String(ua || '');
  if (!s) return '';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\/|CriOS\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(s) ? 'iPhone/iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export function readFilters(sp) {
  const person = UUID.test(String(sp.person)) ? sp.person : '';
  const type = Object.prototype.hasOwnProperty.call(ACTIVITY_TYPES, sp.type) ? sp.type : '';
  const from = DATE.test(String(sp.from)) ? sp.from : '';
  const to = DATE.test(String(sp.to)) ? sp.to : '';
  return { person, type, from, to, q: safeSearch(sp.q) };
}

// Dates are Nairobi days (UTC+3, no daylight saving).
export function applyFilters(query, f) {
  if (f.person) query = query.eq('actor', f.person);
  if (f.type) query = query.eq('entity_table', f.type);
  if (f.from) query = query.gte('created_at', `${f.from}T00:00:00+03:00`);
  if (f.to) query = query.lt('created_at', `${addDays(f.to, 1)}T00:00:00+03:00`);
  if (f.q) query = query.or(`action.ilike.%${f.q.replace(/ /g, '_')}%,actor_name.ilike.%${f.q}%`);
  return query;
}
