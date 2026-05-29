import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 },
          },
          {
            type: 'text',
            text: `Κοίταξε αυτή τη φωτογραφία προσεκτικά.

Πρώτα αξιολόγησε:
- Είναι φωτογραφία μηχανήματος, συσκευής ή εξοπλισμού με ετικέτα/αυτοκόλλητο;
- Φαίνεται καθαρά το serial number ή/και το model;
- Είναι αρκετά ευκρινής για αναγνώριση;

Απάντησε ΜΟΝΟ σε JSON χωρίς markdown:

Αν η φωτογραφία ΔΕΝ δείχνει μηχάνημα με ετικέτα:
{"valid": false, "reason": "no_machine", "message": "Η φωτογραφία δεν δείχνει μηχάνημα με ετικέτα serial number."}

Αν η φωτογραφία είναι θολή ή δεν φαίνεται καθαρά:
{"valid": false, "reason": "blurry", "message": "Η φωτογραφία δεν είναι αρκετά καθαρή. Τράβηξε ξανά πιο κοντά στην ετικέτα."}

Αν δεν υπάρχει serial number ή model ορατό:
{"valid": false, "reason": "no_data", "message": "Δεν εντοπίστηκε serial number ή model. Σιγουρέψου ότι η ετικέτα φαίνεται καθαρά."}

Αν βρεις στοιχεία:
{"valid": true, "serialNumber": "...", "model": "...", "confidence": "high/medium/low"}

Αν βρεις μόνο ένα από τα δύο, βάλε "unknown" για το άλλο και confidence "medium".`,
          },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Model returned non-JSON prose — treat as a low-confidence failure
      console.error('Scan: model returned non-JSON:', clean);
      return res.status(422).json({ valid: false, reason: 'no_data', message: 'Δεν ήταν δυνατή η αναγνώριση. Δοκιμάστε ξανά με καλύτερο φωτισμό.' });
    }

    // Αν δεν είναι valid, επιστρέφουμε 422
    if (!parsed.valid) {
      return res.status(422).json(parsed);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Scan error:', err);
    // Do NOT forward err.message — it may contain API key hints or SDK internals
    return res.status(500).json({ error: 'Σφάλμα αναγνώρισης. Δοκιμάστε ξανά.' });
  }
}
