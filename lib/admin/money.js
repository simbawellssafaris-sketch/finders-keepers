// Money, bookings and payments: shared labels, formatting and safe arithmetic.

export const CURRENCIES = ['USD', 'KES'];
const SYMBOL = { USD: '$', KES: 'KSh ' };

export const BOOKING_STATUSES = ['provisional', 'confirmed', 'completed', 'cancelled'];
export const BOOKING_STATUS_LABELS = { provisional: 'Provisional', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };
export const ACTIVE_BOOKING_STATUSES = ['provisional', 'confirmed']; // trips still to be paid for / travelled

export const PAYMENT_METHODS = ['mpesa', 'bank_transfer', 'card', 'cash', 'other'];
export const PAYMENT_METHOD_LABELS = { mpesa: 'M-Pesa', bank_transfer: 'Bank transfer', card: 'Card', cash: 'Cash', other: 'Other' };
export const PAYMENT_KINDS = ['deposit', 'instalment', 'balance', 'refund'];
export const PAYMENT_KIND_LABELS = { deposit: 'Deposit', instalment: 'Instalment', balance: 'Balance', refund: 'Refund' };
export const PAYMENT_STATUS_LABELS = { pending: 'Waiting for confirmation', confirmed: 'Confirmed', failed: 'Failed / cancelled' };

// Amounts are kept as whole cents while adding, so 0.1 + 0.2 never goes wrong.
export const toCents = (n) => Math.round(Number(n || 0) * 100);
export const fromCents = (c) => c / 100;
export const sumCents = (list) => list.reduce((t, n) => t + toCents(n), 0);

export function fmtMoney(amount, currency = 'USD') {
  const n = Number(amount || 0);
  const text = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOL[currency] || currency + ' '}${text}`;
}

// Text typed into an amount box -> a number with at most 2 decimals, or null when it is not a valid positive amount.
export function parseMoney(text, { allowZero = false } = {}) {
  const s = String(text ?? '').replace(/[,\s]/g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 || (allowZero && n === 0) ? n : null;
}

// YYYY-MM-DD plus / minus days, without time-zone surprises
export function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// Sum a list of rows per currency: [{ currency, value }] -> { USD: 1234.5, KES: 0 }. Currencies are never mixed.
export function totalsByCurrency(rows, pick) {
  const cents = {};
  for (const r of rows) cents[r.currency] = (cents[r.currency] || 0) + toCents(pick(r));
  return Object.fromEntries(Object.entries(cents).map(([c, v]) => [c, fromCents(v)]));
}
export const fmtTotals = (totals) => {
  const parts = Object.entries(totals).filter(([, v]) => v !== 0).map(([c, v]) => fmtMoney(v, c));
  return parts.length ? parts.join(' + ') : fmtMoney(0, 'USD');
};

// The business details kept in Settings (legal name, bank details for invoices, ...)
export const SETTING_KEYS = ['legal_name', 'trading_name', 'email', 'phone', 'address', 'bank_name', 'bank_branch', 'swift_code', 'account_name', 'account_type', 'account_number', 'kra_pin', 'vat_registered'];
