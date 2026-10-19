'use client';

import { useEffect, useRef } from 'react';
import { site } from '../../lib/site.mjs';

const STYLE = `
.fs-wa{position:fixed;right:24px;bottom:84px;z-index:290;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#25D366;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.28);transition:transform .2s,box-shadow .2s;text-decoration:none;}
.fs-wa:hover{transform:scale(1.07);box-shadow:0 6px 22px rgba(0,0,0,.34);}
.fs-wa:focus-visible{outline:3px solid #1a1209;outline-offset:3px;}
.fs-wa svg{width:30px;height:30px;display:block;}
@media (max-width:640px){.fs-wa{right:14px;bottom:76px;width:52px;height:52px;}}
@media print{.fs-wa{display:none;}}
`;

// "Chat with us on WhatsApp": a round button on every public page. It opens a chat with the company's WhatsApp Business number,
// with a short opening message already typed (including which page the visitor was on, so we know what they were looking at).
export default function WhatsAppButton() {
  const link = useRef(null);
  const base = `https://wa.me/${site.whatsapp}`;
  const message = (extra) => `Hello ${site.brand}, I would like to plan a journey${extra ? ` (I was looking at: ${extra})` : ''}.`;

  useEffect(() => {
    if (!link.current) return;
    const title = String(document.title || '').replace(/\s*[—|–-]\s*Finders.*$/i, '').trim();
    const onHome = location.pathname === '/' || /homepage/.test(location.pathname);
    link.current.href = `${base}?text=${encodeURIComponent(message(onHome ? '' : title))}`;
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <a ref={link} className="fs-wa" href={`${base}?text=${encodeURIComponent(message(''))}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.02 3C9.38 3 4 8.37 4 15c0 2.12.55 4.18 1.6 6L4 29l8.2-1.56A12 12 0 0 0 16.02 27C22.65 27 28 21.63 28 15S22.65 3 16.02 3zm0 21.9c-1.78 0-3.52-.48-5.04-1.38l-.36-.21-4.87.93.95-4.74-.24-.38A9.9 9.9 0 0 1 6.1 15c0-5.46 4.45-9.9 9.92-9.9 5.46 0 9.9 4.44 9.9 9.9s-4.44 9.9-9.9 9.9zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>
      </a>
    </>
  );
}
