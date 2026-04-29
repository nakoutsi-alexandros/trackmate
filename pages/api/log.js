import { appendRow } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { serialNumber, model, action, store, date, problem, notes } = req.body;

  if (!serialNumber || !action) {
    return res.status(400).json({ error: 'Serial number και action είναι υποχρεωτικά' });
  }

  // Παίρνουμε τον συνδεδεμένο χρήστη από το cookie
  const currentUser = getUserFromRequest(req);
  const user = currentUser ? currentUser.fullName : '';

  try {
    await appendRow({ serialNumber, model, action, store, date, problem, notes, user });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Log error:', err);
    return res.status(500).json({ error: 'Σφάλμα καταγραφής', details: err.message });
  }
}
