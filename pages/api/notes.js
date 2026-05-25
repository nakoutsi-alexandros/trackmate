// pages/api/notes.js
// GET  ?serial=XXX → ιστορικό σημειώσεων για serial
// GET              → όλες οι τελευταίες σημειώσεις (για Αποθήκη)
// POST             → νέα σημείωση (πάντα append)

import { getNotes, saveNote } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const notesMap = await getNotes();
      return res.status(200).json({ notes: notesMap });
    } catch (err) {
      console.error('getNotes error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης σημειώσεων' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { serialNumber, note } = req.body;
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      if (!note || !note.trim()) return res.status(400).json({ error: 'Η σημείωση δεν μπορεί να είναι κενή' });

      const currentUser = getUserFromRequest(req);
      const createdBy = currentUser ? currentUser.fullName : '';

      await saveNote(serialNumber, note.trim(), createdBy);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('saveNote error:', err);
      return res.status(500).json({ error: 'Σφάλμα αποθήκευσης σημείωσης' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
