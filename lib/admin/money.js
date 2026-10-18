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
  const text = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}${SYMBOL[currency] || currency + ' '}${text}`;
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

// ---- quotations, invoices, documents ----
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
export const QUOTE_STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };
// A "sent" quote past its valid-until date is shown as expired.
export const quoteDisplay = (q, today) => (q.status === 'sent' && q.valid_until && q.valid_until < today ? 'expired' : q.status);

export const INVOICE_DISPLAY_LABELS = { draft: 'Draft', sent: 'Awaiting payment', paid: 'Paid', overdue: 'Overdue', void: 'Void' };
// Draft / void come from the record; paid and overdue are worked out from the payments matched to the invoice.
export function invoiceDisplay(inv, today) {
  if (inv.status === 'void' || inv.status === 'draft') return inv.status;
  if (Number(inv.total) > 0 && toCents(inv.outstanding) <= 0) return 'paid';
  if (inv.due_date && inv.due_date < today) return 'overdue';
  return 'sent';
}

export const DOC_CATEGORIES = ['passport', 'visa', 'itinerary', 'voucher', 'insurance', 'contract', 'other'];
export const DOC_CATEGORY_LABELS = { passport: 'Passport / ID', visa: 'Visa', itinerary: 'Itinerary', voucher: 'Voucher / ticket', insurance: 'Insurance', contract: 'Contract', other: 'Other' };
export const DOC_MAX_BYTES = 10 * 1024 * 1024;

// One line = quantity x unit price, rounded to whole cents (the database view rounds the same way).
export const lineCents = (it) => Math.round(Number(it.quantity || 0) * toCents(it.unit_price));
export const itemsTotal = (items) => fromCents(items.reduce((t, it) => t + lineCents(it), 0));

export const DEFAULT_QUOTE_TERMS = 'Prices are per the currency shown and valid until the date above. A deposit secures the booking and the balance is due 60 days before departure. Cancellation terms are set out on our website.';
export const DEFAULT_INVOICE_TERMS = 'Please quote the invoice number as the payment reference. Payments by bank transfer or M-Pesa are confirmed once the money has reached our account.';

// The business details kept in Settings (legal name, bank details for invoices, ...)
export const SETTING_KEYS = ['legal_name', 'trading_name', 'email', 'phone', 'address', 'bank_name', 'bank_branch', 'swift_code', 'account_name', 'account_type', 'account_number', 'kra_pin', 'vat_registered'];
