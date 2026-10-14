// pages/api/tickets/request.js
// Δημόσιο API της φόρμας αιτήματος (/request) — χωρίς login,
// αλλά μόνο με το σωστό κλειδί του link (k).
//   GET  ?k=...  → λίστα καταστημάτων (όνομα + διεύθυνση) για αυτόματη συμπλήρωση
//   POST { k, fields..., website, t } → δημιουργία ticket

import { getStoreDetails } from '../../../lib/sheets';
import { createWebTicket } from '../../../lib/emailTickets';
import { isValidFormKey, rateLimited } from '../../../lib/requestForm';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const FIELD_KEYS = ['store', 'address', 'postalCode', 'contactName', 'contactPhone', 'problem', 'serialNumber', 'ip', 'courier', 'storeRemarks', 'email'];

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (!isValidFormKey(req.query.k)) return res.status(403).json({ error: 'invalid_link' });
    try {
      const stores = (await getStoreDetails()).map(s => ({ name: s.name, address: s.address || '' }));
      return res.status(200).json({ stores });
    } catch (e) {
      console.error('tickets/request GET', e?.message || e);
      return res.status(200).json({ stores: [] }); // η φόρμα δουλεύει και χωρίς λίστα
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  if (!isValidFormKey(body.k)) return res.status(403).json({ error: 'invalid_link' });

  // Honeypot: κρυφό πεδίο που συμπληρώνουν μόνο τα bots
  if (body.website) return res.status(200).json({ ok: true, ticketId: '' });
  // Πολύ γρήγορη υποβολή (< 3″ από το άνοιγμα της σελίδας) → bot
  const openedAt = Number(body.t) || 0;
  if (openedAt && Date.now() - openedAt < 3000) return res.status(429).json({ error: 'Πολύ γρήγορα — δοκιμάστε ξανά σε λίγα δευτερόλεπτα.' });
  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Πολλά αιτήματα σε λίγο χρόνο. Δοκιμάστε ξανά σε λίγα λεπτά.' });
  }

  const input = {};
  for (const k of FIELD_KEYS) input[k] = typeof body[k] === 'string' ? body[k] : '';

  try {
    const result = await createWebTicket(input);
    if (result.errors) return res.status(400).json({ errors: result.errors });
    return res.status(200).json({ ok: true, ticketId: result.ticket.ticketId });
  } catch (e) {
    console.error('tickets/request POST', e?.status || '', e?.message || e);
    return res.status(503).json({ error: 'Προσωρινό πρόβλημα αποθήκευσης. Δοκιμάστε ξανά σε λίγο.' });
  }
}
