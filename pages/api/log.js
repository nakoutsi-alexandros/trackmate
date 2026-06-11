import { appendRow } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { serialNumber, model, action, store, date, problem, notes, category } = req.body;

  if (!serialNumber || !action) {
    return res.status(400).json({ error: 'Serial number και action είναι υποχρεωτικά' });
  }

  const currentUser = getUserFromRequest(req);
  if (currentUser?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα καταχώρισης' });
  const user = currentUser ? currentUser.fullName : '';

  try {
    await appendRow({ serialNumber, model, action, store, date, problem, notes, user, category });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Log error:', err);
    return res.status(500).json({ error: 'Σφάλμα καταγραφής' });
  }
}
