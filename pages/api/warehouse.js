import { updateStore, updateItemDate, deleteItem, deleteItemCompletely } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  const currentUser = getUserFromRequest(req);
  if (currentUser?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });
  const userName = currentUser ? currentUser.fullName : '';

  if (req.method === 'PATCH') {
    try {
      const { serialNumber, newStore, newDate } = req.body;
      // Treat empty-string as absent — don't silently skip a provided-but-blank value
      const hasStore = newStore != null && newStore !== '';
      const hasDate  = newDate  != null && newDate  !== '';
      if (!serialNumber || (!hasStore && !hasDate)) {
        return res.status(400).json({ error: 'Serial number και πεδίο ενημέρωσης υποχρεωτικά' });
      }
      if (hasStore) await updateStore(serialNumber, newStore);
      if (hasDate)  await updateItemDate(serialNumber, newDate);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('updateWarehouse error:', err);
      return res.status(500).json({ error: 'Σφάλμα ενημέρωσης αποθήκης' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { serialNumber, model, store, category, deleteAll } = req.body;
      if (!serialNumber) {
        return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      }
      if (deleteAll) {
        await deleteItemCompletely(serialNumber);
      } else {
        await deleteItem({ serialNumber, model, store, user: userName, category });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('deleteItem error:', err);
      return res.status(500).json({ error: 'Σφάλμα διαγραφής' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
