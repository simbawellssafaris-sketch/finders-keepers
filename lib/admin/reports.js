// Helpers for the Reports page: date periods and per-currency totals. Money from different currencies is never added together.
import { DATE } from './config';
import { addDays, toCents, fromCents } from './money';

export const PERIODS = [
  ['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'],
  ['this_year', 'This year'], ['last_year', 'Last year'], ['last_90', 'Last 90 days'],
];

const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

// The chosen period as { key, label, from, to } (inclusive Nairobi dates, YYYY-MM-DD). Anything unrecognised falls back to "this year".
export function periodRange(sp, today) {
  const [y, m] = today.split('-').map(Number);
  if (DATE.test(String(sp.from)) && DATE.test(String(sp.to)) && sp.from <= sp.to) return { key: 'custom', label: 'Custom dates', from: sp.from, to: sp.to };
  const key = PERIODS.some(([k]) => k === sp.period) ? sp.period : 'this_year';
  const label = PERIODS.find(([k]) => k === key)[1];
  if (key === 'this_month') return { key, label, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  if (key === 'last_month') { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { key, label, from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` }; }
  if (key === 'this_quarter') { const qs = Math.floor((m - 1) / 3) * 3 + 1; return { key, label, from: `${y}-${pad(qs)}-01`, to: `${y}-${pad(qs + 2)}-${pad(lastDay(y, qs + 2))}` }; }
  if (key === 'last_year') return { key, label, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (key === 'last_90') return { key, label, from: addDays(today, -89), to: today };
  return { key, label, from: `${y}-01-01`, to: `${y}-12-31` };
}

// Nairobi day boundaries as timestamps, for filtering created_at columns.
export const startOf = (d) => `${d}T00:00:00+03:00`;
export const endExclusive = (d) => `${addDays(d, 1)}T00:00:00+03:00`;
// The Nairobi calendar day of a timestamp.
export const nairobiDay = (ts) => new Date(new Date(ts).getTime() + 3 * 3600000).toISOString().slice(0, 10);

// Adds up rows per currency: sumBy(rows, (r) => r.currency, (r) => amount) -> { USD: 1200.5, KES: 0 }
export function sumBy(rows, currencyOf, valueOf) {
  const cents = {};
  for (const r of rows) cents[currencyOf(r)] = (cents[currencyOf(r)] || 0) + toCents(valueOf(r));
  return Object.fromEntries(Object.entries(cents).map(([c, v]) => [c, fromCents(v)]));
}

// Group rows by a key and add up a value per currency: groupSum(rows, keyOf, currencyOf, valueOf) -> Map(key -> { USD: n, KES: n })
export function groupSum(rows, keyOf, currencyOf, valueOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = currencyOf(r);
    const entry = map.get(k) || {};
    entry[cur] = (entry[cur] || 0) + toCents(valueOf(r));
    map.set(k, entry);
  }
  for (const [k, e] of map) map.set(k, Object.fromEntries(Object.entries(e).map(([c, v]) => [c, fromCents(v)])));
  return map;
}

// How many days past due (positive) or still to go (negative or zero) a date is.
export const daysLate = (due, today) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);

export const AGE_BUCKETS = [['Not due yet', (d) => d <= 0], ['1 to 30 days late', (d) => d >= 1 && d <= 30], ['31 to 60 days late', (d) => d >= 31 && d <= 60], ['Over 60 days late', (d) => d > 60]];
