// lib/requestForm.js
// Δημόσια φόρμα αιτήματος (/request) για τα καταστήματα.
// Η σελίδα ανοίγει μόνο με το σωστό κλειδί στο link (?k=...), ώστε να μην μπορεί
// οποιοσδήποτε να βλέπει τη λίστα καταστημάτων ή να στέλνει αιτήματα.
// Το κλειδί βγαίνει αυτόματα από τα μυστικά που υπάρχουν ήδη στο Vercel —
// δεν χρειάζεται νέα ρύθμιση. Αν αλλάξει το TICKETS_INBOUND_SECRET, αλλάζει και το link.

import { createHmac, timingSafeEqual } from 'crypto';

const BASE_URL = 'https://trackmate-lake.vercel.app';

function baseSecret() {
  return process.env.TICKETS_INBOUND_SECRET || process.env.COOKIE_SECRET || 'dev-only-insecure-secret-change-me';
}

export function requestFormKey() {
  return createHmac('sha256', baseSecret()).update('trackmate-request-form-v1').digest('base64url').slice(0, 16);
}

export function isValidFormKey(k) {
  if (!k) return false;
  const a = Buffer.from(String(k));
  const b = Buffer.from(requestFormKey());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requestFormUrl(store) {
  const url = new URL('/request', BASE_URL);
  url.searchParams.set('k', requestFormKey());
  if (store) url.searchParams.set('s', store);
  return url.toString();
}

// Απλό όριο ανά IP (στη μνήμη του server — αρκεί για να κόψει μαζικά spam)
const hits = new Map();
export function rateLimited(ip, max = 6, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
