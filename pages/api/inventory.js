import { getInventory, getHistory } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { serial } = req.query;

  try {
    if (serial) {
      const history = await getHistory(serial);
      return res.status(200).json({ history });
    } else {
      const inventory = await getInventory();
      return res.status(200).json({ inventory });
    }
  } catch (err) {
    console.error('Inventory error:', err);
    return res.status(500).json({ error: 'Σφάλμα ανάκτησης δεδομένων', details: err.message });
  }
}
