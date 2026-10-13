// lib/emailTickets.js
// Tickets από email με συμπληρωμένη φόρμα Cashdro:
//  1. καθάρισμα κειμένου email
//  2. ανάγνωση ΜΟΝΟ των πεδίων της φόρμας (κώδικας, χωρίς AI —
//     ό,τι γράφεται εκτός φόρμας, π.χ. στην υπογραφή, αγνοείται)
//  3. έλεγχος υποχρεωτικών πεδίων
//  4. δημιουργία / ενημέρωση ticket στο Sheet
//  5. αν λείπει κάτι → ειδοποίηση σε ΕΜΑΣ (όχι στο κατάστημα)

import { findTicketByThread, createTicket, saveTicket, getStores } from './sheets';

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

export const REQUIRED_KEYS = FORM_FIELDS.filter(f => f.required).map(f => f.key);

// Πότε ένα email θεωρείται ότι περιέχει τη φόρμα Cashdro:
// τουλάχιστον τόσα πεδία της φόρμας + οπωσδήποτε το "Περιγραφή προβλήματος".
// Έτσι emails χωρίς φόρμα (π.χ. πινακάκια εξαρτημάτων, απαντήσεις "οκ") δεν γίνονται tickets.
const MIN_FORM_FIELDS = 4;

export function looksLikeForm(form) {
  const found = FORM_FIELDS.filter(f => Object.prototype.hasOwnProperty.call(form, f.key)).length;
  return found >= MIN_FORM_FIELDS && Object.prototype.hasOwnProperty.call(form, 'problem');
}
const ALL_KEYS = FORM_FIELDS.map(f => f.key);

// ── 1. Καθάρισμα email ─────────────────────────────
// Κόβει το παλιό quoted κείμενο ("On ... wrote:", "Στις ... έγραψε:", "> ...")
// Το Gmail μετατρέπει διευθύνσεις/τηλέφωνα/emails σε links και στο απλό κείμενο
// τα γράφει ως "κείμενο <https://...>" — τα αφαιρούμε (το link μπορεί να σπάει σε 2 γραμμές)
export function stripAutoLinks(text = '') {
  return String(text)
    .replace(/[ \t]*<\s*(?:https?:\/\/|mailto:|tel:)[^>]*>/gi, '')
    .replace(/\[\s*(?:https?:\/\/|mailto:|tel:)[^\]]*\]/gi, '');
}

export function cleanEmailBody(body = '') {
  const lines = stripAutoLinks(String(body).replace(/\r\n/g, '\n')).split('\n');
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

// Πού τελειώνει η φόρμα και αρχίζει υπογραφή / χαιρετισμός
const SIGNATURE_RE = /^(--+|__+|με (εκτιμηση|τιμη|φιλικους χαιρετισμους)|ευχαριστω|ευχαριστουμε|φιλικα|χαιρετισμους|καλη συνεχεια|regards|best regards|kind regards|thanks|thank you|sent from|απεσταλη απο)/;
const LAST_KEY = FORM_FIELDS[FORM_FIELDS.length - 1].key;

export function parseForm(text) {
  const out = {};
  let current = null;
  let blankSince = false; // κενή γραμμή μετά την τελευταία ετικέτα/τιμή
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim().replace(/^\|+|\|+$/g, '').trim();
    if (!line) { blankSince = true; continue; }

    const hit = matchLabel(line);
    if (hit) {
      current = hit.key;
      blankSince = false;
      if (!out[current]) out[current] = hit.value;
      continue;
    }
    if (!current) continue;
    // Υπογραφή / χαιρετισμός → τέλος φόρμας
    if (SIGNATURE_RE.test(normName(line).toLowerCase())) { current = null; continue; }

    if (!out[current]) {
      // Τιμή στην επόμενη γραμμή. Για το τελευταίο πεδίο, μετά από κενή γραμμή
      // θεωρούμε ότι η φόρμα τελείωσε (ό,τι ακολουθεί είναι υπογραφή).
      if (current === LAST_KEY && blankSince) { current = null; continue; }
      out[current] = line;
    } else if (MULTILINE.has(current) && !blankSince) {
      out[current] += `\n${line}`;      // συνέχεια κειμένου, μέχρι την πρώτη κενή γραμμή
    } else {
      current = null;                    // τέλος του πεδίου
    }
    blankSince = false;
  }
  return out;
}

// ── 3. Έλεγχος πεδίων (κώδικας) ────────────────────
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
  address:      v => normalizeText(v, 150).replace(/\n+/g, ', ').replace(/[\s,;.]+$/, ''),
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

// ── 5. Ειδοποίηση σε εμάς ──────────────────────────
const APP_URL = 'https://trackmate-lake.vercel.app';

const esc = v => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildNotification(ticket, missingKeys) {
  const labelOf = k => FORM_FIELDS.find(f => f.key === k)?.label || k;
  const link = `${APP_URL}/?tab=tickets&ticket=${encodeURIComponent(ticket.ticketId)}`;
  const missingLabels = missingKeys.map(labelOf);
  const subject = `Ελλιπές ticket ${ticket.ticketId}${ticket.store ? ` · ${ticket.store}` : ''}`;

  // ── Απλό κείμενο (για προγράμματα που δεν δείχνουν HTML) ──
  const textRows = FORM_FIELDS.map(f => {
    const v = ticket[f.key];
    const shown = v ? String(v).replace(/\n+/g, ' ') : (missingKeys.includes(f.key) ? '[ΛΕΙΠΕΙ]' : '-');
    return `  ${f.label}: ${shown}`;
  }).join('\n');
  const body = `Ελλιπές ticket ${ticket.ticketId}
${ticket.store || ''}

Λείπουν: ${missingLabels.join(', ')}

Στοιχεία φόρμας
${textRows}

Από: ${ticket.from || '-'}
Θέμα email: ${ticket.subject || '-'}

Άνοιγμα στο TrackMate:
${link}

Στο κατάστημα δεν στάλθηκε κανένα μήνυμα.`;

  // ── HTML ──
  const C = { text: '#1f2133', sub: '#6b6f8a', line: '#e7e5f2', acc: '#7c3aed', amber: '#b45309', amberBg: '#fff7ed', amberLine: '#fed7aa', bg: '#f4f3f9' };
  const row = f => {
    const v = ticket[f.key];
    const isMissing = !v && missingKeys.includes(f.key);
    const value = v
      ? esc(v).replace(/\n/g, '<br>')
      : isMissing
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${C.amberBg};border:1px solid ${C.amberLine};color:${C.amber};font-size:12px;font-weight:700;">Λείπει</span>`
        : `<span style="color:#b3b6c9;">—</span>`;
    return `<tr>
      <td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.sub};font-size:13px;width:42%;vertical-align:top;">${esc(f.label)}${f.required ? '' : ' <span style="color:#b3b6c9;">(προαιρ.)</span>'}</td>
      <td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.text};font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`;
  };

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid ${C.line};overflow:hidden;">
      <tr><td style="padding:18px 24px;border-bottom:1px solid ${C.line};">
        <span style="font-size:15px;font-weight:800;color:${C.text};">Track<span style="color:${C.acc};">Mate</span></span>
        <span style="float:right;font-size:12px;color:${C.sub};padding-top:2px;">Tickets</span>
      </td></tr>

      <tr><td style="padding:22px 24px 6px;">
        <div style="font-family:Consolas,Menlo,monospace;font-size:13px;font-weight:700;color:${C.acc};">${esc(ticket.ticketId)}</div>
        <div style="font-size:21px;font-weight:800;color:${C.text};margin-top:4px;">${esc(ticket.store || 'Χωρίς υποκατάστημα')}</div>
        <div style="font-size:13px;color:${C.sub};margin-top:4px;">Νέα φόρμα από ${esc(ticket.from || '—')}</div>
      </td></tr>

      <tr><td style="padding:14px 24px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.amberBg};border:1px solid ${C.amberLine};border-radius:10px;">
          <tr><td style="padding:12px 14px;color:${C.amber};font-size:14px;">
            <strong>Λείπουν ${missingKeys.length === 1 ? 'ένα στοιχείο' : `${missingKeys.length} στοιχεία`}:</strong> ${missingLabels.map(esc).join(', ')}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:14px 24px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${FORM_FIELDS.map(row).join('')}
        </table>
      </td></tr>

      <tr><td align="center" style="padding:22px 24px 8px;">
        <a href="${link}" style="display:inline-block;padding:12px 26px;border-radius:10px;background:${C.acc};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Άνοιγμα στο TrackMate</a>
      </td></tr>

      <tr><td style="padding:14px 24px 22px;font-size:12px;color:${C.sub};text-align:center;">
        Θέμα email: ${esc(ticket.subject || '—')}<br>
        Στο κατάστημα δεν στάλθηκε κανένα μήνυμα.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  // ── Απλό HTML: μόνο πίνακας, χωρίς κουμπί/εικόνες/βαριά μορφοποίηση ──
  // (για φίλτρα όπως του Microsoft 365 που μπλοκάρουν "διαφημιστικά" emails)
  const tableRows = FORM_FIELDS.map(f => {
    const v = ticket[f.key];
    const missing = !v && missingKeys.includes(f.key);
    const cell = v ? esc(v).replace(/\n/g, '<br>') : missing ? '<b style="color:#b91c1c;">ΛΕΙΠΕΙ</b>' : '-';
    return `<tr><td style="padding:6px 10px;border:1px solid #d0d0d0;background:#f6f6f6;">${esc(f.label)}</td><td style="padding:6px 10px;border:1px solid #d0d0d0;">${cell}</td></tr>`;
  }).join('');
  const htmlTable = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
<p><b>Ελλιπές ticket ${esc(ticket.ticketId)}</b>${ticket.store ? ` - ${esc(ticket.store)}` : ''}</p>
<p>Λείπουν: <b>${missingLabels.map(esc).join(', ')}</b></p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${tableRows}</table>
<p>Από: ${esc(ticket.from || '-')}<br>Θέμα email: ${esc(ticket.subject || '-')}</p>
<p>Στο TrackMate: ${esc(link)}</p>
</div>`;

  // ── Ίδια εμφάνιση με το html, αλλά χωρίς το κουμπί (το link ως απλό κείμενο) ──
  const BUTTON_RE = /<a href="[^"]*" style="display:inline-block;[^"]*">Άνοιγμα στο TrackMate<\/a>/;
  const htmlNoButton = html.replace(BUTTON_RE,
    `<span style="font-size:13px;color:${C.sub};">Στο TrackMate: ${esc(link)}</span>`);

  return { subject, body, html, htmlTable, htmlNoButton };
}

// ── Κύρια ροή ──────────────────────────────────────
// Δείγμα ειδοποίησης (για δοκιμή μορφής από το Gmail script — δεν αποθηκεύει τίποτα)
export function sampleNotification() {
  const ticket = {
    ticketId: 'TM-TEST', store: 'ΔΟΚΙΜΗ ΚΑΤΑΣΤΗΜΑ', address: 'Οδός Δοκιμής 1', postalCode: '',
    contactName: 'Δοκιμαστικός Χρήστης', contactPhone: '', problem: 'Δοκιμαστικό πρόβλημα',
    serialNumber: 'CD7-000000', ip: '', courier: '', storeRemarks: '',
    from: 'test@example.gr', subject: 'Δοκιμή ειδοποίησης',
  };
  return buildNotification(ticket, ['postalCode', 'contactPhone']);
}

export async function processInboundEmail({ threadId, messageId, from, chain, subject, body }) {
  const existing = await findTicketByThread(threadId);

  // Το ίδιο μήνυμα ξανά (το script δεν ολοκλήρωσε, π.χ. απέτυχε η ειδοποίηση):
  // δεν αλλάζουμε το ticket, ξαναστέλνουμε μόνο την ειδοποίηση αν χρειάζεται
  if (existing && messageId && existing.lastMessageId === messageId) {
    const keys = (existing.missing || '').split(',').map(x => x.trim()).filter(Boolean);
    return { ticket: existing, duplicate: true, notify: keys.length ? buildNotification(existing, keys) : null };
  }

  const cleaned = cleanEmailBody(body);

  // 2. Μόνο τα πεδία της φόρμας
  const form = parseForm(cleaned);

  // Χωρίς φόρμα Cashdro → δεν είναι αίτημα (π.χ. πινακάκι εξαρτημάτων): κανένα ticket, καμία ειδοποίηση
  if (!looksLikeForm(form)) {
    return { skipped: true, reason: 'no_form' };
  }
  const fields = {};
  for (const k of ALL_KEYS) fields[k] = NORMALIZERS[k](form[k]);
  fields.model = existing?.model || 'CashDro';

  // Υποκατάστημα → όνομα όπως στο TrackMate
  if (fields.store) fields.store = await resolveStore(fields.store, chain);

  // Κρατάμε τα στοιχεία προηγούμενων μηνυμάτων του ίδιου ticket όπου λείπουν τώρα
  for (const k of ALL_KEYS) if (!fields[k] && existing?.[k]) fields[k] = existing[k];

  // 3. Τι λείπει
  const missingKeys = REQUIRED_KEYS.filter(k => !fields[k]);

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

  // 4. Αποθήκευση
  const ticket = existing
    ? await saveTicket({ ...existing, ...base, updatedBy: 'email' })
    : await createTicket({ ...base, notes: '', updatedBy: 'email' });

  // 5. Ειδοποίηση μόνο σε εμάς, μόνο αν λείπει κάτι
  return { ticket, notify: missingKeys.length ? buildNotification(ticket, missingKeys) : null };
}
