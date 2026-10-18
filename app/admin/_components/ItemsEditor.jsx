'use client';

import { useState } from 'react';
import { fmtMoney, itemsTotal, lineCents, fromCents } from '../../../lib/admin/money';

// Editable lines for a quotation or invoice. The lines travel to the server as one hidden field ("items").
export default function ItemsEditor({ initial = [], currency = 'USD', readOnly = false }) {
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ description: '', quantity: '1', unit_price: '' }]).map((r) => ({
    description: r.description || '', quantity: String(r.quantity ?? '1'), unit_price: r.unit_price === 0 || r.unit_price ? String(r.unit_price) : '',
  })));
  const set = (i, key, v) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
  const num = (s) => Number(String(s).replace(/[,\s]/g, '')) || 0;
  const live = rows.map((r) => ({ quantity: num(r.quantity), unit_price: num(r.unit_price) }));
  return (
    <div className="ad-items">
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      <div className="ad-itemhead"><span>Description</span><span>Qty</span><span>Unit price ({currency})</span><span>Amount</span><span /></div>
      {rows.map((r, i) => (
        <div className="ad-itemrow" key={i}>
          <input aria-label={`Line ${i + 1} description`} value={r.description} onChange={(e) => set(i, 'description', e.target.value)} maxLength={500} placeholder="e.g. 7-night Masai Mara safari, per person" disabled={readOnly} />
          <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={r.quantity} onChange={(e) => set(i, 'quantity', e.target.value)} disabled={readOnly} />
          <input aria-label={`Line ${i + 1} unit price`} inputMode="decimal" value={r.unit_price} onChange={(e) => set(i, 'unit_price', e.target.value)} placeholder="0.00" disabled={readOnly} />
          <span className="ad-itemsum">{fmtMoney(fromCents(lineCents(live[i])), currency)}</span>
          {!readOnly ? <button type="button" className="ad-x" aria-label={`Remove line ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, n) => n !== i) : [{ description: '', quantity: '1', unit_price: '' }]))}>&times;</button> : <span />}
        </div>
      ))}
      <div className="ad-itemfoot">
        {!readOnly ? <button type="button" className="ad-btn ghost" onClick={() => setRows((rs) => [...rs, { description: '', quantity: '1', unit_price: '' }])} disabled={rows.length >= 60}>+ Add a line</button> : <span />}
        <strong>Total: {fmtMoney(itemsTotal(live), currency)}</strong>
      </div>
      <p className="ad-sub" style={{ margin: '8px 0 0' }}>Use a minus sign in the price for a discount. Prices are in the currency chosen above.</p>
    </div>
  );
}
