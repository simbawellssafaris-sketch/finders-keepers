'use client';

export default function PrintButton() {
  return <button type="button" className="ad-btn" onClick={() => window.print()}>Print or save as PDF</button>;
}
