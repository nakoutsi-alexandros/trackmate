/**
 * TrackMate — Gmail → Tickets
 *
 * Τρέχει κάθε 5 λεπτά μέσα στο Gmail λογαριασμό των tickets:
 *  1. βρίσκει τα αδιάβαστα emails
 *  2. κρατάει μόνο όσα έρχονται από τα καταστήματα της λίστας STORES
 *  3. τα στέλνει στο TrackMate (/api/tickets/inbound)
 *  4. απαντάει στο ίδιο thread με το κείμενο που επιστρέφει το TrackMate
 *
 * Εγκατάσταση: δες τα βήματα στο README ή στη συνομιλία.
 */

// ── ΡΥΘΜΙΣΕΙΣ ─────────────────────────────────────────────
const TRACKMATE_URL = 'https://trackmate-lake.vercel.app/api/tickets/inbound';

// Whitelist: email καταστήματος → όνομα καταστήματος (όπως είναι στο TrackMate)
const STORES = {
  'katastima@example.gr': 'ΟΝΟΜΑ ΚΑΤΑΣΤΗΜΑΤΟΣ',
};

const LABEL_DONE    = 'TrackMate';
const LABEL_IGNORED = 'TrackMate/Αγνοήθηκε';
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

    const doneLabel = getOrCreateLabel_(LABEL_DONE);
    const ignoredLabel = getOrCreateLabel_(LABEL_IGNORED);
    const threads = GmailApp.search('in:inbox is:unread newer_than:7d', 0, 30);

    threads.forEach(thread => {
      const messages = thread.getMessages();
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg.isUnread()) continue;

        const fromEmail = extractEmail_(msg.getFrom());

        // Δικά μας μηνύματα ή αυτόματα (auto-reply, noreply, bounce) → χωρίς απάντηση
        if (fromEmail === me || isAutomated_(msg, fromEmail)) {
          msg.markRead();
          continue;
        }

        const store = whitelist[fromEmail];
        if (!store) {
          // Όχι από κατάστημα της λίστας → καμία απάντηση, μόνο ετικέτα
          msg.markRead();
          thread.addLabel(ignoredLabel);
          continue;
        }

        const ok = sendToTrackMate_(msg, thread, fromEmail, store, secret);
        if (!ok) break; // αφήνουμε αδιάβαστο για να ξαναδοκιμάσει σε 5 λεπτά
        thread.addLabel(doneLabel);
      }
    });
  } finally {
    lock.releaseLock();
  }
}


function sendToTrackMate_(msg, thread, fromEmail, store, secret) {
  const payload = {
    threadId: thread.getId(),
    messageId: msg.getId(),
    from: fromEmail,
    store: store,
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
  if (data.shouldReply && data.reply) {
    msg.reply(data.reply);
  }
  msg.markRead();
  Logger.log('Ticket ' + data.ticketId + ' → ' + data.status);
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
  const auto = (msg.getHeader('Auto-Submitted') || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  const prec = (msg.getHeader('Precedence') || '').toLowerCase();
  if (['bulk', 'list', 'junk', 'auto_reply'].indexOf(prec) !== -1) return true;
  if (msg.getHeader('X-Autoreply') || msg.getHeader('X-Autorespond')) return true;
  return false;
}


function extractEmail_(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}


function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
