// lib/emailTickets.js
// Λογική για tickets που έρχονται από email:
//  1. καθάρισμα κειμένου email
//  2. εξαγωγή στοιχείων με Claude (serial, model, πρόβλημα)
//  3. έλεγχος υποχρεωτικών πεδίων (απλός κώδικας, όχι AI)
//  4. δημιουργία / ενημέρωση ticket στο Sheet
//  5. κείμενο αυτόματης απάντησης

import Anthropic from '@anthropic-ai/sdk';
import { findTicketByThread, createTicket, saveTicket } from './sheets';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.TICKETS_MODEL || 'claude-haiku-5-5';
// Εφεδρικό: το ίδιο μοντέλο με το scan, που ξέρουμε ότι δουλεύει με αυτό το API key
const FALLBACK_MODEL = 'claude-sonnet-4-6';

export const TICKET_STATUSES = ['Νέο', 'Ελλιπές', 'Σε εξέλιξη', 'Κλειστό'];

// Υποχρεωτικά πεδία και πώς τα ζητάμε στην απάντηση
const REQUIRED_FIELDS = [
  { key: 'serialNumber', ask: 'Το serial number του μηχανήματος (βρίσκεται στην ετικέτα — μπορείτε να στείλετε και φωτογραφία της ετικέτας)' },
  { key: 'problem',      ask: 'Μια σύντομη περιγραφή του προβλήματος' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ── 1. Καθάρισμα email ─────────────────────────────
// Κόβει το παλιό quoted κείμενο ("On ... wrote:", "Στις ... έγραψε:", "> ...")
export function cleanEmailBody(body = '') {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (/wrote:$/i.test(t) || /έγραψε:?$/i.test(t)) break;
    if (/^-{2,}\s*(Original Message|Αρχικό μήνυμα)/i.test(t)) break;
    if (/^_{5,}$/.test(t)) break;
    if (/^(From|Από):\s/i.test(t) && out.length > 0) break;
    if (t.startsWith('>')) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}

// ── 2. Εξαγωγή στοιχείων με Claude ─────────────────
async function extractFields({ store, subject, body, images, known }) {
  const content = [];
  for (const img of (images || []).slice(0, 2)) {
    if (!img?.data || !ALLOWED_IMAGE_TYPES.includes(img.mimeType)) continue;
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } });
  }

  const knownBlock = known
    ? `Ήδη γνωστά στοιχεία από προηγούμενα μηνύματα του ίδιου αιτήματος:
- Serial: ${known.serialNumber || '(άγνωστο)'}
- Model: ${known.model || '(άγνωστο)'}
- Πρόβλημα: ${known.problem || '(άγνωστο)'}
Κράτα τα γνωστά στοιχεία, εκτός αν το νέο μήνυμα τα διορθώνει ή τα συμπληρώνει.`
    : 'Δεν υπάρχουν προηγούμενα στοιχεία.';

  content.push({
    type: 'text',
    text: `Είσαι βοηθός τεχνικής υποστήριξης. Ένα κατάστημα στέλνει email για βλάβη μηχανήματος (π.χ. CashDro, POS, kiosk).

Κατάστημα: ${store || '(άγνωστο)'}
Θέμα email: ${subject || '(χωρίς θέμα)'}

Κείμενο email:
"""
${body || '(κενό)'}
"""

${knownBlock}

${content.length > 1 ? 'Υπάρχουν και συνημμένες φωτογραφίες· αν δείχνουν ετικέτα, διάβασε από εκεί serial/model.' : ''}

Κανόνες:
- serialNumber: ΜΟΝΟ αν εμφανίζεται ρητά στο κείμενο ή σε φωτογραφία ετικέτας. Ποτέ μην το μαντεύεις. Αλλιώς null.
- model: μοντέλο/κωδικός είδους αν αναφέρεται, αλλιώς null.
- problem: σύντομη περίληψη του προβλήματος στα ελληνικά (έως 200 χαρακτήρες). Αν το email δεν περιγράφει πρόβλημα, null.

Απάντησε ΜΟΝΟ με ένα αντικείμενο JSON, χωρίς markdown και χωρίς άλλο κείμενο.
Για ό,τι δεν βρεις βάλε null. Παράδειγμα:
{"serialNumber": "AB123456", "model": null, "problem": "Δεν δέχεται χαρτονομίσματα"}`,
  });

  // Δοκιμάζει πρώτα το κύριο μοντέλο και μετά το εφεδρικό.
  // Αποτυχία = σφάλμα API ή απάντηση χωρίς έγκυρο JSON.
  let lastError;
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
      });
      const text = response.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n')
        .replace(/```json|```/g, '')
        .trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error(`non-JSON response (stop_reason=${response.stop_reason}): ${text.slice(0, 200) || '(κενό)'}`);
      }
      return JSON.parse(match[0]);
    } catch (err) {
      lastError = err;
      console.error(`tickets: model ${model} failed — ${err?.status || ''} ${err?.error?.error?.message || err?.message || err}`);
    }
  }
  throw lastError;
}

// ── 3. Έλεγχος πεδίων (κώδικας) ────────────────────
function normalizeSerial(v) {
  if (!v || typeof v !== 'string') return '';
  const s = v.trim().replace(/^['"]|['"]$/g, '');
  if (/^(null|unknown|n\/a|-|άγνωστο)$/i.test(s)) return '';
  // Λογικό serial: 4–40 χαρακτήρες, τουλάχιστον ένα ψηφίο
  if (s.length < 4 || s.length > 40 || !/\d/.test(s)) return '';
  return s;
}

function normalizeText(v, max = 300) {
  if (!v || typeof v !== 'string') return '';
  const s = v.trim();
  if (/^(null|unknown|n\/a|-|άγνωστο)$/i.test(s)) return '';
  return s.slice(0, max);
}

function computeMissing(fields) {
  return REQUIRED_FIELDS.filter(f => {
    const v = fields[f.key] || '';
    if (f.key === 'problem') return v.length < 5;
    return !v;
  });
}

// ── 5. Κείμενα απάντησης ───────────────────────────
const FOOTER = '\n\n—\nΑυτό είναι αυτόματο μήνυμα από το TrackMate. Για οποιαδήποτε διευκρίνιση απαντήστε σε αυτό το email.';

function replyMissing(ticket, missing) {
  const list = missing.map(m => `• ${m.ask}`).join('\n');
  return `Γεια σας,

Λάβαμε το μήνυμά σας και δημιουργήθηκε το αίτημα ${ticket.ticketId}.
Για να το προχωρήσουμε χρειαζόμαστε ακόμα:

${list}

Παρακαλούμε απαντήστε σε αυτό το email με τα παραπάνω στοιχεία.${FOOTER}`;
}

function replyRegistered(ticket) {
  return `Γεια σας,

Το αίτημά σας καταχωρήθηκε με αριθμό ${ticket.ticketId}.

Κατάστημα: ${ticket.store || '-'}
Serial number: ${ticket.serialNumber}${ticket.model ? `\nΜοντέλο: ${ticket.model}` : ''}
Πρόβλημα: ${ticket.problem}

Θα επικοινωνήσουμε μαζί σας σύντομα.${FOOTER}`;
}

function replyUpdate(ticket) {
  return `Γεια σας,

Λάβαμε το νέο σας μήνυμα για το αίτημα ${ticket.ticketId} και το προσθέσαμε στο ιστορικό του.${FOOTER}`;
}

// ── Κύρια ροή ──────────────────────────────────────
export async function processInboundEmail({ threadId, messageId, from, store, subject, body, images }) {
  const existing = await findTicketByThread(threadId);

  // Το ίδιο μήνυμα ξανά (π.χ. το script ξανάτρεξε) → καμία αλλαγή, καμία απάντηση
  if (existing && messageId && existing.lastMessageId === messageId) {
    return { ticket: existing, shouldReply: false, duplicate: true };
  }

  const cleaned = cleanEmailBody(body);
  // Αν αποτύχει ο Claude πετάει error → το API απαντά 503 και το script ξαναδοκιμάζει
  const extracted = await extractFields({ store, subject, body: cleaned, images, known: existing });

  const fields = {
    serialNumber: normalizeSerial(extracted.serialNumber) || existing?.serialNumber || '',
    model:        normalizeText(extracted.model, 80)      || existing?.model || '',
    problem:      normalizeText(extracted.problem, 300)   || existing?.problem || '',
  };
  const missing = computeMissing(fields);
  const missingText = missing.map(m => m.key).join(', ');

  let status;
  if (missing.length) status = 'Ελλιπές';
  else if (!existing || ['Ελλιπές', 'Κλειστό', ''].includes(existing.status)) status = 'Νέο';
  else status = existing.status; // π.χ. "Σε εξέλιξη" — δεν το πειράζουμε

  const base = {
    status,
    threadId,
    lastMessageId: messageId || '',
    from: from || existing?.from || '',
    store: store || existing?.store || '',
    subject: existing?.subject || subject || '',
    ...fields,
    missing: missingText,
    lastMessage: cleaned.slice(0, 2000),
  };

  let ticket;
  if (existing) {
    ticket = await saveTicket({ ...existing, ...base, updatedBy: 'email' });
  } else {
    ticket = await createTicket({ ...base, notes: '', updatedBy: 'email' });
  }

  let reply;
  if (missing.length) reply = replyMissing(ticket, missing);
  else if (!existing || existing.status === 'Ελλιπές' || existing.missing) reply = replyRegistered(ticket);
  else reply = replyUpdate(ticket);

  return { ticket, shouldReply: true, reply };
}
