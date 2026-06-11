// pages/api/movement.js
// DELETE { serialNumber, timestamp, action } → διαγραφή μίας κίνησης → Κάδος

import { deleteMovement } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  const currentUser = getUserFromRequest(req);
  if (currentUser?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });

  if (req.method === 'DELETE') {
    try {
      const { serialNumber, timestamp, action } = req.body;
      if (!serialNumber || !timestamp) {
        return res.status(400).json({ error: 'serialNumber και timestamp υποχρεωτικά' });
      }
      const result = await deleteMovement({
        serialNumber,
        timestamp,
        action,
        user: currentUser ? currentUser.fullName : '',
      });
      if (!result.deleted) return res.status(404).json({ error: 'Η κίνηση δεν βρέθηκε' });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('deleteMovement error:', err);
      return res.status(500).json({ error: 'Σφάλμα διαγραφής κίνησης' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
