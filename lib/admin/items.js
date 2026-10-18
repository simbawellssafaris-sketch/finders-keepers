// Reads the invoice / quotation lines posted from the editor and checks them. Used by server actions only.
import { toCents, fromCents, lineCents } from './money';

const QTY = /^\d{1,8}(\.\d{1,2})?$/;
const PRICE = /^-?\d{1,10}(\.\d{1,2})?$/;

// Returns { items, total } or { error }. Negative unit prices are allowed (discounts); the total must not be negative.
export function readItems(raw, { requireTotal = false } = {}) {
  let list;
  try { list = JSON.parse(String(raw || '[]')); } catch { return { error: 'The lines could not be read. Please reload the page and try again.' }; }
  if (!Array.isArray(list) || list.length > 60) return { error: 'Please keep to 60 lines or fewer.' };
  const items = [];
  for (const [i, r] of list.entries()) {
    const description = String((r && r.description) ?? '').trim().slice(0, 500);
    const qty = String((r && r.quantity) ?? '').replace(/[,\s]/g, '');
    const price = String((r && r.unit_price) ?? '').replace(/[,\s]/g, '');
    if (!description && !qty && !price) continue; // ignore blank rows
    if (!description) return { error: `Line ${i + 1}: please describe what it is for.` };
    if (!QTY.test(qty) || Number(qty) <= 0) return { error: `Line ${i + 1}: the quantity must be a number above zero.` };
    if (!PRICE.test(price)) return { error: `Line ${i + 1}: the price must be a number such as 1500 or 1250.50 (use a minus sign for a discount).` };
    items.push({ description, quantity: Number(qty), unit_price: Number(price), position: items.length });
  }
  const total = fromCents(items.reduce((t, it) => t + lineCents(it), 0));
  if (toCents(total) < 0) return { error: 'The total cannot be below zero.' };
  if (requireTotal && (!items.length || toCents(total) <= 0)) return { error: 'Add at least one line with an amount above zero.' };
  return { items, total };
}

// Swap a document's lines for new ones without ever leaving it empty: add the new lines first, then remove the old ones.
export async function replaceItems(supabase, table, fk, parentId, items) {
  const { data: old, error: e0 } = await supabase.from(table).select('id').eq(fk, parentId);
  if (e0) return false;
  let added = [];
  if (items.length) {
    const { data, error } = await supabase.from(table).insert(items.map((it) => ({ ...it, [fk]: parentId }))).select('id');
    if (error) return false;
    added = data || [];
  }
  const oldIds = (old || []).map((r) => r.id);
  if (oldIds.length) {
    const { error } = await supabase.from(table).delete().in('id', oldIds);
    if (error) {
      if (added.length) await supabase.from(table).delete().in('id', added.map((r) => r.id)); // put things back as they were
      return false;
    }
  }
  return true;
}
