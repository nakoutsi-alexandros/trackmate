// pages/api/tickets/inbound.js
// Καλείται ΜΟΝΟ από το Google Apps Script του Gmail.
// Δεν χρησιμοποιεί login cookie — προστατεύεται με κοινό μυστικό
// (header x-trackmate-secret === env TICKETS_INBOUND_SECRET).

import { timingSafeEqual } from 'crypto';
import { processInboundEmail, sampleNotification, probeEmailForm, buildWebTicketNotification } from '../../../lib/emailTickets';
import { getTickets } from '../../../lib/sheets';
import { requestFormUrl } from '../../../lib/requestForm';

// Το Vercel δέχεται έως ~4.5MB ανά request· το script στέλνει μικρές εικόνες μόνο
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

function secretMatches(given) {
  const expected = process.env.TICKETS_INBOUND_SECRET || '';
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!secretMatches(req.headers['x-trackmate-secret'])) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Δοκιμή μορφής ειδοποίησης από το script (δεν δημιουργεί ticket)
  if (req.body && req.body.sample) {
    return res.status(200).json({ notify: sampleNotification() });
  }

  // Νέα tickets από τη φόρμα web μετά από μια χρονική στιγμή → ειδοποιήσεις για το script
  if (req.body && req.body.webSince !== undefined) {
    try {
      const since = Date.parse(req.body.webSince) || 0;
      const list = (await getTickets())
        .filter(t => String(t.threadId).startsWith('web-') && (Date.parse(t.createdAt) || 0) > since)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .slice(0, 20);
      return res.status(200).json({
        now: new Date().toISOString(),
        tickets: list.map(t => ({ ticketId: t.ticketId, createdAt: t.createdAt, notify: buildWebTicketNotification(t) })),
      });
    } catch (err) {
      console.error('tickets/inbound webSince error:', err?.message || err);
      return res.status(503).json({ error: 'Προσωρινό σφάλμα' });
    }
  }

  // Αποστολέας εκτός λίστας: μόνο έλεγχος αν έστειλε φόρμα (δεν δημιουργείται ticket)
  if (req.body && req.body.probe) {
    return res.status(200).json({ isForm: probeEmailForm(String(req.body.body || '')), formUrl: requestFormUrl('', req) });
  }

  const { threadId, messageId, from, fromName, store, chain, subject, body, images } = req.body || {};
  if (!threadId || !messageId) {
    return res.status(400).json({ error: 'threadId και messageId είναι υποχρεωτικά' });
  }

  try {
    const result = await processInboundEmail({
      threadId: String(threadId),
      messageId: String(messageId),
      from: String(from || ''),
      fromName: String(fromName || ''),
      store: String(store || ''),
      chain: String(chain || ''),
      subject: String(subject || ''),
      body: String(body || ''),
      images: Array.isArray(images) ? images : [],
    });

    if (result.skipped) {
      return res.status(200).json({ skipped: true, reason: result.reason });
    }

    return res.status(200).json({
      ticketId: result.ticket.ticketId,
      status: result.ticket.status,
      missing: result.ticket.missing || '',
      // Στο κατάστημα δεν απαντάμε ποτέ· μόνο ειδοποίηση σε εμάς όταν λείπει κάτι
      notify: result.notify || null,
      duplicate: !!result.duplicate,
    });
  } catch (err) {
    console.error('tickets/inbound error:', err?.status || '', err?.error?.error?.message || err?.message || err);
    // 503 → το script αφήνει το email αδιάβαστο και ξαναδοκιμάζει στην επόμενη εκτέλεση
    return res.status(503).json({ error: 'Προσωρινό σφάλμα, θα γίνει νέα προσπάθεια' });
  }
}
