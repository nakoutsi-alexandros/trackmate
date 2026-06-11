import { getParts, getMachineParts, saveMachinePart, deleteMachinePart } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const [parts, machineParts] = await Promise.all([
        getParts().catch(err => {
          console.error('getParts list error:', err);
          return [];
        }),
        getMachineParts().catch(err => {
          console.error('getMachineParts error:', err);
          return {};
        }),
      ]);
      return res.status(200).json({ parts, machineParts });
    } catch (err) {
      console.error('getParts error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης ανταλλακτικών' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { serialNumber, code, description, machineModel } = req.body;
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      if (!code || !code.trim()) return res.status(400).json({ error: 'Κωδικός ανταλλακτικού υποχρεωτικός' });

      const currentUser = getUserFromRequest(req);
      if (currentUser?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });
      const savedPart = await saveMachinePart({
        serialNumber,
        code: code.trim(),
        description: (description || '').trim(),
        machineModel: machineModel || '',
        createdBy: currentUser ? currentUser.fullName : '',
      });

      return res.status(200).json({ success: true, part: savedPart });
    } catch (err) {
      console.error('saveMachinePart error:', err);
      return res.status(500).json({ error: 'Σφάλμα αποθήκευσης ανταλλακτικού' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { serialNumber, code, createdAt } = req.body;
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      if (!code) return res.status(400).json({ error: 'Κωδικός ανταλλακτικού υποχρεωτικός' });

      const currentUserDel = getUserFromRequest(req);
      if (currentUserDel?.role === 'viewer') return res.status(403).json({ error: 'Δεν έχεις δικαίωμα αλλαγών' });
      await deleteMachinePart({ serialNumber, code, createdAt });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('deleteMachinePart error:', err);
      return res.status(500).json({ error: 'Σφάλμα διαγραφής ανταλλακτικού' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
