import { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';



const ACTION_CATEGORIES = [
  {
    id: 'new',
    icon: '🆕',
    label: 'Νέα εισαγωγή',
    desc: 'Καινούριο μηχάνημα',
    direct: true,
    value: 'Νέα εισαγωγή',
  },
  {
    id: 'warehouse',
    icon: '📦',
    label: 'Αποθήκη',
    desc: 'Εισαγωγή ή αποστολή',
    subs: [
      { value: 'Εισαγωγή στην αποθήκη', icon: '📥', desc: 'Παραλαβή από κατάστημα' },
      { value: 'Αποστολή σε κατάστημα', icon: '📤', desc: 'Αποστολή από αποθήκη' },
    ],
  },
  {
    id: 'repair',
    icon: '🔧',
    label: 'Επισκευή',
    desc: 'Διάγνωση & επισκευή',
    subs: [
      { value: 'Σε επισκευή', icon: '🔍', desc: 'Δουλεύουμε πάνω' },
      { value: 'Επισκευάστηκε', icon: '✅', desc: 'Έτοιμο για αποστολή' },
    ],
  },
  {
    id: 'send',
    icon: '🚚',
    label: 'Αποστολή',
    desc: 'Σε κατάστημα ή κεντρικά',
    subs: [
      { value: 'Αποστολή σε κατάστημα', icon: '🏪', desc: 'Πίσω στο κατάστημα' },
      { value: 'Αποστολή στα κεντρικά', icon: '✈️', desc: 'Δεν επισκευάστηκε, πάει Ισπανία' },
    ],
  },
];

const STATUS_COLOR = {
  'Νέα εισαγωγή': '#5B8DEF',
  'Εισαγωγή στην αποθήκη': '#888',
  'Αποστολή σε κατάστημα': '#1D9E75',
  'Σε επισκευή': '#BA7517',
  'Επισκευάστηκε': '#1D9E75',
  'Αποστολή στα κεντρικά': '#9B59B6',
};

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

  const filtered = filterAction === 'Όλα' ? inventory : inventory.filter(i => i.action === filterAction);

  return (
    <>
      <Head>
        <title>TrackMate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1D9E75" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TrackMate" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header-top">
            <div className="logo" onClick={()=>{setTab('scan');handleReset();}} style={{cursor:'pointer'}}>Track<span>Mate</span></div>
            {currentUser && (
              <div className="user-area">
                <span className="user-name">👤 {currentUser.fullName}</span>
                <button className="btn-logout" onClick={handleLogout} title="Αποσύνδεση">Έξοδος</button>
              </div>
            )}
          </div>
          <nav className="nav">
            {['scan','inventory','history','settings'].map(t => (
              <button key={t} className={`nav-btn ${tab===t?'active':''}`}
                onClick={() => { setTab(t); if(t==='inventory') loadInventory(); if(t==='settings') loadStores(); }}>
                {t==='scan'?'📷 Scan':t==='inventory'?'📦 Απόθεμα':t==='history'?'🕐 Ιστορικό':'⚙️'}
              </button>
            ))}
          </nav>
        </header>

        <main className="main">
          {tab==='scan' && (
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
                      : <>
                          <div className="upload-icon">📷</div>
                          <div className="upload-title">Πάτα για φωτογραφία ή γκαλερί</div>
                          <div className="upload-sub">Τραβάει από κάμερα ή ανεβάζει από γκαλερί</div>
                        </>
                    }
                  </div>
                  <input ref={fileRef} type="file" accept="image/*"
                    style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                    style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])} />
                  <div className="btn-row">
                    <button className="btn-half" onClick={() => cameraRef.current.click()}>📷 Κάμερα</button>
                    <button className="btn-half" onClick={() => fileRef.current.click()}>🖼️ Γκαλερί</button>
                  </div>
                  {scanError && <div className="error-banner" style={{marginTop:'12px'}}>⚠️ {scanError}</div>}
                  {imagePreview && (
                    <button className="btn-primary" onClick={handleScan} disabled={scanning}>
                      {scanning ? '🔍 Αναγνώριση...' : '🔍 Αναγνώριση serial & model'}
                    </button>
                  )}
                  <button className="btn-ghost" onClick={handleSkipScan}>
                    ✏️ Συμπλήρωσε χειροκίνητα
                  </button>
                </div>
              )}

              {step===2 && (
                <div className="card fade-in">
                  {scanError && <div className="error-banner">⚠️ {scanError}</div>}
                  {!scanError && imagePreview && (
                    <div className="ai-badge">✨ Αναγνωρίστηκε — έλεγξε τα στοιχεία</div>
                  )}

                  <div className="section-label">Στοιχεία μηχανήματος</div>
                  <div className="field-group">
                    <label className="field-label">Serial Number *</label>
                    <input className="text-input" value={serialNumber}
                      onChange={e=>setSerialNumber(e.target.value)}
                      placeholder="π.χ. A4829301" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Model</label>
                    <input className="text-input" value={model}
                      onChange={e=>setModel(e.target.value)}
                      placeholder="π.χ. Keurig K-Elite" />
                  </div>

                  <div className="section-label" style={{marginTop:'16px'}}>Τύπος κίνησης</div>
                  <div className="action-grid">
                    {ACTION_CATEGORIES.map(cat => (
                      <div key={cat.id}
                        className={`action-tile ${actionCat===cat.id?'selected':''}`}
                        onClick={() => {
                          setActionCat(cat.id);
                          if (cat.direct) setAction(cat.value);
                          else setAction('');
                        }}>
                        <div className="action-icon">{cat.icon}</div>
                        <div className="action-title">{cat.label}</div>
                        <div className="action-sub">{cat.desc}</div>
                      </div>
                    ))}
                  </div>

                  {actionCat && !ACTION_CATEGORIES.find(c=>c.id===actionCat)?.direct && (
                    <div className="sub-action-list">
                      {ACTION_CATEGORIES.find(c=>c.id===actionCat)?.subs.map(s => (
                        <div key={s.value}
                          className={`sub-action-item ${action===s.value?'selected':''}`}
                          onClick={() => setAction(s.value)}>
                          <span className="sub-action-icon">{s.icon}</span>
                          <div>
                            <div className="sub-action-label">{s.value}</div>
                            <div className="sub-action-desc">{s.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {action && (
                    <div className="selected-action-badge">✓ {action}</div>
                  )}

                  <div className="field-group" style={{marginTop:'16px'}}>
                    <label className="field-label">🏪 Κατάστημα</label>
                    {!showStorePicker ? (
                      <div style={{display:'flex', gap:'8px'}}>
                        <div className="text-input store-display" onClick={()=>setShowStorePicker(true)}
                          style={{cursor:'pointer', color: store ? '#1a1a18' : '#999'}}>
                          {store || 'Επίλεξε κατάστημα...'}
                        </div>
                        {store && <button className="btn-clear" onClick={()=>setStore('')}>✕</button>}
                      </div>
                    ) : (
                      <div className="store-picker">
                        <input
                          className="text-input"
                          placeholder="🔍 Αναζήτηση..."
                          value={storeSearch}
                          onChange={e=>{ setStoreSearch(e.target.value); setStoreChain('all'); }}
                          autoFocus
                        />
                        <div className="chain-tabs">
                          {STORE_CHAINS.map(c => (
                            <button key={c.id}
                              className={`chain-tab ${storeChain===c.id?'active':''}`}
                              onClick={()=>{ setStoreChain(c.id); setStoreSearch(''); }}>
                              {c.label}
                            </button>
                          ))}
                        </div>
                        <div className="store-list">
                          {storesList.filter(s => {
                            const matchChain = storeChain === 'all' ? true
                              : storeChain === 'other' ? !['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c=>s.startsWith(c))
                              : s.startsWith(storeChain);
                            const matchSearch = storeSearch === '' || s.toLowerCase().includes(storeSearch.toLowerCase());
                            return matchChain && matchSearch;
                          }).map(s => (
                            <div key={s} className={`store-item ${store===s?'active':''}`}
                              onClick={()=>{ setStore(s); setShowStorePicker(false); setStoreSearch(''); setStoreChain('all'); }}>
                              {s}
                            </div>
                          ))}
                        </div>
                        <button className="btn-ghost" style={{marginTop:'8px'}} onClick={()=>setShowStorePicker(false)}>Άκυρο</button>
                      </div>
                    )}
                  </div>

                  <div className="field-group">
                    <label className="field-label">📅 Ημερομηνία</label>
                    <input className="text-input" type="date" value={date}
                      onChange={e=>setDate(e.target.value)} />
                  </div>

                  <div className="field-group">
                    <label className="field-label">🔧 Πρόβλημα</label>
                    <input className="text-input" value={problem}
                      onChange={e=>setProblem(e.target.value)}
                      placeholder="π.χ. Χαλασμένη οθόνη, δεν ανάβει..." />
                  </div>

                  <div className="field-group">
                    <label className="field-label">📝 Σημειώσεις</label>
                    <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                      placeholder="Οποιαδήποτε επιπλέον πληροφορία..." />
                  </div>

                  <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? '⏳ Καταχώριση...' : '✅ Καταχώριση κίνησης'}
                  </button>
                  <button className="btn-ghost" onClick={handleReset}>← Πίσω</button>
                </div>
              )}

              {step===3 && (
                <div className="card fade-in success-card">
                  <div className="success-icon">✅</div>
                  <div className="success-title">Καταχωρήθηκε!</div>
                  <div className="success-sub">
                    <strong>{model || 'Μηχάνημα'}</strong> · {serialNumber}<br/>
                    🏪 {store}<br/>
                    {action}{problem ? ` · 🔧 ${problem}` : ''}
                  </div>
                  <button className="btn-primary" onClick={handleReset}>📷 Νέο scan</button>
                </div>
              )}
            </div>
          )}

          {tab==='inventory' && (
            <div className="fade-in">
              <div className="filter-row">
                {['Όλα','Νέα εισαγωγή','Αποστολή σε κατάστημα','Σε επισκευή','Επισκευάστηκε','Εισαγωγή στην αποθήκη','Αποστολή στα κεντρικά'].map(f => (
                  <button key={f} className={`filter-pill ${filterAction===f?'active':''}`}
                    onClick={()=>setFilterAction(f)}>{f}</button>
                ))}
              </div>
              {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
              {!loadingInv && filtered.length === 0 && (
                <div className="empty">Δεν βρέθηκαν εγγραφές.<br/>Κάνε ένα scan πρώτα!</div>
              )}
              {filtered.map((item, i) => (
                <div key={i} className="machine-row"
                  onClick={()=>{ setTab('history'); loadHistory(item.serialNumber); }}>
                  <div className="machine-dot" style={{background: STATUS_COLOR[item.action]||'#888'}} />
                  <div className="machine-info">
                    <div className="machine-name">{item.model || 'Άγνωστο model'}</div>
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
              <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
            </div>
          )}

          {tab==='history' && (
            <div className="fade-in">
              <div className="field-group">
                <label className="field-label">Αναζήτηση με Serial Number</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input className="text-input" value={historySerial}
                    onChange={e=>setHistorySerial(e.target.value)}
                    placeholder="π.χ. A4829301" />
                  <button className="btn-search" onClick={()=>loadHistory(historySerial, '')}>Αναζήτηση</button>
                </div>
              </div>
              <div className="divider-or">ή</div>
              <div className="field-group">
                <label className="field-label">Αναζήτηση με Κατάστημα</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <div className="text-input store-display" style={{cursor:'pointer', color: historyStore?'#1a1a18':'#999', flex:1}}
                    onClick={()=>setShowStorePicker('history')}>
                    {historyStore || 'Επίλεξε κατάστημα...'}
                  </div>
                  {historyStore && <button className="btn-clear" onClick={()=>setHistoryStore('')}>✕</button>}
                  <button className="btn-search" onClick={()=>loadHistory('', historyStore)}>Αναζήτηση</button>
                </div>
                {showStorePicker === 'history' && (
                  <div className="store-picker" style={{marginTop:'8px'}}>
                    <input className="text-input" placeholder="🔍 Αναζήτηση..." value={storeSearch}
                      onChange={e=>{ setStoreSearch(e.target.value); setStoreChain('all'); }} autoFocus />
                    <div className="chain-tabs">
                      {STORE_CHAINS.map(c => (
                        <button key={c.id} className={`chain-tab ${storeChain===c.id?'active':''}`}
                          onClick={()=>{ setStoreChain(c.id); setStoreSearch(''); }}>{c.label}</button>
                      ))}
                    </div>
                    <div className="store-list">
                      {storesList.filter(s => {
                        const matchChain = storeChain==='all'?true:storeChain==='other'?!['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c=>s.startsWith(c)):s.startsWith(storeChain);
                        return matchChain && (storeSearch===''||s.toLowerCase().includes(storeSearch.toLowerCase()));
                      }).map(s => (
                        <div key={s} className={`store-item ${historyStore===s?'active':''}`}
                          onClick={()=>{ setHistoryStore(s); setShowStorePicker(false); setStoreSearch(''); setStoreChain('all'); }}>
                          {s}
                        </div>
                      ))}
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
                    <div className="h-dot" style={{borderColor: STATUS_COLOR[item.action]||'#888'}} />
                    {i < history.length-1 && <div className="h-line" />}
                  </div>
                  <div className="h-card">
                    <div className="h-action">{item.action}</div>
                    <div className="h-meta">🏪 {item.store} · 📅 {item.date}{item.user ? ` · 👤 ${item.user}` : ''}</div>
                    {item.problem && <div className="h-notes">🔧 {item.problem}</div>}
                    {item.notes && <div className="h-notes">📝 {item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==='settings' && (
            <div className="fade-in">
              <div className="card">
                <div className="card-title">⚙️ Ρυθμίσεις</div>
                <div className="card-sub">Διαχείριση καταστημάτων</div>

                <div className="section-label">Προσθήκη νέου καταστήματος</div>
                <div className="field-group">
                  <input className="text-input" value={newStoreName}
                    onChange={e=>{ setNewStoreName(e.target.value); setAddStoreMsg(null); }}
                    placeholder="π.χ. ΚΩΤΣΟΒΟΛΟΣ 999 Νέα Πόλη"
                    onKeyDown={e=>{ if(e.key==='Enter') handleAddStore(); }}
                  />
                </div>
                {addStoreMsg && (
                  <div className={addStoreMsg.type==='success' ? 'banner-success' : 'error-banner'} style={{marginBottom:'12px'}}>
                    {addStoreMsg.type==='success' ? '✅ ' : '⚠️ '}{addStoreMsg.text}
                  </div>
                )}
                <button className="btn-primary" onClick={handleAddStore} disabled={addingStore || !newStoreName.trim()}>
                  {addingStore ? '⏳ Προσθήκη...' : '➕ Προσθήκη καταστήματος'}
                </button>
              </div>

              <div className="card">
                <div className="section-label">Λίστα καταστημάτων ({storesList.length})</div>
                <div style={{maxHeight:'300px', overflowY:'auto', marginTop:'8px'}}>
                  {storesList.map((s, i) => (
                    <div key={i} className="settings-store-item">{s}</div>
                  ))}
                </div>
                <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadStores}>🔄 Ανανέωση</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F5F5F3; color: #1a1a18; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #fff; }
        .header { background: #fff; border-bottom: 1px solid #EBEBEA; position: sticky; top: 0; z-index: 10; }
        .header-top { padding: 12px 16px 8px; display: flex; align-items: center; justify-content: space-between; }
        .user-area { display: flex; align-items: center; gap: 8px; }
        .user-name { font-size: 12px; color: #555; font-weight: 500; }
        .btn-logout { background: none; border: 1px solid #EBEBEA; border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #999; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .btn-logout:hover { border-color: #E24B4A; color: #E24B4A; }
        .nav { display: flex; gap: 4px; padding: 0 12px 10px; }
        .nav-btn { flex: 1; padding: 8px 4px; border-radius: 20px; border: none; background: transparent; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; color: #666; transition: all 0.15s; text-align: center; }
        .nav-btn.active { background: #E1F5EE; color: #0F6E56; font-weight: 500; }
        .logo { font-size: 16px; font-weight: 600; }
        .logo span { color: #1D9E75; }
        .nav { display: flex; gap: 4px; }
        .nav-btn { padding: 6px 10px; border-radius: 20px; border: none; background: transparent; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; color: #666; transition: all 0.15s; }
        .nav-btn.active { background: #E1F5EE; color: #0F6E56; font-weight: 500; }
        .main { padding: 16px; }
        .card { background: #fff; border: 1px solid #EBEBEA; border-radius: 16px; padding: 20px; margin-bottom: 12px; }
        .card-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .card-sub { font-size: 13px; color: #666; margin-bottom: 16px; }
        .upload-area { border: 2px dashed #D4D4D2; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.15s; background: #FAFAF9; }
        .upload-area:hover { border-color: #1D9E75; background: #F0FBF7; }
        .upload-icon { font-size: 32px; margin-bottom: 10px; }
        .upload-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; }
        .upload-sub { font-size: 12px; color: #999; }
        .preview-img { width: 100%; border-radius: 10px; max-height: 250px; object-fit: contain; }
        .btn-primary { width: 100%; padding: 12px; background: #1D9E75; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 12px; transition: all 0.15s; display: block; }
        .btn-primary:hover { background: #0F6E56; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { width: 100%; padding: 10px; background: transparent; color: #666; border: 1px solid #EBEBEA; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 8px; display: block; width: 100%; }
        .btn-search { padding: 10px 16px; background: #1D9E75; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; }
        .ai-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: #E1F5EE; color: #0F6E56; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px; font-weight: 500; }
        .error-banner { background: #FFF3E0; border: 1px solid #FFB74D; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #E65100; margin-bottom: 14px; }
        .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .section-label { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .action-tile { background: #FAFAF9; border: 1.5px solid #EBEBEA; border-radius: 12px; padding: 12px; cursor: pointer; transition: all 0.15s; }
        .action-tile:hover { border-color: #1D9E75; }
        .action-tile.selected { border-color: #1D9E75; background: #E1F5EE; }
        .action-icon { font-size: 20px; margin-bottom: 6px; }
        .action-title { font-size: 12px; font-weight: 500; }
        .action-sub { font-size: 11px; color: #999; margin-top: 2px; }
        .sub-action-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; animation: fadeIn 0.15s ease; }
        .sub-action-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #EBEBEA; border-radius: 10px; cursor: pointer; transition: all 0.15s; background: #FAFAF9; }
        .sub-action-item:hover { border-color: #1D9E75; background: #F0FBF7; }
        .sub-action-item.selected { border-color: #1D9E75; background: #E1F5EE; }
        .sub-action-icon { font-size: 16px; width: 24px; text-align: center; flex-shrink: 0; }
        .sub-action-label { font-size: 13px; font-weight: 500; color: #1a1a18; }
        .sub-action-desc { font-size: 11px; color: #999; margin-top: 1px; }
        .selected-action-badge { display: inline-flex; align-items: center; gap: 6px; background: #E1F5EE; color: #0F6E56; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 20px; margin-bottom: 4px; }
        .store-display { display: flex; align-items: center; min-height: 40px; flex: 1; }
        .btn-clear { padding: 8px 12px; border: 1px solid #EBEBEA; border-radius: 10px; background: #fff; color: #999; cursor: pointer; font-size: 13px; flex-shrink: 0; }
        .store-picker { border: 1px solid #EBEBEA; border-radius: 12px; padding: 10px; background: #FAFAF9; }
        .chain-tabs { display: flex; gap: 5px; overflow-x: auto; padding: 8px 0; scrollbar-width: none; }
        .chain-tabs::-webkit-scrollbar { display: none; }
        .chain-tab { flex-shrink: 0; padding: 4px 10px; border-radius: 20px; border: 1px solid #EBEBEA; font-size: 11px; font-weight: 500; cursor: pointer; background: #fff; color: #666; transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .chain-tab.active { background: #1D9E75; color: #fff; border-color: #1D9E75; }
        .store-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
        .store-item { padding: 8px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; color: #1a1a18; transition: all 0.15s; }
        .store-item:hover { background: #E1F5EE; color: #0F6E56; }
        .store-item.active { background: #E1F5EE; color: #0F6E56; font-weight: 500; }
        .field-group { margin-bottom: 12px; }
        .field-label { font-size: 12px; color: #555; display: block; margin-bottom: 6px; font-weight: 500; }
        select, textarea, .text-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #EBEBEA; background: #FAFAF9; font-size: 13px; color: #1a1a18; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.15s; }
        select:focus, textarea:focus, .text-input:focus { border-color: #1D9E75; background: #fff; }
        textarea { resize: none; height: 72px; }
        .success-card { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 48px; margin-bottom: 12px; }
        .success-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .success-sub { font-size: 13px; color: #666; line-height: 1.8; margin-bottom: 20px; }
        .filter-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-pill { padding: 5px 12px; border-radius: 20px; border: 1px solid #EBEBEA; background: #fff; font-size: 12px; cursor: pointer; color: #666; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .filter-pill.active { background: #E1F5EE; color: #0F6E56; border-color: #9FE1CB; }
        .machine-row { background: #fff; border: 1px solid #EBEBEA; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 10px; cursor: pointer; transition: all 0.15s; }
        .machine-row:hover { border-color: #1D9E75; }
        .machine-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .machine-info { flex: 1; min-width: 0; }
        .machine-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .machine-serial { font-family: 'DM Mono', monospace; font-size: 11px; color: #999; margin-top: 2px; }
        .machine-bottom { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
        .machine-store { font-size: 12px; color: #444; }
        .machine-date { font-size: 12px; color: #999; }
        .machine-problem { font-size: 11px; color: #BA7517; margin-top: 3px; }
        .machine-user { font-size: 11px; color: #1D9E75; margin-top: 2px; }
        .history-item { display: flex; gap: 12px; margin-bottom: 12px; }
        .h-dot-wrap { display: flex; flex-direction: column; align-items: center; }
        .h-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #1D9E75; background: #fff; flex-shrink: 0; margin-top: 4px; }
        .h-line { width: 1px; flex: 1; background: #EBEBEA; margin-top: 4px; min-height: 20px; }
        .h-card { flex: 1; background: #FAFAF9; border: 1px solid #EBEBEA; border-radius: 10px; padding: 10px 12px; }
        .h-action { font-size: 13px; font-weight: 500; }
        .h-meta { font-size: 11px; color: #999; margin-top: 3px; }
        .h-notes { font-size: 11px; color: #666; margin-top: 4px; }
        .loading { text-align: center; padding: 40px; color: #999; font-size: 13px; }
        .empty { text-align: center; padding: 40px 20px; color: #999; font-size: 13px; line-height: 1.6; }
        .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .btn-half { padding: 10px; background: #F5F5F3; color: #1a1a18; border: 1px solid #EBEBEA; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.15s; }
        .btn-half:hover { border-color: #1D9E75; background: #E1F5EE; }
        .banner-success { background: #E1F5EE; color: #0F6E56; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
        .settings-store-item { padding: 8px 4px; font-size: 12px; color: #444; border-bottom: 1px solid #F5F5F3; }
        .divider-or::before, .divider-or::after { content: ''; position: absolute; top: 50%; width: 44%; height: 1px; background: #EBEBEA; }
        .divider-or::before { left: 0; } .divider-or::after { right: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
