import { getMachineLogLinks, saveMachineLogLink } from '../../lib/sheets';
import { getUserFromRequest } from '../../lib/auth';

const normalizeUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const links = await getMachineLogLinks();
      return res.status(200).json({ links });
    } catch (err) {
      console.error('getMachineLogLinks error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης links logs' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { serialNumber, url, machineModel } = req.body;
      const cleanUrl = normalizeUrl(url);
      if (!serialNumber) return res.status(400).json({ error: 'Serial number υποχρεωτικό' });
      if (!cleanUrl) return res.status(400).json({ error: 'Link υποχρεωτικό' });

      const currentUser = getUserFromRequest(req);
      const savedLink = await saveMachineLogLink({
        serialNumber,
        url: cleanUrl,
        machineModel: machineModel || '',
        createdBy: currentUser ? currentUser.fullName : '',
      });

      return res.status(200).json({ success: true, link: savedLink });
    } catch (err) {
      console.error('saveMachineLogLink error:', err);
      return res.status(500).json({ error: 'Σφάλμα αποθήκευσης link logs' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
