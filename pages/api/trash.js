// pages/api/trash.js
// GET                       → λίστα διαγραμμένων (κάδος)
// POST   { batchId }        → επαναφορά μηχανήματος από τον κάδο
// DELETE { batchId }        → οριστική διαγραφή από τον κάδο

import { getTrash, restoreFromTrash, purgeTrashItem } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const items = await getTrash();
      return res.status(200).json({ items });
    } catch (err) {
      console.error('getTrash error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης κάδου' });
    }
  }

  // Restore και purge είναι write ops — όχι για viewers
  const currentUser = getUserFromRequest(req);
  if (currentUser?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });

  if (req.method === 'POST') {
    try {
      const { batchId } = req.body;
      if (!batchId) return res.status(400).json({ error: 'batchId υποχρεωτικό' });
      await restoreFromTrash(batchId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('restoreFromTrash error:', err);
      return res.status(500).json({ error: 'Σφάλμα επαναφοράς' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { batchId } = req.body;
      if (!batchId) return res.status(400).json({ error: 'batchId υποχρεωτικό' });
      await purgeTrashItem(batchId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('purgeTrashItem error:', err);
      return res.status(500).json({ error: 'Σφάλμα οριστικής διαγραφής' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
