// pages/api/access.js
// GET          → map πρόσβασης IP ανά serial { serial: { ipAccess, ipNote, updatedAt, updatedBy } }
// POST { serialNumber, ipAccess, ipNote } → ορισμός (admin only)

import { getMachineAccess, setMachineAccess, IP_ACCESS_VALUES } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const access = await getMachineAccess();
      return res.status(200).json({ access });
    } catch (err) {
      console.error('getMachineAccess error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης πρόσβασης' });
    }
  }

  if (req.method === 'POST') {
    const currentUser = getUserFromRequest(req);
    if (!currentUser || currentUser.role === 'viewer') {
      return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });
    }
    try {
      const { serialNumber, ipAccess = '', ipNote = '' } = req.body || {};
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      if (ipAccess && !IP_ACCESS_VALUES.includes(ipAccess)) {
        return res.status(400).json({ error: 'Μη έγκυρη κατάσταση πρόσβασης' });
      }
      const saved = await setMachineAccess({
        serialNumber,
        ipAccess,
        ipNote,
        user: currentUser.fullName || currentUser.username || '',
      });
      return res.status(200).json({ success: true, access: saved });
    } catch (err) {
      console.error('setMachineAccess error:', err);
      return res.status(500).json({ error: 'Σφάλμα αποθήκευσης πρόσβασης' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
