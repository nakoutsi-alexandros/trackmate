// pages/api/tickets.js
// GET   → λίστα tickets (νεότερα πρώτα)
// PATCH → αλλαγή status / σημειώσεων { ticketId, status?, notes? }

import { getTickets, updateTicketFields } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';
import { TICKET_STATUSES } from '../../lib/emailTickets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const tickets = await getTickets();
      tickets.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ tickets });
    } catch (err) {
      console.error('getTickets error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης tickets' });
    }
  }

  if (req.method === 'PATCH') {
    const user = getUserFromRequest(req);
    if (!user || user.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });

    const { ticketId, status, notes } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'Λείπει το ticketId' });
    if (status !== undefined && !TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Μη έγκυρη κατάσταση' });
    }

    try {
      const updated = await updateTicketFields(ticketId, { status, notes }, user.fullName || user.username || '');
      if (!updated) return res.status(404).json({ error: 'Το ticket δεν βρέθηκε' });
      return res.status(200).json({ ticket: updated });
    } catch (err) {
      console.error('updateTicket error:', err);
      return res.status(500).json({ error: 'Σφάλμα ενημέρωσης ticket' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
