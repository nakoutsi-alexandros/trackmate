// pages/request.js
// Δημόσια φόρμα αιτήματος τεχνικής υποστήριξης Cashdro για τα καταστήματα.
// Ανοίγει χωρίς login, μόνο με το link που έχει το σωστό κλειδί (?k=...).
// Προαιρετικά ?s=ΟΝΟΜΑ ΚΑΤΑΣΤΗΜΑΤΟΣ για προσυμπλήρωση.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const SAVED_KEY = 'trackmate_request_contact';
const CONTACT_FIELDS = ['store', 'address', 'postalCode', 'contactName', 'contactPhone', 'email'];
const EMPTY = { store: '', address: '', postalCode: '', contactName: '', contactPhone: '', email: '', problem: '', serialNumber: '', ip: '', courier: '', storeRemarks: '', website: '' };

const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export default function RequestPage() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [linkState, setLinkState] = useState('checking'); // checking | ok | invalid
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // ticketId
  const [showExtra, setShowExtra] = useState(false);
  const openedAt = useRef(Date.now());
  const formRef = useRef(null);

  useEffect(() => {
    if (!router.isReady) return;
    const k = String(router.query.k || '');
    const s = String(router.query.s || '');
    setKey(k);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') || {}; } catch (e) {}
    setForm(f => {
      const next = { ...f };
      for (const c of CONTACT_FIELDS) if (saved[c]) next[c] = saved[c];
      // Link για συγκεκριμένο κατάστημα: υπερισχύει της αποθηκευμένης επιλογής
      if (s && norm(s) !== norm(saved.store)) { next.store = s; next.address = ''; next.postalCode = ''; }
      return next;
    });
    if (!k) { setLinkState('invalid'); return; }
    fetch(`/api/tickets/request?k=${encodeURIComponent(k)}`, { cache: 'no-store' })
      .then(async r => {
        if (r.status === 403) { setLinkState('invalid'); return; }
        const d = await r.json().catch(() => ({}));
        setStores(Array.isArray(d.stores) ? d.stores : []);
        setLinkState('ok');
      })
      .catch(() => setLinkState('ok'));
  }, [router.isReady]);

  const storeMatch = useMemo(() => stores.find(s => norm(s.name) === norm(form.store)), [stores, form.store]);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Επιλογή καταστήματος από τη λίστα → συμπλήρωση διεύθυνσης αν είναι κενή
      if (k === 'store') {
        const m = stores.find(s => norm(s.name) === norm(v));
        if (m && m.address && !f.address) next.address = m.address;
      }
      return next;
    });
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const REQUIRED = {
    store: 'Επιλέξτε ή γράψτε το κατάστημα.',
    address: 'Γράψτε τη διεύθυνση του καταστήματος.',
    postalCode: 'Γράψτε τον Τ.Κ.',
    contactName: 'Γράψτε ονοματεπώνυμο.',
    contactPhone: 'Γράψτε τηλέφωνο επικοινωνίας.',
    problem: 'Περιγράψτε το πρόβλημα.',
  };

  const focusFirstError = (errs) => {
    const first = Object.keys(REQUIRED).concat(['ip']).find(k => errs[k]);
    if (!first) return;
    if (first === 'ip') setShowExtra(true);
    setTimeout(() => {
      const el = formRef.current?.querySelector(`[name="${first}"]`);
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }, 30);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errs = {};
    for (const [k, msg] of Object.entries(REQUIRED)) if (!form[k].trim()) errs[k] = msg;
    if (Object.keys(errs).length) { setErrors(errs); focusFirstError(errs); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tickets/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, k: key, t: openedAt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.errors) { setErrors(data.errors); focusFirstError(data.errors); return; }
      if (res.status === 403) { setLinkState('invalid'); return; }
      if (!res.ok) { setFormError(data.error || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.'); return; }
      try {
        const saved = Object.fromEntries(CONTACT_FIELDS.map(c => [c, form[c]]));
        localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
      } catch (e2) {}
      setDone(data.ticketId || '✓');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFormError('Δεν υπάρχει σύνδεση. Ελέγξτε το ίντερνετ και δοκιμάστε ξανά.');
    } finally {
      setSubmitting(false);
    }
  };

  const newRequest = () => {
    setForm(f => ({ ...EMPTY, ...Object.fromEntries(CONTACT_FIELDS.map(c => [c, f[c]])) }));
    setErrors({});
    setDone(null);
    setShowExtra(false);
    openedAt.current = Date.now();
  };

  const field = (k, label, props = {}) => (
    <div className={`f${errors[k] ? ' has-err' : ''}`}>
      <label htmlFor={k}>{label}{REQUIRED[k] && <span className="req" aria-hidden="true"> *</span>}</label>
      {props.multiline
        ? <textarea id={k} name={k} value={form[k]} onChange={e => set(k, e.target.value)} rows={props.rows || 4} placeholder={props.placeholder || ''} aria-invalid={!!errors[k]} />
        : <input id={k} name={k} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={props.placeholder || ''}
            type={props.type || 'text'} inputMode={props.inputMode} autoComplete={props.autoComplete || 'off'} list={props.list} aria-invalid={!!errors[k]} />}
      {props.hint && !errors[k] && <div className="hint">{props.hint}</div>}
      {errors[k] && <div className="err" role="alert">{errors[k]}</div>}
    </div>
  );

  return (
    <>
      <Head>
        <title>Αίτημα υποστήριξης Cashdro</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/png" href="/favicon-v2.png" />
      </Head>

      <div className="page">
        <header className="top">
          <img src="/icon-192-v2.png" alt="" className="logo" />
          <div>
            <div className="brand">TrackMate</div>
            <div className="brand-sub">Τεχνική υποστήριξη Cashdro</div>
          </div>
        </header>

        <main className="card">
          {linkState === 'checking' && <div className="state">Φόρτωση…</div>}

          {linkState === 'invalid' && (
            <div className="state">
              <div className="state-icon warn">!</div>
              <h1>Το link δεν είναι έγκυρο</h1>
              <p>Ζητήστε το σωστό link της φόρμας από την τεχνική υποστήριξη.</p>
            </div>
          )}

          {linkState === 'ok' && done && (
            <div className="state">
              <div className="state-icon ok">✓</div>
              <h1>Το αίτημα καταχωρήθηκε</h1>
              {done !== '✓' && <div className="ticket-no">Αριθμός αιτήματος <strong>{done}</strong></div>}
              <p>Θα επικοινωνήσουμε μαζί σας στο <span className="nowrap">{form.contactPhone || 'τηλέφωνο που δώσατε'}</span> το συντομότερο.</p>
              <button className="btn secondary" type="button" onClick={newRequest}>Νέο αίτημα</button>
            </div>
          )}

          {linkState === 'ok' && !done && (
            <form ref={formRef} onSubmit={submit} noValidate>
              <h1>Αίτημα υποστήριξης</h1>
              <p className="lead">Συμπληρώστε τα στοιχεία και θα σας καλέσουμε. Τα πεδία με <span className="req">*</span> είναι υποχρεωτικά.</p>

              <section>
                <h2>Κατάστημα</h2>
                {field('store', 'Υποκατάστημα', { placeholder: stores.length ? 'Αρχίστε να γράφετε για αναζήτηση…' : 'π.χ. ΚΩΤΣΟΒΟΛΟΣ ΓΛΥΦΑΔΑ', list: 'store-list', hint: storeMatch ? '✓ Βρέθηκε στη λίστα καταστημάτων' : undefined })}
                <datalist id="store-list">
                  {stores.map(s => <option key={s.name} value={s.name} />)}
                </datalist>
                <div className="row">
                  <div className="grow">{field('address', 'Διεύθυνση καταστήματος', { placeholder: 'Οδός, αριθμός, περιοχή', autoComplete: 'street-address' })}</div>
                  <div className="narrow">{field('postalCode', 'Τ.Κ.', { placeholder: '16674', inputMode: 'numeric', autoComplete: 'postal-code' })}</div>
                </div>
              </section>

              <section>
                <h2>Υπεύθυνος επικοινωνίας</h2>
                <div className="row">
                  <div className="grow">{field('contactName', 'Ονοματεπώνυμο', { autoComplete: 'name' })}</div>
                  <div className="grow">{field('contactPhone', 'Τηλέφωνο', { type: 'tel', inputMode: 'tel', placeholder: '210 1234567', autoComplete: 'tel' })}</div>
                </div>
                {field('email', 'Email (προαιρετικό)', { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'για να σας στείλουμε ενημέρωση' })}
              </section>

              <section>
                <h2>Πρόβλημα</h2>
                {field('problem', 'Περιγραφή προβλήματος', { multiline: true, rows: 5, placeholder: 'Τι συμβαίνει; Εμφανίζεται κάποιο μήνυμα ή κωδικός σφάλματος;' })}

                <button type="button" className="more" onClick={() => setShowExtra(v => !v)} aria-expanded={showExtra}>
                  {showExtra ? '− ' : '+ '}Επιπλέον στοιχεία (σειριακός, IP, μεταφορική)
                </button>
                {showExtra && (
                  <div className="extra">
                    <div className="row">
                      <div className="grow">{field('serialNumber', 'Σειριακός Cashdro', { placeholder: 'Αν φαίνεται στο μηχάνημα' })}</div>
                      <div className="grow">{field('ip', 'IP Cashdro', { placeholder: 'π.χ. 192.168.1.50', inputMode: 'decimal' })}</div>
                    </div>
                    {field('courier', 'Μεταφορική (σε περίπτωση αποστολής ανταλλακτικού)')}
                    {field('storeRemarks', 'Παρατηρήσεις', { multiline: true, rows: 3, placeholder: 'π.χ. ωράριο καταστήματος, πότε μπορούμε να έρθουμε' })}
                  </div>
                )}
              </section>

              {/* Honeypot για bots — κρυφό για τους ανθρώπους */}
              <div className="hp" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} />
              </div>

              {formError && <div className="form-err" role="alert">{formError}</div>}
              {Object.keys(errors).length > 0 && !formError && <div className="form-err" role="alert">Ελέγξτε τα πεδία με κόκκινο.</div>}

              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Αποστολή…' : 'Αποστολή αιτήματος'}
              </button>
              <p className="fine">Τα στοιχεία επικοινωνίας θυμούνται σε αυτή τη συσκευή για το επόμενο αίτημα.</p>
            </form>
          )}
        </main>
      </div>

      <style jsx global>{`
        :root {
          --bg: #f4f3fa; --card: #ffffff; --text: #17172a; --muted: #5d5d7a; --line: #dddbea;
          --accent: #6d28d9; --accent-2: #5b21b6; --accent-soft: #f1ebff; --err: #c02626; --ok: #047857; --field: #fbfbfe;
        }
        @media (prefers-color-scheme: dark) {
          :root { --bg: #0b0b14; --card: #14141f; --text: #f5f3ff; --muted: #a8add2; --line: #2b2b3d; --accent: #8b5cf6; --accent-2: #a78bfa; --accent-soft: #1f1a33; --err: #f87171; --ok: #34d399; --field: #10101a; }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
        .page { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
        .top { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .logo { width: 40px; height: 40px; border-radius: 10px; }
        .brand { font-weight: 800; font-size: 17px; letter-spacing: -0.3px; }
        .brand-sub { font-size: 13px; color: var(--muted); }
        .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px; box-shadow: 0 1px 2px rgba(20,20,40,.04), 0 8px 24px rgba(20,20,40,.05); }
        h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: -0.4px; }
        .lead { margin: 0 0 8px; color: var(--muted); font-size: 14px; line-height: 1.5; }
        section { padding-top: 18px; margin-top: 18px; border-top: 1px solid var(--line); }
        h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); margin: 0 0 12px; font-weight: 700; }
        .row { display: flex; gap: 12px; }
        .grow { flex: 1; min-width: 0; }
        .narrow { width: 130px; flex-shrink: 0; }
        .f { margin-bottom: 14px; }
        label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
        .req { color: var(--err); }
        input, textarea { width: 100%; font: inherit; font-size: 16px; color: var(--text); background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 11px 12px; outline: none; transition: border-color .15s, box-shadow .15s; }
        textarea { resize: vertical; line-height: 1.45; }
        input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
        .has-err input, .has-err textarea { border-color: var(--err); }
        .err { color: var(--err); font-size: 13px; margin-top: 5px; font-weight: 500; }
        .hint { color: var(--ok); font-size: 13px; margin-top: 5px; font-weight: 500; }
        .more { background: none; border: none; color: var(--accent); font: inherit; font-size: 14px; font-weight: 600; padding: 4px 0; cursor: pointer; }
        .more:hover { text-decoration: underline; }
        .extra { margin-top: 12px; }
        .nowrap { white-space: nowrap; }
        .hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
        .btn { width: 100%; margin-top: 20px; background: var(--accent); color: #fff; border: none; border-radius: 12px; padding: 14px 18px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; transition: background .15s; }
        .btn:hover:not(:disabled) { background: var(--accent-2); }
        .btn:disabled { opacity: .65; cursor: wait; }
        .btn.secondary { width: auto; background: var(--accent-soft); color: var(--accent); padding: 12px 22px; }
        .form-err { margin-top: 16px; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--err) 10%, transparent); color: var(--err); font-size: 14px; font-weight: 600; }
        .fine { margin: 12px 0 0; font-size: 12px; color: var(--muted); text-align: center; }
        .state { text-align: center; padding: 28px 8px; color: var(--muted); }
        .state h1 { color: var(--text); margin-top: 14px; }
        .state p { line-height: 1.5; max-width: 420px; margin: 8px auto 20px; }
        .state-icon { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; }
        .state-icon.ok { background: var(--ok); }
        .state-icon.warn { background: #ea580c; }
        .ticket-no { display: inline-block; margin-top: 4px; padding: 8px 16px; border-radius: 10px; background: var(--accent-soft); color: var(--text); font-size: 15px; }
        .ticket-no strong { color: var(--accent); font-size: 18px; margin-left: 4px; }
        @media (max-width: 560px) {
          .page { padding: 16px 12px 36px; }
          .card { padding: 20px 16px; border-radius: 14px; }
          .row { flex-direction: column; gap: 0; }
          .narrow { width: 100%; }
        }
      `}</style>
    </>
  );
}
