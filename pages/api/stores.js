// pages/api/stores.js
// GET  → επιστρέφει λίστα καταστημάτων από το Sheet
// POST → προσθέτει νέο κατάστημα στο Sheet

import { getStores, getStoreDetails, addStoreDetails } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const stores = await getStores();
      const storeDetails = await getStoreDetails();
      return res.status(200).json({ stores, storeDetails });
    } catch (err) {
      console.error('getStores error:', err);
      return res.status(500).json({ error: 'Σφάλμα φόρτωσης καταστημάτων' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, phone = '', address = '', vat = '' } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Το όνομα καταστήματος είναι υποχρεωτικό' });
      }

      // Έλεγχος αν υπάρχει ήδη
      const existing = await getStores();
      const duplicate = existing.find(
        s => s.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        return res.status(409).json({ error: 'Το κατάστημα υπάρχει ήδη' });
      }

      await addStoreDetails({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        vat: vat.trim(),
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('addStore error:', err);
      return res.status(500).json({ error: 'Σφάλμα προσθήκης καταστήματος' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
