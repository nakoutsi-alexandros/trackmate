// pages/api/warehouse.js
// PATCH → ενημερώνει το κατάστημα ενός μηχανήματος
// DELETE → "διαγράφει" μηχάνημα (προσθέτει κίνηση Διαγράφηκε)

import { updateStore, deleteItem } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  const currentUser = getUserFromRequest(req);
  const userName = currentUser ? currentUser.fullName : '';

  if (req.method === 'PATCH') {
    try {
      const { serialNumber, newStore } = req.body;
      if (!serialNumber || !newStore) {
        return res.status(400).json({ error: 'Serial number και κατάστημα υποχρεωτικά' });
      }
      await updateStore(serialNumber, newStore);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('updateStore error:', err);
      return res.status(500).json({ error: 'Σφάλμα ενημέρωσης καταστήματος' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { serialNumber, model, store } = req.body;
      if (!serialNumber) {
        return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      }
      await deleteItem({ serialNumber, model, store, user: userName });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('deleteItem error:', err);
      return res.status(500).json({ error: 'Σφάλμα διαγραφής' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
