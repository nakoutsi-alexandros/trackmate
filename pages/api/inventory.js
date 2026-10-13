import { getInventory, getHistory, getHistoryByStore, getAllMovements } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { serial, store, all } = req.query;

  try {
    if (all) {
      const movements = await getAllMovements();
      return res.status(200).json({ movements });
    } else if (serial) {
      const history = await getHistory(serial);
      return res.status(200).json({ history });
    } else if (store) {
      const history = await getHistoryByStore(store);
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
