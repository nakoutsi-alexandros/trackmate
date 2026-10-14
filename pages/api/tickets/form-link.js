// pages/api/tickets/form-link.js
// Για συνδεδεμένους χρήστες: δίνει το link της φόρμας αιτήματος για τα καταστήματα.
import { requestFormUrl } from '../../../lib/requestForm';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const store = typeof req.query.store === 'string' ? req.query.store.slice(0, 100) : '';
  return res.status(200).json({ url: requestFormUrl(store) });
}
