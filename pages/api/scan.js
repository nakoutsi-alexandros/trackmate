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
            text: `Κοίταξε αυτή τη φωτογραφία και βρες:
1. Serial Number (SN, S/N, Serial No, ή παρόμοιο)
2. Model name/number

Απάντησε ΜΟΝΟ σε JSON χωρίς markdown:
{"serialNumber": "...", "model": "...", "confidence": "high/medium/low"}

Αν δεν βρεις κάτι βάλε "unknown".`,
          },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: 'Σφάλμα αναγνώρισης', details: err.message });
  }
}
