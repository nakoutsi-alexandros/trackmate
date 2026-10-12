// lib/emailTickets.js
// Tickets από email με συμπληρωμένη φόρμα (πρότυπο κειμένου):
//  1. καθάρισμα κειμένου email
//  2. ανάγνωση των πεδίων της φόρμας (κώδικας, χωρίς AI)
//  3. αν λείπει κάτι, ο Claude ψάχνει μήπως γράφτηκε αλλού στο κείμενο
//  4. έλεγχος υποχρεωτικών πεδίων (κώδικας)
//  5. δημιουργία / ενημέρωση ticket στο Sheet
//  6. αν λείπει κάτι → ειδοποίηση σε ΕΜΑΣ (όχι στο κατάστημα)

import Anthropic from '@anthropic-ai/sdk';
import { findTicketByThread, createTicket, saveTicket, getStores } from './sheets';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.TICKETS_MODEL || 'claude-haiku-5-5';
// Εφεδρικό: το ίδιο μοντέλο με το scan, που ξέρουμε ότι δουλεύει με αυτό το API key
const FALLBACK_MODEL = 'claude-sonnet-4-6';

export const TICKET_STATUSES = ['Νέο', 'Ελλιπές', 'Σε εξέλιξη', 'Κλειστό'];

// Τα πεδία της φόρμας Cashdro, με τη σειρά που εμφανίζονται.
// labels: πώς μπορεί να είναι γραμμένη η ετικέτα (χωρίς τόνους, πεζά, χωρίς παρενθέσεις/αστεράκια)
// required: αν λείπει → ticket "Ελλιπές" + ειδοποίηση σε εμάς
export const FORM_FIELDS = [
  { key: 'store',        label: 'Υποκατάστημα',              required: true,  labels: ['υποκαταστημα', 'καταστημα'] },
  { key: 'address',      label: 'Διεύθυνση καταστήματος',    required: true,  labels: ['διευθυνση καταστηματος', 'διευθυνση'] },
  { key: 'postalCode',   label: 'Ταχυδρομικός κώδικας',      required: true,  labels: ['ταχυδρομικος κωδικας', 'ταχ. κωδικας', 'τ.κ.', 'τκ'] },
  { key: 'contactName',  label: 'Ονοματεπώνυμο υπευθύνου',   required: true,  labels: ['ονομ/νο υπευθυνου', 'ονοματεπωνυμο υπευθυνου', 'ονοματεπωνυμο', 'ονομ/νο', 'ονομα'] },
  { key: 'contactPhone', label: 'Τηλέφωνο επικοινωνίας',     required: true,  labels: ['τηλεφωνο επικοινωνιας υπευθυνου', 'τηλεφωνο επικοινωνιας', 'τηλεφωνο', 'τηλ.', 'τηλ'] },
  { key: 'problem',      label: 'Περιγραφή προβλήματος',     required: true,  labels: ['περιγραφη προβληματος', 'περιγραφη', 'προβλημα'] },
  { key: 'serialNumber', label: 'Σειριακός Cashdro',         required: false, labels: ['σειριακος cashdro', 'σειριακος αριθμος', 'σειριακος', 'serial number', 'serial', 's/n'] },
  { key: 'ip',           label: 'IP Cashdro',                required: false, labels: ['ip cashdro', 'ip'] },
  { key: 'courier',      label: 'Μεταφορική',                required: false, labels: ['μεταφορικη σε περιπτωση αποστολης ανταλλακτικου', 'μεταφορικη'] },
  { key: 'storeRemarks', label: 'Παρατηρήσεις',              required: false, labels: ['παρατηρησεις'] },
];

const REQUIRED_KEYS = FORM_FIELDS.filter(f => f.required).map(f => f.key);
const ALL_KEYS = FORM_FIELDS.map(f => f.key);

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

// Σύγκριση χωρίς τόνους / κεφαλαία / διπλά κενά
function normName(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

// ── 2. Ανάγνωση φόρμας (κώδικας) ───────────────────
// Η φόρμα είναι πίνακας: στο κείμενο του email γίνεται "Ετικέτα: τιμή"
// ή η ετικέτα σε μία γραμμή και η τιμή στην επόμενη.
// Η περιγραφή και οι παρατηρήσεις μπορεί να συνεχίζουν σε πολλές γραμμές.
const LABEL_INDEX = FORM_FIELDS
  .flatMap(f => f.labels.map(l => ({ key: f.key, label: normName(l) })))
  .sort((a, b) => b.label.length - a.label.length); // πρώτα οι μεγαλύτερες ετικέτες

const MULTILINE = new Set(['problem', 'storeRemarks', 'address']);

function labelKey(text) {
  const n = normName(text.replace(/\([^)]*\)/g, ' ').replace(/[*]/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!n) return null;
  for (const { key, label } of LABEL_INDEX) {
    // Η ετικέτα πρέπει να ταιριάζει ολόκληρη λέξη (όχι "τκ" μέσα σε άλλη λέξη)
    if (n === label || n.startsWith(label + ' ')) return key;
  }
  return null;
}

function matchLabel(line) {
  const clean = line.replace(/^[\s•·\->#|]+/, '').replace(/\*\*/g, '').trim();
  const colon = clean.search(/[:：]/);
  if (colon > 0) {
    const key = labelKey(clean.slice(0, colon));
    // Τιμή μετά την άνω-κάτω τελεία· αφαιρούμε tabs / κάθετες γραμμές πίνακα
    if (key) return { key, value: clean.slice(colon + 1).replace(/^[\s|\t]+/, '').replace(/[\s|]+$/, '').trim() };
  }
  // Γραμμή που είναι ΜΟΝΟ ετικέτα (π.χ. χάθηκε η άνω-κάτω τελεία)
  const key = labelKey(clean);
  if (key && normName(clean).length <= 60 && !/\d{3,}/.test(clean)) {
    const exact = LABEL_INDEX.some(l => l.key === key && normName(clean.replace(/\([^)]*\)/g, ' ').replace(/[*]/g, ' ')).replace(/\s+/g, ' ').trim() === l.label);
    if (exact) return { key, value: '' };
  }
  return null;
}

export function parseForm(text) {
  const out = {};
  let current = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim().replace(/^\|+|\|+$/g, '').trim();
    const hit = line ? matchLabel(line) : null;
    if (hit) {
      current = hit.key;
      if (!out[current]) out[current] = hit.value;
      continue;
    }
    if (!current || !line) continue;
    if (!out[current]) out[current] = line;                       // τιμή στην επόμενη γραμμή
    else if (MULTILINE.has(current)) out[current] += `\n${line}`; // συνέχεια κειμένου
  }
  return out;
}

// ── 3. Ο Claude για ό,τι δεν βρέθηκε στη φόρμα ──────
async function extractMissing({ missingKeys, subject, body, images }) {
  const content = [];
  for (const img of (images || []).slice(0, 2)) {
    if (!img?.data || !ALLOWED_IMAGE_TYPES.includes(img.mimeType)) continue;
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data } });
  }
  const wanted = FORM_FIELDS.filter(f => missingKeys.includes(f.key));
  const example = Object.fromEntries(wanted.map(f => [f.key, null]));

  content.push({
    type: 'text',
    text: `Ένα κατάστημα έστειλε email για βλάβη μηχανήματος. Κάποια στοιχεία δεν βρέθηκαν στη φόρμα.
Ψάξε αν γράφονται ΑΛΛΟΥ στο κείμενο ή στην υπογραφή${content.length > 1 ? ' ή σε συνημμένη φωτογραφία ετικέτας' : ''}.

Θέμα: ${subject || '(χωρίς θέμα)'}
Κείμενο:
"""
${body || '(κενό)'}
"""

Στοιχεία που ψάχνουμε:
${wanted.map(f => `- ${f.key}: ${f.label}`).join('\n')}

Κανόνες: ΠΟΤΕ μη μαντεύεις. Ό,τι δεν γράφεται ρητά είναι null. Μην βγάζεις όνομα από τη διεύθυνση email.
Το problem να είναι σύντομη περίληψη στα ελληνικά (έως 200 χαρακτήρες). Ο postalCode είναι 5ψήφιος.

Απάντησε ΜΟΝΟ με ένα αντικείμενο JSON με αυτά τα κλειδιά, χωρίς markdown:
${JSON.stringify(example)}`,
  });

  let lastError;
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const response = await client.messages.create({ model, max_tokens: 1024, messages: [{ role: 'user', content }] });
      const text = response.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        .replace(/```json|```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`non-JSON response (stop_reason=${response.stop_reason}): ${text.slice(0, 200) || '(κενό)'}`);
      return JSON.parse(match[0]);
    } catch (err) {
      lastError = err;
      console.error(`tickets: model ${model} failed — ${err?.status || ''} ${err?.error?.error?.message || err?.message || err}`);
    }
  }
  throw lastError;
}

// ── 4. Έλεγχος πεδίων (κώδικας) ────────────────────
// Κενές τιμές ή placeholders του προτύπου ("...", "___", "-", "null")
const EMPTY_RE = /^(null|unknown|n\/a|na|-+|_+|\.+|…+|άγνωστο|κανένα|δεν γνωρίζω|δεν ξέρω|\[.*\]|<.*>)$/i;

function normalizeText(v, max = 300) {
  if (v == null || typeof v !== 'string') return '';
  const s = v.trim().replace(/^["']|["']$/g, '');
  if (!s || EMPTY_RE.test(s)) return '';
  return s.slice(0, max);
}

function normalizeSerial(v) {
  const s = normalizeText(v, 40);
  if (s.length < 4 || !/\d/.test(s)) return '';
  return s;
}

function normalizePhone(v) {
  const s = normalizeText(v, 40);
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';
  if (/[^\d+\s\-().]/.test(s)) return '';
  return s;
}

function normalizeName(v) {
  const s = normalizeText(v, 80);
  if (s.length < 2 || /@|\d/.test(s)) return '';
  return s;
}

function normalizePostal(v) {
  const s = normalizeText(v, 20);
  const digits = s.replace(/\D/g, '');
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : '';
}

function normalizeIp(v) {
  const s = normalizeText(v, 40);
  const m = s.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
  if (!m || m.slice(1).some(x => Number(x) > 255)) return '';
  return m[0];
}

const NORMALIZERS = {
  store:        v => normalizeText(v, 80),
  address:      v => normalizeText(v, 150).replace(/\n+/g, ', '),
  postalCode:   normalizePostal,
  contactName:  normalizeName,
  contactPhone: normalizePhone,
  problem:      v => { const s = normalizeText(v, 800); return s.length >= 5 ? s : ''; },
  serialNumber: normalizeSerial,
  ip:           normalizeIp,
  courier:      v => normalizeText(v, 80),
  storeRemarks: v => normalizeText(v, 500),
};

// Ταίριασμα υποκαταστήματος με τα καταστήματα του TrackMate
// π.χ. "Γλυφάδα" από domain ΚΩΤΣΟΒΟΛΟΣ → "ΚΩΤΣΟΒΟΛΟΣ ΓΛΥΦΑΔΑ"
async function resolveStore(value, chain) {
  if (!value) return '';
  let all = [];
  try { all = await getStores(); } catch (e) { console.error('tickets: getStores failed', e?.message || e); }
  const v = normName(value);
  const c = normName(chain);
  const pool = c ? all.filter(n => normName(n).includes(c)) : all;

  const exact = pool.find(n => normName(n) === v);
  if (exact) return exact;
  const partial = pool.filter(n => normName(n).includes(v));
  if (partial.length === 1) return partial[0];

  // Δεν βρέθηκε μοναδικό → κρατάμε ό,τι έγραψε, με μπροστά την αλυσίδα αν λείπει
  return c && !v.includes(c) ? `${chain} ${value}` : value;
}

// ── 6. Ειδοποίηση σε εμάς ──────────────────────────
function buildNotification(ticket, missingKeys) {
  const labelOf = k => FORM_FIELDS.find(f => f.key === k)?.label || k;
  const filled = FORM_FIELDS
    .map(f => `${f.label}: ${ticket[f.key] || '— ΛΕΙΠΕΙ —'}`)
    .join('\n');
  return {
    subject: `TrackMate: ελλιπές ticket ${ticket.ticketId}${ticket.store ? ` — ${ticket.store}` : ''}`,
    body: `Το ticket ${ticket.ticketId} δημιουργήθηκε αλλά λείπουν στοιχεία:

${missingKeys.map(k => `• ${labelOf(k)}`).join('\n')}

Από: ${ticket.from}
Θέμα: ${ticket.subject || '-'}

Στοιχεία που διαβάστηκαν:
${filled}

Μήνυμα καταστήματος:
${(ticket.lastMessage || '').slice(0, 1500)}

Άνοιγμα στο TrackMate: https://trackmate-lake.vercel.app/?tab=tickets

—
Αυτόματο μήνυμα TrackMate. Στο κατάστημα δεν στάλθηκε τίποτα.`,
  };
}

// ── Κύρια ροή ──────────────────────────────────────
export async function processInboundEmail({ threadId, messageId, from, store, chain, subject, body, images }) {
  const existing = await findTicketByThread(threadId);

  // Το ίδιο μήνυμα ξανά (το script δεν ολοκλήρωσε, π.χ. απέτυχε η ειδοποίηση):
  // δεν αλλάζουμε το ticket, ξαναστέλνουμε μόνο την ειδοποίηση αν χρειάζεται
  if (existing && messageId && existing.lastMessageId === messageId) {
    const keys = (existing.missing || '').split(',').map(x => x.trim()).filter(Boolean);
    return { ticket: existing, duplicate: true, notify: keys.length ? buildNotification(existing, keys) : null };
  }

  const cleaned = cleanEmailBody(body);

  // 2. Φόρμα
  const form = parseForm(cleaned);
  const fields = {};
  for (const k of ALL_KEYS) fields[k] = NORMALIZERS[k](form[k]);
  fields.model = existing?.model || 'CashDro';

  // Αν το email είναι από γνωστό κατάστημα (STORES) και η φόρμα δεν το γράφει
  if (!fields.store && store) fields.store = store;

  // 3. Claude μόνο για ό,τι έλειψε
  let missingKeys = REQUIRED_KEYS.filter(k => !fields[k] && !existing?.[k]);
  if (missingKeys.length) {
    // Αν αποτύχει ο Claude πετάει error → το API απαντά 503 και το script ξαναδοκιμάζει
    const extra = await extractMissing({ missingKeys, subject, body: cleaned, images });
    for (const k of missingKeys) {
      const v = NORMALIZERS[k](typeof extra?.[k] === 'string' ? extra[k] : '');
      if (v) fields[k] = v;
    }
  }

  // Υποκατάστημα → όνομα όπως στο TrackMate
  if (fields.store && fields.store !== store) fields.store = await resolveStore(fields.store, chain);

  // Κρατάμε τα στοιχεία προηγούμενων μηνυμάτων του ίδιου ticket όπου λείπουν τώρα
  for (const k of ALL_KEYS) if (!fields[k] && existing?.[k]) fields[k] = existing[k];

  // 4. Τι λείπει τελικά
  missingKeys = REQUIRED_KEYS.filter(k => !fields[k]);

  let status;
  if (missingKeys.length) status = 'Ελλιπές';
  else if (!existing || ['Ελλιπές', 'Κλειστό', ''].includes(existing.status)) status = 'Νέο';
  else status = existing.status; // π.χ. "Σε εξέλιξη" — δεν το πειράζουμε

  const base = {
    status,
    threadId,
    lastMessageId: messageId || '',
    from: from || existing?.from || '',
    subject: existing?.subject || subject || '',
    ...fields,
    missing: missingKeys.join(', '),
    lastMessage: cleaned.slice(0, 2000),
  };

  // 5. Αποθήκευση
  const ticket = existing
    ? await saveTicket({ ...existing, ...base, updatedBy: 'email' })
    : await createTicket({ ...base, notes: '', updatedBy: 'email' });

  // 6. Ειδοποίηση μόνο σε εμάς, μόνο αν λείπει κάτι
  return { ticket, notify: missingKeys.length ? buildNotification(ticket, missingKeys) : null };
}
