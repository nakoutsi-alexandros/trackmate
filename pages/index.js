import { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';



const ACTION_CATEGORIES = [
  {
    id: 'new',
    icon: '🆕',
    label: 'Καινούριο Μηχάνημα',
    desc: 'Διαθέσιμο για αποστολή',
    direct: true,
    value: 'Καινούριο Μηχάνημα',
  },
  {
    id: 'repair-in',
    icon: '🔧',
    label: 'Εισαγωγή για επισκευή',
    desc: 'Προς έλεγχο/επισκευή',
    direct: true,
    value: 'Εισαγωγή για επισκευή',
  },
  {
    id: 'send-hq',
    icon: '✈️',
    label: 'Αποστολή στα κεντρικά',
    desc: 'Προς κεντρική αποθήκη',
    direct: true,
    value: 'Αποστολή στα κεντρικά',
  },
  {
    id: 'send-store',
    icon: '🏪',
    label: 'Αποστολή σε κατάστημα',
    desc: 'Έξοδος προς κατάστημα',
    direct: true,
    value: 'Αποστολή σε κατάστημα',
  },
];

const STATUS_COLOR = {
  'Καινούριο Μηχάνημα': '#5B8DEF',
  'Εισαγωγή για επισκευή': '#BA7517',
  'Αποστολή σε κατάστημα': '#1D9E75',
  'Αποστολή στα κεντρικά': '#9B59B6',
};

const LEGACY_ACTION_LABELS = {
  'Νέα εισαγωγή': 'Καινούριο Μηχάνημα',
  'Εισαγωγή στην αποθήκη': 'Καινούριο Μηχάνημα',
  'Σε επισκευή': 'Εισαγωγή για επισκευή',
  'Επισκευάστηκε': 'Καινούριο Μηχάνημα',
};

const normalizeAction = (action) => LEGACY_ACTION_LABELS[action] || action;

const STORE_CHAINS = [
  { id: 'all', label: 'Όλα' },
  { id: 'ΚΩΤΣΟΒΟΛΟΣ', label: 'ΚΩΤΣΟΒΟΛΟΣ' },
  { id: 'MINI KIOSK', label: 'MINI KIOSK' },
  { id: 'ΚΤΕΛ', label: 'ΚΤΕΛ' },
  { id: 'THE BEAUTY BAR', label: 'BEAUTY BAR' },
  { id: 'ΡΟΥΠΑΣ', label: 'ΡΟΥΠΑΣ' },
  { id: 'other', label: 'Άλλα' },
];

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('scan');
  const [step, setStep] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [action, setAction] = useState('');
  const [actionCat, setActionCat] = useState(null);
  const [store, setStore] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeChain, setStoreChain] = useState('all');
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [problem, setProblem] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [history, setHistory] = useState(null);
  const [historySerial, setHistorySerial] = useState('');
  const [historyStore, setHistoryStore] = useState('');
  const [filterAction, setFilterAction] = useState('Όλα');
  const [sortOrder, setSortOrder] = useState('desc');

  const parseGreekTimestamp = (ts) => {
    if (!ts) return 0;
    try {
      const [datePart, timePart] = ts.split(', ');
      const [day, month, year] = datePart.split('/').map(Number);
      const parts = timePart.split(' ');
      const meridiem = parts[1] || '';
      let [hours, minutes, seconds] = parts[0].split(':').map(Number);
      if (meridiem.includes('μ.μ') && hours !== 12) hours += 12;
      if (meridiem.includes('π.μ') && hours === 12) hours = 0;
      return new Date(year, month - 1, day, hours, minutes, seconds || 0).getTime();
    } catch { return 0; }
  };

  const sortItems = (items) => [...items].sort((a, b) => {
    const ta = parseGreekTimestamp(a.timestamp) || 0;
    const tb = parseGreekTimestamp(b.timestamp) || 0;
    // Αν δεν έχει timestamp, χρησιμοποιούμε index (reverse)
    if (ta === 0 && tb === 0) return 0;
    return sortOrder === 'desc' ? tb - ta : ta - tb;
  });
  const [storesList, setStoresList] = useState([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  const [addStoreMsg, setAddStoreMsg] = useState(null);
  const fileRef = useRef();
  const cameraRef = useRef();

  // Φόρτωση καταστημάτων από Sheet
  const loadStores = async () => {
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      setStoresList(data.stores || []);
    } catch (e) {}
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    setAddingStore(true);
    setAddStoreMsg(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoreName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddStoreMsg({ type: 'error', text: data.error });
      } else {
        setAddStoreMsg({ type: 'success', text: 'Το κατάστημα προστέθηκε!' });
        setNewStoreName('');
        loadStores();
      }
    } catch (e) {
      setAddStoreMsg({ type: 'error', text: 'Σφάλμα δικτύου.' });
    } finally {
      setAddingStore(false);
    }
  };

  // Φόρτωση συνδεδεμένου χρήστη και καταστημάτων
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCurrentUser(data.user); })
      .catch(() => {});

    loadStores();
    loadInventory();

    // Καταχώρηση Service Worker για αυτόματο update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
      }).catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const handleImage = useCallback((file) => {
    if (!file) return;
    setImageMime('image/jpeg');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setImagePreview(compressed);
        setImageBase64(compressed.split(',')[1]);
        setScanError(null);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleImage(e.dataTransfer.files[0]);
  }, [handleImage]);

  const handleScan = async () => {
    if (!imageBase64) return;
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const data = await res.json();

      // Validation error — δείξε μήνυμα, μείνε στο step 1
      if (res.status === 422) {
        setScanError(data.message || 'Δεν ήταν δυνατή η αναγνώριση.');
        setScanning(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Σφάλμα');

      setSerialNumber(data.serialNumber !== 'unknown' ? data.serialNumber : '');
      setModel(data.model !== 'unknown' ? data.model : '');
      setScanError(null);
      setStep(2);
    } catch (e) {
      setScanError('Σφάλμα επικοινωνίας. Δοκίμασε ξανά.');
    } finally {
      setScanning(false);
    }
  };

  const handleSkipScan = () => {
    setSerialNumber(''); setModel('');
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!serialNumber) { alert('Βάλε Serial Number!'); return; }
    if (!action) { alert('Επίλεξε τύπο κίνησης!'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, model, action, store, date, problem, notes }),
      });
      if (!res.ok) throw new Error();
      setStep(3);
    } catch (e) {
      alert('Σφάλμα καταγραφής. Δοκίμασε ξανά.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1); setImagePreview(null); setImageBase64(null);
    setSerialNumber(''); setModel(''); setScanError(null);
    setAction(''); setActionCat(null);
    setStore(''); setStoreSearch(''); setStoreChain('all'); setShowStorePicker(false);
    setDate(new Date().toISOString().split('T')[0]);
    setProblem(''); setNotes('');
  };

  const loadInventory = async () => {
    setLoadingInv(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (e) { alert('Σφάλμα φόρτωσης.'); }
    finally { setLoadingInv(false); }
  };

  const loadHistory = async (serial, store) => {
    setHistorySerial(serial || '');
    setHistoryStore(store || '');
    try {
      const params = new URLSearchParams();
      if (serial) params.set('serial', serial);
      if (store) params.set('store', store);
      const res = await fetch(`/api/inventory?${params.toString()}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) { alert('Σφάλμα φόρτωσης ιστορικού.'); }
  };

  const filtered = sortItems(filterAction === 'Όλα' ? inventory : inventory.filter(i => normalizeAction(i.action) === filterAction));
  const warehouseItems = sortItems(inventory.filter(i => ['Καινούριο Μηχάνημα', 'Εισαγωγή για επισκευή'].includes(normalizeAction(i.action))));

  const STATUS_PILL = {
    'Καινούριο Μηχάνημα':      { label: 'Διαθέσιμο',        cls: 'pill-blue'   },
    'Εισαγωγή για επισκευή':   { label: 'Επισκευή',         cls: 'pill-amber'  },
    'Αποστολή σε κατάστημα':   { label: 'Κατάστημα',        cls: 'pill-green'  },
    'Αποστολή στα κεντρικά':   { label: 'Κεντρικά',         cls: 'pill-purple' },
  };

  const FILTERS = ['Όλα','Καινούριο Μηχάνημα','Εισαγωγή για επισκευή','Αποστολή σε κατάστημα','Αποστολή στα κεντρικά'];

  const NAV_ITEMS = [
    { id: 'scan',      label: 'Scan',       icon: '⊕' },
    { id: 'inventory', label: 'Κινήσεις',   icon: '▦' },
    { id: 'warehouse', label: 'Αποθήκη',    icon: '□' },
    { id: 'history',   label: 'Ιστορικό',   icon: '◷' },
    { id: 'settings',  label: 'Ρυθμίσεις',  icon: '◎' },
  ];

  const handleTabClick = (t) => {
    setTab(t);
    if (t === 'inventory' || t === 'warehouse') loadInventory();
    if (t === 'settings') loadStores();
  };

  // Shared content για κάθε tab
  const tabContent = (
    <>
      {tab === 'scan' && (
        <div className="fade-in">
          {step===1 && (
            <div className="card">
              <div className="card-title">Φωτογράφισε το μηχάνημα</div>
              <div className="card-sub">Ανέβασε φωτογραφία για αυτόματη αναγνώριση serial & model</div>
              <div className="upload-area"
                onDragOver={e=>e.preventDefault()} onDrop={handleDrop}
                onClick={() => fileRef.current.click()}
                style={imagePreview?{padding:'12px'}:{}}>
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="preview-img" />
                  : <><div className="upload-icon">📷</div><div className="upload-title">Πάτα για φωτογραφία ή γκαλερί</div><div className="upload-sub">Τραβάει από κάμερα ή ανεβάζει από γκαλερί</div></>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])} />
              <div className="btn-row">
                <button className="btn-half" onClick={() => cameraRef.current.click()}>📷 Κάμερα</button>
                <button className="btn-half" onClick={() => fileRef.current.click()}>🖼️ Γκαλερί</button>
              </div>
              {scanError && <div className="error-banner" style={{marginTop:'12px'}}>⚠️ {scanError}</div>}
              {imagePreview && <button className="btn-primary" onClick={handleScan} disabled={scanning}>{scanning ? '🔍 Αναγνώριση...' : '🔍 Αναγνώριση serial & model'}</button>}
              <button className="btn-ghost" onClick={handleSkipScan}>✏️ Συμπλήρωσε χειροκίνητα</button>
            </div>
          )}
          {step===2 && (
            <div className="card fade-in">
              {scanError && <div className="error-banner">⚠️ {scanError}</div>}
              {!scanError && imagePreview && <div className="ai-badge">✨ Αναγνωρίστηκε — έλεγξε τα στοιχεία</div>}
              <div className="section-label">Στοιχεία μηχανήματος</div>
              <div className="field-group">
                <label className="field-label">Serial Number *</label>
                <input className="text-input" value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} placeholder="π.χ. A4829301" />
              </div>
              <div className="field-group">
                <label className="field-label">Model</label>
                <input className="text-input" value={model} onChange={e=>setModel(e.target.value)} placeholder="π.χ. Keurig K-Elite" />
              </div>
              <div className="section-label" style={{marginTop:'16px'}}>Τύπος κίνησης</div>
              <div className="action-grid">
                {ACTION_CATEGORIES.map(cat => (
                  <div key={cat.id} className={`action-tile ${actionCat===cat.id?'selected':''}`}
                    onClick={() => { setActionCat(cat.id); if (cat.direct) setAction(cat.value); else setAction(''); }}>
                    <div className="action-icon">{cat.icon}</div>
                    <div className="action-title">{cat.label}</div>
                    <div className="action-sub">{cat.desc}</div>
                  </div>
                ))}
              </div>
              {actionCat && !ACTION_CATEGORIES.find(c=>c.id===actionCat)?.direct && (
                <div className="sub-action-list">
                  {ACTION_CATEGORIES.find(c=>c.id===actionCat)?.subs.map(s => (
                    <div key={s.value} className={`sub-action-item ${action===s.value?'selected':''}`} onClick={() => setAction(s.value)}>
                      <span className="sub-action-icon">{s.icon}</span>
                      <div><div className="sub-action-label">{s.value}</div><div className="sub-action-desc">{s.desc}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {action && <div className="selected-action-badge">✓ {action}</div>}
              <div className="field-group" style={{marginTop:'16px'}}>
                <label className="field-label">🏪 Κατάστημα</label>
                {!showStorePicker ? (
                  <div style={{display:'flex',gap:'8px'}}>
                    <div className="text-input store-display" onClick={()=>setShowStorePicker(true)} style={{cursor:'pointer',color:store?'#1a1a18':'#999'}}>{store || 'Επίλεξε κατάστημα...'}</div>
                    {store && <button className="btn-clear" onClick={()=>setStore('')}>✕</button>}
                  </div>
                ) : (
                  <div className="store-picker">
                    <input className="text-input" placeholder="🔍 Αναζήτηση..." value={storeSearch} onChange={e=>{setStoreSearch(e.target.value);setStoreChain('all');}} autoFocus />
                    <div className="chain-tabs">
                      {STORE_CHAINS.map(c => <button key={c.id} className={`chain-tab ${storeChain===c.id?'active':''}`} onClick={()=>{setStoreChain(c.id);setStoreSearch('');}}>{c.label}</button>)}
                    </div>
                    <div className="store-list">
                      {storesList.filter(s => {
                        const mc = storeChain==='all'?true:storeChain==='other'?!['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c=>s.startsWith(c)):s.startsWith(storeChain);
                        return mc && (storeSearch===''||s.toLowerCase().includes(storeSearch.toLowerCase()));
                      }).map(s => <div key={s} className={`store-item ${store===s?'active':''}`} onClick={()=>{setStore(s);setShowStorePicker(false);setStoreSearch('');setStoreChain('all');}}>{s}</div>)}
                    </div>
                    <button className="btn-ghost" style={{marginTop:'8px'}} onClick={()=>setShowStorePicker(false)}>Άκυρο</button>
                  </div>
                )}
              </div>
              <div className="field-group">
                <label className="field-label">📅 Ημερομηνία</label>
                <input className="text-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">🔧 Πρόβλημα</label>
                <input className="text-input" value={problem} onChange={e=>setProblem(e.target.value)} placeholder="π.χ. Χαλασμένη οθόνη, δεν ανάβει..." />
              </div>
              <div className="field-group">
                <label className="field-label">📝 Σημειώσεις</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Οποιαδήποτε επιπλέον πληροφορία..." />
              </div>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '⏳ Καταχώριση...' : '✅ Καταχώριση κίνησης'}</button>
              <button className="btn-ghost" onClick={handleReset}>← Πίσω</button>
            </div>
          )}
          {step===3 && (
            <div className="card fade-in success-card">
              <div className="success-icon">✅</div>
              <div className="success-title">Καταχωρήθηκε!</div>
              <div className="success-sub"><strong>{model || 'Μηχάνημα'}</strong> · {serialNumber}<br/>🏪 {store}<br/>{action}{problem ? ` · 🔧 ${problem}` : ''}</div>
              <button className="btn-primary" onClick={handleReset}>📷 Νέο scan</button>
            </div>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="fade-in">
          {/* Desktop: table view */}
          <div className="desktop-only">
            <div className="inv-stats">
              <div className="stat-card"><div className="stat-label">Σύνολο</div><div className="stat-val">{inventory.length}</div><div className="stat-sub">μηχανήματα</div></div>
              <div className="stat-card"><div className="stat-label">Σε επισκευή</div><div className="stat-val">{inventory.filter(i=>normalizeAction(i.action)==='Εισαγωγή για επισκευή').length}</div><div className="stat-sub">ενεργές</div></div>
              <div className="stat-card"><div className="stat-label">Αποθήκη</div><div className="stat-val">{warehouseItems.length}</div><div className="stat-sub">διαθέσιμα</div></div>
              <div className="stat-card"><div className="stat-label">Σε κατάστημα</div><div className="stat-val">{inventory.filter(i=>normalizeAction(i.action)==='Αποστολή σε κατάστημα').length}</div><div className="stat-sub">τοποθετημένα</div></div>
            </div>
            <div className="filter-row">
              {FILTERS.map(f => <button key={f} className={`filter-pill ${filterAction===f?'active':''}`} onClick={()=>setFilterAction(f)}>{f}</button>)}
              <button className="sort-btn" onClick={()=>setSortOrder(s=>s==='desc'?'asc':'desc')}>{sortOrder==='desc'?'↓ Νεότερα':'↑ Παλαιότερα'}</button>
            </div>
            {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
            {!loadingInv && filtered.length > 0 && (
              <div className="dt-table">
                <div className="dt-head">
                  <div className="dt-th">Model / Serial</div>
                  <div className="dt-th">Κατάστημα</div>
                  <div className="dt-th">Κατάσταση</div>
                  <div className="dt-th">Ημερομηνία</div>
                  <div className="dt-th">Χρήστης</div>
                </div>
                {filtered.map((item, i) => (
                  <div key={i} className="dt-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                    <div className="dt-td">
                      <span className="dt-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                      <div><div className="dt-model">{item.model || '—'}</div><div className="dt-serial">{item.serialNumber}</div></div>
                    </div>
                    <div className="dt-td dt-muted">{item.store || '—'}</div>
                    <div className="dt-td"><span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span></div>
                    <div className="dt-td dt-muted">{item.date}</div>
                    <div className="dt-td dt-muted">{item.user || '—'}</div>
                  </div>
                ))}
              </div>
            )}
            {!loadingInv && filtered.length === 0 && <div className="empty">Δεν βρέθηκαν εγγραφές.</div>}
          </div>
          {/* Mobile: card view */}
          <div className="mobile-only">
            <div className="filter-row">
              {FILTERS.map(f => <button key={f} className={`filter-pill ${filterAction===f?'active':''}`} onClick={()=>setFilterAction(f)}>{f}</button>)}
              <button className="sort-btn" onClick={()=>setSortOrder(s=>s==='desc'?'asc':'desc')}>{sortOrder==='desc'?'↓ Νεότερα':'↑ Παλαιότερα'}</button>
            </div>
            {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
            {!loadingInv && filtered.length === 0 && <div className="empty">Δεν βρέθηκαν εγγραφές.<br/>Κάνε ένα scan πρώτα!</div>}
            {filtered.map((item, i) => (
              <div key={i} className="machine-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                <div className="machine-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                <div className="machine-info">
                  <div className="machine-name-row">
                    <div className="machine-name">{item.model || 'Άγνωστο model'}</div>
                    <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                  </div>
                  <div className="machine-serial">{item.serialNumber}</div>
                  <div className="machine-bottom">
                    <span className="machine-store">🏪 {item.store || '—'}</span>
                    <span className="machine-date">📅 {item.date}</span>
                  </div>
                  {item.problem && <div className="machine-problem">🔧 {item.problem}</div>}
                  {item.user && <div className="machine-user">👤 {item.user}</div>}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
        </div>
      )}

      {tab === 'warehouse' && (
        <div className="fade-in">
          <div className="inv-stats">
            <div className="stat-card"><div className="stat-label">Σύνολο αποθήκης</div><div className="stat-val">{warehouseItems.length}</div><div className="stat-sub">μηχανήματα</div></div>
            <div className="stat-card"><div className="stat-label">Καινούρια</div><div className="stat-val">{inventory.filter(i=>normalizeAction(i.action)==='Καινούριο Μηχάνημα').length}</div><div className="stat-sub">έτοιμα για αποστολή</div></div>
            <div className="stat-card"><div className="stat-label">Σε επισκευή</div><div className="stat-val">{inventory.filter(i=>normalizeAction(i.action)==='Εισαγωγή για επισκευή').length}</div><div className="stat-sub">στην αποθήκη</div></div>
            <div className="stat-card"><div className="stat-label">Αποσταλμένα</div><div className="stat-val">{inventory.filter(i=>['Αποστολή σε κατάστημα','Αποστολή στα κεντρικά'].includes(normalizeAction(i.action))).length}</div><div className="stat-sub">έχουν φύγει</div></div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
            <button className="sort-btn" onClick={()=>setSortOrder(s=>s==='desc'?'asc':'desc')}>{sortOrder==='desc'?'↓ Νεότερα':'↑ Παλαιότερα'}</button>
          </div>
          {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
          {!loadingInv && warehouseItems.length === 0 && <div className="empty">Δεν υπάρχουν διαθέσιμα μηχανήματα στην αποθήκη.</div>}
          {!loadingInv && warehouseItems.length > 0 && (
            <div className="dt-table desktop-only">
              <div className="dt-head">
                <div className="dt-th">Model / Serial</div>
                <div className="dt-th">Τελευταίο κατάστημα</div>
                <div className="dt-th">Κατάσταση</div>
                <div className="dt-th">Ημερομηνία</div>
                <div className="dt-th">Χρήστης</div>
              </div>
              {warehouseItems.map((item, i) => (
                <div key={i} className="dt-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                  <div className="dt-td">
                    <span className="dt-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                    <div><div className="dt-model">{item.model || '—'}</div><div className="dt-serial">{item.serialNumber}</div></div>
                  </div>
                  <div className="dt-td dt-muted">{item.store || '—'}</div>
                  <div className="dt-td"><span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span></div>
                  <div className="dt-td dt-muted">{item.date}</div>
                  <div className="dt-td dt-muted">{item.user || '—'}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mobile-only">
            {warehouseItems.map((item, i) => (
              <div key={i} className="machine-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                <div className="machine-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                <div className="machine-info">
                  <div className="machine-name-row">
                    <div className="machine-name">{item.model || 'Άγνωστο model'}</div>
                    <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                  </div>
                  <div className="machine-serial">{item.serialNumber}</div>
                  <div className="machine-bottom">
                    <span className="machine-store">🏪 {item.store || '—'}</span>
                    <span className="machine-date">📅 {item.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
        </div>
      )}

      {tab === 'history' && (
        <div className="fade-in">
          <div className="field-group">
            <label className="field-label">Αναζήτηση με Serial Number</label>
            <div style={{display:'flex',gap:'8px'}}>
              <input className="text-input" value={historySerial} onChange={e=>setHistorySerial(e.target.value)} placeholder="π.χ. A4829301" />
              <button className="btn-search" onClick={()=>loadHistory(historySerial, '')}>Αναζήτηση</button>
            </div>
          </div>
          <div className="divider-or">ή</div>
          <div className="field-group">
            <label className="field-label">Αναζήτηση με Κατάστημα</label>
            <div style={{display:'flex',gap:'8px'}}>
              <div className="text-input store-display" style={{cursor:'pointer',color:historyStore?'#1a1a18':'#999',flex:1}} onClick={()=>setShowStorePicker('history')}>{historyStore || 'Επίλεξε κατάστημα...'}</div>
              {historyStore && <button className="btn-clear" onClick={()=>setHistoryStore('')}>✕</button>}
              <button className="btn-search" onClick={()=>loadHistory('', historyStore)}>Αναζήτηση</button>
            </div>
            {showStorePicker === 'history' && (
              <div className="store-picker" style={{marginTop:'8px'}}>
                <input className="text-input" placeholder="🔍 Αναζήτηση..." value={storeSearch} onChange={e=>{setStoreSearch(e.target.value);setStoreChain('all');}} autoFocus />
                <div className="chain-tabs">
                  {STORE_CHAINS.map(c => <button key={c.id} className={`chain-tab ${storeChain===c.id?'active':''}`} onClick={()=>{setStoreChain(c.id);setStoreSearch('');}}>{c.label}</button>)}
                </div>
                <div className="store-list">
                  {storesList.filter(s => {
                    const mc = storeChain==='all'?true:storeChain==='other'?!['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c=>s.startsWith(c)):s.startsWith(storeChain);
                    return mc && (storeSearch===''||s.toLowerCase().includes(storeSearch.toLowerCase()));
                  }).map(s => <div key={s} className={`store-item ${historyStore===s?'active':''}`} onClick={()=>{setHistoryStore(s);setShowStorePicker(false);setStoreSearch('');setStoreChain('all');}}>{s}</div>)}
                </div>
                <button className="btn-ghost" style={{marginTop:'8px'}} onClick={()=>setShowStorePicker(false)}>Άκυρο</button>
              </div>
            )}
          </div>
          {history === null && <div className="empty">Γράψε serial number για να δεις το ιστορικό.</div>}
          {history && history.length === 0 && <div className="empty">Δεν βρέθηκε ιστορικό.</div>}
          {history && history.map((item, i) => (
            <div key={i} className="history-item">
              <div className="h-dot-wrap">
                <div className="h-dot" style={{borderColor:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                {i < history.length-1 && <div className="h-line" />}
              </div>
              <div className="h-card">
                <div className="h-action-row">
                  <div className="h-action">{normalizeAction(item.action)}</div>
                  <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                </div>
                <div className="h-meta">🏪 {item.store} · 📅 {item.date}{item.user ? ` · 👤 ${item.user}` : ''}</div>
                {item.problem && <div className="h-notes">🔧 {item.problem}</div>}
                {item.notes && <div className="h-notes">📝 {item.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div className="fade-in">
          <div className="card">
            <div className="card-title">Ρυθμίσεις</div>
            <div className="card-sub">Διαχείριση καταστημάτων</div>
            <div className="section-label">Προσθήκη νέου καταστήματος</div>
            <div className="field-group">
              <input className="text-input" value={newStoreName} onChange={e=>{setNewStoreName(e.target.value);setAddStoreMsg(null);}} placeholder="π.χ. ΚΩΤΣΟΒΟΛΟΣ 999 Νέα Πόλη" onKeyDown={e=>{if(e.key==='Enter')handleAddStore();}} />
            </div>
            {addStoreMsg && <div className={addStoreMsg.type==='success'?'banner-success':'error-banner'} style={{marginBottom:'12px'}}>{addStoreMsg.type==='success'?'✅ ':'⚠️ '}{addStoreMsg.text}</div>}
            <button className="btn-primary" onClick={handleAddStore} disabled={addingStore||!newStoreName.trim()}>{addingStore?'⏳ Προσθήκη...':'➕ Προσθήκη καταστήματος'}</button>
          </div>
          <div className="card">
            <div className="section-label">Λίστα καταστημάτων ({storesList.length})</div>
            <div style={{maxHeight:'300px',overflowY:'auto',marginTop:'8px'}}>
              {storesList.map((s,i) => <div key={i} className="settings-store-item">{s}</div>)}
            </div>
            <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadStores}>🔄 Ανανέωση</button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <Head>
        <title>TrackMate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a1a18" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TrackMate" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className="desktop-layout">
        <aside className="sidebar">
          <div className="sb-logo" onClick={()=>{setTab('scan');handleReset();}} style={{cursor:'pointer'}}>
            Track<span>Mate</span>
          </div>
          <nav className="sb-nav">
            <div className="sb-section">Κύριο μενού</div>
            {NAV_ITEMS.filter(n => n.id !== 'settings').map(n => (
              <button key={n.id} className={`sb-item ${tab===n.id?'active':''}`} onClick={()=>handleTabClick(n.id)}>
                <span className="sb-icon">{n.icon}</span>{n.label}
              </button>
            ))}
            <div className="sb-section" style={{marginTop:'12px'}}>Διαχείριση</div>
            <button className={`sb-item ${tab==='settings'?'active':''}`} onClick={()=>handleTabClick('settings')}>
              <span className="sb-icon">⚙️</span>Ρυθμίσεις
            </button>
          </nav>
          {currentUser && (
            <div className="sb-footer">
              <div className="sb-avatar">{currentUser.fullName.slice(0,2).toUpperCase()}</div>
              <div className="sb-username">{currentUser.fullName}</div>
              <button className="sb-logout" onClick={handleLogout} title="Αποσύνδεση">↩</button>
            </div>
          )}
        </aside>
        <div className="desktop-main">
          <div className="desktop-header">
            <div className="desktop-title">
              {tab==='scan'?'Scan':tab==='inventory'?'Κινήσεις':tab==='warehouse'?'Αποθήκη':tab==='history'?'Ιστορικό':'Ρυθμίσεις'}
            </div>
            {(tab==='inventory' || tab==='warehouse') && (
              <div className="desktop-header-actions">
                {tab==='inventory' && ['Όλα','Επισκευή'].map(f => (
                  <button key={f} className={`filter-pill ${filterAction===(f==='Επισκευή'?'Εισαγωγή για επισκευή':f)?'active':''}`}
                    onClick={()=>setFilterAction(f==='Επισκευή'?'Εισαγωγή για επισκευή':'Όλα')}>
                    {f}
                  </button>
                ))}
                <button className="btn-new" onClick={()=>handleTabClick('scan')}>+ Νέα καταχώρηση</button>
              </div>
            )}
          </div>
          <div className="desktop-content">
            {tabContent}
          </div>
        </div>
      </div>

      {/* ─── MOBILE LAYOUT ─── */}
      <div className="mobile-layout">
        <header className="mob-header">
          <div className="mob-header-top">
            <div className="logo" onClick={()=>{setTab('scan');handleReset();}} style={{cursor:'pointer'}}>Track<span>Mate</span></div>
            {currentUser && (
              <div className="user-area">
                <span className="user-name">{currentUser.fullName}</span>
                <button className="btn-logout" onClick={handleLogout}>↩</button>
              </div>
            )}
          </div>
          <nav className="mob-nav">
            {NAV_ITEMS.map(n => (
              <button key={n.id} className={`mob-nav-btn ${tab===n.id?'active':''}`} onClick={()=>handleTabClick(n.id)}>
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </header>
        <main className="mob-main">
          {tabContent}
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #000000; color: #1a1a18; min-height: 100vh; }

        /* ─── RESPONSIVE VISIBILITY ─── */
        .desktop-layout { display: none; }
        .mobile-layout  { display: flex; flex-direction: column; min-height: 100vh; }
        .desktop-only   { display: none; }
        .mobile-only    { display: block; }
        @media (min-width: 768px) {
          .desktop-layout { display: flex; height: 100vh; overflow: hidden; }
          .mobile-layout  { display: none; }
          .desktop-only   { display: block; }
          .mobile-only    { display: none; }
        }

        /* ─── DESKTOP SIDEBAR ─── */
        .sidebar { width: 200px; flex-shrink: 0; background: #1a1a18; border-right: none; display: flex; flex-direction: column; }
        .sb-logo { padding: 20px 18px 16px; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: -0.2px; border-bottom: 1px solid #2d2d2b; }
        .sb-logo span { color: #6b6b68; font-weight: 400; }
        .sb-nav { flex: 1; padding: 8px; }
        .sb-section { font-size: 10px; font-weight: 500; color: #4b4b48; padding: 10px 10px 4px; letter-spacing: 0.08em; text-transform: uppercase; }
        .sb-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px; border-radius: 7px; border: none; background: transparent; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #8a8a86; cursor: pointer; transition: all 0.1s; margin-bottom: 1px; text-align: left; }
        .sb-item:hover { background: #2d2d2b; color: #fff; }
        .sb-item.active { background: #2d2d2b; color: #fff; font-weight: 500; }
        .sb-icon { font-size: 13px; width: 16px; text-align: center; }
        .sb-footer { padding: 12px 10px; border-top: 1px solid #2d2d2b; display: flex; align-items: center; gap: 8px; }
        .sb-avatar { width: 26px; height: 26px; border-radius: 50%; background: #2d2d2b; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #8a8a86; flex-shrink: 0; }
        .sb-username { flex: 1; font-size: 12px; color: #8a8a86; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-logout { background: none; border: none; cursor: pointer; font-size: 13px; color: #4b4b48; padding: 2px 4px; transition: color 0.1s; }
        .sb-logout:hover { color: #ef4444; }

        /* ─── DESKTOP MAIN ─── */
        .desktop-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #d2d4ce; }
        .desktop-header { padding: 14px 24px 12px; background: #e4e5df; border-bottom: 1px solid #c7c9c0; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .desktop-title { font-size: 15px; font-weight: 600; color: #1a1a18; flex-shrink: 0; }
        .desktop-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .btn-new { padding: 6px 14px; background: #fff; color: #1a1a18; border: 1px solid #d1d5db; border-radius: 7px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 500; transition: all 0.1s; }
        .btn-new:hover { background: #f7f7f5; }
        .desktop-content { flex: 1; overflow-y: auto; padding: 20px 24px; }

        /* ─── DESKTOP TABLE ─── */
        .inv-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin-bottom: 14px; }
        .stat-card { background: #fff; border: 1px solid #ebebea; border-radius: 8px; padding: 14px 16px; }
        .stat-label { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
        .stat-val { font-size: 28px; font-weight: 600; color: #1a1a18; line-height: 1; }
        .stat-sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }
        .dt-table { background: #fff; border: 1px solid #ebebea; border-radius: 10px; overflow: hidden; }
        .dt-head { display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr; background: #fafaf9; border-bottom: 1px solid #ebebea; }
        .dt-th { font-size: 10px; font-weight: 500; color: #9ca3af; padding: 8px 14px; text-transform: uppercase; letter-spacing: 0.06em; }
        .dt-row { display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr; border-bottom: 1px solid #f4f4f2; cursor: pointer; transition: background 0.1s; }
        .dt-row:last-child { border-bottom: none; }
        .dt-row:hover { background: #fafaf9; }
        .dt-td { font-size: 12px; color: #1a1a18; padding: 10px 14px; display: flex; align-items: center; gap: 7px; }
        .dt-td.dt-muted { color: #6b7280; font-size: 12px; }
        .dt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dt-model { font-size: 12px; font-weight: 500; }
        .dt-serial { font-family: 'DM Mono', monospace; font-size: 10px; color: #9ca3af; margin-top: 1px; }

        /* ─── STATUS PILLS ─── */
        .status-pill { font-size: 11px; padding: 3px 10px; border-radius: 6px; font-weight: 500; white-space: nowrap; }
        .pill-green  { background: #22c55e; color: #fff; }
        .pill-amber  { background: #f59e0b; color: #fff; }
        .pill-gray   { background: #e5e7eb; color: #6b7280; }
        .pill-blue   { background: #3b82f6; color: #fff; }
        .pill-purple { background: #fff; color: #1a1a18; border: 1px solid #d1d5db; }

        /* ─── MOBILE HEADER ─── */
        .mob-header { background: #1a1a18; border-bottom: none; position: sticky; top: 0; z-index: 10; }
        .mob-header-top { padding: 12px 16px 10px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 15px; font-weight: 600; color: #fff; letter-spacing: -0.2px; }
        .logo span { color: #6b6b68; font-weight: 400; }
        .user-area { display: flex; align-items: center; gap: 8px; }
        .user-name { font-size: 12px; color: #8a8a86; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-logout { background: none; border: 1px solid #2d2d2b; border-radius: 7px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #8a8a86; transition: all 0.1s; font-family: 'DM Sans', sans-serif; }
        .btn-logout:hover { border-color: #ef4444; color: #ef4444; }
        .mob-nav { display: flex; padding: 0 12px 10px; gap: 2px; }
        .mob-nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border-radius: 8px; border: none; background: transparent; font-size: 11px; font-family: 'DM Sans', sans-serif; cursor: pointer; color: #6b6b68; transition: all 0.1s; }
        .mob-nav-btn span:first-child { font-size: 15px; }
        .mob-nav-btn.active { color: #fff; background: #2d2d2b; }
        .mob-main { flex: 1; padding: 14px 16px; background: #f7f7f5; }

        /* ─── DATE INPUT FIX ─── */
        input[type="date"].text-input { width: 100%; max-width: 100%; min-width: 0; appearance: none; -webkit-appearance: none; }

        /* ─── SHARED COMPONENTS ─── */
        .card { background: #f7f7f4; border: 1px solid #c4c6bd; border-radius: 12px; padding: 16px; margin-bottom: 10px; box-shadow: 0 12px 28px rgba(26, 26, 24, 0.08); }
        .card-title { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
        .card-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; }
        .upload-area { border: 1.5px dashed #b8bab2; border-radius: 10px; padding: 32px 20px; text-align: center; cursor: pointer; transition: all 0.12s; background: #fbfbf9; }
        .upload-area:hover { border-color: #85887e; background: #f1f2ee; }
        .upload-icon { font-size: 26px; margin-bottom: 8px; }
        .upload-title { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
        .upload-sub { font-size: 12px; color: #9ca3af; }
        .preview-img { width: 100%; border-radius: 8px; max-height: 240px; object-fit: contain; }
        .btn-primary { width: 100%; padding: 11px; background: #1a1a18; color: #fff; border: none; border-radius: 9px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 10px; transition: opacity 0.1s; display: block; letter-spacing: -0.1px; }
        .btn-primary:hover { opacity: 0.8; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { width: 100%; padding: 10px; background: transparent; color: #6b7280; border: 1px solid #ebebea; border-radius: 9px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 8px; display: block; transition: all 0.1s; }
        .btn-ghost:hover { border-color: #9ca3af; color: #1a1a18; }
        .btn-search { padding: 9px 14px; background: #1a1a18; color: #fff; border: none; border-radius: 9px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; transition: opacity 0.1s; }
        .btn-search:hover { opacity: 0.8; }
        .ai-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; background: #f0fdf4; color: #166534; padding: 4px 10px; border-radius: 20px; margin-bottom: 12px; font-weight: 500; border: 1px solid #dcfce7; }
        .error-banner { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #9a3412; margin-bottom: 12px; }
        .banner-success { background: #f0fdf4; color: #166534; padding: 10px 12px; border-radius: 8px; font-size: 12px; margin-bottom: 12px; border: 1px solid #dcfce7; }
        .section-label { font-size: 10px; font-weight: 500; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 8px; }
        .action-tile { background: #fafaf9; border: 1px solid #ebebea; border-radius: 10px; padding: 11px; cursor: pointer; transition: all 0.1s; }
        .action-tile:hover { border-color: #9ca3af; }
        .action-tile.selected { border-color: #1a1a18; background: #f7f7f5; }
        .action-icon { font-size: 16px; margin-bottom: 5px; }
        .action-title { font-size: 12px; font-weight: 500; }
        .action-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
        .sub-action-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; animation: fadeIn 0.12s ease; }
        .sub-action-item { display: flex; align-items: center; gap: 9px; padding: 9px 11px; border: 1px solid #ebebea; border-radius: 9px; cursor: pointer; transition: all 0.1s; background: #fff; }
        .sub-action-item:hover { border-color: #9ca3af; }
        .sub-action-item.selected { border-color: #1a1a18; background: #f7f7f5; }
        .sub-action-icon { font-size: 14px; width: 20px; text-align: center; flex-shrink: 0; }
        .sub-action-label { font-size: 12px; font-weight: 500; }
        .sub-action-desc { font-size: 11px; color: #9ca3af; margin-top: 1px; }
        .selected-action-badge { display: inline-flex; align-items: center; gap: 5px; background: #f7f7f5; color: #1a1a18; font-size: 11px; font-weight: 500; padding: 4px 10px; border-radius: 20px; margin-bottom: 4px; border: 1px solid #ebebea; }
        .store-display { display: flex; align-items: center; min-height: 38px; flex: 1; }
        .btn-clear { padding: 7px 11px; border: 1px solid #ebebea; border-radius: 9px; background: #fff; color: #9ca3af; cursor: pointer; font-size: 12px; flex-shrink: 0; }
        .store-picker { border: 1px solid #ebebea; border-radius: 10px; padding: 10px; background: #fafaf9; }
        .chain-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 6px 0; scrollbar-width: none; }
        .chain-tabs::-webkit-scrollbar { display: none; }
        .chain-tab { flex-shrink: 0; padding: 3px 9px; border-radius: 20px; border: 1px solid #ebebea; font-size: 11px; cursor: pointer; background: #fff; color: #6b7280; transition: all 0.1s; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .chain-tab.active { background: #1a1a18; color: #fff; border-color: #1a1a18; }
        .store-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; margin-top: 4px; }
        .store-item { padding: 7px 9px; border-radius: 7px; font-size: 12px; cursor: pointer; color: #1a1a18; transition: background 0.1s; }
        .store-item:hover { background: #f4f4f2; }
        .store-item.active { background: #f4f4f2; font-weight: 500; }
        .field-group { margin-bottom: 10px; }
        .field-label { font-size: 11px; color: #6b7280; display: block; margin-bottom: 5px; font-weight: 500; }
        select, textarea, .text-input { width: 100%; padding: 9px 11px; border-radius: 9px; border: 1px solid #ebebea; background: #fafaf9; font-size: 13px; color: #1a1a18; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.1s; }
        select:focus, textarea:focus, .text-input:focus { border-color: #9ca3af; background: #fff; }
        textarea { resize: none; height: 68px; }
        .success-card { text-align: center; padding: 36px 20px; }
        .success-icon { font-size: 40px; margin-bottom: 10px; }
        .success-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
        .success-sub { font-size: 13px; color: #6b7280; line-height: 1.8; margin-bottom: 18px; }
        .filter-row { display: flex; gap: 5px; margin-bottom: 12px; flex-wrap: wrap; }
        .filter-pill { padding: 4px 10px; border-radius: 6px; border: 1px solid #ebebea; background: #fff; font-size: 11px; cursor: pointer; color: #6b7280; font-family: 'DM Sans', sans-serif; transition: all 0.1s; }
        .filter-pill:hover { border-color: #9ca3af; color: #1a1a18; }
        .filter-pill.active { background: #1a1a18; color: #fff; border-color: #1a1a18; }
        .machine-row { background: #fff; border: 1px solid #ebebea; border-radius: 10px; padding: 11px 13px; margin-bottom: 6px; display: flex; align-items: flex-start; gap: 9px; cursor: pointer; transition: border-color 0.1s; }
        .machine-row:hover { border-color: #9ca3af; }
        .machine-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .machine-info { flex: 1; min-width: 0; }
        .machine-name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
        .machine-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .machine-serial { font-family: 'DM Mono', monospace; font-size: 10px; color: #9ca3af; }
        .machine-bottom { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
        .machine-store { font-size: 11px; color: #6b7280; }
        .machine-date { font-size: 11px; color: #9ca3af; }
        .machine-problem { font-size: 11px; color: #92400e; margin-top: 2px; }
        .machine-user { font-size: 11px; color: #166534; margin-top: 2px; }
        .history-item { display: flex; gap: 10px; margin-bottom: 10px; }
        .h-dot-wrap { display: flex; flex-direction: column; align-items: center; }
        .h-dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #1a1a18; background: #fff; flex-shrink: 0; margin-top: 4px; }
        .h-line { width: 1px; flex: 1; background: #ebebea; margin-top: 3px; min-height: 18px; }
        .h-card { flex: 1; background: #fff; border: 1px solid #ebebea; border-radius: 9px; padding: 9px 11px; }
        .h-action-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
        .h-action { font-size: 12px; font-weight: 500; }
        .h-meta { font-size: 11px; color: #9ca3af; }
        .h-notes { font-size: 11px; color: #6b7280; margin-top: 3px; }
        .loading { text-align: center; padding: 40px; color: #9ca3af; font-size: 13px; }
        .empty { text-align: center; padding: 36px 20px; color: #9ca3af; font-size: 13px; line-height: 1.6; }
        .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 10px; }
        .btn-half { padding: 9px; background: #fff; color: #1a1a18; border: 1px solid #ebebea; border-radius: 9px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: border-color 0.1s; }
        .btn-half:hover { border-color: #9ca3af; }
        .settings-store-item { padding: 7px 4px; font-size: 12px; color: #6b7280; border-bottom: 1px solid #f7f7f5; }
        .divider-or { text-align: center; color: #c4c4c2; font-size: 11px; margin: 8px 0; position: relative; }
        .divider-or::before, .divider-or::after { content: ''; position: absolute; top: 50%; width: 44%; height: 1px; background: #ebebea; }
        .divider-or::before { left: 0; } .divider-or::after { right: 0; }
        .sort-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #ebebea; background: #fff; font-size: 11px; cursor: pointer; color: #6b7280; font-family: 'DM Sans', sans-serif; transition: all 0.1s; white-space: nowrap; }
        .sort-btn:hover { border-color: #1a1a18; color: #1a1a18; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.18s ease; }
        @media (max-width: 767px) {
          .inv-stats { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
          .stat-card { padding: 12px; }
          .stat-val { font-size: 24px; }
        }
      `}</style>
    </>
  );
}
