'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// The dashboard's menu: a button in the top bar that opens a panel listing every section, grouped.
// `groups` is [{ title, links: [{ href, label, key }] }]; `current` is the key of the page being viewed.
export default function NavMenu({ groups, current }) {
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  const panel = useRef(null);
  const label = groups.flatMap((g) => g.links).find((l) => l.key === current);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); if (button.current) button.current.focus(); }
      if (e.key === 'Tab' && panel.current) { // keep keyboard focus inside the open menu
        const items = panel.current.querySelectorAll('a, button');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('ad-lock');
    const active = panel.current && panel.current.querySelector('[aria-current="page"]');
    window.setTimeout(() => { (active || (panel.current && panel.current.querySelector('a'))).focus(); }, 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('ad-lock'); };
  }, [open]);

  return (
    <>
      <button ref={button} type="button" className="ad-menubtn" aria-expanded={open} aria-controls="ad-menu" onClick={() => setOpen((o) => !o)}>
        <span className="ad-burger" aria-hidden="true"><i /><i /><i /></span>
        <span>Menu</span>
      </button>
      {label ? <span className="ad-here" aria-hidden="true">{label.label}</span> : null}

      <div className={`ad-menu${open ? ' open' : ''}`} id="ad-menu" aria-hidden={!open}>
        <div className="ad-menu-veil" onClick={() => setOpen(false)} />
        <nav className="ad-menu-panel" aria-label="Admin sections" ref={panel} inert={open ? undefined : true}>
          <div className="ad-menu-head">
            <strong>Menu</strong>
            <button type="button" className="ad-menu-close" aria-label="Close menu" onClick={() => { setOpen(false); if (button.current) button.current.focus(); }}>&times;</button>
          </div>
          {groups.map((g) => (
            <div className="ad-menu-group" key={g.title}>
              <p>{g.title}</p>
              <ul>
                {g.links.map((l) => (
                  <li key={l.key}>
                    <Link href={l.href} aria-current={current === l.key ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
