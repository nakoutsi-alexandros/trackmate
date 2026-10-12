// lib/emailTickets.js
// Λογική για tickets που έρχονται από email:
//  1. καθάρισμα κειμένου email
//  2. εξαγωγή στοιχείων με Claude (όνομα, τηλέφωνο, πρόβλημα, υποκατάστημα, serial)
//  3. έλεγχος υποχρεωτικών πεδίων (απλός κώδικας, όχι AI)
//  4. δημιουργία / ενημέρωση ticket στο Sheet
//  5. κείμενο αυτόματης απάντησης

import Anthropic from '@anthropic-ai/sdk';
import { findTicketByThread, createTicket, saveTicket, getStores } from './sheets';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.TICKETS_MODEL || 'claude-haiku-5-5';
// Εφεδρικό: το ίδιο μοντέλο με το scan, που ξέρουμε ότι δουλεύει με αυτό το API key
const FALLBACK_MODEL = 'claude-sonnet-4-6';

export const TICKET_STATUSES = ['Νέο', 'Ελλιπές', 'Σε εξέλιξη', 'Κλειστό'];

// Υποχρεωτικά πεδία και πώς τα ζητάμε στην απάντηση
const REQUIRED_FIELDS = [
  { key: 'store',        ask: 'Από ποιο υποκατάστημα στέλνετε (π.χ. περιοχή ή διεύθυνση του καταστήματος)' },
  { key: 'contactName',  ask: 'Το ονοματεπώνυμό σας' },
  { key: 'contactPhone', ask: 'Ένα τηλέφωνο επικοινωνίας' },
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

// Σύγκριση ονομάτων χωρίς τόνους / κεφαλαία / διπλά κενά
function normName(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

// Τα καταστήματα του TrackMate που ανήκουν στην αλυσίδα (το όνομά τους περιέχει την αλυσίδα)
async function storesOfChain(chain) {
  if (!chain) return [];
  try {
    const all = await getStores();
    const c = normName(chain);
    return all.filter(n => normName(n).includes(c));
  } catch (e) {
    console.error('tickets: getStores failed', e?.message || e);
    return [];
  }
}

// ── 2. Εξαγωγή στοιχείων με Claude ─────────────────
async function extractFields({ store, chain, chainStores, subject, body, images, known }) {
  const content = [];
  for (const img of (images || []).slice(0, 2)) {
    if (!img?.data || !ALLOWED_IMAGE_TYPES.includes(img.mimeType)) continue;
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } });
  }

  const knownBlock = known
    ? `Ήδη γνωστά στοιχεία από προηγούμενα μηνύματα του ίδιου αιτήματος:
- Όνομα: ${known.contactName || '(άγνωστο)'}
- Τηλέφωνο: ${known.contactPhone || '(άγνωστο)'}
- Πρόβλημα: ${known.problem || '(άγνωστο)'}
- Serial: ${known.serialNumber || '(άγνωστο)'}
- Model: ${known.model || '(άγνωστο)'}
Κράτα τα γνωστά στοιχεία, εκτός αν το νέο μήνυμα τα διορθώνει ή τα συμπληρώνει.`
    : 'Δεν υπάρχουν προηγούμενα στοιχεία.';

  const storeBlock = store
    ? `Κατάστημα: ${store}`
    : `Αλυσίδα: ${chain || '(άγνωστη)'} — το υποκατάστημα δεν είναι γνωστό από τη διεύθυνση email.${
        chainStores?.length ? `\nΥποκαταστήματα της αλυσίδας:\n${chainStores.map(n => `- ${n}`).join('\n')}` : ''}`;

  const storeRule = store
    ? 'βάλε null (το κατάστημα είναι ήδη γνωστό).'
    : chainStores?.length
      ? 'ποιο από τα υποκαταστήματα της λίστας στέλνει, ΜΟΝΟ αν προκύπτει καθαρά από το κείμενο ή την υπογραφή. Γράψε το όνομα ΑΚΡΙΒΩΣ όπως στη λίστα. Αλλιώς null.'
      : 'το υποκατάστημα/περιοχή ΜΟΝΟ αν αναφέρεται ρητά (π.χ. στην υπογραφή). Αλλιώς null.';

  content.push({
    type: 'text',
    text: `Είσαι βοηθός τεχνικής υποστήριξης. Ένα κατάστημα στέλνει email για βλάβη μηχανήματος (π.χ. CashDro, POS, kiosk).

${storeBlock}
Θέμα email: ${subject || '(χωρίς θέμα)'}

Κείμενο email:
"""
${body || '(κενό)'}
"""

${knownBlock}

${content.length > 1 ? 'Υπάρχουν και συνημμένες φωτογραφίες· αν δείχνουν ετικέτα, διάβασε από εκεί serial/model.' : ''}

Κανόνες (ποτέ μη μαντεύεις — ό,τι δεν βρεις είναι null):
- contactName: ονοματεπώνυμο του ανθρώπου που στέλνει, ΜΟΝΟ αν το γράφει ο ίδιος στο κείμενο ή στην υπογραφή. Μην το βγάζεις από τη διεύθυνση email.
- contactPhone: τηλέφωνο επικοινωνίας όπως γράφεται στο κείμενο ή την υπογραφή.
- problem: σύντομη περίληψη του προβλήματος στα ελληνικά (έως 200 χαρακτήρες). Αν δεν περιγράφεται πρόβλημα, null.
- store: ${storeRule}
- serialNumber: μόνο αν εμφανίζεται ρητά στο κείμενο ή σε φωτογραφία ετικέτας.
- model: μοντέλο/κωδικός είδους αν αναφέρεται.

Απάντησε ΜΟΝΟ με ένα αντικείμενο JSON, χωρίς markdown και χωρίς άλλο κείμενο. Παράδειγμα:
{"contactName": "Μαρία Παπαδοπούλου", "contactPhone": "6912345678", "problem": "Δεν δέχεται χαρτονομίσματα", "store": null, "serialNumber": null, "model": null}`,
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
const EMPTY_RE = /^(null|unknown|n\/a|-|άγνωστο|κανένα)$/i;

function normalizeText(v, max = 300) {
  if (!v || typeof v !== 'string') return '';
  const s = v.trim();
  if (EMPTY_RE.test(s)) return '';
  return s.slice(0, max);
}

function normalizeSerial(v) {
  const s = normalizeText(v, 40).replace(/^['"]|['"]$/g, '');
  // Λογικό serial: 4–40 χαρακτήρες, τουλάχιστον ένα ψηφίο
  if (s.length < 4 || !/\d/.test(s)) return '';
  return s;
}

function normalizePhone(v) {
  const s = normalizeText(v, 40);
  // Τουλάχιστον 10 ψηφία (ελληνικό τηλέφωνο), επιτρέπονται +, κενά, παύλες, παρενθέσεις
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  if (/[^\d+\s\-().]/.test(s)) return '';
  return s;
}

function normalizeName(v) {
  const s = normalizeText(v, 80);
  // Τουλάχιστον 2 γράμματα, όχι email/αριθμοί
  if (s.length < 2 || /@|\d/.test(s)) return '';
  return s;
}

// Το υποκατάστημα που πρότεινε ο Claude: μόνο αν ταιριάζει με κατάστημα της λίστας
function resolveStore(suggested, chain, chainStores) {
  const v = normalizeText(suggested, 80);
  if (!v) return '';
  if (chainStores.length) {
    return chainStores.find(n => normName(n) === normName(v)) || '';
  }
  // Δεν υπάρχουν καταστήματα της αλυσίδας στο TrackMate → κρατάμε ό,τι γράφει
  return chain && !normName(v).includes(normName(chain)) ? `${chain} ${v}` : v;
}

function computeMissing(fields, chain) {
  return REQUIRED_FIELDS.filter(f => {
    const v = fields[f.key] || '';
    if (f.key === 'problem') return v.length < 5;
    // Από domain αλυσίδας: μόνο το όνομα της αλυσίδας δεν αρκεί, θέλουμε υποκατάστημα
    if (f.key === 'store') return !v || (!!chain && normName(v) === normName(chain));
    return !v;
  });
}

// ── 5. Κείμενα απάντησης ───────────────────────────
const FOOTER = '\n\n—\nΑυτό είναι αυτόματο μήνυμα από το TrackMate. Για οποιαδήποτε διευκρίνιση απαντήστε σε αυτό το email.';

// Χωρίς όνομα: η ονομαστική ("Γεια σας Νίκος") ακούγεται λάθος στα ελληνικά
function greeting() {
  return 'Γεια σας,';
}

function replyMissing(ticket, missing) {
  const list = missing.map(m => `• ${m.ask}`).join('\n');
  return `${greeting(ticket)}

Λάβαμε το μήνυμά σας και δημιουργήθηκε το αίτημα ${ticket.ticketId}.
Για να το προχωρήσουμε χρειαζόμαστε ακόμα:

${list}

Παρακαλούμε απαντήστε σε αυτό το email με τα παραπάνω στοιχεία.${FOOTER}`;
}

function replyRegistered(ticket) {
  const lines = [
    `Κατάστημα: ${ticket.store || '-'}`,
    `Υπεύθυνος επικοινωνίας: ${ticket.contactName}`,
    `Τηλέφωνο: ${ticket.contactPhone}`,
    `Πρόβλημα: ${ticket.problem}`,
  ];
  if (ticket.serialNumber) lines.push(`Serial number: ${ticket.serialNumber}`);
  if (ticket.model) lines.push(`Μοντέλο: ${ticket.model}`);

  return `${greeting(ticket)}

Το αίτημά σας καταχωρήθηκε με αριθμό ${ticket.ticketId}.

${lines.join('\n')}

Θα επικοινωνήσουμε μαζί σας σύντομα.${FOOTER}`;
}

function replyUpdate(ticket) {
  return `${greeting(ticket)}

Λάβαμε το νέο σας μήνυμα για το αίτημα ${ticket.ticketId} και το προσθέσαμε στο ιστορικό του.${FOOTER}`;
}

function missingFromTicket(ticket) {
  const keys = (ticket.missing || '').split(',').map(x => x.trim()).filter(Boolean);
  return REQUIRED_FIELDS.filter(f => keys.includes(f.key));
}

// ── Κύρια ροή ──────────────────────────────────────
export async function processInboundEmail({ threadId, messageId, from, fromName, store, chain, subject, body, images }) {
  const existing = await findTicketByThread(threadId);

  // Το ίδιο μήνυμα ξανά: το ticket γράφτηκε, αλλά το script δεν ολοκλήρωσε
  // (π.χ. η Google απέτυχε στην αποστολή της απάντησης). Δεν αλλάζουμε το ticket,
  // ξαναστέλνουμε όμως την απάντηση που αντιστοιχεί στην τρέχουσα κατάστασή του.
  if (existing && messageId && existing.lastMessageId === messageId) {
    const pending = missingFromTicket(existing);
    const reply = pending.length ? replyMissing(existing, pending) : replyRegistered(existing);
    return { ticket: existing, shouldReply: true, reply, duplicate: true };
  }

  const cleaned = cleanEmailBody(body);
  const knownStore = store || existing?.store || '';
  const chainStores = store ? [] : await storesOfChain(chain);
  // Αν αποτύχει ο Claude πετάει error → το API απαντά 503 και το script ξαναδοκιμάζει
  const extracted = await extractFields({
    store, chain, chainStores, subject, body: cleaned, images, known: existing,
  });

  // Υποκατάστημα: γνωστό από το email → αλλιώς από το κείμενο → αλλιώς η αλυσίδα
  const detectedStore = store ? '' : resolveStore(extracted.store, chain, chainStores);
  const previousIsChainOnly = existing && chain && normName(existing.store) === normName(chain);
  const finalStore = store
    || (detectedStore && (!existing?.store || previousIsChainOnly) ? detectedStore : '')
    || knownStore
    || chain
    || '';

  const fields = {
    store:        finalStore,
    contactName:  normalizeName(extracted.contactName)   || existing?.contactName || '',
    contactPhone: normalizePhone(extracted.contactPhone) || existing?.contactPhone || '',
    problem:      normalizeText(extracted.problem, 300)  || existing?.problem || '',
    serialNumber: normalizeSerial(extracted.serialNumber) || existing?.serialNumber || '',
    model:        normalizeText(extracted.model, 80)      || existing?.model || '',
  };
  const missing = computeMissing(fields, store ? '' : chain);
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
