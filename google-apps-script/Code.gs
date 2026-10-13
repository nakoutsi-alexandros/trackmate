/**
 * TrackMate — Gmail → Tickets
 *
 * Τρέχει κάθε 5 λεπτά μέσα στο Gmail λογαριασμό των tickets:
 *  1. βρίσκει τα αδιάβαστα emails
 *  2. κρατάει μόνο όσα έρχονται από τα καταστήματα της λίστας STORES
 *  3. τα στέλνει στο TrackMate (/api/tickets/inbound)
 *  4. αν λείπουν στοιχεία από τη φόρμα, στέλνει ειδοποίηση σε ΕΜΑΣ (NOTIFY_EMAIL)
 *     — στο κατάστημα δεν στέλνεται ποτέ τίποτα
 *
 * Εγκατάσταση: δες τα βήματα στο README ή στη συνομιλία.
 */

// ── ΡΥΘΜΙΣΕΙΣ ─────────────────────────────────────────────
const TRACKMATE_URL = 'https://trackmate-lake.vercel.app/api/tickets/inbound';

// Πού έρχεται η ειδοποίηση όταν λείπουν στοιχεία.
// Ένα email:   'alex@etairia.gr'
// Πολλά email: 'alex@etairia.gr,maria@etairia.gr'   (κόμμα, χωρίς κενά)
// Για έλεγχο: τρέξε τη συνάρτηση testNotify — στέλνει δοκιμαστικό email εδώ.
const NOTIFY_EMAIL = 'to-email-sas@example.gr';

// false = απλό κείμενο (περνάει τα φίλτρα του Outlook/Microsoft 365)
// true  = μορφοποιημένο email με κουμπί (μόνο αν ο διαχειριστής έχει επιτρέψει τον αποστολέα)
const NOTIFY_HTML = false;

// Whitelist 1 — συγκεκριμένα emails που επιτρέπεται να στέλνουν φόρμα.
// Αρκεί το email· το όνομα δίπλα είναι προαιρετικό (μπορεί να μείνει '').
// Το υποκατάστημα διαβάζεται πάντα από τη φόρμα.
const STORES = {
  'katastima@example.gr': 'ΟΝΟΜΑ ΚΑΤΑΣΤΗΜΑΤΟΣ',
};

// Whitelist 2 — ολόκληρα domains αλυσίδων: domain → όνομα αλυσίδας (όπως είναι στο TrackMate)
// Δέχεται ΟΠΟΙΟΔΗΠΟΤΕ email του domain. Αν το υποκατάστημα φαίνεται στο κείμενο ή
// στη φόρμα, το TrackMate το ταιριάζει με τα καταστήματα της αλυσίδας.
// Δέχεται και ολόκληρη διεύθυνση (π.χ. για δοκιμή: 'to-email-mou@gmail.com': 'ΑΛΥΣΙΔΑ').
const DOMAINS = {
  // 'johndoe.gr': 'ΑΛΥΣΙΔΑ',
};

// Λατινικά ονόματα: το Gmail κάποιες φορές δεν βρίσκει υπο-ετικέτες με ελληνικά
const LABEL_DONE    = 'TrackMate-Tickets';
const LABEL_IGNORED = 'TrackMate-Ignored';
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // ανά εικόνα
const MAX_IMAGES = 2;
// ──────────────────────────────────────────────────────────


/** Τρέξε το ΜΙΑ φορά: φτιάχνει μυστικό κλειδί + χρονοδιακόπτη 5 λεπτών. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TRACKMATE_SECRET');
  if (!secret) {
    secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('TRACKMATE_SECRET', secret);
  }

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(5).create();

  getOrCreateLabel_(LABEL_DONE);
  getOrCreateLabel_(LABEL_IGNORED);

  Logger.log('✅ Έτοιμο. Βάλε στο Vercel το env TICKETS_INBOUND_SECRET με τιμή:');
  Logger.log(secret);
}


/** Κύρια λειτουργία — την τρέχει ο χρονοδιακόπτης. */
function processInbox() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // τρέχει ήδη άλλη εκτέλεση

  try {
    const secret = PropertiesService.getScriptProperties().getProperty('TRACKMATE_SECRET');
    if (!secret) throw new Error('Λείπει το μυστικό κλειδί — τρέξε πρώτα το setup().');

    const me = Session.getEffectiveUser().getEmail().toLowerCase();
    const whitelist = {};
    Object.keys(STORES).forEach(k => { whitelist[k.trim().toLowerCase()] = STORES[k]; });
    const domainList = {};
    Object.keys(DOMAINS).forEach(k => { domainList[k.trim().toLowerCase().replace(/^@/, '')] = DOMAINS[k]; });

    const threads = GmailApp.search('in:inbox is:unread newer_than:7d', 0, 30);

    threads.forEach(thread => {
      const messages = thread.getMessages();
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg.isUnread()) continue;

        let step = 'ανάγνωση αποστολέα';
        try {
          const fromEmail = extractEmail_(msg.getFrom());

          // Δικά μας μηνύματα ή αυτόματα (auto-reply, noreply, bounce) → χωρίς απάντηση
          step = 'έλεγχος αυτόματου μηνύματος';
          if (fromEmail === me || isAutomated_(msg, fromEmail)) {
            msg.markRead();
            continue;
          }

          // Μετράει μόνο αν το email/domain ΥΠΑΡΧΕΙ στη λίστα — όχι αν έχει όνομα δίπλα
          const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
          const domain = fromEmail.split('@')[1] || '';
          const byEmail = has(whitelist, fromEmail);
          const domainKey = has(domainList, fromEmail) ? fromEmail : (has(domainList, domain) ? domain : null);
          const store = byEmail ? (whitelist[fromEmail] || '') : '';
          const chain = !byEmail && domainKey ? (domainList[domainKey] || '') : '';
          if (!byEmail && !domainKey) {
            // Όχι από κατάστημα της λίστας → καμία απάντηση, μόνο ετικέτα
            step = 'σήμανση αγνοημένου';
            msg.markRead();
            addLabelSafe_(thread, LABEL_IGNORED);
            continue;
          }

          step = 'αποστολή στο TrackMate';
          const ok = sendToTrackMate_(msg, thread, fromEmail, store, chain, secret);
          if (!ok) break; // αφήνουμε αδιάβαστο για να ξαναδοκιμάσει σε 5 λεπτά
          addLabelSafe_(thread, LABEL_DONE);
        } catch (e) {
          Logger.log('Σφάλμα (' + step + ') στο "' + msg.getSubject() + '": ' + e);
          break; // μένει αδιάβαστο, νέα προσπάθεια στην επόμενη εκτέλεση
        }
      }
    });
  } finally {
    lock.releaseLock();
  }
}


function sendToTrackMate_(msg, thread, fromEmail, store, chain, secret) {
  const payload = {
    threadId: thread.getId(),
    messageId: msg.getId(),
    from: fromEmail,
    fromName: extractName_(msg.getFrom()),
    store: store,
    chain: chain,
    subject: msg.getSubject(),
    body: msg.getPlainBody(),
    images: collectImages_(msg),
  };

  const res = UrlFetchApp.fetch(TRACKMATE_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-trackmate-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code !== 200) {
    Logger.log('TrackMate απάντησε ' + code + ': ' + res.getContentText().slice(0, 300));
    return false;
  }

  const data = JSON.parse(res.getContentText());
  if (!data.notify) {
    Logger.log('Ticket ' + data.ticketId + ': όλα τα στοιχεία υπάρχουν — δεν χρειάζεται ειδοποίηση');
  } else if (!notifyConfigured_()) {
    Logger.log('⚠️ Ticket ' + data.ticketId + ' ελλιπές, αλλά ΔΕΝ στάλθηκε ειδοποίηση: συμπλήρωσε σωστά το NOTIFY_EMAIL στην κορυφή του script');
  } else {
    try {
      sendNotify_(data.notify);
      Logger.log('✉️ Ειδοποίηση για ' + data.ticketId + ' στάλθηκε σε: ' + notifyList_());
    } catch (e) {
      Logger.log('Αποτυχία ειδοποίησης για ' + data.ticketId + ': ' + e + ' — νέα προσπάθεια σε 5 λεπτά');
      return false; // μένει αδιάβαστο → το TrackMate θα ξαναδώσει την ίδια ειδοποίηση
    }
  }
  msg.markRead();
  Logger.log('Ticket ' + data.ticketId + ' → ' + data.status + (data.missing ? ' (λείπουν: ' + data.missing + ')' : ''));
  return true;
}


function collectImages_(msg) {
  const out = [];
  const atts = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
  for (let i = 0; i < atts.length && out.length < MAX_IMAGES; i++) {
    const a = atts[i];
    const type = (a.getContentType() || '').toLowerCase();
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(type) === -1) continue;
    if (a.getSize() > MAX_IMAGE_BYTES) continue;
    out.push({ mimeType: type, data: Utilities.base64Encode(a.getBytes()) });
  }
  return out;
}


function isAutomated_(msg, fromEmail) {
  if (/(no-?reply|mailer-daemon|postmaster)/i.test(fromEmail)) return true;
  const header = name => {
    try { return String(msg.getHeader(name) || '').toLowerCase(); } catch (e) { return ''; }
  };
  const auto = header('Auto-Submitted');
  if (auto && auto !== 'no') return true;
  if (['bulk', 'list', 'junk', 'auto_reply'].indexOf(header('Precedence')) !== -1) return true;
  if (header('X-Autoreply') || header('X-Autorespond')) return true;
  return false;
}


/** Τρέξε το για να δοκιμάσεις ότι οι ειδοποιήσεις φτάνουν. */
function testNotify() {
  if (!notifyConfigured_()) {
    Logger.log('⚠️ Το NOTIFY_EMAIL δεν είναι σωστό: "' + NOTIFY_EMAIL + '". Βάλε το email σας στην κορυφή του script.');
    return;
  }
  GmailApp.sendEmail(notifyList_(), 'TrackMate: δοκιμαστική ειδοποίηση',
    'Αν βλέπεις αυτό το email, οι ειδοποιήσεις για ελλιπή tickets λειτουργούν.', { name: 'TrackMate' });
  Logger.log('✉️ Στάλθηκε δοκιμαστικό email σε: ' + notifyList_() + ' (κοίτα και στα Ανεπιθύμητα)');
}

/** Στέλνει μια ειδοποίηση ίδια με αυτή ενός πραγματικού ελλιπούς ticket (για δοκιμή). */
function testNotifyTicket() {
  if (!notifyConfigured_()) {
    Logger.log('⚠️ Το NOTIFY_EMAIL δεν είναι σωστό: "' + NOTIFY_EMAIL + '".');
    return;
  }
  sendNotify_({
    subject: 'Ελλιπές ticket TM-TEST · ΔΟΚΙΜΗ',
    body: 'Ελλιπές ticket TM-TEST\nΔΟΚΙΜΗ\n\nΛείπουν: Τηλέφωνο επικοινωνίας\n\nΣτοιχεία φόρμας\n  Υποκατάστημα: ΔΟΚΙΜΗ\n  Τηλέφωνο επικοινωνίας: [ΛΕΙΠΕΙ]\n\n' +
          'Άνοιγμα στο TrackMate:\nhttps://trackmate-lake.vercel.app/?tab=tickets\n\nΑυτό είναι δοκιμαστικό μήνυμα.',
    html: '<p><b>Ελλιπές ticket TM-TEST</b></p><p>Αυτό είναι δοκιμαστικό μήνυμα.</p>',
  });
  Logger.log('✉️ Στάλθηκε δοκιμαστική ειδοποίηση ticket (' + (NOTIFY_HTML ? 'HTML' : 'απλό κείμενο') + ') σε: ' + notifyList_());
}

function sendNotify_(notify) {
  const opts = { name: 'TrackMate' };
  if (NOTIFY_HTML && notify.html) opts.htmlBody = notify.html;
  GmailApp.sendEmail(notifyList_(), notify.subject, notify.body, opts);
}

function notifyList_() {
  return String(NOTIFY_EMAIL || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean).join(',');
}

function notifyConfigured_() {
  const list = notifyList_();
  if (!list || /example\./i.test(list)) return false;
  return list.split(',').every(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}


function extractName_(from) {
  const m = String(from || '').match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : '';
}


function extractEmail_(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}


function getOrCreateLabel_(name) {
  const found = GmailApp.getUserLabels().filter(l => l.getName() === name)[0];
  return found || GmailApp.createLabel(name);
}

// Οι ετικέτες είναι μόνο για ευκολία· ένα σφάλμα εδώ δεν σταματά τίποτα
function addLabelSafe_(thread, name) {
  try {
    thread.addLabel(getOrCreateLabel_(name));
  } catch (e) {
    Logger.log('Δεν μπήκε η ετικέτα ' + name + ': ' + e);
  }
}
