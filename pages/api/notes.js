// pages/api/notes.js
// GET  → επιστρέφει όλες τις σημειώσεις
// POST → αποθηκεύει σημείωση για serial

import { getNotes, saveNote } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const notes = await getNotes();
      return res.status(200).json({ notes });
    } catch (err) {
      console.error('getNotes error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης σημειώσεων' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { serialNumber, note } = req.body;
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });

      const currentUser = getUserFromRequest(req);
      const updatedBy = currentUser ? currentUser.fullName : '';

      await saveNote(serialNumber, note || '', updatedBy);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('saveNote error:', err);
      return res.status(500).json({ error: 'Σφάλμα αποθήκευσης σημείωσης' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
