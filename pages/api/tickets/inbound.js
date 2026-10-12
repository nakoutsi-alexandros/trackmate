// pages/api/tickets/inbound.js
// Καλείται ΜΟΝΟ από το Google Apps Script του Gmail.
// Δεν χρησιμοποιεί login cookie — προστατεύεται με κοινό μυστικό
// (header x-trackmate-secret === env TICKETS_INBOUND_SECRET).

import { timingSafeEqual } from 'crypto';
import { processInboundEmail } from '../../../lib/emailTickets';

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

  const { threadId, messageId, from, store, subject, body, images } = req.body || {};
  if (!threadId || !messageId) {
    return res.status(400).json({ error: 'threadId και messageId είναι υποχρεωτικά' });
  }

  try {
    const result = await processInboundEmail({
      threadId: String(threadId),
      messageId: String(messageId),
      from: String(from || ''),
      store: String(store || ''),
      subject: String(subject || ''),
      body: String(body || ''),
      images: Array.isArray(images) ? images : [],
    });

    return res.status(200).json({
      ticketId: result.ticket.ticketId,
      status: result.ticket.status,
      shouldReply: result.shouldReply,
      reply: result.reply || '',
      duplicate: !!result.duplicate,
    });
  } catch (err) {
    console.error('tickets/inbound error:', err?.status || '', err?.error?.error?.message || err?.message || err);
    // 503 → το script αφήνει το email αδιάβαστο και ξαναδοκιμάζει στην επόμενη εκτέλεση
    return res.status(503).json({ error: 'Προσωρινό σφάλμα, θα γίνει νέα προσπάθεια' });
  }
}
