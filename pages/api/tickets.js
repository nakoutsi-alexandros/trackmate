// pages/api/tickets.js
// GET   → λίστα tickets (νεότερα πρώτα)
// PATCH  → αλλαγή κατάστασης / σημειώσεων / στοιχείων { ticketId, ...πεδία }
// DELETE → οριστική διαγραφή { ticketId }

import { getTickets, updateTicketFields, deleteTicket } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';
import { TICKET_STATUSES, REQUIRED_KEYS } from '../../lib/emailTickets';

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

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    const user = getUserFromRequest(req);
    if (!user || user.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });
  }

  if (req.method === 'DELETE') {
    const { ticketId } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'Λείπει το ticketId' });
    try {
      const ok = await deleteTicket(String(ticketId));
      if (!ok) return res.status(404).json({ error: 'Το ticket δεν βρέθηκε' });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('deleteTicket error:', err);
      return res.status(500).json({ error: 'Σφάλμα διαγραφής ticket' });
    }
  }

  if (req.method === 'PATCH') {
    const user = getUserFromRequest(req);
    const { ticketId, ...fields } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'Λείπει το ticketId' });
    if (fields.status !== undefined && !TICKET_STATUSES.includes(fields.status)) {
      return res.status(400).json({ error: 'Μη έγκυρη κατάσταση' });
    }

    // Email πελάτη: κενό ή έγκυρη διεύθυνση
    if (typeof fields.from === 'string') {
      fields.from = fields.from.trim().toLowerCase();
      if (fields.from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.from)) {
        return res.status(400).json({ error: 'Μη έγκυρο email' });
      }
    }
    // Νέο log link: κανονικοποίηση σε https://
    if (fields.addLogLink) {
      let url = String(fields.addLogLink.url || fields.addLogLink || '').trim();
      if (!url) return res.status(400).json({ error: 'Λείπει το link' });
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      fields.addLogLink = { url };
    }

    try {
      const updated = await updateTicketFields(ticketId, fields, user.fullName || user.username || '', REQUIRED_KEYS);
      if (!updated) return res.status(404).json({ error: 'Το ticket δεν βρέθηκε' });
      return res.status(200).json({ ticket: updated });
    } catch (err) {
      console.error('updateTicket error:', err);
      return res.status(500).json({ error: 'Σφάλμα ενημέρωσης ticket' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
