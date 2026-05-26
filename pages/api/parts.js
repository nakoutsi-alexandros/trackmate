import { getParts, getMachineParts, saveMachinePart } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const [parts, machineParts] = await Promise.all([getParts(), getMachineParts()]);
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

  return res.status(405).json({ error: 'Method not allowed' });
}
