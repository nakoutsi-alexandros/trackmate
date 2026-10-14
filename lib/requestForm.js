// lib/requestForm.js
// Δημόσια φόρμα αιτήματος (/support) για τους πελάτες.
// Το link βγαίνει από FORM_PUBLIC_URL (αν οριστεί στο Vercel, π.χ. όταν μπει δικό σας domain),
// αλλιώς από τη διεύθυνση από την οποία ανοίχτηκε το TrackMate.

const FALLBACK_BASE = 'https://trackmate-lake.vercel.app';

export function requestFormUrl(store, req) {
  let url;
  if (process.env.FORM_PUBLIC_URL) {
    url = new URL(process.env.FORM_PUBLIC_URL);
  } else {
    const host = req && (req.headers['x-forwarded-host'] || req.headers.host);
    const proto = (req && req.headers['x-forwarded-proto']) || 'https';
    url = new URL('/support', host && !/^localhost|^127\./.test(host) ? `${proto}://${host}` : FALLBACK_BASE);
  }
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
