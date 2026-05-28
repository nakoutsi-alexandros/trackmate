import { updateStore, updateItemDate, deleteItem } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  const currentUser = getUserFromRequest(req);
  const userName = currentUser ? currentUser.fullName : '';

  if (req.method === 'PATCH') {
    try {
      const { serialNumber, newStore, newDate } = req.body;
      if (!serialNumber || (!newStore && !newDate)) {
        return res.status(400).json({ error: 'Serial number και πεδίο ενημέρωσης υποχρεωτικά' });
      }
      if (newStore) await updateStore(serialNumber, newStore);
      if (newDate) await updateItemDate(serialNumber, newDate);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('updateWarehouse error:', err);
      return res.status(500).json({ error: 'Σφάλμα ενημέρωσης αποθήκης' });
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
