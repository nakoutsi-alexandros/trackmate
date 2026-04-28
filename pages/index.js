import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

const STORES = [
  'Αποθήκη κεντρική',
  'Κατάστημα Περιστερίου',
  'Κατάστημα Γλυφάδας',
  'Κατάστημα Κηφισιάς',
  'Κατάστημα Πειραιά',
  'Κατάστημα Θεσσαλονίκης',
];

const ACTIONS = [
  { value: 'Αποστολή σε κατάστημα', icon: '🏪', desc: 'Τοποθέτηση σε νέο σημείο' },
  { value: 'Αντικατάσταση', icon: '🔄', desc: 'Εναλλαγή σε κατάστημα' },
  { value: 'Επισκευή', icon: '🔧', desc: 'Επιστροφή για σέρβις' },
  { value: 'Stock / Αποθήκη', icon: '📦', desc: 'Επιστροφή στο stock' },
];

const STATUS_COLOR = {
  'Αποστολή σε κατάστημα': '#1D9E75',
  'Αντικατάσταση': '#1D9E75',
  'Επισκευή': '#BA7517',
  'Stock / Αποθήκη': '#888',
};

export default function Home() {
  const [tab, setTab] = useState('scan');
  const [step, setStep] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(null);
  const [action, setAction] = useState('Αποστολή σε κατάστημα');
  const [store, setStore] = useState(STORES[1]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [history, setHistory] = useState(null);
  const [historySerial, setHistorySerial] = useState('');
  const [filterAction, setFilterAction] = useState('Όλα');
  const fileRef = useRef();

  const handleImage = useCallback((file) => {
    if (!file) return;
    setImageMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
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
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const data = await res.json();
      setScanned(data);
      setStep(2);
    } catch (e) {
      alert('Σφάλμα αναγνώρισης. Δοκίμασε ξανά.');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: scanned.serialNumber,
          model: scanned.model,
          action,
          store,
          notes,
        }),
      });
      setStep(3);
      setSuccess(true);
    } catch (e) {
      alert('Σφάλμα καταγραφής.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1); setImagePreview(null); setImageBase64(null);
    setScanned(null); setAction('Αποστολή σε κατάστημα');
    setStore(STORES[1]); setNotes(''); setSuccess(false);
  };

  const loadInventory = async () => {
    setLoadingInv(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (e) {
      alert('Σφάλμα φόρτωσης.');
    } finally {
      setLoadingInv(false);
    }
  };

  const loadHistory = async (serial) => {
    setHistorySerial(serial);
    try {
      const res = await fetch(`/api/inventory?serial=${encodeURIComponent(serial)}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (e) {
      alert('Σφάλμα φόρτωσης ιστορικού.');
    }
  };

  const filtered = filterAction === 'Όλα' ? inventory : inventory.filter(i => i.action === filterAction);

  return (
    <>
      <Head>
        <title>TrackMate — Tracking μηχανημάτων</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="logo">Track<span>Mate</span></div>
          <nav className="nav">
            {['scan','inventory','history'].map(t => (
              <button key={t} className={`nav-btn ${tab===t?'active':''}`}
                onClick={() => { setTab(t); if(t==='inventory') loadInventory(); }}>
                {t==='scan'?'📷 Scan':t==='inventory'?'📦 Απόθεμα':'🕐 Ιστορικό'}
              </button>
            ))}
          </nav>
        </header>

        <main className="main">
          {/* SCAN TAB */}
          {tab==='scan' && (
            <div className="fade-in">
              {step===1 && (
                <>
                  <div className="card">
                    <div className="card-title">Φωτογράφισε το μηχάνημα</div>
                    <div className="card-sub">Ανέβασε φωτογραφία — το AI θα αναγνωρίσει serial & model αυτόματα</div>
                    <div className="upload-area"
                      onDragOver={e=>e.preventDefault()} onDrop={handleDrop}
                      onClick={() => fileRef.current.click()}
                      style={imagePreview?{padding:'12px'}:{}}>
                      {imagePreview
                        ? <img src={imagePreview} alt="preview" className="preview-img" />
                        : <>
                            <div className="upload-icon">📷</div>
                            <div className="upload-title">Πάτα ή σύρε φωτογραφία εδώ</div>
                            <div className="upload-sub">JPG, PNG — από κάμερα ή γκαλερί</div>
                          </>
                      }
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment"
                      style={{display:'none'}} onChange={e=>handleImage(e.target.files[0])} />
                    {imagePreview && (
                      <button className="btn-primary" onClick={handleScan} disabled={scanning}>
                        {scanning ? '🔍 Αναγνώριση...' : '🔍 Αναγνώριση serial & model'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {step===2 && scanned && (
                <div className="card fade-in">
                  <div className="ai-badge">✨ Αναγνωρίστηκε αυτόματα</div>
                  <div className="result-grid">
                    <div className="result-field">
                      <div className="result-label">Serial Number</div>
                      <div className="result-value mono">{scanned.serialNumber}</div>
                    </div>
                    <div className="result-field">
                      <div className="result-label">Model</div>
                      <div className="result-value">{scanned.model}</div>
                    </div>
                  </div>
                  <div className="section-label">Επίλεξε ενέργεια</div>
                  <div className="action-grid">
                    {ACTIONS.map(a => (
                      <div key={a.value} className={`action-tile ${action===a.value?'selected':''}`}
                        onClick={() => setAction(a.value)}>
                        <div className="action-icon">{a.icon}</div>
                        <div className="action-title">{a.value}</div>
                        <div className="action-sub">{a.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="field-group">
                    <label className="field-label">Κατάστημα</label>
                    <select value={store} onChange={e=>setStore(e.target.value)}>
                      {STORES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Σημειώσεις (προαιρετικό)</label>
                    <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                      placeholder="π.χ. αντικατάσταση χαλασμένης μονάδας..." />
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
                    <strong>{scanned?.model}</strong> · {scanned?.serialNumber}<br/>
                    → {store} · {action}
                  </div>
                  <button className="btn-primary" onClick={handleReset}>📷 Νέο scan</button>
                </div>
              )}
            </div>
          )}

          {/* INVENTORY TAB */}
          {tab==='inventory' && (
            <div className="fade-in">
              <div className="filter-row">
                {['Όλα','Αποστολή σε κατάστημα','Επισκευή','Stock / Αποθήκη'].map(f => (
                  <button key={f} className={`filter-pill ${filterAction===f?'active':''}`}
                    onClick={()=>setFilterAction(f)}>{f}</button>
                ))}
              </div>
              {loadingInv && <div className="loading">Φόρτωση...</div>}
              {!loadingInv && filtered.length === 0 && (
                <div className="empty">Δεν βρέθηκαν εγγραφές.<br/>Κάνε ένα scan πρώτα!</div>
              )}
              {filtered.map((item, i) => (
                <div key={i} className="machine-row" onClick={()=>{ setTab('history'); loadHistory(item.serialNumber); }}>
                  <div className="machine-dot" style={{background: STATUS_COLOR[item.action]||'#888'}} />
                  <div className="machine-info">
                    <div className="machine-name">{item.model}</div>
                    <div className="machine-serial mono">{item.serialNumber}</div>
                  </div>
                  <div className="machine-loc">
                    <div className="machine-loc-name">{item.store}</div>
                    <div className="machine-date">{item.date}</div>
                  </div>
                </div>
              ))}
              <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab==='history' && (
            <div className="fade-in">
              <div className="field-group">
                <label className="field-label">Serial Number</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input className="text-input" value={historySerial}
                    onChange={e=>setHistorySerial(e.target.value)}
                    placeholder="π.χ. A4829301" />
                  <button className="btn-primary" style={{whiteSpace:'nowrap'}}
                    onClick={()=>loadHistory(historySerial)}>Αναζήτηση</button>
                </div>
              </div>
              {history === null && <div className="empty">Γράψε serial number για να δεις το ιστορικό.</div>}
              {history && history.length === 0 && <div className="empty">Δεν βρέθηκε ιστορικό για αυτό το serial.</div>}
              {history && history.map((item, i) => (
                <div key={i} className="history-item">
                  <div className="h-dot-wrap">
                    <div className="h-dot" style={{borderColor: STATUS_COLOR[item.action]||'#888'}} />
                    {i < history.length-1 && <div className="h-line" />}
                  </div>
                  <div className="h-card">
                    <div className="h-action">{item.action}</div>
                    <div className="h-meta">{item.store} · {item.date}</div>
                    {item.notes && <div className="h-notes">📝 {item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F5F5F3; color: #1a1a18; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #fff; }
        .header { background: #fff; border-bottom: 1px solid #EBEBEA; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .logo { font-size: 16px; font-weight: 600; color: #1a1a18; letter-spacing: -0.3px; }
        .logo span { color: #1D9E75; }
        .nav { display: flex; gap: 4px; }
        .nav-btn { padding: 6px 10px; border-radius: 20px; border: none; background: transparent; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; color: #666; transition: all 0.15s; }
        .nav-btn.active { background: #E1F5EE; color: #0F6E56; font-weight: 500; }
        .main { padding: 16px; }
        .card { background: #fff; border: 1px solid #EBEBEA; border-radius: 16px; padding: 20px; margin-bottom: 12px; }
        .card-title { font-size: 16px; font-weight: 600; color: #1a1a18; margin-bottom: 4px; }
        .card-sub { font-size: 13px; color: #666; margin-bottom: 16px; }
        .upload-area { border: 2px dashed #D4D4D2; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.15s; background: #FAFAF9; }
        .upload-area:hover { border-color: #1D9E75; background: #F0FBF7; }
        .upload-icon { font-size: 32px; margin-bottom: 10px; }
        .upload-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; }
        .upload-sub { font-size: 12px; color: #999; }
        .preview-img { width: 100%; border-radius: 10px; max-height: 250px; object-fit: contain; }
        .btn-primary { width: 100%; padding: 12px; background: #1D9E75; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 12px; transition: all 0.15s; }
        .btn-primary:hover { background: #0F6E56; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { width: 100%; padding: 10px; background: transparent; color: #666; border: 1px solid #EBEBEA; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 8px; }
        .ai-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: #E1F5EE; color: #0F6E56; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px; font-weight: 500; }
        .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .result-field { background: #FAFAF9; border-radius: 10px; padding: 12px; }
        .result-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .result-value { font-size: 14px; font-weight: 500; color: #1a1a18; }
        .mono { font-family: 'DM Mono', monospace; font-size: 13px; }
        .section-label { font-size: 12px; font-weight: 500; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .action-tile { background: #FAFAF9; border: 1.5px solid #EBEBEA; border-radius: 12px; padding: 12px; cursor: pointer; transition: all 0.15s; }
        .action-tile:hover { border-color: #1D9E75; }
        .action-tile.selected { border-color: #1D9E75; background: #E1F5EE; }
        .action-icon { font-size: 20px; margin-bottom: 6px; }
        .action-title { font-size: 12px; font-weight: 500; color: #1a1a18; }
        .action-sub { font-size: 11px; color: #999; margin-top: 2px; }
        .field-group { margin-bottom: 12px; }
        .field-label { font-size: 12px; color: #666; display: block; margin-bottom: 6px; }
        select, textarea, .text-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #EBEBEA; background: #FAFAF9; font-size: 13px; color: #1a1a18; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.15s; }
        select:focus, textarea:focus, .text-input:focus { border-color: #1D9E75; }
        textarea { resize: none; height: 72px; }
        .success-card { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 48px; margin-bottom: 12px; }
        .success-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .success-sub { font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 20px; }
        .filter-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-pill { padding: 5px 12px; border-radius: 20px; border: 1px solid #EBEBEA; background: #fff; font-size: 12px; cursor: pointer; color: #666; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .filter-pill.active { background: #E1F5EE; color: #0F6E56; border-color: #9FE1CB; }
        .machine-row { background: #fff; border: 1px solid #EBEBEA; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.15s; }
        .machine-row:hover { border-color: #1D9E75; }
        .machine-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .machine-info { flex: 1; }
        .machine-name { font-size: 13px; font-weight: 500; color: #1a1a18; }
        .machine-serial { font-size: 11px; color: #999; margin-top: 2px; }
        .machine-loc { text-align: right; }
        .machine-loc-name { font-size: 12px; font-weight: 500; color: #1a1a18; }
        .machine-date { font-size: 11px; color: #999; }
        .history-item { display: flex; gap: 12px; margin-bottom: 12px; }
        .h-dot-wrap { display: flex; flex-direction: column; align-items: center; }
        .h-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #1D9E75; background: #fff; flex-shrink: 0; margin-top: 4px; }
        .h-line { width: 1px; flex: 1; background: #EBEBEA; margin-top: 4px; min-height: 20px; }
        .h-card { flex: 1; background: #FAFAF9; border: 1px solid #EBEBEA; border-radius: 10px; padding: 10px 12px; }
        .h-action { font-size: 13px; font-weight: 500; color: #1a1a18; }
        .h-meta { font-size: 11px; color: #999; margin-top: 3px; }
        .h-notes { font-size: 11px; color: #666; margin-top: 4px; }
        .loading { text-align: center; padding: 40px; color: #999; font-size: 13px; }
        .empty { text-align: center; padding: 40px 20px; color: #999; font-size: 13px; line-height: 1.6; }
        .fade-in { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
