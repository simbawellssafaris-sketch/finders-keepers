import { companyLine, bankLines } from '../../../lib/admin/business';
import { fmtMoney, lineCents, fromCents } from '../../../lib/admin/money';
import PrintButton from './PrintButton';

// The printable page for a quotation, invoice or receipt (print it, or "Save as PDF" in the browser's print window).
export default function DocSheet({ business: s, kind, reference, stamp, meta = [], billLabel = 'Billed to', billTo, title, items, currency, total, paid, intro, terms, bank = false, rows, footnote }) {
  const bankRows = bank ? bankLines(s) : [];
  return (
    <div className="ad-print">
      <div className="ad-noprint" style={{ marginBottom: 20 }}><PrintButton /></div>
      <header className="ad-dochead">
        <div>
          <h1>{s.legal_name || 'Finders Keepers Safaris Limited'}</h1>
          <p>{companyLine(s)}</p>
        </div>
        <div className="ad-docid">
          <strong>{kind}</strong>
          <span>{reference}</span>
          {stamp ? <em className="ad-stamp">{stamp}</em> : null}
        </div>
      </header>

      <div className="ad-docmeta">
        <div>
          <small>{billLabel}</small>
          <strong>{billTo.name}</strong>
          {billTo.email ? <span>{billTo.email}</span> : null}
          {billTo.phone ? <span>{billTo.phone}</span> : null}
        </div>
        {meta.map(([k, v]) => (v ? <div key={k}><small>{k}</small><strong>{v}</strong></div> : null))}
      </div>

      <h2>{title}</h2>
      {intro ? <p style={{ whiteSpace: 'pre-wrap' }}>{intro}</p> : null}

      {items ? (
        <table className="ad-ptable ad-lines">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td><td>{Number(it.quantity)}</td><td>{fmtMoney(it.unit_price, currency)}</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(fromCents(lineCents(it)), currency)}</td>
              </tr>
            ))}
            <tr className="ad-total"><td colSpan={3} style={{ textAlign: 'right' }}>Total</td><td style={{ textAlign: 'right' }}>{fmtMoney(total, currency)}</td></tr>
            {paid !== undefined && paid !== null ? (
              <>
                <tr><td colSpan={3} style={{ textAlign: 'right' }}>Paid</td><td style={{ textAlign: 'right' }}>{fmtMoney(paid, currency)}</td></tr>
                <tr className="ad-total"><td colSpan={3} style={{ textAlign: 'right' }}>Balance due</td><td style={{ textAlign: 'right' }}>{fmtMoney(Number(total) - Number(paid), currency)}</td></tr>
              </>
            ) : null}
          </tbody>
        </table>
      ) : null}

      {rows ? <table className="ad-ptable"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table> : null}

      {bankRows.length ? (
        <>
          <h3>How to pay</h3>
          <table className="ad-ptable"><tbody>{bankRows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
        </>
      ) : null}
      {terms ? <p className="ad-terms">{terms}</p> : null}
      {footnote ? <p className="ad-terms">{footnote}</p> : null}
    </div>
  );
}
