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
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('trackmate_dark', next ? '1' : '0');
      return next;
    });
  };
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
  const [existingItem, setExistingItem] = useState(null); // υπάρχον μηχάνημα με ίδιο serial
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
  const [filterPeriod, setFilterPeriod] = useState('all'); // all | today | 7 | 30 | custom
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [storesList, setStoresList] = useState([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  const [addStoreMsg, setAddStoreMsg] = useState(null);
  const [warehouseNotes, setWarehouseNotes] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingStore, setEditingStore] = useState(null); // serial που επεξεργάζεται κατάστημα
  const [editStoreSearch, setEditStoreSearch] = useState('');
  const [editStoreChain, setEditStoreChain] = useState('all');
  const [savingStore, setSavingStore] = useState(false);
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

  const loadNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      setWarehouseNotes(data.notes || {});
    } catch (e) {}
  };

  const handleSaveNote = async (serialNumber) => {
    setSavingNote(true);
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, note: noteInput }),
      });
      setWarehouseNotes(prev => ({ ...prev, [serialNumber]: { note: noteInput, updatedAt: 'μόλις τώρα', updatedBy: currentUser?.fullName || '' } }));
      setEditingNote(null);
      setNoteInput('');
    } catch (e) {
      alert('Σφάλμα αποθήκευσης σημείωσης.');
    } finally {
      setSavingNote(false);
    }
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
    // Φόρτωση dark mode preference
    const saved = localStorage.getItem('trackmate_dark');
    if (saved === '1') setDarkMode(true);

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCurrentUser(data.user); })
      .catch(() => {});

    loadStores();
    loadInventory();
    loadNotes();

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
    setExistingItem(null);
  };

  const handleUpdateStore = async (serialNumber, newStore) => {
    setSavingStore(true);
    try {
      const res = await fetch('/api/warehouse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, newStore }),
      });
      if (!res.ok) throw new Error();
      setEditingStore(null);
      setEditStoreSearch('');
      setEditStoreChain('all');
      loadInventory();
    } catch (e) {
      alert('Σφάλμα ενημέρωσης καταστήματος.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Διαγραφή "${item.model || item.serialNumber}" από την αποθήκη;\n\nΤο ιστορικό θα παραμείνει.`)) return;
    try {
      const res = await fetch('/api/warehouse', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber: item.serialNumber, model: item.model, store: item.store }),
      });
      if (!res.ok) throw new Error();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα διαγραφής.');
    }
  };

  // Quick mark as repaired - άμεση καταχώρηση χωρίς φόρμα
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');

      const warehouseData = warehouseItems.map(item => ({
        'Serial Number': item.serialNumber,
        'Model': item.model || '',
        'Κατάσταση': normalizeAction(item.action),
        'Από Κατάστημα': displayStore(item),
        'Ημερομηνία': item.date,
        'Χρήστης': item.user || '',
        'Πρόβλημα': item.problem || '',
        'Σημείωση': warehouseNotes[item.serialNumber]?.note || '',
      }));

      const movementsData = inventory.map(item => ({
        'Serial Number': item.serialNumber,
        'Model': item.model || '',
        'Τελευταία Κίνηση': normalizeAction(item.action),
        'Κατάστημα': item.store || '',
        'Ημερομηνία': item.date,
        'Χρήστης': item.user || '',
        'Πρόβλημα': item.problem || '',
        'Σημειώσεις': item.notes || '',
      }));

      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(warehouseData);
      ws1['!cols'] = [20,20,18,30,14,18,25,30].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws1, 'Αποθήκη');

      const ws2 = XLSX.utils.json_to_sheet(movementsData);
      ws2['!cols'] = [20,20,20,30,14,18,25,30].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws2, 'Κινήσεις');

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `TrackMate_${date}.xlsx`);
    } catch (e) {
      alert('Σφάλμα εξαγωγής. Δοκιμάστε ξανά.');
    }
  };

  const handleMarkRepaired = async (item) => {
    if (!confirm(`Το "${item.model || item.serialNumber}" επισκευάστηκε;`)) return;
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: item.serialNumber,
          model: item.model,
          action: 'Καινούριο Μηχάνημα',
          store: item.store || '',
          date: new Date().toISOString().split('T')[0],
          problem: '',
          notes: 'Επισκευάστηκε',
        }),
      });
      if (!res.ok) throw new Error();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα καταχώρησης.');
    }
  };

  // Quick action: πάει στη φόρμα με serial+model προσυμπληρωμένα
  const startNewAction = (serial, mdl) => {
    handleReset();
    setSerialNumber(serial || '');
    setModel(mdl || '');
    setStep(2);
    setTab('scan');
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

  // Helper: parse ημερομηνία από ISO ή Greek format
  const parseItemDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) return new Date(dateStr);
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  // Φιλτράρισμα με βάση περίοδο
  const applyDateFilter = (items) => {
    if (filterPeriod === 'all') return items;
    const today = new Date(); today.setHours(0,0,0,0);
    return items.filter(item => {
      const d = parseItemDate(item.date);
      if (!d) return true;
      d.setHours(0,0,0,0);
      if (filterPeriod === 'today') return d.getTime() === today.getTime();
      if (filterPeriod === '7')  return (today - d) <= 7  * 86400000;
      if (filterPeriod === '30') return (today - d) <= 30 * 86400000;
      if (filterPeriod === 'custom') {
        const from = filterDateFrom ? new Date(filterDateFrom) : null;
        const to   = filterDateTo   ? new Date(filterDateTo)   : null;
        if (from) from.setHours(0,0,0,0);
        if (to)   to.setHours(23,59,59,999);
        if (from && d < from) return false;
        if (to   && d > to)   return false;
        return true;
      }
      return true;
    });
  };

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
    if (ta === 0 && tb === 0) return 0;
    return sortOrder === 'desc' ? tb - ta : ta - tb;
  });

  const filtered = sortItems(applyDateFilter(filterAction === 'Όλα' ? inventory : inventory.filter(i => normalizeAction(i.action) === filterAction)));
  const warehouseItems = sortItems(inventory.filter(i => ['Καινούριο Μηχάνημα', 'Εισαγωγή για επισκευή'].includes(normalizeAction(i.action))));

  // Εμφάνιση store: αν είναι κενό και η κίνηση είναι Καινούριο Μηχάνημα → "Αποθήκη"
  const displayStore = (item) => {
    if (item.store && item.store.trim()) return item.store;
    if (normalizeAction(item.action) === 'Καινούριο Μηχάνημα') return 'Αποθήκη';
    return '—';
  };

  // Υπολογισμός ημερών από την τελευταία καταχώρηση
  const getDaysInRepair = (item) => {
    if (normalizeAction(item.action) !== 'Εισαγωγή για επισκευή') return null;
    try {
      const raw = item.date;
      if (!raw) return null;
      let entryDate;
      if (raw.includes('-')) {
        // ISO format: 2026-05-13
        entryDate = new Date(raw);
      } else {
        // Greek format: 13/5/2026
        const [day, month, year] = raw.split('/').map(Number);
        entryDate = new Date(year, month - 1, day);
      }
      if (isNaN(entryDate.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      entryDate.setHours(0, 0, 0, 0);
      return Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
    } catch { return null; }
  };

  // Badge για επισκευή: null = κανένα, 'warning' = >5 μέρες, 'danger' = >10 μέρες
  const getRepairBadge = (item) => {
    const days = getDaysInRepair(item);
    if (days === null) return null;
    if (days > 10) return { type: 'danger', days, label: `${days} μέρες` };
    if (days > 5)  return { type: 'warning', days, label: `${days} μέρες` };
    return null;
  };

  const STATUS_PILL = {
    'Καινούριο Μηχάνημα':      { label: 'Διαθέσιμο',        cls: 'pill-blue'   },
    'Εισαγωγή για επισκευή':   { label: 'Επισκευή',         cls: 'pill-amber'  },
    'Αποστολή σε κατάστημα':   { label: 'Κατάστημα',        cls: 'pill-green'  },
    'Αποστολή στα κεντρικά':   { label: 'Κεντρικά',         cls: 'pill-purple' },
    'Διαγράφηκε':              { label: 'Διαγράφηκε',       cls: 'pill-gray'   },
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
                <input className="text-input" value={serialNumber}
                  onChange={e=>{ setSerialNumber(e.target.value); setExistingItem(null); }}
                  onBlur={e=>{
                    const sn = e.target.value.trim();
                    if (!sn) return;
                    const found = inventory.find(i => i.serialNumber.replace(/^'/, '') === sn.replace(/^'/, ''));
                    setExistingItem(found || null);
                  }}
                  placeholder="π.χ. A4829301" />
              </div>

              {existingItem && (
                <div className="existing-item-banner">
                  <div className="existing-item-title">⚠️ Αυτό το serial υπάρχει ήδη</div>
                  <div className="existing-item-info">
                    <span><strong>{existingItem.model || 'Άγνωστο model'}</strong></span>
                    <span className={`status-pill ${STATUS_PILL[normalizeAction(existingItem.action)]?.cls||'pill-gray'}`}>
                      {STATUS_PILL[normalizeAction(existingItem.action)]?.label||normalizeAction(existingItem.action)}
                    </span>
                  </div>
                  <div className="existing-item-meta">
                    🏪 {displayStore(existingItem)} · 📅 {existingItem.date}
                    {existingItem.user ? ` · 👤 ${existingItem.user}` : ''}
                  </div>
                  <div className="existing-item-note">Συνέχισε μόνο αν θέλεις να καταχωρήσεις νέα κίνηση για αυτό το μηχάνημα.</div>
                </div>
              )}
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
            <div className="filter-row">
              {FILTERS.map(f => <button key={f} className={`filter-pill ${filterAction===f?'active':''}`} onClick={()=>setFilterAction(f)}>{f}</button>)}
              <button className="sort-btn" onClick={()=>setSortOrder(s=>s==='desc'?'asc':'desc')}>{sortOrder==='desc'?'↓ Νεότερα':'↑ Παλαιότερα'}</button>
            </div>
            <div className="period-row">
              {[{id:'all',label:'Όλα'},{id:'today',label:'Σήμερα'},{id:'7',label:'7 μέρες'},{id:'30',label:'30 μέρες'},{id:'custom',label:'Εύρος'}].map(p => (
                <button key={p.id} className={`period-pill ${filterPeriod===p.id?'active':''}`} onClick={()=>setFilterPeriod(p.id)}>{p.label}</button>
              ))}
            </div>
            {filterPeriod === 'custom' && (
              <div className="custom-date-row">
                <label className="field-label">Από</label>
                <input type="date" className="text-input" style={{width:'auto'}} value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} />
                <label className="field-label">Έως</label>
                <input type="date" className="text-input" style={{width:'auto'}} value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} />
              </div>
            )}
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
                    <div className="dt-td dt-muted">{displayStore(item)}</div>
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
            <div className="period-row">
              {[{id:'all',label:'Όλα'},{id:'today',label:'Σήμερα'},{id:'7',label:'7 μέρες'},{id:'30',label:'30 μέρες'},{id:'custom',label:'Εύρος'}].map(p => (
                <button key={p.id} className={`period-pill ${filterPeriod===p.id?'active':''}`} onClick={()=>setFilterPeriod(p.id)}>{p.label}</button>
              ))}
            </div>
            {filterPeriod === 'custom' && (
              <div className="custom-date-row">
                <label className="field-label">Από</label>
                <input type="date" className="text-input" style={{width:'auto',flex:1}} value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} />
                <label className="field-label">Έως</label>
                <input type="date" className="text-input" style={{width:'auto',flex:1}} value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} />
              </div>
            )}
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
                    <span className="machine-store">🏪 {displayStore(item)}</span>
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
          {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
          {!loadingInv && warehouseItems.length === 0 && <div className="empty">Δεν υπάρχουν μηχανήματα στην αποθήκη.</div>}
          {!loadingInv && warehouseItems.length > 0 && (
            <div className="dt-table desktop-only">
              <div className="dt-head">
                <div className="dt-th">Model / Serial</div>
                <div className="dt-th">Από κατάστημα</div>
                <div className="dt-th">Κατάσταση</div>
                <div className="dt-th">Ημερομηνία</div>
                <div className="dt-th">Χρήστης</div>
              </div>
              {warehouseItems.map((item, i) => {
                const badge = getRepairBadge(item);
                const itemNote = warehouseNotes[item.serialNumber];
                return (
                  <div key={i}>
                    <div className="dt-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                      <div className="dt-td">
                        <span className="dt-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                        <div>
                          <div className="dt-model">{item.model || '—'}</div>
                          <div className="dt-serial">{item.serialNumber}</div>
                        </div>
                        {badge && <span className={`repair-badge repair-badge-${badge.type}`}>{badge.type==='danger'?'🔴':'🟡'} {badge.label}</span>}
                      </div>
                      <div className="dt-td" onClick={e=>e.stopPropagation()}>
                        {editingStore === item.serialNumber ? (
                          <div className="store-edit-picker">
                            <input className="text-input" style={{fontSize:'11px',padding:'4px 8px'}}
                              placeholder="🔍 Αναζήτηση..." value={editStoreSearch}
                              onChange={e=>{setEditStoreSearch(e.target.value);setEditStoreChain('all');}} autoFocus />
                            <div className="chain-tabs" style={{padding:'4px 0'}}>
                              {STORE_CHAINS.map(c=>(
                                <button key={c.id} className={`chain-tab ${editStoreChain===c.id?'active':''}`}
                                  onClick={()=>{setEditStoreChain(c.id);setEditStoreSearch('');}}>
                                  {c.label}
                                </button>
                              ))}
                            </div>
                            <div className="store-list" style={{maxHeight:'140px'}}>
                              {storesList.filter(s=>{
                                const mc = editStoreChain==='all'?true:editStoreChain==='other'?!['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c=>s.startsWith(c)):s.startsWith(editStoreChain);
                                return mc&&(editStoreSearch===''||s.toLowerCase().includes(editStoreSearch.toLowerCase()));
                              }).map(s=>(
                                <div key={s} className="store-item"
                                  onClick={()=>handleUpdateStore(item.serialNumber, s)}>
                                  {s}
                                </div>
                              ))}
                            </div>
                            <button className="btn-note-cancel" style={{marginTop:'4px',width:'100%'}}
                              onClick={()=>{setEditingStore(null);setEditStoreSearch('');setEditStoreChain('all');}}>
                              Άκυρο
                            </button>
                          </div>
                        ) : (
                          <span className="store-edit-display dt-muted" onClick={()=>setEditingStore(item.serialNumber)}
                            title="Κλικ για αλλαγή καταστήματος">
                            {displayStore(item)} ✏️
                          </span>
                        )}
                      </div>
                      <div className="dt-td"><span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span></div>
                      <div className="dt-td dt-muted">{item.date}</div>
                      <div className="dt-td dt-muted" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span>{item.user || '—'}</span>
                        <div style={{display:'flex',gap:'4px'}}>
                          {normalizeAction(item.action) === 'Εισαγωγή για επισκευή' && (
                            <button className="btn-repaired" onClick={e=>{e.stopPropagation();handleMarkRepaired(item);}}>✓ Επισκευάστηκε</button>
                          )}
                          <button className="btn-quick-action" onClick={e=>{e.stopPropagation();startNewAction(item.serialNumber,item.model);}}>+ Νέα</button>
                          <button className="btn-delete" onClick={e=>{e.stopPropagation();handleDeleteItem(item);}}>✕ Διαγραφή</button>
                        </div>
                      </div>
                    </div>
                    {/* Note row */}
                    <div className="dt-note-row" onClick={e=>e.stopPropagation()}>
                      {editingNote === item.serialNumber ? (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',width:'100%'}}>
                          <input className="text-input note-input-inline" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Γράψε σημείωση..." autoFocus onKeyDown={e=>{if(e.key==='Enter')handleSaveNote(item.serialNumber);if(e.key==='Escape'){setEditingNote(null);setNoteInput('');}}} />
                          <button className="btn-quick-action" onClick={()=>handleSaveNote(item.serialNumber)} disabled={savingNote}>{savingNote?'...':'Αποθήκευση'}</button>
                          <button className="btn-note-cancel" onClick={()=>{setEditingNote(null);setNoteInput('');}}>✕</button>
                        </div>
                      ) : (
                        <div className="note-display-desktop" onClick={()=>{setEditingNote(item.serialNumber);setNoteInput(itemNote?.note||'');}}>
                          {itemNote?.note ? <span className="note-text">📌 {itemNote.note}</span> : <span className="note-empty">+ Σημείωση</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mobile-only">
            {warehouseItems.map((item, i) => {
              const badge = getRepairBadge(item);
              return (
                <div key={i} className="machine-row" onClick={()=>{setTab('history');loadHistory(item.serialNumber);}}>
                  <div className="machine-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                  <div className="machine-info">
                    <div className="machine-name-row">
                      <div className="machine-name">{item.model || 'Άγνωστο model'}</div>
                      <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                    </div>
                    <div className="machine-serial">{item.serialNumber}</div>
                    <div className="machine-bottom" onClick={e=>e.stopPropagation()}>
                      {editingStore === item.serialNumber ? (
                        <div style={{width:'100%'}}>
                          <input className="text-input" style={{fontSize:'11px',padding:'4px 8px',marginBottom:'4px'}}
                            placeholder="🔍 Αναζήτηση καταστήματος..." value={editStoreSearch}
                            onChange={e=>setEditStoreSearch(e.target.value)} autoFocus />
                          <div className="store-list" style={{maxHeight:'120px'}}>
                            {storesList.filter(s=>editStoreSearch===''||s.toLowerCase().includes(editStoreSearch.toLowerCase())).map(s=>(
                              <div key={s} className="store-item" onClick={()=>handleUpdateStore(item.serialNumber, s)}>{s}</div>
                            ))}
                          </div>
                          <button className="btn-note-cancel" style={{marginTop:'4px',width:'100%'}}
                            onClick={()=>{setEditingStore(null);setEditStoreSearch('');}}>Άκυρο</button>
                        </div>
                      ) : (
                        <span className="machine-store" onClick={()=>setEditingStore(item.serialNumber)}
                          style={{cursor:'pointer'}}>
                          🏪 {displayStore(item)} ✏️
                        </span>
                      )}
                      <span className="machine-date">📅 {item.date}</span>
                    </div>
                    {badge && <div className={`repair-badge repair-badge-${badge.type}`}>{badge.type==='danger'?'🔴':'🟡'} Σε επισκευή {badge.label}</div>}
                    {/* Note section */}
                    {editingNote === item.serialNumber ? (
                      <div className="note-edit" onClick={e=>e.stopPropagation()}>
                        <textarea className="note-input" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Γράψε σημείωση..." autoFocus />
                        <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
                          <button className="btn-quick-action" onClick={()=>handleSaveNote(item.serialNumber)} disabled={savingNote}>{savingNote?'...':'💾 Αποθήκευση'}</button>
                          <button className="btn-note-cancel" onClick={()=>{setEditingNote(null);setNoteInput('');}}>Άκυρο</button>
                        </div>
                      </div>
                    ) : (
                      <div className="note-display" onClick={e=>{e.stopPropagation();setEditingNote(item.serialNumber);setNoteInput(warehouseNotes[item.serialNumber]?.note||'');}}>
                        {warehouseNotes[item.serialNumber]?.note
                          ? <span className="note-text">📌 {warehouseNotes[item.serialNumber].note}</span>
                          : <span className="note-empty">+ Προσθήκη σημείωσης</span>}
                      </div>
                    )}
                    <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                      {normalizeAction(item.action) === 'Εισαγωγή για επισκευή' && (
                        <button className="btn-repaired" onClick={e=>{e.stopPropagation();handleMarkRepaired(item);}}>✓ Επισκευάστηκε</button>
                      )}
                      <button className="btn-quick-action" onClick={e=>{e.stopPropagation();startNewAction(item.serialNumber,item.model);}}>+ Νέα κίνηση</button>
                      <button className="btn-delete" onClick={e=>{e.stopPropagation();handleDeleteItem(item);}}>✕ Διαγραφή</button>
                    </div>
                  </div>
                </div>
              );
            })}
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
          {history && history.length > 0 && historySerial && (
            <div className="history-machine-header">
              <div className="history-machine-info">
                <div className="history-machine-model">{history[0]?.model || 'Άγνωστο model'}</div>
                <div className="history-machine-serial">{history[0]?.serialNumber}</div>
                <div className="history-machine-count">{history.length} κινήσεις</div>
              </div>
              <button className="btn-quick-action" onClick={()=>startNewAction(history[0]?.serialNumber, history[0]?.model)}>
                + Νέα κίνηση
              </button>
            </div>
          )}
          {history && history.length > 0 && !historySerial && (
            <div className="history-store-header">
              <span className="history-store-count">{history.length} κινήσεις για <strong>{historyStore}</strong></span>
            </div>
          )}
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
                {!historySerial && (
                  <div className="h-machine">
                    <span className="h-machine-model">{item.model || '—'}</span>
                    <span className="h-machine-serial">{item.serialNumber}</span>
                    <button className="btn-quick-action" style={{marginLeft:'auto'}} onClick={e=>{e.stopPropagation();startNewAction(item.serialNumber,item.model);}}>+ Νέα κίνηση</button>
                  </div>
                )}
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
            <div className="card-title">📥 Εξαγωγή δεδομένων</div>
            <div className="card-sub">Κατέβασε τα δεδομένα σε Excel για να τα ανεβάσεις στο SharePoint</div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'4px'}}>
              <div style={{fontSize:'12px',color:'#6b7280',flex:1}}>
                Περιλαμβάνει: <strong>Αποθήκη</strong> ({warehouseItems.length} μηχανήματα) και <strong>Κινήσεις</strong> ({inventory.length} εγγραφές) σε 2 sheets.
              </div>
            </div>
            <button className="btn-export" onClick={handleExportExcel}>
              📥 Κατέβασε Excel
            </button>
          </div>
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className={`desktop-layout${darkMode?' dark':''}`}>
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
              <button className="sb-dark-btn" onClick={toggleDarkMode} title={darkMode?'Light mode':'Dark mode'}>{darkMode?'☀️':'🌙'}</button>
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
      <div className={`mobile-layout${darkMode?' dark':''}`}>
        <header className="mob-header">
          <div className="mob-header-top">
            <div className="logo" onClick={()=>{setTab('scan');handleReset();}} style={{cursor:'pointer'}}>Track<span>Mate</span></div>
            {currentUser && (
              <div className="user-area">
                <button className="mob-dark-btn" onClick={toggleDarkMode}>{darkMode?'☀️':'🌙'}</button>
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #0c0c0c;
          --bg2:       #111111;
          --bg3:       #181818;
          --bg4:       #1e1e1e;
          --bg5:       #242424;
          --border:    rgba(255,255,255,0.06);
          --border2:   rgba(255,255,255,0.1);
          --text1:     #f2f2f2;
          --text2:     #a0a0a0;
          --text3:     #606060;
          --text4:     #383838;
          --accent:    #a78bfa;
          --accent-glow: rgba(167,139,250,0.15);
          --green:     #34d399;
          --green-bg:  rgba(52,211,153,0.1);
          --orange:    #fb923c;
          --orange-bg: rgba(251,146,60,0.1);
          --red:       #f87171;
          --red-bg:    rgba(248,113,113,0.1);
          --blue:      #60a5fa;
          --blue-bg:   rgba(96,165,250,0.1);
          --font: 'Inter', -apple-system, sans-serif;
          --mono: 'JetBrains Mono', monospace;
          --radius: 10px;
          --radius-sm: 6px;
          --radius-lg: 14px;
          --shadow: 0 4px 24px rgba(0,0,0,0.4);
          --shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
        }

        html { font-size: 14px; }
        body { font-family: var(--font); background: var(--bg); color: var(--text1); min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased; }

        /* ─── SCROLLBAR ─── */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--bg5); border-radius: 2px; }

        /* ─── RESPONSIVE ─── */
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

        /* ══════════════════════════════════
           DESKTOP LAYOUT
        ══════════════════════════════════ */

        /* ─── SIDEBAR ─── */
        .sidebar {
          width: 220px; flex-shrink: 0;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          position: relative;
        }
        .sidebar::after {
          content: '';
          position: absolute; top: 0; right: 0;
          width: 1px; height: 100%;
          background: linear-gradient(to bottom, transparent, var(--accent-glow), transparent);
          pointer-events: none;
        }
        .sb-logo {
          padding: 22px 18px 18px;
          font-size: 16px; font-weight: 700;
          letter-spacing: -0.5px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
        }
        .sb-logo .t { color: var(--text1); }
        .sb-logo .m { color: var(--accent); }
        .sb-logo span { color: var(--accent); }
        .sb-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
        .sb-section {
          font-size: 10px; font-weight: 600;
          color: var(--text4);
          padding: 12px 10px 5px;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
        .sb-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 8px 10px;
          border-radius: var(--radius-sm);
          border: none; background: transparent;
          font-size: 13px; font-family: var(--font);
          color: var(--text3); cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 1px; text-align: left;
        }
        .sb-item:hover { background: var(--bg3); color: var(--text2); }
        .sb-item.active {
          background: linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.06));
          color: var(--text1); font-weight: 500;
          border: 1px solid rgba(167,139,250,0.2);
        }
        .sb-item.active .sb-icon { color: var(--accent); }
        .sb-icon { font-size: 15px; width: 18px; text-align: center; color: var(--text4); flex-shrink: 0; }
        .sb-footer {
          padding: 12px 12px 16px;
          border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 8px;
        }
        .sb-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: #fff;
          flex-shrink: 0; box-shadow: 0 0 10px var(--accent-glow);
        }
        .sb-username { flex: 1; font-size: 11px; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
        .sb-logout { background: none; border: none; cursor: pointer; font-size: 14px; color: var(--text4); padding: 3px; transition: color 0.15s; border-radius: 4px; }
        .sb-logout:hover { color: var(--red); }
        .sb-dark-btn { background: none; border: none; cursor: pointer; font-size: 14px; color: var(--text4); padding: 3px; transition: color 0.15s; border-radius: 4px; }
        .sb-dark-btn:hover { color: var(--accent); }

        /* ─── DESKTOP MAIN ─── */
        .desktop-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
        .desktop-header {
          padding: 14px 24px;
          background: rgba(17,17,17,0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .desktop-title { font-size: 15px; font-weight: 600; color: var(--text1); letter-spacing: -0.3px; }
        .desktop-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .desktop-content { flex: 1; overflow-y: auto; padding: 20px 24px; }

        /* ═══════════════════════════════════
           BUTTONS
        ═══════════════════════════════════ */
        .btn-new {
          padding: 7px 14px;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: #fff; border: none; border-radius: var(--radius-sm);
          font-size: 12px; font-family: var(--font); cursor: pointer;
          font-weight: 600; transition: all 0.15s;
          box-shadow: 0 2px 12px var(--accent-glow);
          letter-spacing: -0.1px;
        }
        .btn-new:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 16px var(--accent-glow); }
        .btn-primary {
          width: 100%; padding: 12px;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: #fff; border: none; border-radius: var(--radius);
          font-size: 13px; font-weight: 600; font-family: var(--font);
          cursor: pointer; margin-top: 10px; transition: all 0.15s;
          display: block; box-shadow: 0 4px 16px var(--accent-glow);
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-ghost {
          width: 100%; padding: 10px;
          background: transparent; color: var(--text3);
          border: 1px solid var(--border2);
          border-radius: var(--radius); font-size: 12px;
          font-family: var(--font); cursor: pointer;
          margin-top: 8px; display: block; transition: all 0.15s;
        }
        .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
        .btn-search {
          padding: 9px 16px;
          background: linear-gradient(135deg, var(--accent), #7c3aed);
          color: #fff; border: none; border-radius: var(--radius);
          font-size: 12px; font-family: var(--font); cursor: pointer;
          white-space: nowrap; transition: all 0.15s; font-weight: 600;
          box-shadow: 0 2px 10px var(--accent-glow);
        }
        .btn-search:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-export {
          width: 100%; padding: 11px;
          background: var(--bg3); color: var(--text2);
          border: 1px solid var(--border2);
          border-radius: var(--radius); font-size: 13px; font-weight: 500;
          font-family: var(--font); cursor: pointer; margin-top: 12px;
          transition: all 0.15s; display: block;
        }
        .btn-export:hover { border-color: var(--accent); color: var(--accent); }
        .btn-repaired {
          padding: 5px 10px;
          background: var(--green-bg); color: var(--green);
          border: 1px solid rgba(52,211,153,0.25); border-radius: var(--radius-sm);
          font-size: 10px; font-family: var(--font); cursor: pointer;
          font-weight: 600; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-repaired:hover { background: rgba(52,211,153,0.2); border-color: var(--green); }
        .btn-quick-action {
          padding: 5px 11px;
          background: var(--bg4); color: var(--text2);
          border: 1px solid var(--border2); border-radius: var(--radius-sm);
          font-size: 10px; font-family: var(--font); cursor: pointer;
          font-weight: 500; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-quick-action:hover { border-color: var(--accent); color: var(--accent); }
        .btn-delete {
          padding: 5px 10px;
          background: var(--red-bg); color: var(--red);
          border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius-sm);
          font-size: 10px; font-weight: 600; cursor: pointer;
          transition: all 0.15s; flex-shrink: 0; font-family: var(--font);
        }
        .btn-delete:hover { background: rgba(248,113,113,0.2); border-color: var(--red); }
        .btn-half {
          padding: 9px; background: var(--bg3); color: var(--text2);
          border: 1px solid var(--border2); border-radius: var(--radius);
          font-size: 12px; font-family: var(--font); cursor: pointer; transition: all 0.15s;
        }
        .btn-half:hover { border-color: var(--accent); color: var(--accent); }
        .btn-note-cancel {
          padding: 5px 10px; border: 1px solid var(--border2);
          border-radius: var(--radius-sm); background: var(--bg3);
          font-size: 10px; cursor: pointer; color: var(--text3); font-family: var(--font);
        }
        .btn-clear {
          padding: 7px 11px; border: 1px solid var(--border2);
          border-radius: var(--radius); background: var(--bg3);
          color: var(--text3); cursor: pointer; font-size: 12px; flex-shrink: 0; transition: all 0.15s;
        }
        .btn-clear:hover { border-color: var(--red); color: var(--red); }

        /* ═══════════════════════════════════
           STATS CARDS
        ═══════════════════════════════════ */
        .inv-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
        .stat-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 14px 16px;
          transition: all 0.2s ease; position: relative; overflow: hidden;
        }
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
        }
        .stat-card:hover { border-color: var(--border2); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
        .stat-label { font-size: 10px; color: var(--text3); margin-bottom: 6px; font-weight: 500; letter-spacing: 0.03em; display: flex; align-items: center; gap: 5px; }
        .stat-val { font-size: 28px; font-weight: 700; color: var(--text1); line-height: 1; }
        .stat-sub { font-size: 10px; color: var(--text4); margin-top: 4px; }

        /* ═══════════════════════════════════
           TABLE
        ═══════════════════════════════════ */
        .dt-table {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .dt-head {
          display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr;
          background: var(--bg3); border-bottom: 1px solid var(--border);
        }
        .dt-th { font-size: 9px; font-weight: 600; color: var(--text4); padding: 9px 14px; text-transform: uppercase; letter-spacing: 0.1em; }
        .dt-row {
          display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr;
          border-bottom: 1px solid var(--border); cursor: pointer;
          transition: background 0.12s;
        }
        .dt-row:last-child { border-bottom: none; }
        .dt-row:hover { background: rgba(255,255,255,0.02); }
        .dt-td { font-size: 12px; color: var(--text2); padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
        .dt-td.dt-muted { color: var(--text3); font-size: 11px; }
        .dt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dt-model { font-size: 12px; font-weight: 500; color: var(--text1); }
        .dt-serial { font-family: var(--mono); font-size: 9px; color: var(--text4); margin-top: 1px; }
        .dt-note-row { padding: 5px 14px 8px; background: var(--bg2); border-bottom: 1px solid var(--border); }

        /* ═══════════════════════════════════
           STATUS PILLS
        ═══════════════════════════════════ */
        .status-pill { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 20px; white-space: nowrap; letter-spacing: 0.02em; }
        .pill-green  { background: var(--green-bg);  color: var(--green);  border: 1px solid rgba(52,211,153,0.2);  }
        .pill-amber  { background: var(--orange-bg); color: var(--orange); border: 1px solid rgba(251,146,60,0.2);  }
        .pill-gray   { background: rgba(255,255,255,0.04); color: var(--text3); border: 1px solid var(--border2); }
        .pill-blue   { background: var(--blue-bg);   color: var(--blue);   border: 1px solid rgba(96,165,250,0.2);  }
        .pill-purple { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(167,139,250,0.2); }

        /* ═══════════════════════════════════
           MOBILE HEADER
        ═══════════════════════════════════ */
        .mob-header {
          background: var(--bg2);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 10;
          backdrop-filter: blur(12px);
        }
        .mob-header-top { padding: 12px 16px 10px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 16px; font-weight: 700; letter-spacing: -0.4px; }
        .logo .t { color: var(--text1); }
        .logo span { color: var(--accent); }
        .user-area { display: flex; align-items: center; gap: 8px; }
        .user-name { font-size: 11px; color: var(--text3); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-logout { background: none; border: 1px solid var(--border2); border-radius: var(--radius-sm); padding: 4px 10px; font-size: 11px; cursor: pointer; color: var(--text3); transition: all 0.15s; font-family: var(--font); }
        .btn-logout:hover { border-color: var(--red); color: var(--red); }
        .mob-dark-btn { background: none; border: none; cursor: pointer; font-size: 15px; color: var(--text4); padding: 3px; }
        .mob-nav { display: flex; padding: 0 10px 10px; gap: 2px; }
        .mob-nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border-radius: var(--radius-sm); border: none; background: transparent; font-size: 10px; font-family: var(--font); cursor: pointer; color: var(--text4); transition: all 0.15s; font-weight: 500; }
        .mob-nav-btn span:first-child { font-size: 16px; }
        .mob-nav-btn.active { background: var(--accent-glow); color: var(--accent); }
        .mob-main { flex: 1; padding: 14px 16px; background: var(--bg); }

        /* ─── DATE INPUT ─── */
        input[type="date"].text-input { width: 100%; max-width: 100%; min-width: 0; appearance: none; -webkit-appearance: none; color-scheme: dark; }

        /* ═══════════════════════════════════
           CARDS & SHARED
        ═══════════════════════════════════ */
        .card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 18px; margin-bottom: 12px;
          position: relative; overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(167,139,250,0.3), transparent);
        }
        .card-title { font-size: 15px; font-weight: 600; color: var(--text1); margin-bottom: 4px; }
        .card-sub { font-size: 12px; color: var(--text3); margin-bottom: 16px; }
        .section-label { font-size: 9px; font-weight: 700; color: var(--text4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
        .field-group { margin-bottom: 12px; }
        .field-label { font-size: 11px; color: var(--text3); display: block; margin-bottom: 5px; font-weight: 500; }
        select, textarea, .text-input {
          width: 100%; padding: 10px 12px;
          border-radius: var(--radius); border: 1px solid var(--border2);
          background: var(--bg3); font-size: 12px; color: var(--text1);
          font-family: var(--font); outline: none; transition: all 0.15s;
        }
        select:focus, textarea:focus, .text-input:focus {
          border-color: var(--accent);
          background: var(--bg4);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        select option { background: var(--bg3); }
        textarea { resize: none; height: 70px; }
        .text-input::placeholder { color: var(--text4); }

        .upload-area {
          border: 1px dashed var(--border2);
          border-radius: var(--radius-lg); padding: 36px 20px;
          text-align: center; cursor: pointer; transition: all 0.2s;
          background: var(--bg3); position: relative; overflow: hidden;
        }
        .upload-area:hover { border-color: var(--accent); background: rgba(167,139,250,0.03); box-shadow: 0 0 20px var(--accent-glow) inset; }
        .upload-icon { font-size: 30px; margin-bottom: 10px; display: block; }
        .upload-title { font-size: 13px; font-weight: 500; color: var(--text2); margin-bottom: 4px; }
        .upload-sub { font-size: 12px; color: var(--text4); }
        .preview-img { width: 100%; border-radius: var(--radius); max-height: 240px; object-fit: contain; }

        .ai-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; background: var(--green-bg); color: var(--green);
          padding: 5px 12px; border-radius: 20px; margin-bottom: 14px;
          font-weight: 600; border: 1px solid rgba(52,211,153,0.2);
        }
        .error-banner { background: var(--red-bg); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius); padding: 10px 14px; font-size: 12px; color: var(--red); margin-bottom: 14px; }
        .banner-success { background: var(--green-bg); color: var(--green); padding: 10px 14px; border-radius: var(--radius); font-size: 12px; margin-bottom: 14px; border: 1px solid rgba(52,211,153,0.2); }

        /* ─── ACTION TILES ─── */
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .action-tile {
          background: var(--bg3); border: 1px solid var(--border2);
          border-radius: var(--radius-lg); padding: 14px;
          cursor: pointer; transition: all 0.15s;
        }
        .action-tile:hover { border-color: var(--accent); background: rgba(167,139,250,0.05); }
        .action-tile.selected { border-color: var(--accent); background: var(--accent-glow); box-shadow: 0 0 16px var(--accent-glow); }
        .action-icon { font-size: 20px; margin-bottom: 6px; display: block; }
        .action-title { font-size: 12px; font-weight: 600; color: var(--text2); }
        .action-sub { font-size: 10px; color: var(--text4); margin-top: 3px; }
        .sub-action-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; animation: fadeIn 0.15s ease; }
        .sub-action-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid var(--border2);
          border-radius: var(--radius); cursor: pointer;
          transition: all 0.15s; background: var(--bg3);
        }
        .sub-action-item:hover { border-color: var(--accent); }
        .sub-action-item.selected { border-color: var(--accent); background: var(--accent-glow); }
        .sub-action-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
        .sub-action-label { font-size: 12px; font-weight: 500; color: var(--text2); }
        .sub-action-desc { font-size: 10px; color: var(--text4); margin-top: 2px; }
        .selected-action-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--accent-glow); color: var(--accent);
          font-size: 11px; font-weight: 600; padding: 5px 12px;
          border-radius: 20px; margin-bottom: 6px;
          border: 1px solid rgba(167,139,250,0.2);
        }

        /* ─── STORE PICKER ─── */
        .store-display { display: flex; align-items: center; min-height: 40px; flex: 1; }
        .store-picker { border: 1px solid var(--border2); border-radius: var(--radius-lg); padding: 12px; background: var(--bg3); }
        .chain-tabs { display: flex; gap: 5px; overflow-x: auto; padding: 6px 0; scrollbar-width: none; }
        .chain-tabs::-webkit-scrollbar { display: none; }
        .chain-tab { flex-shrink: 0; padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border2); font-size: 10px; cursor: pointer; background: var(--bg4); color: var(--text3); transition: all 0.15s; font-family: var(--font); white-space: nowrap; font-weight: 500; }
        .chain-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 2px 8px var(--accent-glow); }
        .store-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; margin-top: 6px; }
        .store-item { padding: 8px 10px; border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; color: var(--text2); transition: all 0.1s; }
        .store-item:hover { background: var(--bg4); color: var(--text1); }
        .store-item.active { background: var(--accent-glow); color: var(--accent); font-weight: 500; }

        /* ─── FILTERS ─── */
        .filter-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .filter-pill { padding: 5px 11px; border-radius: 20px; border: 1px solid var(--border2); background: var(--bg3); font-size: 10px; cursor: pointer; color: var(--text3); font-family: var(--font); transition: all 0.15s; font-weight: 500; }
        .filter-pill:hover { border-color: var(--accent); color: var(--accent); }
        .filter-pill.active { background: var(--accent-glow); color: var(--accent); border-color: rgba(167,139,250,0.3); }
        .period-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .period-pill { padding: 5px 11px; border-radius: 20px; border: 1px solid var(--border2); background: var(--bg3); font-size: 10px; cursor: pointer; color: var(--text3); font-family: var(--font); transition: all 0.15s; font-weight: 500; }
        .period-pill:hover { border-color: var(--accent); color: var(--accent); }
        .period-pill.active { background: var(--accent-glow); color: var(--accent); border-color: rgba(167,139,250,0.3); }
        .sort-btn { padding: 5px 11px; border-radius: 20px; border: 1px solid var(--border2); background: var(--bg3); font-size: 10px; cursor: pointer; color: var(--text3); font-family: var(--font); transition: all 0.15s; white-space: nowrap; font-weight: 500; }
        .sort-btn:hover { border-color: var(--accent); color: var(--accent); }
        .custom-date-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .custom-date-row .field-label { margin: 0; white-space: nowrap; }

        /* ─── MACHINE CARDS (mobile) ─── */
        .machine-row {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 12px 14px;
          margin-bottom: 8px; display: flex; align-items: flex-start;
          gap: 10px; cursor: pointer; transition: all 0.15s;
        }
        .machine-row:hover { border-color: var(--accent); background: rgba(167,139,250,0.03); }
        .machine-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .machine-info { flex: 1; min-width: 0; }
        .machine-name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
        .machine-name { font-size: 13px; font-weight: 600; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .machine-serial { font-family: var(--mono); font-size: 9px; color: var(--text4); }
        .machine-bottom { display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
        .machine-store { font-size: 11px; color: var(--text3); }
        .machine-date { font-size: 11px; color: var(--text4); }
        .machine-problem { font-size: 11px; color: var(--orange); margin-top: 3px; }
        .machine-user { font-size: 11px; color: var(--green); margin-top: 2px; }

        /* ─── HISTORY ─── */
        .history-item { display: flex; gap: 12px; margin-bottom: 12px; }
        .h-dot-wrap { display: flex; flex-direction: column; align-items: center; }
        .h-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--accent); background: var(--bg); flex-shrink: 0; margin-top: 4px; box-shadow: 0 0 8px var(--accent-glow); }
        .h-line { width: 1px; flex: 1; background: var(--border); margin-top: 4px; min-height: 18px; }
        .h-card { flex: 1; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 13px; transition: border-color 0.15s; }
        .h-card:hover { border-color: var(--border2); }
        .h-action-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
        .h-action { font-size: 12px; font-weight: 600; color: var(--text1); }
        .h-meta { font-size: 10px; color: var(--text4); }
        .h-notes { font-size: 11px; color: var(--text3); margin-top: 4px; }
        .h-machine { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
        .h-machine-model { font-size: 12px; font-weight: 600; color: var(--text1); }
        .h-machine-serial { font-family: var(--mono); font-size: 10px; color: var(--text4); }
        .history-machine-header {
          background: var(--bg2); border: 1px solid var(--accent);
          border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 16px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          box-shadow: 0 0 20px var(--accent-glow);
        }
        .history-machine-info { flex: 1; min-width: 0; }
        .history-machine-model { font-size: 15px; font-weight: 700; color: var(--text1); margin-bottom: 3px; }
        .history-machine-serial { font-family: var(--mono); font-size: 11px; color: var(--text3); margin-bottom: 4px; }
        .history-machine-count { font-size: 10px; color: var(--text4); }
        .history-store-header { padding: 8px 0 12px; }
        .history-store-count { font-size: 13px; color: var(--text3); }
        .quick-action-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--bg2); border: 1px solid var(--border2);
          border-radius: var(--radius-lg); padding: 12px 16px; margin-bottom: 16px;
        }
        .quick-action-info { display: flex; flex-direction: column; gap: 3px; }
        .quick-serial { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--text1); }
        .quick-model { font-size: 11px; color: var(--text4); }

        /* ─── SUCCESS ─── */
        .success-card { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .success-title { font-size: 20px; font-weight: 700; color: var(--text1); margin-bottom: 8px; }
        .success-sub { font-size: 13px; color: var(--text3); line-height: 1.8; margin-bottom: 20px; }

        /* ─── BADGES & MISC ─── */
        .repair-badge { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 20px; white-space: nowrap; margin-left: 6px; letter-spacing: 0.03em; }
        .repair-badge-warning { background: var(--orange-bg); color: var(--orange); border: 1px solid rgba(251,146,60,0.2); }
        .repair-badge-danger  { background: var(--red-bg);    color: var(--red);    border: 1px solid rgba(248,113,113,0.2); }
        .existing-item-banner { background: var(--orange-bg); border: 1px solid rgba(251,146,60,0.2); border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 16px; }
        .existing-item-title { font-size: 12px; font-weight: 700; color: var(--orange); margin-bottom: 6px; }
        .existing-item-info { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 13px; color: var(--text1); }
        .existing-item-meta { font-size: 11px; color: var(--text3); margin-bottom: 6px; }
        .existing-item-note { font-size: 10px; color: var(--orange); font-style: italic; }
        .note-display-desktop { cursor: pointer; display: inline-flex; align-items: center; }
        .note-input-inline { flex: 1; padding: 6px 10px; font-size: 12px; }
        .note-edit { margin-top: 8px; }
        .note-input { width: 100%; padding: 8px 11px; border: 1px solid var(--border2); border-radius: var(--radius); font-size: 12px; font-family: var(--font); resize: none; height: 60px; background: var(--bg3); color: var(--text1); transition: border-color 0.15s; }
        .note-input:focus { border-color: var(--accent); outline: none; }
        .note-display { margin-top: 6px; cursor: pointer; padding: 4px 0; }
        .note-text { font-size: 11px; color: var(--text3); }
        .note-empty { font-size: 11px; color: var(--text4); }
        .store-edit-picker { min-width: 240px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-lg); padding: 10px; box-shadow: var(--shadow); }
        .store-edit-display { cursor: pointer; color: var(--text3); font-size: 12px; transition: color 0.15s; }
        .store-edit-display:hover { color: var(--accent); }
        .wh-section-title { font-size: 11px; font-weight: 700; color: var(--text2); margin: 16px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); letter-spacing: 0.02em; }
        .divider-or { text-align: center; color: var(--text4); font-size: 11px; margin: 8px 0; position: relative; }
        .divider-or::before, .divider-or::after { content: ''; position: absolute; top: 50%; width: 44%; height: 1px; background: var(--border2); }
        .divider-or::before { left: 0; } .divider-or::after { right: 0; }
        .settings-store-item { padding: 8px 4px; font-size: 12px; color: var(--text3); border-bottom: 1px solid var(--border); }
        .loading { text-align: center; padding: 48px; color: var(--text4); font-size: 13px; }
        .empty { text-align: center; padding: 48px 20px; color: var(--text4); font-size: 13px; line-height: 1.7; }
        .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }

        /* ═══════════════════════════════════
           LIGHT MODE (when NOT .dark)
        ═══════════════════════════════════ */
        .desktop-layout:not(.dark), .mobile-layout:not(.dark) {
          --bg:        #f5f5f5;
          --bg2:       #ffffff;
          --bg3:       #f0f0f0;
          --bg4:       #e8e8e8;
          --bg5:       #e0e0e0;
          --border:    rgba(0,0,0,0.07);
          --border2:   rgba(0,0,0,0.12);
          --text1:     #111111;
          --text2:     #444444;
          --text3:     #888888;
          --text4:     #bbbbbb;
          --accent:    #7c3aed;
          --accent-glow: rgba(124,58,237,0.12);
          --green-bg:  rgba(22,163,74,0.08);
          --orange-bg: rgba(234,88,12,0.08);
          --red-bg:    rgba(220,38,38,0.08);
          --blue-bg:   rgba(37,99,235,0.08);
        }
        .desktop-layout:not(.dark) body,
        .mobile-layout:not(.dark) body { background: #f5f5f5; }
        .desktop-layout:not(.dark) .sidebar { background: #1a1a18; }
        .desktop-layout:not(.dark) .desktop-header { background: rgba(255,255,255,0.9); }
        .desktop-layout:not(.dark) .mob-header { background: rgba(255,255,255,0.95); }
        .desktop-layout:not(.dark) .dt-row:hover { background: #fafafa; }
        .desktop-layout:not(.dark) .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

        /* ═══════════════════════════════════
           ANIMATIONS
        ═══════════════════════════════════ */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow-pulse { 0%,100% { box-shadow: 0 0 12px var(--accent-glow); } 50% { box-shadow: 0 0 24px var(--accent-glow); } }
        .fade-in { animation: fadeIn 0.2s ease; }

        @media (prefers-reduced-motion: reduce) {
          *, .fade-in { animation: none !important; transition: none !important; }
        }
        @media (max-width: 767px) {
          .inv-stats { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
          .stat-card { padding: 12px; }
          .stat-val { font-size: 24px; }
        }
      `}</style>
    </>
  );
}
