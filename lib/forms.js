// Turns a submitted website form into a database row and saves it to Supabase.
// The pages' own scripts keep handling the on-screen result (thank-you message, WhatsApp / email buttons);
// this only adds the save, so a visitor never has to wait on it.
import { getTurnstileToken } from './turnstile';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_KEY = 'fs-pending-submissions';
const recent = new Map();

const text = (v, max = 5000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const count = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : null;
};
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);
const emailOrNull = (v) => {
  const s = text(v, 254);
  return s && EMAIL.test(s) ? s : null;
};
const value = (form, name) => (form.elements[name] ? form.elements[name].value : '');

// Same rule the pages apply before they show "thank you": every required field filled in, emails well formed.
function isValid(form) {
  for (const el of form.querySelectorAll('[required]')) {
    if (!String(el.value || '').trim()) return false;
  }
  for (const el of form.querySelectorAll('input[type="email"]')) {
    if (el.required && !EMAIL.test(String(el.value || '').trim())) return false;
  }
  return true;
}

const SERVICES = {
  pjForm: 'private-jets',
  loForm: 'layover-safari',
  flightForm: 'flight-arrangements',
  ctForm: 'city-tour',
  ftForm: 'airport-fast-track',
};

// Private jets, layover safaris, flights, city tours, fast track: shared columns, everything else goes in "details".
function serviceRow(form, service) {
  const top = new Set(['name', 'email', 'phone', 'travellers']);
  const details = {};
  for (const [key, raw] of new FormData(form).entries()) {
    const v = text(raw, 2000);
    if (!v || top.has(key) || key.startsWith('fs_')) continue;
    if (key in details) details[key] = [].concat(details[key], v);
    else details[key] = v;
  }
  return {
    table: 'service_requests',
    row: {
      service,
      name: text(value(form, 'name'), 200),
      email: text(value(form, 'email'), 254),
      phone: text(value(form, 'phone'), 60),
      travellers: count(value(form, 'travellers')),
      details,
    },
  };
}

function enquiryRow(form) {
  const note = document.getElementById('enqPackageNote');
  const pkg = note && !note.hidden ? text(note.textContent.replace(/^Enquiring about:\s*/i, ''), 300) : null;
  return {
    table: 'enquiries',
    row: {
      name: text(value(form, 'name'), 200),
      phone: text(value(form, 'phone'), 60),
      email: emailOrNull(value(form, 'email')),
      travellers: count(value(form, 'travellers')),
      preferred_date: day(value(form, 'dates')),
      interest: text(value(form, 'interest'), 200),
      package: pkg,
      notes: text(value(form, 'notes')),
    },
  };
}

const field = (id) => {
  const el = document.getElementById(id);
  return el ? el.value : '';
};

// Returns { table, row } for a recognised, valid form, otherwise null.
export function buildSubmission(form) {
  const id = form.id;
  let sub = null;
  if (id === 'enqForm') sub = enquiryRow(form);
  else if (SERVICES[id]) sub = serviceRow(form, SERVICES[id]);
  else if (id === 'footSubForm') sub = { table: 'newsletter_subscribers', row: { email: text(field('footEmail'), 254), first_name: text(field('footFirstName'), 100), last_name: text(field('footLastName'), 100), source: 'footer' } };
  else if (id === 'subForm') sub = { table: 'newsletter_subscribers', row: { email: text(field('sub-email'), 254), source: 'popup' } };
  else if (id === 'journalForm') sub = { table: 'newsletter_subscribers', row: { email: text(field('journalEmail'), 254), source: 'journal' } };
  if (!sub || !isValid(form)) return null;
  // the hidden trap field (see armForms) is only ever filled in by bots
  if (form.elements.fs_website && String(form.elements.fs_website.value || '').trim()) return null;
  sub.row.source_page = text(location.pathname, 300);
  sub.age = Math.round(performance.now()); // ms since the page opened; bots submit almost instantly
  return sub;
}

// First choice: the site's own server route (/api/submit), which saves the row AND emails the business.
// Returns 'done', 'refused' (the data is invalid for good) or 'unavailable' (static hosting, offline, rate limit,
// CAPTCHA/bot check not passed, error). In the 'unavailable' case the row is still saved straight to Supabase, just not emailed.
async function viaServer(item) {
  const ts = await getTurnstileToken(); // null when the CAPTCHA is not configured
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: item.table, row: item.row, age: item.age, ts }),
    });
    if (res.ok) return 'done';
    if (res.status === 400) return 'refused';
  } catch {}
  return 'unavailable';
}

// Duplicate subscribers (23505) count as done. Other 22/23/42 errors mean the database refused the data for good,
// so retrying would never help. Anything else (offline, server hiccup) is kept and retried later.
async function send(supabase, item) {
  const server = await viaServer(item);
  if (server === 'done' || server === 'refused') return true;
  // No server route (e.g. the static export): save straight to Supabase instead.
  const { error } = await supabase.from(item.table).insert(item.row);
  if (!error || error.code === '23505') return true;
  if (/^(22|23|42)/.test(error.code || '')) {
    console.warn('Submission refused by the database:', error.message);
    return true;
  }
  return false;
}

const readPending = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
};
const writePending = (list) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)));
  } catch {}
};

export async function saveSubmission(supabase, item) {
  // the same form fired twice within a few seconds (double click) is saved once
  const sig = JSON.stringify({ t: item.table, r: item.row });
  if (recent.has(sig) && Date.now() - recent.get(sig) < 20000) return;
  recent.set(sig, Date.now());
  let ok = false;
  try {
    ok = await send(supabase, item);
  } catch {}
  if (!ok) writePending([...readPending(), item]);
}

export async function flushPending(supabase) {
  const list = readPending();
  if (!list.length) return;
  writePending([]);
  const stillFailing = [];
  for (const item of list) {
    let ok = false;
    try {
      ok = await send(supabase, item);
    } catch {}
    if (!ok) stillFailing.push(item);
  }
  if (stillFailing.length) writePending([...stillFailing, ...readPending()]);
}

// Adds an invisible trap field to every known form. People never see or fill it; many spam bots fill every field they find.
const FORM_IDS = ['enqForm', ...Object.keys(SERVICES), 'footSubForm', 'subForm', 'journalForm'];
export function armForms() {
  for (const id of FORM_IDS) {
    const form = document.getElementById(id);
    if (!form || form.elements.fs_website) continue;
    const trap = document.createElement('input');
    trap.type = 'text';
    trap.name = 'fs_website';
    trap.tabIndex = -1;
    trap.autocomplete = 'off';
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;opacity:0;';
    form.appendChild(trap);
  }
}
