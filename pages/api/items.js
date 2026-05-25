import { getItems } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const items = await getItems();
    return res.status(200).json({ items });
  } catch (err) {
    console.error('getItems error:', err);
    return res.status(500).json({ error: 'Σφάλμα φόρτωσης κωδικών είδους' });
  }
}
