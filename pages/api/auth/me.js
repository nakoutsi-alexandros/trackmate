// pages/api/auth/me.js
// Επιστρέφει τον τρέχοντα χρήστη από το cookie

import { getUserFromRequest, setAuthCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Ανανεώνει τη σύνδεση για άλλες 7 μέρες όσο η εφαρμογή χρησιμοποιείται
  // (π.χ. οθόνη/τηλεόραση που μένει ανοιχτή — δεν πέφτει ποτέ στο login)
  setAuthCookie(res, user.username, user.fullName, user.role || 'admin');
  return res.status(200).json({ user });
}
