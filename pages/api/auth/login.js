// pages/api/auth/login.js
// Έλεγχος credentials και δημιουργία session cookie

import { getUsers } from '../../../lib/sheets';
import { setAuthCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Συμπληρώστε username και password' });
    }

    // Dev bypass — only in development, no Google Sheets needed
    if (process.env.NODE_ENV === 'development' && username === 'dev' && password === 'dev') {
      setAuthCookie(res, 'dev', 'Dev User');
      return res.status(200).json({ success: true, user: { username: 'dev', fullName: 'Dev User' } });
    }

    // Φέρνουμε όλους τους users από το Sheet
    const users = await getUsers();

    // Βρίσκουμε τον χρήστη (case-insensitive username)
    const user = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase().trim()
    );

    if (!user) {
      return res.status(401).json({ error: 'Λάθος username ή password' });
    }

    // Έλεγχος αν είναι ενεργός
    const activeStr = (user.active || '').toString().toLowerCase().trim();
    const isActive = activeStr === 'true' || activeStr === 'yes' || activeStr === '1' || activeStr === 'ναι';
    if (!isActive) {
      return res.status(403).json({ error: 'Ο λογαριασμός είναι ανενεργός' });
    }

    // Έλεγχος password (plain text comparison)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Λάθος username ή password' });
    }

    // Επιτυχία - φτιάχνουμε cookie
    setAuthCookie(res, user.username, user.fullName || user.username);

    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        fullName: user.fullName || user.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Σφάλμα διακομιστή' });
  }
}
