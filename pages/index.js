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

// Αναζήτηση χωρίς τόνους / κεφαλαία
const normalizeSearch = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const STORE_CHAINS = [
  { id: 'all', label: 'Όλα' },
  { id: 'ΚΩΤΣΟΒΟΛΟΣ', label: 'ΚΩΤΣΟΒΟΛΟΣ' },
  { id: 'MINI KIOSK', label: 'MINI KIOSK' },
  { id: 'ΚΤΕΛ', label: 'ΚΤΕΛ' },
  { id: 'THE BEAUTY BAR', label: 'BEAUTY BAR' },
  { id: 'ΡΟΥΠΑΣ', label: 'ΡΟΥΠΑΣ' },
  { id: 'other', label: 'Άλλα' },
];

// Width of the swipe-reveal action tray in px (module-level so it's never recreated)
const SWIPE_W = 200;

const TAB_IDS = ['home', 'scan', 'inventory', 'warehouse', 'history', 'tickets', 'settings'];
const INVENTORY_CACHE_KEY = 'trackmate_inventory_cache_v1';
const MACHINE_CATEGORIES = ['CashDro', "McDonald's"];

const readInventoryCache = () => {
  if (typeof window === 'undefined') return [];
  try {
    const cached = JSON.parse(localStorage.getItem(INVENTORY_CACHE_KEY) || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
};

// ══════════════════════════════════════════════
// ΓΡΑΦΗΜΑΤΑ ΑΡΧΙΚΗΣ (χωρίς βιβλιοθήκη — HTML/CSS)
// Χρώματα: --c-avail / --c-repair / --c-store / --c-central (ελεγμένα για αχρωματοψία)
// ══════════════════════════════════════════════
const FLEET_SERIES = [
  { key: 'avail',   label: 'Διαθέσιμα',      color: 'var(--c-avail)' },
  { key: 'repair',  label: 'Σε επισκευή',    color: 'var(--c-repair)' },
  { key: 'store',   label: 'Σε καταστήματα', color: 'var(--c-store)' },
  { key: 'central', label: 'Στα κεντρικά',   color: 'var(--c-central)' },
];

// Μία οριζόντια μπάρα: πού βρίσκεται όλος ο στόλος
function FleetBar({ counts, onSelect, ready }) {
  const [hover, setHover] = useState(null);
  const total = FLEET_SERIES.reduce((s, x) => s + (counts[x.key] || 0), 0);
  const pct = n => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="fleet">
      <div className="fleet-bar" role="img" aria-label={FLEET_SERIES.map(s => `${s.label}: ${counts[s.key] || 0}`).join(', ')}>
        {total === 0 && <div className="fleet-empty" />}
        {FLEET_SERIES.filter(s => counts[s.key] > 0).map(s => (
          <button key={s.key} className={`fleet-seg ${hover && hover !== s.key ? 'dim' : ''}`}
            style={{ flexGrow: counts[s.key], background: s.color }}
            onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.key)} onBlur={() => setHover(null)}
            onClick={() => onSelect?.(s.key)}
            aria-label={`${s.label}: ${counts[s.key]}`}>
            {hover === s.key && <span className="chart-tip">{s.label}: <strong>{counts[s.key]}</strong> ({pct(counts[s.key])}%)</span>}
          </button>
        ))}
      </div>
      <div className="fleet-legend">
        {FLEET_SERIES.map(s => (
          <button key={s.key} className={`fleet-key ${hover === s.key ? 'on' : ''}`} onClick={() => onSelect?.(s.key)}
            onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="fleet-swatch" style={{ background: s.color }} />
            <span className="fleet-key-label">{s.label}</span>
            <span className="fleet-key-num">{ready ? (counts[s.key] || 0) : '—'}</span>
            <span className="fleet-key-pct">{ready && total ? `${pct(counts[s.key] || 0)}%` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const WEEK_SERIES = [
  { key: 'Καινούριο Μηχάνημα',     label: 'Νέα στην αποθήκη', color: 'var(--c-avail)' },
  { key: 'Εισαγωγή για επισκευή',  label: 'Επισκευές',        color: 'var(--c-repair)' },
  { key: 'Αποστολή σε κατάστημα',  label: 'Σε καταστήματα',   color: 'var(--c-store)' },
  { key: 'Αποστολή στα κεντρικά',  label: 'Στα κεντρικά',     color: 'var(--c-central)' },
];

// Στρογγυλό μέγιστο άξονα, ώστε και το μισό του να είναι ακέραιο (π.χ. 25 → 30, 9 → 10)
const niceMax = (v) => {
  if (v <= 4) return 4;
  const half = v / 2;
  const pow = Math.pow(10, Math.floor(Math.log10(half)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(n => n * pow).find(x => x >= half && Number.isInteger(x));
  return (step || Math.ceil(half)) * 2;
};

// Στοιβαγμένες στήλες: κινήσεις ανά εβδομάδα
function WeeklyChart({ weeks }) {
  const [hover, setHover] = useState(null);
  const totals = weeks.map(w => WEEK_SERIES.reduce((s, x) => s + (w.counts[x.key] || 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = [0, max / 2, max];
  return (
    <div className="wchart">
      <div className="chart-legend">
        {WEEK_SERIES.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <div className="wchart-plot">
        <div className="wchart-grid">
          {ticks.slice().reverse().map(t => <div key={t} className="wchart-gridline"><span>{t}</span></div>)}
        </div>
        <div className="wchart-cols">
          {weeks.map((w, i) => (
            <div key={w.label} className={`wchart-col ${hover === i ? 'on' : ''}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} tabIndex={0}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`Εβδομάδα ${w.label}: ${totals[i]} κινήσεις`}>
              <div className="wchart-stack" style={{ height: `${(totals[i] / max) * 100}%` }}>
                {WEEK_SERIES.filter(s => w.counts[s.key]).map(s => (
                  <div key={s.key} className="wchart-seg" style={{ flexGrow: w.counts[s.key], background: s.color }} />
                ))}
              </div>
              <span className="wchart-x">{w.label}</span>
              {hover === i && (
                <div className={`chart-tip wide ${i > weeks.length - 3 ? 'left' : ''}`}>
                  <div className="tip-title">Εβδομάδα {w.range}</div>
                  {WEEK_SERIES.map(s => (
                    <div key={s.key} className="tip-row"><i style={{ background: s.color }} />{s.label}<strong>{w.counts[s.key] || 0}</strong></div>
                  ))}
                  <div className="tip-row total">Σύνολο<strong>{totals[i]}</strong></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Οριζόντιες μπάρες, μία σειρά (π.χ. μηχανήματα ανά αλυσίδα)
function HBarChart({ rows, color, onSelect, unit = '' }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="hbars">
      {rows.map(r => (
        <button key={r.label} className="hbar-row" onClick={() => onSelect?.(r)} title={`${r.label}: ${r.value}${unit}`}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="hbar-value">{r.value}</span>
        </button>
      ))}
    </div>
  );
}

// Πόσες μέρες είναι τα μηχανήματα σε επισκευή
function AgingChart({ buckets, onSelect }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(1, ...buckets.map(b => b.value)));
  return (
    <div className="aging">
      <div className="aging-cols">
        {buckets.map((b, i) => (
          <button key={b.label} className={`aging-col ${b.late ? 'late' : ''}`} onClick={onSelect}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            aria-label={`${b.label} ημέρες: ${b.value} μηχανήματα`}>
            <span className="aging-val">{b.value}</span>
            <span className="aging-bar" style={{ height: `${(b.value / max) * 100}%` }} />
            <span className="aging-x">{b.label}</span>
            {hover === i && <span className="chart-tip">{b.value} μηχ. · {b.label} ημέρες</span>}
          </button>
        ))}
      </div>
      <div className="aging-note"><i className="late" /> πάνω από 7 ημέρες σε επισκευή</div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const isViewer = currentUser?.role === 'viewer';
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('trackmate_sidebar', next ? 'collapsed' : 'open'); } catch (e) {}
      return next;
    });
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('trackmate_dark', next ? '1' : '0');
      return next;
    });
  };
  const [tab, setTab] = useState('home');
  const [step, setStep] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [itemsList, setItemsList] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [manualItemEntry, setManualItemEntry] = useState(false);
  const [partsList, setPartsList] = useState([]);
  const [machineParts, setMachineParts] = useState({});
  const [partModalItem, setPartModalItem] = useState(null);
  const [partSearch, setPartSearch] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [manualPartEntry, setManualPartEntry] = useState(false);
  const [manualPartCode, setManualPartCode] = useState('');
  const [partSerialInput, setPartSerialInput] = useState('');
  const [manualPartDescription, setManualPartDescription] = useState('');
  const [savingPart, setSavingPart] = useState(false);
  const [machineLogLinks, setMachineLogLinks] = useState({});
  const [logLinkModalItem, setLogLinkModalItem] = useState(null);
  const [logLinkInput, setLogLinkInput] = useState('');
  const [savingLogLink, setSavingLogLink] = useState(false);
  const [action, setAction] = useState('');
  const [existingItem, setExistingItem] = useState(null); // υπάρχον μηχάνημα με ίδιο serial
  const [actionCat, setActionCat] = useState(null);
  const [machineCategory, setMachineCategory] = useState('CashDro');
  const [store, setStore] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeChain, setStoreChain] = useState('all');
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [problem, setProblem] = useState('');
  const [notes, setNotes] = useState('');
  const [shipmentMethod, setShipmentMethod] = useState('ours');
  const [shipmentCourier, setShipmentCourier] = useState('');
  const [shipmentItemDescription, setShipmentItemDescription] = useState('');
  const [shipmentPrice, setShipmentPrice] = useState('');
  const [shipmentPurpose, setShipmentPurpose] = useState('');
  const [shipmentNotes, setShipmentNotes] = useState('');
  const [copiedShipmentEmail, setCopiedShipmentEmail] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [inventory, setInventory] = useState(() => readInventoryCache());
  const [inventorySnapshotReady, setInventorySnapshotReady] = useState(() => readInventoryCache().length > 0);
  const [loadingInv, setLoadingInv] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [history, setHistory] = useState(null);
  const [historySerial, setHistorySerial] = useState('');
  const [historyStore, setHistoryStore] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [filterAction, setFilterAction] = useState('Όλα');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all');
  const [homeCategoryFilter, setHomeCategoryFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [warehouseCategoryFilter, setWarehouseCategoryFilter] = useState('all');
  const [historyStoreCategoryFilter, setHistoryStoreCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterPeriod, setFilterPeriod] = useState('all'); // all | today | 7 | 30 | custom
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [storesList, setStoresList] = useState([]);
  const [storeDetailsList, setStoreDetailsList] = useState([]);
  const [selectedStoreDetails, setSelectedStoreDetails] = useState(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreVat, setNewStoreVat] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  const [addStoreMsg, setAddStoreMsg] = useState(null);
  const [storeDetailsDraft, setStoreDetailsDraft] = useState({ name: '', phone: '', address: '', vat: '', contract: '', contractStart: '', contractEnd: '' });
  const [savingStoreDetails, setSavingStoreDetails] = useState(false);
  const [storeDetailsMsg, setStoreDetailsMsg] = useState(null);
  const [settingsStoreSearch, setSettingsStoreSearch] = useState('');
  const [trashItems, setTrashItems] = useState([]);
  // ── Tickets (από email) ──
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState('');
  const [ticketFilter, setTicketFilter] = useState('open'); // open | Νέο | Ελλιπές | Σε εξέλιξη | Κλειστό | all
  const [ticketSearch, setTicketSearch] = useState('');
  const [allMovements, setAllMovements] = useState(null); // όλες οι κινήσεις, για τα γραφήματα
  const [openTicketId, setOpenTicketId] = useState(null);
  const [ticketNoteDraft, setTicketNoteDraft] = useState('');
  const [ticketLogDraft, setTicketLogDraft] = useState(''); // νέο link logs στο ticket
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [ticketDraft, setTicketDraft] = useState({});
  const [ticketDeleteConfirm, setTicketDeleteConfirm] = useState(null);
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [trashBusy, setTrashBusy] = useState(null); // batchId που γίνεται restore/purge
  const [warehouseNotes, setWarehouseNotes] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({}); // serials με ανοιχτό ιστορικό
  const [editingStore, setEditingStore] = useState(null); // serial που επεξεργάζεται κατάστημα
  const [editStoreSearch, setEditStoreSearch] = useState('');
  const [editStoreChain, setEditStoreChain] = useState('all');
  const [savingStore, setSavingStore] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [editDateValue, setEditDateValue] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [mobileSheet, setMobileSheet] = useState(null);
  const [swipedItem, setSwipedItem] = useState(null);
  const swipedItemRef = useRef(null); // mirrors swipedItem for use inside non-reactive callbacks
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const fileRef = useRef();
  const cameraRef = useRef();
  const mobMainRef = useRef(null);
  const swipeElRef = useRef(null);
  const swipeDrag = useRef({ x: 0, y: 0, baseX: 0, horiz: null, serial: null });
  const pullTouchStartY = useRef(0);
  const inventoryRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  // Φόρτωση καταστημάτων από Sheet
  const loadStores = async () => {
    try {
      const res = await fetch('/api/stores', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return;
      setStoresList(data.stores || []);
      setStoreDetailsList(data.storeDetails || []);
    } catch (e) {}
  };

  const loadNotes = async () => {
    try {
      const res = await fetch('/api/notes', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return;
      setWarehouseNotes(data.notes || {});
    } catch (e) {}
  };

  const loadTrash = async () => {
    setLoadingTrash(true);
    try {
      const res = await fetch('/api/trash');
      const data = await res.json();
      setTrashItems(data.items || []);
    } catch (e) {
      setTrashItems([]);
    } finally {
      setLoadingTrash(false);
    }
  };

  const restoreTrashItem = async (batchId) => {
    setTrashBusy(batchId);
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error();
      await loadTrash();
      loadInventory();
      loadNotes();
      loadParts();
    } catch (e) {
      alert('Σφάλμα επαναφοράς.');
    } finally {
      setTrashBusy(null);
    }
  };

  const purgeTrashItem = async (batchId) => {
    if (!confirm('Οριστική διαγραφή; Δεν θα μπορεί να γίνει επαναφορά.')) return;
    setTrashBusy(batchId);
    try {
      const res = await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error();
      await loadTrash();
    } catch (e) {
      alert('Σφάλμα οριστικής διαγραφής.');
    } finally {
      setTrashBusy(null);
    }
  };

  const loadItems = async () => {
    try {
      const res = await fetch('/api/items');
      const data = await res.json();
      setItemsList(data.items || []);
    } catch (e) {}
  };

  const loadParts = async () => {
    try {
      const res = await fetch('/api/parts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return;
      setPartsList(data.parts || []);
      setMachineParts(data.machineParts || {});
    } catch (e) {}
  };

  const loadLogLinks = async () => {
    try {
      const res = await fetch('/api/log-links', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) return;
      setMachineLogLinks(data.links || {});
    } catch (e) {}
  };

  const handleSaveNote = async (serialNumber) => {
    if (!noteInput.trim()) return;
    setSavingNote(true);
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, note: noteInput }),
      });
      // Ενημερώνουμε τοπικά — προσθέτουμε στο array αντί να αντικαθιστούμε
      const newNote = {
        note: noteInput,
        createdAt: new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
        createdBy: currentUser?.fullName || '',
      };
      setWarehouseNotes(prev => ({
        ...prev,
        [serialNumber]: [newNote, ...(prev[serialNumber] || [])],
      }));
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
        body: JSON.stringify({
          name: newStoreName.trim(),
          phone: newStorePhone.trim(),
          address: newStoreAddress.trim(),
          vat: newStoreVat.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddStoreMsg({ type: 'error', text: data.error });
      } else {
        setAddStoreMsg({ type: 'success', text: 'Το κατάστημα προστέθηκε!' });
        setNewStoreName('');
        setNewStorePhone('');
        setNewStoreAddress('');
        setNewStoreVat('');
        loadStores();
      }
    } catch (e) {
      setAddStoreMsg({ type: 'error', text: 'Σφάλμα δικτύου.' });
    } finally {
      setAddingStore(false);
    }
  };

  const openStoreDetails = (store) => {
    const next = {
      name: store.name || '',
      phone: store.phone || '',
      address: store.address || '',
      vat: store.vat || '',
      contract: store.contract || '',
      contractStart: store.contractStart || '',
      contractEnd: store.contractEnd || '',
    };
    setSelectedStoreDetails(next);
    setStoreDetailsDraft(next);
    setStoreDetailsMsg(null);
  };

  const closeStoreDetails = () => {
    setSelectedStoreDetails(null);
    setStoreDetailsDraft({ name: '', phone: '', address: '', vat: '', contract: '', contractStart: '', contractEnd: '' });
    setStoreDetailsMsg(null);
  };

  const updateStoreDetailsDraft = (field, value) => {
    setStoreDetailsDraft(prev => ({ ...prev, [field]: value }));
    setStoreDetailsMsg(null);
  };

  const handleSaveStoreDetails = async () => {
    if (!selectedStoreDetails || !storeDetailsDraft.name.trim()) return;
    setSavingStoreDetails(true);
    setStoreDetailsMsg(null);
    try {
      const updatedStore = {
        name: storeDetailsDraft.name.trim(),
        phone: storeDetailsDraft.phone.trim(),
        address: storeDetailsDraft.address.trim(),
        vat: storeDetailsDraft.vat.trim(),
        contract: storeDetailsDraft.contract.trim(),
        contractStart: storeDetailsDraft.contractStart.trim(),
        contractEnd: storeDetailsDraft.contractEnd.trim(),
      };
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: selectedStoreDetails.name,
          ...updatedStore,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Σφάλμα ενημέρωσης καταστήματος');
      setSelectedStoreDetails(updatedStore);
      setStoreDetailsDraft(updatedStore);
      setStoresList(prev => prev.map(s => s === selectedStoreDetails.name ? updatedStore.name : s));
      setStoreDetailsList(prev => prev.map(s => s.name === selectedStoreDetails.name ? updatedStore : s));
      if (historyStore === selectedStoreDetails.name) setHistoryStore(updatedStore.name);
      if (store === selectedStoreDetails.name) setStore(updatedStore.name);
      setStoreDetailsMsg({ type: 'success', text: 'Τα στοιχεία ενημερώθηκαν.' });
      loadStores();
    } catch (e) {
      setStoreDetailsMsg({ type: 'error', text: e.message || 'Σφάλμα ενημέρωσης καταστήματος.' });
    } finally {
      setSavingStoreDetails(false);
    }
  };

  // Φόρτωση συνδεδεμένου χρήστη και καταστημάτων
  useEffect(() => {
    // Φόρτωση dark mode preference
    const saved = localStorage.getItem('trackmate_dark');
    if (saved === '1') setDarkMode(true);
    if (saved === '0') setDarkMode(false); // κρατάει και την επιλογή φωτεινού θέματος
    try { if (localStorage.getItem('trackmate_sidebar') === 'collapsed') setSidebarCollapsed(true); } catch (e) {}

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCurrentUser(data.user); })
      .catch(() => {});

    loadStores();
    loadInventory();
    loadNotes();
    loadItems();
    loadParts();
    loadLogLinks();

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

  const cleanSerial = (value) => String(value || '').replace(/^'/, '').trim().toLowerCase();

  const findExistingSerial = (value) => {
    const sn = cleanSerial(value);
    if (!sn) return null;
    return inventory.find(i => cleanSerial(i.serialNumber) === sn) || null;
  };

  const isDuplicateNewMachine = () => (
    !!existingItem && normalizeAction(action) === 'Καινούριο Μηχάνημα'
  );

  const isShipmentBlockedByWarehouse = () => {
    const isShipment = ['Αποστολή σε κατάστημα', 'Αποστολή στα κεντρικά'].includes(normalizeAction(action));
    if (!isShipment || !serialNumber) return false;
    const sn = cleanSerial(serialNumber);
    const existing = inventory.find(i => cleanSerial(i.serialNumber) === sn);
    if (!existing) return true;
    return normalizeAction(existing.action) !== 'Καινούριο Μηχάνημα';
  };

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

      const scannedSerial = data.serialNumber !== 'unknown' ? data.serialNumber : '';
      const existingScannedItem = findExistingSerial(scannedSerial);
      setSerialNumber(scannedSerial);
      setModel(data.model !== 'unknown' ? data.model : '');
      setExistingItem(existingScannedItem);
      if (existingScannedItem) setMachineCategory(getMachineCategory(existingScannedItem));
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

  const isShipmentAction = () => ['Αποστολή σε κατάστημα', 'Αποστολή στα κεντρικά'].includes(action);

  const getSelectedStoreDetails = () => (
    storeDetailsList.find(s => s.name === store) || {
      name: store || (action === 'Αποστολή στα κεντρικά' ? 'Κεντρικά' : ''),
      phone: '',
      address: '',
      vat: '',
    }
  );

  const getStoreDetailsByName = (name) => (
    storeDetailsList.find(s => s.name === name) || {
      name: name || '',
      phone: '',
      address: '',
      vat: '',
      contract: '',
      contractStart: '',
      contractEnd: '',
    }
  );

  const getShipmentMethodLabel = () => (
    shipmentMethod === 'courier' ? 'Courier' : 'Με δική μας μεταφορά'
  );

  const buildMovementNotes = () => {
    if (!isShipmentAction()) return notes;
    const parts = [];
    if (notes.trim()) parts.push(notes.trim());
    parts.push(`Τρόπος μεταφοράς: ${getShipmentMethodLabel()}`);
    if (shipmentMethod === 'courier' && shipmentCourier.trim()) parts.push(`Courier: ${shipmentCourier.trim()}`);
    if (shipmentItemDescription.trim()) parts.push(`Περιγραφή είδους: ${shipmentItemDescription.trim()}`);
    if (shipmentNotes.trim()) parts.push(`Σημειώσεις αποστολής: ${shipmentNotes.trim()}`);
    return parts.join('\n');
  };

  const buildShipmentEmail = () => {
    const destination = getSelectedStoreDetails();
    const table = getShipmentBlocks(destination)
      .map((rows, i) => [`A/A ${i + 1}`, ...rows.map(([label, value]) => `${label}\t${value}`)].join('\n'))
      .join('\n\n');
    return `Θέμα: Αποστολή μηχανήματος ${model || serialNumber || ''} προς ${destination.name || store || 'προορισμό'}

Καλησπέρα,

Παρακαλώ δείτε τα στοιχεία αποστολής:

${table}

Ευχαριστώ.`;
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');

  const buildShipmentEmailHtml = () => {
    const destination = getSelectedStoreDetails();
    const tables = getShipmentBlocks(destination).map((rows, blockIndex) => {
    const bodyRows = rows.map(([label, value], index) => `
      <tr>
        ${index === 0 ? `<td rowspan="${rows.length}" style="border:1px solid #7f7f7f;padding:8px;text-align:center;vertical-align:top;width:42px;">${blockIndex + 1}</td>` : ''}
        <td style="border:1px solid #7f7f7f;background:#d8d1ff;padding:6px 8px;width:150px;vertical-align:top;">${escapeHtml(label)}:</td>
        <td style="border:1px solid #7f7f7f;padding:6px 8px;vertical-align:top;min-width:220px;">${escapeHtml(value)}</td>
      </tr>
    `).join('');

    return `
        <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #7f7f7f;font-family:Arial, sans-serif;font-size:14px;color:#000;">
          <tr>
            <th style="border:1px solid #7f7f7f;background:#c9c1ff;padding:7px 8px;width:42px;text-align:left;">A/A</th>
            <th style="border:1px solid #7f7f7f;background:#c9c1ff;padding:7px 8px;text-align:left;">CashDro &amp; McDonald's</th>
            <th style="border:1px solid #7f7f7f;background:#c9c1ff;padding:7px 8px;text-align:center;">Εξαγωγή ειδών</th>
          </tr>
          ${bodyRows}
        </table>`;
    }).join('\n        <br>\n');

    return `
      <div style="font-family:Arial, sans-serif;font-size:14px;color:#000;">
        <p>Καλησπέρα,</p>
        <p>Παρακαλώ δείτε τα στοιχεία αποστολής:</p>
        ${tables}
        <p>Ευχαριστώ.</p>
      </div>
    `;
  };

  const getShipmentRows = (destination = getSelectedStoreDetails()) => {
    const methodLabel = shipmentMethod === 'courier' && shipmentCourier.trim()
      ? `Courier (${shipmentCourier.trim()})`
      : getShipmentMethodLabel();
    const isMcD = machineCategory === "McDonald's";
    const eponymia = isMcD ? 'Premiere Capital Ελλάς' : (destination.name || store || '—');
    const branch = isMcD
      ? [destination.name || store, destination.address].filter(Boolean).join(' (') + (destination.address ? ')' : '')
      : (destination.address || '—');
    return [
      ['Επωνυμία Πελάτη', eponymia],
      ['ΑΦΜ', destination.vat || '—'],
      ['Υποκατάστημα', branch],
      ['Κωδικός Είδους', model || '—'],
      ['Περιγραφή Είδους', shipmentItemDescription || '—'],
      ['Σειριακός', serialNumber || '—'],
      ['Ποσότητα', '1'],
      ['Τιμή', shipmentPrice.trim() || '—'],
      ['Σκοπός Διακίνησης', shipmentPurpose.trim() || '—'],
      ['Τρόπος Αποστολής', methodLabel],
      ['Παρατηρήσεις', shipmentNotes.trim() || '—'],
    ];
  };

  // Ανταλλακτικά που είναι τοποθετημένα πάνω στο μηχάνημα που στέλνουμε
  const getShipmentParts = () => {
    if (!supportsSparePartsCategory(machineCategory)) return [];
    const sn = String(serialNumber || '').trim();
    if (!sn) return [];
    const key = Object.keys(machineParts || {}).find(k => k.trim().toUpperCase() === sn.toUpperCase());
    return key ? (machineParts[key] || []) : [];
  };

  // Ένας πίνακας για το μηχάνημα + ένας για κάθε ανταλλακτικό του
  const getShipmentBlocks = (destination = getSelectedStoreDetails()) => {
    const machineRows = getShipmentRows(destination);
    const keep = new Set(['Επωνυμία Πελάτη', 'ΑΦΜ', 'Υποκατάστημα', 'Σκοπός Διακίνησης', 'Τρόπος Αποστολής']);
    const common = Object.fromEntries(machineRows.filter(([l]) => keep.has(l)));
    const partBlocks = getShipmentParts().map(part => [
      ['Επωνυμία Πελάτη', common['Επωνυμία Πελάτη']],
      ['ΑΦΜ', common['ΑΦΜ']],
      ['Υποκατάστημα', common['Υποκατάστημα']],
      ['Κωδικός Είδους', part.code || '—'],
      ['Περιγραφή Είδους', part.description || '—'],
      ['Σειριακός', part.partSerial || '—'],
      ['Ποσότητα', '1'],
      ['Τιμή', '—'],
      ['Σκοπός Διακίνησης', common['Σκοπός Διακίνησης']],
      ['Τρόπος Αποστολής', common['Τρόπος Αποστολής']],
      ['Παρατηρήσεις', `Ανταλλακτικό τοποθετημένο στο μηχάνημα ${[model, serialNumber && `SN ${serialNumber}`].filter(Boolean).join(' ')}`],
    ]);
    return [machineRows, ...partBlocks];
  };

  const copyShipmentEmail = async () => {
    try {
      const html = buildShipmentEmailHtml();
      const temp = document.createElement('div');
      temp.contentEditable = 'true';
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      temp.style.top = '0';
      temp.innerHTML = html;
      document.body.appendChild(temp);

      const range = document.createRange();
      range.selectNodeContents(temp);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const copied = document.execCommand('copy');
      selection.removeAllRanges();
      document.body.removeChild(temp);

      if (!copied) await navigator.clipboard.writeText(buildShipmentEmail());
      setCopiedShipmentEmail(true);
      setTimeout(() => setCopiedShipmentEmail(false), 1800);
    } catch (e) {
      alert('Δεν ήταν δυνατή η αντιγραφή. Δοκίμασε να επιλέξεις το κείμενο χειροκίνητα.');
    }
  };

  const handleSubmit = async () => {
    if (!serialNumber) { alert('Βάλε Serial Number!'); return; }
    if (!action) { alert('Επίλεξε τύπο κίνησης!'); return; }
    const duplicate = findExistingSerial(serialNumber);
    if (duplicate && normalizeAction(action) === 'Καινούριο Μηχάνημα') {
      setExistingItem(duplicate);
      alert('Αυτό το serial υπάρχει ήδη. Δεν μπορεί να καταχωρηθεί ξανά ως Καινούριο Μηχάνημα. Επίλεξε άλλη κίνηση.');
      return;
    }
    if (isShipmentBlockedByWarehouse()) {
      const sn = cleanSerial(serialNumber);
      const existing = inventory.find(i => cleanSerial(i.serialNumber) === sn);
      const reason = !existing
        ? 'το serial δεν βρέθηκε στην αποθήκη'
        : `βρέθηκε ως "${normalizeAction(existing.action)}"`;
      alert(`Δεν μπορεί να γίνει αποστολή: ${reason}. Μόνο μηχανήματα με κατάσταση "Καινούριο Μηχάνημα" μπορούν να αποσταλούν.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, model, action, store, date, problem, notes: buildMovementNotes(), category: machineCategory }),
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
    setItemSearch(''); setShowItemPicker(false); setManualItemEntry(false);
    setAction(''); setActionCat(null);
    setMachineCategory('CashDro');
    setStore(''); setStoreSearch(''); setStoreChain('all'); setShowStorePicker(false);
    setDate(new Date().toISOString().split('T')[0]);
    setProblem(''); setNotes('');
    setShipmentMethod('ours'); setShipmentCourier(''); setShipmentItemDescription(''); setShipmentPrice(''); setShipmentPurpose(''); setShipmentNotes(''); setCopiedShipmentEmail(false);
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

  const toDateInputValue = (value) => {
    if (!value) return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return new Date().toISOString().split('T')[0];
    const [, day, month, year] = match;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const startEditingDate = (item) => {
    setEditingDate(item.serialNumber);
    setEditDateValue(toDateInputValue(item.date));
  };

  const cancelEditingDate = () => {
    setEditingDate(null);
    setEditDateValue('');
  };

  const handleUpdateDate = async (serialNumber, newDate = editDateValue) => {
    if (!newDate) return;
    setSavingDate(true);
    try {
      const res = await fetch('/api/warehouse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, newDate }),
      });
      if (!res.ok) throw new Error();
      cancelEditingDate();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα ενημέρωσης ημερομηνίας.');
    } finally {
      setSavingDate(false);
    }
  };

  const handleDeleteItem = (item) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async (deleteAll) => {
    const item = deleteConfirmItem;
    setDeleteConfirmItem(null);
    try {
      const res = await fetch('/api/warehouse', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber: item.serialNumber, model: item.model, store: item.store, category: getMachineCategory(item), deleteAll }),
      });
      if (!res.ok) throw new Error();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα διαγραφής.');
    }
  };

  const [deletingMovement, setDeletingMovement] = useState(null); // timestamp που σβήνεται

  const handleDeleteMovement = async (item) => {
    if (!item.timestamp) { alert('Η κίνηση δεν έχει χρονοσήμανση και δεν μπορεί να διαγραφεί.'); return; }
    const label = `${normalizeAction(item.action)} · 🏪 ${item.store || '—'} · 📅 ${item.date || '—'}`;
    if (!confirm(`Διαγραφή αυτής της κίνησης;\n\n${label}\n\nΘα μεταφερθεί στον Κάδο και μπορεί να επαναφερθεί.`)) return;
    setDeletingMovement(item.timestamp);
    try {
      const res = await fetch('/api/movement', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber: item.serialNumber, timestamp: item.timestamp, action: item.action }),
      });
      if (!res.ok) throw new Error();
      if (historySerial) loadHistory(historySerial, '');
      else if (historyStore) loadHistory('', historyStore);
      loadInventory();
    } catch (e) {
      alert('Σφάλμα διαγραφής κίνησης.');
    } finally {
      setDeletingMovement(null);
    }
  };

  // Quick mark as repaired - άμεση καταχώρηση χωρίς φόρμα
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const formatMachineParts = (item) => {
        if (!supportsSpareParts(item)) return '';
        const parts = machineParts[item.serialNumber] || [];
        return parts
          .map(part => [part.code, part.description, part.partSerial ? `SN ${part.partSerial}` : ''].filter(Boolean).join(' - '))
          .join(' | ');
      };

      const warehouseData = warehouseItems.map(item => ({
        'Serial Number': item.serialNumber,
        'Model': item.model || '',
        'Κατηγορία': getMachineCategory(item),
        'Κατάσταση': normalizeAction(item.action),
        'Από Κατάστημα': displayStore(item),
        'Ημερομηνία': item.date,
        'Χρήστης': item.user || '',
        'Πρόβλημα': item.problem || '',
        'Ανταλλακτικά': formatMachineParts(item),
        // warehouseNotes[serial] is an array of note objects — access the latest with [0]
        'Σημείωση': warehouseNotes[item.serialNumber]?.[0]?.note || '',
      }));

      const movementsData = inventory.map(item => ({
        'Serial Number': item.serialNumber,
        'Model': item.model || '',
        'Κατηγορία': getMachineCategory(item),
        'Τελευταία Κίνηση': normalizeAction(item.action),
        'Κατάστημα': item.store || '',
        'Ημερομηνία': item.date,
        'Χρήστης': item.user || '',
        'Πρόβλημα': item.problem || '',
        'Ανταλλακτικά': formatMachineParts(item),
        'Σημειώσεις': item.notes || '',
      }));

      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(warehouseData);
      ws1['!cols'] = [20,20,18,20,30,14,18,25,38,30].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws1, 'Αποθήκη');

      const ws2 = XLSX.utils.json_to_sheet(movementsData);
      ws2['!cols'] = [20,20,18,20,30,14,18,25,38,30].map(w=>({wch:w}));
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
          category: getMachineCategory(item),
        }),
      });
      if (!res.ok) throw new Error();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα καταχώρησης.');
    }
  };

  const handleQuickSaveNote = async (serialNumber) => {
    const note = prompt('Νέα σημείωση για το μηχάνημα:');
    if (!note || !note.trim()) return;
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNumber, note }),
      });
      const newNote = {
        note: note.trim(),
        createdAt: new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
        createdBy: currentUser?.fullName || '',
      };
      setWarehouseNotes(prev => ({
        ...prev,
        [serialNumber]: [newNote, ...(prev[serialNumber] || [])],
      }));
    } catch (e) {
      alert('Σφάλμα αποθήκευσης σημείωσης.');
    }
  };

  const openPartModal = (item) => {
    if (!supportsSpareParts(item)) {
      alert('Τα ανταλλακτικά ισχύουν μόνο για CashDro μηχανήματα.');
      return;
    }
    setPartModalItem(item);
    setPartSearch('');
    setSelectedPart(null);
    setManualPartEntry(false);
    setManualPartCode('');
    setManualPartDescription('');
    setPartSerialInput('');
  };

  const closePartModal = () => {
    setPartModalItem(null);
    setPartSearch('');
    setSelectedPart(null);
    setManualPartEntry(false);
    setManualPartCode('');
    setManualPartDescription('');
    setPartSerialInput('');
  };

  const openLogLinkModal = (item) => {
    setLogLinkModalItem(item);
    setLogLinkInput(machineLogLinks[item.serialNumber]?.[0]?.url || '');
  };

  const closeLogLinkModal = () => {
    setLogLinkModalItem(null);
    setLogLinkInput('');
  };

  const openLogLink = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveLogLink = async () => {
    if (!logLinkModalItem || !logLinkInput.trim()) return;
    setSavingLogLink(true);
    try {
      const res = await fetch('/api/log-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: logLinkModalItem.serialNumber,
          machineModel: logLinkModalItem.model || '',
          url: logLinkInput,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const savedLink = data.link || {
        url: logLinkInput,
        createdAt: new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
        createdBy: currentUser?.fullName || '',
        machineModel: logLinkModalItem.model || '',
      };
      setMachineLogLinks(prev => ({
        ...prev,
        [logLinkModalItem.serialNumber]: [savedLink, ...(prev[logLinkModalItem.serialNumber] || [])],
      }));
      closeLogLinkModal();
    } catch (e) {
      alert(`Σφάλμα αποθήκευσης ${getLinkActionLabel(logLinkModalItem)}.`);
    } finally {
      setSavingLogLink(false);
    }
  };

  const handleSavePart = async () => {
    const partToSave = manualPartEntry
      ? { code: manualPartCode.trim(), description: manualPartDescription.trim() }
      : selectedPart;
    if (!partModalItem || !supportsSpareParts(partModalItem) || !partToSave?.code?.trim()) return;
    setSavingPart(true);
    try {
      const res = await fetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: partModalItem.serialNumber,
          machineModel: partModalItem.model || '',
          code: partToSave.code,
          description: partToSave.description || '',
          partSerial: partSerialInput.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Σφάλμα αποθήκευσης ανταλλακτικού.');
      const savedPart = data.part || {
        code: partToSave.code,
        description: partToSave.description || '',
        partSerial: partSerialInput.trim(),
        createdAt: new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
        createdBy: currentUser?.fullName || '',
        machineModel: partModalItem.model || '',
      };
      setMachineParts(prev => ({
        ...prev,
        [partModalItem.serialNumber]: [savedPart, ...(prev[partModalItem.serialNumber] || [])],
      }));
      closePartModal();
    } catch (e) {
      alert(e.message || 'Σφάλμα αποθήκευσης ανταλλακτικού.');
    } finally {
      setSavingPart(false);
    }
  };

  const handleDeletePart = async (serialNumber, part) => {
    if (!confirm(`Να αφαιρεθεί το ανταλλακτικό "${part.code}" από το μηχάνημα;`)) return;
    try {
      const res = await fetch('/api/parts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber,
          code: part.code,
          createdAt: part.createdAt || '',
        }),
      });
      if (!res.ok) throw new Error();
      setMachineParts(prev => ({
        ...prev,
        [serialNumber]: (prev[serialNumber] || []).filter(p => !(p.code === part.code && p.createdAt === part.createdAt)),
      }));
    } catch (e) {
      alert('Σφάλμα διαγραφής ανταλλακτικού.');
    }
  };

  const handleMoveToRepair = async (item) => {
    if (!confirm(`Να μπει το "${item.model || item.serialNumber}" σε επισκευή;`)) return;
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: item.serialNumber,
          model: item.model,
          action: 'Εισαγωγή για επισκευή',
          store: item.store || '',
          date: new Date().toISOString().split('T')[0],
          problem: '',
          notes: 'Μεταφέρθηκε σε επισκευή από την αποθήκη',
          category: getMachineCategory(item),
        }),
      });
      if (!res.ok) throw new Error();
      loadInventory();
    } catch (e) {
      alert('Σφάλμα καταχώρησης.');
    }
  };

  // Quick action: πάει στη φόρμα με serial+κωδικό είδους προσυμπληρωμένα
  const startNewAction = (serial, mdl) => {
    const source = findExistingSerial(serial);
    handleReset();
    setSerialNumber(serial || '');
    setModel(mdl || '');
    setMachineCategory(getMachineCategory(source));
    setStep(2);
    handleTabClick('scan');
  };

  // ── Tickets ──
  // silent: ανανέωση στο παρασκήνιο (χωρίς "Φόρτωση..." και χωρίς μήνυμα λάθους)
  const loadTickets = async (opts) => {
    const silent = !!(opts && opts.silent === true);
    if (!silent) { setLoadingTickets(true); setTicketsError(''); }
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Σφάλμα');
      setTickets(data.tickets || []);
      if (silent) setTicketsError('');
      return true;
    } catch (e) {
      if (!silent) setTicketsError('Δεν φορτώθηκαν τα tickets. Δοκίμασε ξανά.');
      return false;
    } finally {
      if (!silent) setLoadingTickets(false);
    }
  };

  // Μία ανάγνωση του Sheet → και απόθεμα και κινήσεις (για το dashboard / auto-refresh)
  const loadAllMovements = async () => {
    try {
      const res = await fetch('/api/inventory?all=1', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { router.replace('/login'); return false; }
      if (!res.ok) return false;
      if (Array.isArray(data.movements)) setAllMovements(data.movements);
      if (Array.isArray(data.inventory)) {
        // ακυρώνει τυχόν παλιότερο αίτημα loadInventory ώστε να μη γράψει πάνω από τα νέα
        inventoryRequestRef.current += 1;
        setInventory(data.inventory);
        setInventorySnapshotReady(true);
        setInventoryError('');
        setLoadingInv(false);
        try { localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(data.inventory)); } catch (e) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const updateTicket = async (ticketId, fields) => {
    setSavingTicketId(ticketId);
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(prev => prev.map(t => t.ticketId === ticketId ? { ...t, ...data.ticket } : t));
      return true;
    } catch (e) {
      alert(e.message || 'Σφάλμα ενημέρωσης ticket.');
      return false;
    } finally {
      setSavingTicketId(null);
    }
  };

  // Link της φόρμας αιτήματος (/request) για τα καταστήματα → αντιγραφή στο πρόχειρο
  const [formLinkState, setFormLinkState] = useState('');
  const copyFormLink = async () => {
    try {
      const res = await fetch('/api/tickets/form-link', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error();
      try { await navigator.clipboard.writeText(data.url); }
      catch (e) { window.prompt('Αντιγράψτε το link της φόρμας:', data.url); }
      setFormLinkState('copied');
    } catch (e) {
      setFormLinkState('error');
    }
    setTimeout(() => setFormLinkState(''), 2000);
  };

  const openTicket = (t) => {
    setEditingTicketId(null);
    if (openTicketId === t.ticketId) { setOpenTicketId(null); return; }
    setOpenTicketId(t.ticketId);
    setTicketNoteDraft(t.notes || '');
    setTicketLogDraft('');
  };

  // Πεδία της φόρμας Cashdro που επεξεργάζονται
  const TICKET_EDIT_FIELDS = [
    { key: 'store',        label: 'Υποκατάστημα' },
    { key: 'address',      label: 'Διεύθυνση καταστήματος' },
    { key: 'postalCode',   label: 'Ταχυδρομικός κώδικας' },
    { key: 'contactName',  label: 'Ονοματεπώνυμο υπευθύνου' },
    { key: 'contactPhone', label: 'Τηλέφωνο επικοινωνίας' },
    { key: 'from',         label: 'Email πελάτη' },
    { key: 'serialNumber', label: 'Σειριακός Cashdro' },
    { key: 'ip',           label: 'IP Cashdro' },
    { key: 'courier',      label: 'Μεταφορική' },
    { key: 'problem',      label: 'Περιγραφή προβλήματος', multiline: true },
    { key: 'storeRemarks', label: 'Παρατηρήσεις καταστήματος', multiline: true },
  ];

  const startEditTicket = (t) => {
    setTicketDraft(Object.fromEntries(TICKET_EDIT_FIELDS.map(f => [f.key, t[f.key] || ''])));
    setEditingTicketId(t.ticketId);
  };

  const saveTicketEdit = async (t) => {
    const changed = Object.fromEntries(
      TICKET_EDIT_FIELDS
        .filter(f => (ticketDraft[f.key] || '') !== (t[f.key] || ''))
        .map(f => [f.key, ticketDraft[f.key] || ''])
    );
    if (!Object.keys(changed).length) { setEditingTicketId(null); return; }
    const ok = await updateTicket(t.ticketId, changed);
    if (ok) setEditingTicketId(null);
  };

  const confirmDeleteTicket = async () => {
    const t = ticketDeleteConfirm;
    if (!t) return;
    setSavingTicketId(t.ticketId);
    try {
      const res = await fetch('/api/tickets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: t.ticketId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setTickets(prev => prev.filter(x => x.ticketId !== t.ticketId));
      setOpenTicketId(null);
      setEditingTicketId(null);
      setTicketDeleteConfirm(null);
    } catch (e) {
      alert(e.message || 'Σφάλμα διαγραφής ticket.');
    } finally {
      setSavingTicketId(null);
    }
  };

  // Ticket → φόρμα κίνησης (Εισαγωγή για επισκευή) με προσυμπληρωμένα στοιχεία
  const ticketToMovement = (t) => {
    const source = findExistingSerial(t.serialNumber);
    handleReset();
    setSerialNumber(t.serialNumber || '');
    setModel(t.model || '');
    setMachineCategory(getMachineCategory(source));
    setStore(t.store || '');
    setProblem(t.problem || '');
    setNotes(`Ticket ${t.ticketId}`);
    selectActionById('repair-in');
    setStep(2);
    handleTabClick('scan');
    if (t.status === 'Νέο') updateTicket(t.ticketId, { status: 'Σε εξέλιξη' });
  };

  const loadInventory = async () => {
    const requestId = inventoryRequestRef.current + 1;
    inventoryRequestRef.current = requestId;
    setLoadingInv(true);
    setInventoryError('');

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (requestId !== inventoryRequestRef.current) return;
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 1000));
      try {
        const res = await fetch('/api/inventory', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (requestId !== inventoryRequestRef.current) return;
        if (res.status === 401) { router.replace('/login'); return; }
        if (!res.ok) { lastError = new Error(data.error || 'Σφάλμα φόρτωσης αποθήκης.'); continue; }
        if (!Array.isArray(data.inventory)) { lastError = new Error('Η αποθήκη δεν επέστρεψε σωστά δεδομένα.'); continue; }
        setInventory(data.inventory);
        setInventorySnapshotReady(true);
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(data.inventory));
        setInventoryError('');
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (requestId !== inventoryRequestRef.current) return;
    if (lastError) setInventoryError(lastError.message || 'Σφάλμα φόρτωσης. Τα προηγούμενα δεδομένα έμειναν στην οθόνη.');
    setLoadingInv(false);
  };

  const loadHistory = async (serial, store) => {
    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    setHistorySerial(serial || '');
    setHistoryStore(store || '');
    setHistoryError('');
    try {
      const params = new URLSearchParams();
      if (serial) params.set('serial', serial);
      if (store) params.set('store', store);
      const res = await fetch(`/api/inventory?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (requestId !== historyRequestRef.current) return;
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Σφάλμα φόρτωσης ιστορικού.');
      if (!Array.isArray(data.history)) throw new Error('Το ιστορικό δεν επέστρεψε σωστά δεδομένα.');
      setHistory(data.history);
      setHistoryError('');
    } catch (e) {
      if (requestId !== historyRequestRef.current) return;
      setHistoryError(e.message || 'Σφάλμα φόρτωσης ιστορικού.');
    }
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
  const looksLikeMcdStore = (storeName) => String(storeName || '').trim().toLowerCase().startsWith('mcd');
  const matchesStoreMachineCategory = (storeName, category) => {
    if (category === "McDonald's") return looksLikeMcdStore(storeName);
    if (category === 'CashDro') return !looksLikeMcdStore(storeName);
    return true;
  };
  const matchesStoreChain = (storeName, chain) => {
    if (chain === 'all') return true;
    if (chain === 'other') return !['ΚΩΤΣΟΒΟΛΟΣ','MINI KIOSK','ΚΤΕΛ','THE BEAUTY BAR','ΡΟΥΠΑΣ'].some(c => storeName.startsWith(c));
    return storeName.startsWith(chain);
  };
  const getMachineCategory = (item) => {
    if (item?.category) return item.category;
    if (looksLikeMcdStore(item?.store)) return "McDonald's";
    return 'CashDro';
  };
  const matchesMachineCategory = (item, category) => category === 'all' || getMachineCategory(item) === category;
  const getListCategory = (entry) => {
    const raw = String(entry?.category || '').trim();
    return raw || 'CashDro';
  };
  const matchesListCategory = (entry, category) => getListCategory(entry) === category;
  const supportsSparePartsCategory = (category) => MACHINE_CATEGORIES.includes(category);
  const supportsSpareParts = (item) => supportsSparePartsCategory(getMachineCategory(item));
  const isTicketLinkItem = (item) => getMachineCategory(item) === "McDonald's";
  const getLinkLabel = (item) => isTicketLinkItem(item) ? 'Ticket' : 'Logs';
  const getLinkActionLabel = (item) => `Link ${getLinkLabel(item).toLowerCase()}`;
  const getOpenLinkLabel = (item) => `Άνοιγμα ${getLinkLabel(item).toLowerCase()}`;

  const inventoryCategoryItems = inventory.filter(i => matchesMachineCategory(i, inventoryCategoryFilter));
  const filtered = sortItems(applyDateFilter(filterAction === 'Όλα' ? inventoryCategoryItems : inventoryCategoryItems.filter(i => normalizeAction(i.action) === filterAction)));
  const categoryFilteredInventory = warehouseCategoryFilter === 'all'
    ? inventory
    : inventory.filter(i => getMachineCategory(i) === warehouseCategoryFilter);
  const warehouseItems = sortItems(categoryFilteredInventory.filter(i => ['Καινούριο Μηχάνημα', 'Εισαγωγή για επισκευή'].includes(normalizeAction(i.action))));
  const shippedItems = sortItems(categoryFilteredInventory.filter(i => ['Αποστολή σε κατάστημα','Αποστολή στα κεντρικά'].includes(normalizeAction(i.action))));
  const availableItems = warehouseItems.filter(i => normalizeAction(i.action) === 'Καινούριο Μηχάνημα');
  const repairItems = warehouseItems.filter(i => normalizeAction(i.action) === 'Εισαγωγή για επισκευή');
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
  const weekMovements = inventory.filter(item => {
    const time = parseGreekTimestamp(item.timestamp) || parseItemDate(item.date)?.getTime() || 0;
    return time >= weekStart.getTime();
  });
  const homeInventory = inventory.filter(i => matchesMachineCategory(i, homeCategoryFilter));
  const homeWarehouseItems = sortItems(homeInventory.filter(i => ['Καινούριο Μηχάνημα', 'Εισαγωγή για επισκευή'].includes(normalizeAction(i.action))));
  const homeShippedItems = sortItems(homeInventory.filter(i => ['Αποστολή σε κατάστημα','Αποστολή στα κεντρικά'].includes(normalizeAction(i.action))));
  const homeAvailableItems = homeWarehouseItems.filter(i => normalizeAction(i.action) === 'Καινούριο Μηχάνημα');
  const homeRepairItems = homeWarehouseItems.filter(i => normalizeAction(i.action) === 'Εισαγωγή για επισκευή');
  const homeWeekMovements = homeInventory.filter(item => {
    const time = parseGreekTimestamp(item.timestamp) || parseItemDate(item.date)?.getTime() || 0;
    return time >= weekStart.getTime();
  });
  const attentionRepairItems = repairItems.filter(item => {
    const d = parseItemDate(item.date);
    if (!d) return false;
    d.setHours(0,0,0,0);
    return (todayStart - d) > 7 * 86400000;
  });
  const homeAttentionRepairItems = homeRepairItems.filter(item => {
    const d = parseItemDate(item.date);
    if (!d) return false;
    d.setHours(0,0,0,0);
    return (todayStart - d) > 7 * 86400000;
  });
  const warehouseVisibleItems = warehouseFilter === 'new'
    ? availableItems
    : warehouseFilter === 'repair'
      ? repairItems
      : warehouseFilter === 'shipped'
        ? shippedItems
        : warehouseItems;
  const storeRows = storeDetailsList.length
    ? storeDetailsList
    : storesList.map(name => ({ name, phone: '', address: '', vat: '' }));
  const inventoryStoreNames = inventory
    .map(item => item.store || '')
    .filter(name => name.trim() !== '');
  const historyStoreBaseOptions = Array.from(new Set([...storesList, ...inventoryStoreNames]));
  const getStoreMovementCategories = (storeName) => {
    const storeKey = String(storeName || '').toLowerCase();
    return new Set(
      inventory
        .filter(item => String(item.store || '').toLowerCase().includes(storeKey))
        .map(item => getMachineCategory(item))
    );
  };
  const historyStoreOptions = historyStoreBaseOptions.filter(storeName => {
    if (historyStoreCategoryFilter === 'all') return true;
    const isMcdStore = looksLikeMcdStore(storeName);
    if (historyStoreCategoryFilter === "McDonald's" && isMcdStore) return true;
    if (historyStoreCategoryFilter === 'CashDro' && isMcdStore) return false;
    const movementCategories = getStoreMovementCategories(storeName);
    if (movementCategories.size > 0) return movementCategories.has(historyStoreCategoryFilter);
    if (historyStoreCategoryFilter === "McDonald's") return false;
    if (historyStoreCategoryFilter === 'CashDro') return true;
    return false;
  });
  // Κατάσταση συμβολαίου: { daysLeft, level } όπου level = expired | soon (≤60μ) | ok.
  // Επιστρέφει null αν το κατάστημα δεν έχει σύμβαση ή έγκυρη ημ/νία λήξης.
  const getContractStatus = (store) => {
    if (!store || store.contract !== 'yes' || !store.contractEnd) return null;
    const end = new Date(store.contractEnd);
    if (Number.isNaN(end.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end - today) / 86400000);
    if (daysLeft < 0) return { daysLeft, level: 'expired' };
    if (daysLeft <= 60) return { daysLeft, level: 'soon' };
    return { daysLeft, level: 'ok' };
  };

  const missingNoteItems = warehouseItems.filter(item => !(warehouseNotes[item.serialNumber] || []).length);
  const homeMissingNoteItems = homeWarehouseItems.filter(item => !(warehouseNotes[item.serialNumber] || []).length);
  const incompleteStoreRows = storeRows.filter(store => !store.phone || !store.address || !store.vat);
  const homeIncompleteStoreRows = incompleteStoreRows.filter(store => {
    if (homeCategoryFilter === 'all') return true;
    return matchesStoreMachineCategory(store.name, homeCategoryFilter);
  });
  // Συμβόλαια που λήγουν: status με βάση το contractEnd (μόνο stores με σύμβαση)
  const expiringContracts = storeRows.filter(store => {
    const st = getContractStatus(store);
    return st && st.level !== 'ok';
  });
  const homeExpiringContracts = expiringContracts.filter(store => {
    if (homeCategoryFilter === 'all') return true;
    return matchesStoreMachineCategory(store.name, homeCategoryFilter);
  });
  const attentionCount = attentionRepairItems.length + missingNoteItems.length + incompleteStoreRows.length + expiringContracts.length;
  const homeAttentionCount = homeAttentionRepairItems.length + homeMissingNoteItems.length + homeIncompleteStoreRows.length + homeExpiringContracts.length;
  const recentMovements = sortItems(inventory).slice(0, 5);
  const homeRecentMovements = sortItems(homeInventory).slice(0, 5);
  const countOrDash = (value) => inventorySnapshotReady ? value : '—';

  // ── Δεδομένα γραφημάτων Αρχικής ──
  const fleetCounts = homeInventory.reduce((acc, item) => {
    const a = normalizeAction(item.action);
    const key = a === 'Καινούριο Μηχάνημα' ? 'avail'
      : a === 'Εισαγωγή για επισκευή' ? 'repair'
      : a === 'Αποστολή σε κατάστημα' ? 'store'
      : a === 'Αποστολή στα κεντρικά' ? 'central' : null;
    if (key) acc[key] += 1;
    return acc;
  }, { avail: 0, repair: 0, store: 0, central: 0 });

  const movementTime = (item) => parseItemDate(item.date)?.getTime() || parseGreekTimestamp(item.timestamp) || 0;
  const chartWeeks = (() => {
    const monday = new Date(); monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const source = (allMovements || inventory).filter(i => matchesMachineCategory(i, homeCategoryFilter));
    const fmtD = d => d.toLocaleDateString('el-GR', { day: 'numeric', month: 'numeric' });
    return Array.from({ length: 8 }, (_, idx) => {
      const start = new Date(monday); start.setDate(monday.getDate() - (7 - idx) * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const last = new Date(end); last.setDate(end.getDate() - 1);
      const counts = {};
      source.forEach(item => {
        const t = movementTime(item);
        if (t >= start.getTime() && t < end.getTime()) {
          const a = normalizeAction(item.action);
          counts[a] = (counts[a] || 0) + 1;
        }
      });
      return { label: idx === 7 ? 'Τώρα' : fmtD(start), range: `${fmtD(start)} – ${fmtD(last)}`, counts };
    });
  })();
  const chartWeeksTotal = chartWeeks.reduce((s, w) => s + Object.values(w.counts).reduce((a, b) => a + b, 0), 0);

  const chainOf = (storeName) => {
    const n = String(storeName || '').toUpperCase();
    if (looksLikeMcdStore(storeName)) return "McDonald's";
    const chain = STORE_CHAINS.find(c => c.id !== 'all' && c.id !== 'other' && n.includes(c.id));
    return chain ? chain.label : 'Άλλα';
  };
  const chainRows = Object.entries(
    homeInventory
      .filter(i => normalizeAction(i.action) === 'Αποστολή σε κατάστημα')
      .reduce((acc, i) => { const c = chainOf(i.store); acc[c] = (acc[c] || 0) + 1; return acc; }, {})
  ).map(([label, value]) => ({ label, value }))
   .sort((a, b) => (a.label === 'Άλλα') - (b.label === 'Άλλα') || b.value - a.value);

  const agingBuckets = (() => {
    const b = [
      { label: '0–3', min: 0, max: 3, value: 0 },
      { label: '4–7', min: 4, max: 7, value: 0 },
      { label: '8–14', min: 8, max: 14, value: 0, late: true },
      { label: '15+', min: 15, max: Infinity, value: 0, late: true },
    ];
    homeRepairItems.forEach(item => {
      const d = parseItemDate(item.date); if (!d) return;
      d.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.round((todayStart - d) / 86400000));
      const bucket = b.find(x => days >= x.min && days <= x.max);
      if (bucket) bucket.value += 1;
    });
    return b;
  })();
  const openTicketsCount = tickets.filter(t => t.status !== 'Κλειστό').length;
  const missingTicketsCount = tickets.filter(t => t.status === 'Ελλιπές').length;
  // Νέα tickets (status «Νέο»), το πιο πρόσφατο πρώτο — για το «Θέλουν προσοχή» της αρχικής
  const byNewest = (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  const newTickets = tickets.filter(t => t.status === 'Νέο').sort(byNewest);
  const newTicketsCount = newTickets.length;
  const FRESH_TICKET_MS = 60 * 60 * 1000; // «ΝΕΟ» για όσα ήρθαν την τελευταία ώρα
  const isFreshTicket = t => { const ts = Date.parse(t.createdAt); return !!ts && Date.now() - ts < FRESH_TICKET_MS; };
  const freshTickets = newTickets.filter(isFreshTicket);
  const missingTickets = tickets.filter(t => t.status === 'Ελλιπές').sort(byNewest);
  const freshMissingTickets = missingTickets.filter(isFreshTicket);
  const ticketAgo = iso => {
    const ts = Date.parse(iso);
    if (!ts) return '';
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return 'μόλις τώρα';
    if (min < 60) return `πριν ${min}′`;
    const h = Math.round(min / 60);
    if (h < 24) return `πριν ${h} ${h === 1 ? 'ώρα' : 'ώρες'}`;
    const d = Math.round(h / 24);
    return `πριν ${d} ${d === 1 ? 'μέρα' : 'μέρες'}`;
  };
  const openTicketsFiltered = (filter, ticketId) => {
    setTicketFilter(filter);
    handleTabClick('tickets');
    if (ticketId) setOpenTicketId(ticketId);
  };
  const filteredStoreRows = storeRows.filter(store => {
    const q = settingsStoreSearch.trim().toLowerCase();
    if (!q) return true;
    return [store.name, store.phone, store.address, store.vat]
      .some(value => String(value || '').toLowerCase().includes(q));
  });
  const filteredItems = itemsList.filter(item => {
    if (!matchesListCategory(item, machineCategory)) return false;
    const q = itemSearch.trim().toLowerCase();
    if (!q) return true;
    // Guard against null/undefined description coming from the Sheet
    return item.code.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
  });
  const filteredParts = partsList.filter(part => {
    const modalCategory = partModalItem ? getMachineCategory(partModalItem) : machineCategory;
    if (!matchesListCategory(part, modalCategory)) return false;
    const q = partSearch.trim().toLowerCase();
    if (!q) return true;
    return part.code.toLowerCase().includes(q) || (part.description || '').toLowerCase().includes(q);
  });
  const historyTimeline = history && historySerial
    ? [
        ...history.map(item => ({
          type: 'movement',
          item,
          sortTime: parseGreekTimestamp(item.timestamp) || parseItemDate(item.date)?.getTime() || 0,
        })),
        // Use historySerial (the queried serial) as the lookup key, not history[0].serialNumber
        // which is undefined when history is empty (machine exists but has no movements yet)
        ...(history?.[0] && supportsSpareParts(history[0]) ? (machineParts[historySerial] || []) : []).map(part => ({
          type: 'part',
          part,
          sortTime: parseGreekTimestamp(part.createdAt) || 0,
        })),
        ...(machineLogLinks[historySerial] || []).map(link => ({
          type: 'logLink',
          link,
          sortTime: parseGreekTimestamp(link.createdAt) || 0,
        })),
      ].sort((a, b) => b.sortTime - a.sortTime)
    : (history || []).map(item => ({ type: 'movement', item, sortTime: parseGreekTimestamp(item.timestamp) || 0 }));

  const handleSelectItem = (item) => {
    setModel(item.code);
    setShipmentItemDescription(item.description || '');
    setItemSearch('');
    setShowItemPicker(false);
    setManualItemEntry(false);
  };

  useEffect(() => {
    if (!model || shipmentItemDescription || itemsList.length === 0) return;
    const match = itemsList.find(item => matchesListCategory(item, machineCategory) && item.code.toLowerCase() === model.toLowerCase());
    if (match?.description) setShipmentItemDescription(match.description);
  }, [machineCategory, model, shipmentItemDescription, itemsList]);

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
    { id: 'home',      label: 'Αρχική',     icon: '⌂' },
    { id: 'scan',      label: 'Scan',       icon: '⊕' },
    { id: 'inventory', label: 'Κινήσεις',   icon: '▦' },
    { id: 'warehouse', label: 'Αποθήκη',    icon: '□' },
    { id: 'history',   label: 'Ιστορικό',   icon: '◷' },
    { id: 'settings',  label: 'Ρυθμίσεις',  icon: '◎' },
  ];

  // ── Αυτόματη ανανέωση (για την οθόνη/τηλεόραση) ──
  // Κάθε 30″ φέρνει τα νέα δεδομένα στο παρασκήνιο, χωρίς "Φόρτωση..." και χωρίς
  // να πειράζει ό,τι γράφει κάποιος εκείνη τη στιγμή. Τρέχει μόνο όταν η σελίδα φαίνεται.
  const AUTO_REFRESH_MS = 30 * 1000;
  const autoRefreshRef = useRef(null);
  const autoState = useRef({ running: false, last: {}, version: null });

  autoRefreshRef.current = async (force) => {
    const st = autoState.current;
    if (st.running) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const busy = !!(partModalItem || logLinkModalItem || deleteConfirmItem || submitting ||
      editingTicketId || ticketDeleteConfirm || editingNote || editingStore || editingDate ||
      openActionMenu || swipedItem || pullRefreshing || tab === 'scan' || tab === 'settings');
    const now = Date.now();
    const due = (key, ms) => force || !st.last[key] || now - st.last[key] >= ms;
    const mark = (key) => { st.last[key] = now; };

    st.running = true;
    try {
      // Νέα έκδοση της εφαρμογής (μετά από push) → φόρτωσε τη σελίδα από την αρχή
      if (due('version', 5 * 60 * 1000)) {
        mark('version');
        try {
          const r = await fetch('/api/version', { cache: 'no-store' });
          const d = await r.json();
          if (st.version && d.version && d.version !== st.version && !busy) {
            window.location.reload();
            return;
          }
          if (d.version && !st.version) st.version = d.version;
        } catch (e) {}
      }
      // Κρατάει τη σύνδεση ενεργή (για να μη ζητάει login η τηλεόραση)
      if (due('session', 30 * 60 * 1000)) {
        mark('session');
        try {
          const r = await fetch('/api/auth/me', { cache: 'no-store' });
          if (r.status === 401) { router.replace('/login'); return; }
        } catch (e) {}
      }

      if (busy) return;

      const jobs = [];
      if (tab === 'home' || tab === 'inventory' || tab === 'warehouse') {
        jobs.push(loadAllMovements());
        if (tab !== 'home' && due('parts', 2 * 60 * 1000)) { mark('parts'); loadParts(); loadLogLinks(); }
        if (tab === 'warehouse' && due('notes', 5 * 60 * 1000)) { mark('notes'); loadNotes(); }
      }
      if (tab === 'tickets' || (tab === 'home' && due('tickets', AUTO_REFRESH_MS)) || due('tickets', 2 * 60 * 1000)) {
        mark('tickets');
        jobs.push(loadTickets({ silent: true }));
      }
      if (tab === 'history' && (historySerial || historyStore)) {
        loadHistory(historySerial, historyStore);
      }
      if (due('stores', 5 * 60 * 1000)) { mark('stores'); loadStores(); }

      if (jobs.length) await Promise.all(jobs);
    } finally {
      st.running = false;
    }
  };

  useEffect(() => {
    // πρώτη φορά: μόνο κρατάμε την έκδοση και την ώρα — τα δεδομένα τα φέρνει ήδη η αρχική φόρτωση
    autoState.current.last = { version: 0, session: Date.now(), tickets: Date.now(), parts: Date.now(), notes: Date.now(), stores: Date.now() };
    const run = (force) => { if (autoRefreshRef.current) autoRefreshRef.current(force); };
    const interval = setInterval(() => run(false), AUTO_REFRESH_MS);
    let lastWake = Date.now();
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastWake < 5000) return; // focus + visibilitychange μαζί → μία φορά
      lastWake = Date.now();
      run(false);
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, []);

  const handleTabClick = (t) => {
    setOpenActionMenu(null);
    setTab(t);
    if (t === 'home' || t === 'inventory' || t === 'warehouse') {
      loadInventory();
      loadParts();
      loadLogLinks();
    }
    if (t === 'settings') { loadStores(); loadTrash(); }
    if (t === 'tickets') loadTickets();
    if (t === 'home') { loadAllMovements(); loadTickets(); }
    router.push(
      { pathname: router.pathname, query: t === 'home' ? {} : { tab: t } },
      undefined,
      { shallow: true }
    );
  };

  const historyHref = (serial) => `/?tab=history&serial=${encodeURIComponent(serial || '')}`;

  const openHistoryForSerial = (serial) => {
    setOpenActionMenu(null);
    setTab('history');
    loadHistory(serial);
    router.push(
      { pathname: router.pathname, query: { tab: 'history', serial } },
      undefined,
      { shallow: true }
    );
  };

  const handleHistoryLinkClick = (e, serial) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openHistoryForSerial(serial);
  };

  const openWarehouseFilter = (filter, category = homeCategoryFilter) => {
    setWarehouseFilter(filter);
    setWarehouseCategoryFilter(category);
    handleTabClick('warehouse');
  };

  // Helper: set swipedItem state AND keep the ref in sync
  const setSwipedItemSynced = (val) => {
    swipedItemRef.current = val;
    setSwipedItem(val);
  };

  // ── Swipe actions (real-time drag) ──
  const onSwipeStart = (e, serial) => {
    const el = e.currentTarget.querySelector('[data-swipe-row]');
    swipeElRef.current = el;
    // Immediately kill transition so card follows finger from frame 1
    if (el) el.style.transition = 'none';
    swipeDrag.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      // Use ref so we always read current value even if React hasn't re-rendered yet
      baseX: swipedItemRef.current === serial ? -SWIPE_W : 0,
      horiz: null,
      serial,
    };
  };
  const onSwipeEnd = (e) => {
    const el = swipeElRef.current;
    const d = swipeDrag.current;
    const serial = d.serial; // snapshot before clearing
    // Always clear both refs immediately so the document touchmove listener
    // stops intercepting on the very next touch, regardless of early returns below
    swipeElRef.current = null;
    d.serial = null;
    if (!el) return;
    const dx = e.changedTouches[0].clientX - d.x;
    if (d.horiz === null || !d.horiz) {
      // Αν το tap είναι πάνω σε action button, αφήνουμε το onClick να τρέξει κανονικά
      if (e.target.closest('.swipe-actions-bg')) return;
      // Tap στο card body — κλείσε αν είναι ανοιχτό (ref αντί closure για να αποφύγουμε stale value)
      if (swipedItemRef.current === serial) {
        el.style.transition = 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)';
        el.style.transform = 'translateX(0px)';
        setTimeout(() => { if (el) el.style.transform = ''; }, 300);
        setSwipedItemSynced(null);
      }
      return;
    }
    const nx = d.baseX + dx;
    el.style.transition = 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)';
    if (nx < -(SWIPE_W / 3)) {
      el.style.transform = `translateX(-${SWIPE_W}px)`;
      setTimeout(() => { if (el) el.style.transform = ''; }, 300);
      setSwipedItemSynced(serial);
    } else {
      el.style.transform = 'translateX(0px)';
      setTimeout(() => { if (el) el.style.transform = ''; }, 300);
      setSwipedItemSynced(null);
    }
  };

  // ── Pull-to-refresh ──
  const handlePullTouchStart = (e) => {
    if (mobMainRef.current?.scrollTop === 0) {
      pullTouchStartY.current = e.touches[0].clientY;
    } else {
      pullTouchStartY.current = null;
    }
  };
  const handlePullTouchMove = (e) => {
    if (pullTouchStartY.current == null) return;
    const dy = e.touches[0].clientY - pullTouchStartY.current;
    if (dy > 0) setPullDistance(Math.min(dy, 80));
  };
  const handlePullTouchEnd = async () => {
    if (pullDistance > 60) {
      setPullRefreshing(true);
      setPullDistance(0);
      try {
        await Promise.all([loadInventory(), loadParts(), loadLogLinks()]);
      } finally {
        // Guarantee spinner is hidden even if one of the load calls throws
        setPullRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
    pullTouchStartY.current = null;
  };

  // Non-passive touchmove on document — scroll is on window/body so must go top-level
  useEffect(() => {
    const onMove = (e) => {
      const d = swipeDrag.current;
      if (!d.serial) return;
      const dx = e.touches[0].clientX - d.x;
      const dy = e.touches[0].clientY - d.y;
      if (d.horiz === null) {
        // Block scroll speculatively until direction is confirmed
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { e.preventDefault(); return; }
        d.horiz = Math.abs(dx) > Math.abs(dy);
      }
      if (!d.horiz) return; // vertical — let scroll happen
      e.preventDefault();   // horizontal — block scroll
      const rowEl = swipeElRef.current;
      if (!rowEl) return;
      const nx = Math.max(Math.min(d.baseX + dx, 0), -SWIPE_W);
      rowEl.style.transition = 'none';
      rowEl.style.transform = `translateX(${nx}px)`;
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    return () => document.removeEventListener('touchmove', onMove);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    const querySerial = Array.isArray(router.query.serial) ? router.query.serial[0] : router.query.serial;
    const nextTab = TAB_IDS.includes(queryTab) ? queryTab : 'home';

    if (nextTab !== tab) setTab(nextTab);
    if (nextTab === 'home' || nextTab === 'inventory' || nextTab === 'warehouse') {
      loadInventory();
      loadParts();
      loadLogLinks();
    }
    if (nextTab === 'history' && querySerial && querySerial !== historySerial) {
      loadHistory(querySerial);
    }
    if (nextTab === 'settings') { loadStores(); loadTrash(); }
    if (nextTab === 'home') { loadAllMovements(); loadTickets(); }
    if (nextTab === 'tickets') {
      loadTickets();
      // Link από την ειδοποίηση email: ανοίγει κατευθείαν το συγκεκριμένο ticket
      const queryTicket = Array.isArray(router.query.ticket) ? router.query.ticket[0] : router.query.ticket;
      if (queryTicket) { setTicketFilter('all'); setOpenTicketId(queryTicket); }
    }
  }, [router.isReady, router.query.tab, router.query.serial, router.query.ticket]);

  const renderWarehouseActions = (item) => {
    if (isViewer) return null;
    const action = normalizeAction(item.action);
    const isRepair = action === 'Εισαγωγή για επισκευή';
    const isAvailable = action === 'Καινούριο Μηχάνημα';
    const menuId = `${item.serialNumber}-${item.model || ''}`;

    const runMenuAction = (e, fn) => {
      e.preventDefault();
      e.stopPropagation();
      setOpenActionMenu(null);
      fn();
    };

    return (
      <div className="item-actions" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
        <button
          className="action-menu-btn"
          onClick={e=>{e.preventDefault();e.stopPropagation();setOpenActionMenu(openActionMenu === menuId ? null : menuId);}}
          aria-label="Ενέργειες μηχανήματος"
          title="Ενέργειες"
        >
          ⋯
        </button>
        {openActionMenu === menuId && (
          <div className="action-menu">
            {!isViewer && <button className="action-menu-item" onClick={e=>runMenuAction(e, ()=>startNewAction(item.serialNumber,item.model))}>+ Νέα κίνηση</button>}
            {!isViewer && isAvailable && (
              <button className="action-menu-item" onClick={e=>runMenuAction(e, ()=>handleMoveToRepair(item))}>Σε επισκευή</button>
            )}
            {!isViewer && isRepair && (
              <button className="action-menu-item success" onClick={e=>runMenuAction(e, ()=>handleMarkRepaired(item))}>✓ Επισκευάστηκε</button>
            )}
            {!isViewer && supportsSpareParts(item) && (
              <button className="action-menu-item" onClick={e=>runMenuAction(e, ()=>openPartModal(item))}>Ανταλλακτικό</button>
            )}
            {!isViewer && <button className="action-menu-item" onClick={e=>runMenuAction(e, ()=>openLogLinkModal(item))}>{getLinkActionLabel(item)}</button>}
            {!isViewer && <button className="action-menu-item danger" onClick={e=>runMenuAction(e, ()=>handleDeleteItem(item))}>✕ Διαγραφή</button>}
          </div>
        )}
      </div>
    );
  };

  const selectActionById = (actionId) => {
    const cat = ACTION_CATEGORIES.find(c => c.id === actionId);
    if (!cat) return;
    setActionCat(cat.id);
    setAction(cat.value || '');
  };

  const getSuggestedActions = (item) => {
    const current = normalizeAction(item?.action || '');
    if (current === 'Καινούριο Μηχάνημα') return ['send-store', 'send-hq', 'repair-in'];
    if (current === 'Εισαγωγή για επισκευή') return ['new', 'repair-in'];
    if (current === 'Αποστολή σε κατάστημα' || current === 'Αποστολή στα κεντρικά') return ['repair-in', 'new'];
    return ['repair-in', 'send-store'];
  };

  const renderMachineCard = (item, options = {}) => {
    if (!item) return null;
    const serial = item.serialNumber;
    const itemNotes = warehouseNotes[serial] || [];
    const itemParts = supportsSpareParts(item) ? (machineParts[serial] || []) : [];
    const itemLogLinks = machineLogLinks[serial] || [];
    const status = normalizeAction(item.action);
    const suggested = getSuggestedActions(item)
      .map(id => ACTION_CATEGORIES.find(c => c.id === id))
      .filter(Boolean);

    const useAsMovement = (actionId) => {
      setSerialNumber(serial || '');
      setModel(item.model || '');
      selectActionById(actionId);
      setStep(2);
      handleTabClick('scan');
    };

    return (
      <div className={`machine-card ${options.compact ? 'compact' : ''}`}>
        <div className="machine-card-head">
          <div>
            <div className="machine-card-title">{item.model || 'Άγνωστος κωδικός είδους'}</div>
            <div className="machine-card-serial">{serial}</div>
          </div>
          <span className={`status-pill ${STATUS_PILL[status]?.cls||'pill-gray'}`}>{STATUS_PILL[status]?.label||status}</span>
        </div>
        <div className="machine-card-grid">
          <div><span>Κατάστημα</span><strong>{displayStore(item)}</strong></div>
          <div><span>Κατηγορία</span><strong>{getMachineCategory(item)}</strong></div>
          <div><span>Τελευταία κίνηση</span><strong>{item.date || '—'}</strong></div>
          <div><span>Χρήστης</span><strong>{item.user || '—'}</strong></div>
          <div><span>Εγγραφές</span><strong>{historySerial && history?.[0]?.serialNumber === serial ? `${history.length} κινήσεις` : '—'}</strong></div>
        </div>
        {itemParts.length > 0 && (
          <div className="machine-card-section">
            <span className="machine-card-label">Ανταλλακτικά</span>
            <div className="machine-card-chips">
              {itemParts.slice(0, 4).map((part, idx) => (
                <span key={`${part.code}-${idx}`} className="part-chip">{part.code}{part.description ? ` · ${part.description}` : ''}{part.partSerial ? ` · SN ${part.partSerial}` : ''}</span>
              ))}
              {itemParts.length > 4 && <span className="part-more">+{itemParts.length - 4}</span>}
            </div>
          </div>
        )}
        {itemNotes.length > 0 && (
          <div className="machine-card-section">
            <span className="machine-card-label">Τελευταία σημείωση</span>
            <div className="machine-card-note">📌 {itemNotes[0].note} <span>{itemNotes[0].createdAt}</span></div>
          </div>
        )}
        {itemLogLinks.length > 0 && (
          <div className="machine-card-section">
            <span className="machine-card-label">{getLinkLabel(item)}</span>
            <a className="log-link" href={itemLogLinks[0].url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>
              {getOpenLinkLabel(item)}
            </a>
          </div>
        )}
        <div className="machine-card-actions">
          {!isViewer && suggested.map(cat => (
            <button key={cat.id} className="btn-quick-action" onClick={()=>useAsMovement(cat.id)}>{cat.label}</button>
          ))}
          {!isViewer && <button className="note-add-btn" onClick={()=>handleQuickSaveNote(serial)}>+ Νέα σημείωση</button>}
          {!isViewer && supportsSpareParts(item) && <button className="note-add-btn" onClick={()=>openPartModal(item)}>Ανταλλακτικό</button>}
          {!isViewer && <button className="note-add-btn" onClick={()=>openLogLinkModal(item)}>{getLinkActionLabel(item)}</button>}
          {options.showHistoryButton && (
            <a className="btn-quick-action row-link" href={historyHref(serial)} onClick={e=>handleHistoryLinkClick(e, serial)}>Ιστορικό</a>
          )}
        </div>
      </div>
    );
  };

  const getContractDurationLabel = (start, end) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return '';
    const months = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)));
    if (months < 12) return `${months} μήνες`;
    const years = Math.floor(months / 12);
    const restMonths = months % 12;
    return restMonths ? `${years} έτη και ${restMonths} μήνες` : `${years} έτη`;
  };

  const renderStoreDetailsEditor = () => {
    if (!selectedStoreDetails) return null;
    const isCashDroStore = !looksLikeMcdStore(storeDetailsDraft.name || selectedStoreDetails.name);
    const hasContract = storeDetailsDraft.contract === 'yes';
    const contractDuration = getContractDurationLabel(storeDetailsDraft.contractStart, storeDetailsDraft.contractEnd);

    return (
      <div className="store-detail-card">
        <div className="store-detail-head">
          <div>
            <div className="store-detail-title">{selectedStoreDetails.name}</div>
            <div className="store-detail-sub">Επεξεργασία στοιχείων καταστήματος</div>
          </div>
          <button className="btn-note-cancel" onClick={closeStoreDetails}>✕</button>
        </div>
        <div className="store-detail-grid">
          <div className="store-detail-field wide">
            <span>Όνομα καταστήματος</span>
            <input className="text-input store-detail-input" value={storeDetailsDraft.name} onChange={e=>updateStoreDetailsDraft('name', e.target.value)} readOnly={isViewer} />
          </div>
          <div className="store-detail-field">
            <span>ΑΦΜ</span>
            <input className="text-input store-detail-input" value={storeDetailsDraft.vat} onChange={e=>updateStoreDetailsDraft('vat', e.target.value)} readOnly={isViewer} />
          </div>
          <div className="store-detail-field">
            <span>Τηλέφωνο</span>
            <input className="text-input store-detail-input" value={storeDetailsDraft.phone} onChange={e=>updateStoreDetailsDraft('phone', e.target.value)} readOnly={isViewer} />
          </div>
          <div className="store-detail-field wide">
            <span>Διεύθυνση</span>
            <input className="text-input store-detail-input" value={storeDetailsDraft.address} onChange={e=>updateStoreDetailsDraft('address', e.target.value)} readOnly={isViewer} />
          </div>
        </div>

        {isCashDroStore && (
          <div className="store-contract-box">
            <label className="store-contract-toggle">
              <input
                type="checkbox"
                checked={hasContract}
                onChange={e=>updateStoreDetailsDraft('contract', e.target.checked ? 'yes' : '')}
                disabled={isViewer}
              />
              <span>Έχει σύμβαση</span>
            </label>
            {hasContract && (
              <div className="store-detail-grid">
                <div className="store-detail-field">
                  <span>Έναρξη σύμβασης</span>
                  <input className="text-input store-detail-input" type="date" value={storeDetailsDraft.contractStart} onChange={e=>updateStoreDetailsDraft('contractStart', e.target.value)} />
                </div>
                <div className="store-detail-field">
                  <span>Λήξη σύμβασης</span>
                  <input className="text-input store-detail-input" type="date" value={storeDetailsDraft.contractEnd} onChange={e=>updateStoreDetailsDraft('contractEnd', e.target.value)} />
                </div>
                <div className="store-contract-duration">
                  Διάρκεια: <strong>{contractDuration || 'συμπλήρωσε ημερομηνίες'}</strong>
                  {(() => {
                    const cs = getContractStatus(storeDetailsDraft);
                    if (!cs) return null;
                    if (cs.level === 'expired') return <span className="contract-inline expired"> · Έληξε πριν {Math.abs(cs.daysLeft)} ημέρες</span>;
                    return <span className={`contract-inline ${cs.level}`}> · Λήγει σε {cs.daysLeft} ημέρες</span>;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {storeDetailsMsg && <div className={storeDetailsMsg.type==='success'?'banner-success':'error-banner'} style={{marginTop:'10px'}}>{storeDetailsMsg.type==='success'?'✅ ':'⚠️ '}{storeDetailsMsg.text}</div>}
        {!isViewer && <div className="store-detail-actions">
          <button className="btn-note-cancel" onClick={()=>openStoreDetails(selectedStoreDetails)} disabled={savingStoreDetails}>Επαναφορά</button>
          <button className="btn-primary" onClick={handleSaveStoreDetails} disabled={savingStoreDetails || !storeDetailsDraft.name.trim()}>
            {savingStoreDetails ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'}
          </button>
        </div>}
      </div>
    );
  };

  // Shared content για κάθε tab
  const tabContent = (
    <>
      {inventoryError && ['home','inventory','warehouse'].includes(tab) && (
        <div className="error-banner">⚠️ {inventoryError} {inventorySnapshotReady ? 'Τα τελευταία διαθέσιμα δεδομένα έμειναν στην οθόνη.' : 'Δεν εμφανίζονται προσωρινά μηδενικά μέχρι να φορτώσει η αποθήκη.'}</div>
      )}
      {historyError && tab === 'history' && (
        <div className="error-banner">⚠️ {historyError}</div>
      )}

      {tab === 'home' && (
        <div key="home" className="fade-in dashboard">
          <div className="dashboard-greeting">
            <div>
              <div className="dashboard-kicker">{new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div className="greeting-name">Γεια σου, {currentUser?.fullName || currentUser?.username || 'χρήστη'}</div>
            </div>
            <div className="quick-actions">
              {!isViewer && <button className="quick-action-btn" onClick={()=>handleTabClick('scan')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2m10-16h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M12 12h.01"/></svg>
                Scan
              </button>}
              <button className="quick-action-btn" onClick={()=>openWarehouseFilter('all')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                Αποθήκη
              </button>
              <button className="quick-action-btn" onClick={()=>handleTabClick('history')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Ιστορικό
              </button>
            </div>
          </div>

          <div className="warehouse-category-tabs dashboard-category-tabs">
            <button className={`warehouse-category-tab ${homeCategoryFilter === 'all' ? 'active' : ''}`} onClick={()=>setHomeCategoryFilter('all')}>Όλα</button>
            {MACHINE_CATEGORIES.map(cat => (
              <button key={cat} className={`warehouse-category-tab ${homeCategoryFilter === cat ? 'active' : ''}`} onClick={()=>setHomeCategoryFilter(cat)}>
                {cat}
              </button>
            ))}
          </div>

          <div className="dashboard-stat-grid">
            <button className="dash-stat" onClick={()=>openWarehouseFilter('all')}>
              <span>Σύνολο αποθήκης</span>
              <strong>{countOrDash(homeWarehouseItems.length)}</strong>
              <small>μηχανήματα μέσα</small>
            </button>
            <button className="dash-stat" onClick={()=>openWarehouseFilter('new')}>
              <span>Διαθέσιμα</span>
              <strong>{countOrDash(homeAvailableItems.length)}</strong>
              <small>έτοιμα για αποστολή</small>
            </button>
            <button className="dash-stat warn" onClick={()=>openWarehouseFilter('repair')}>
              <span>Σε επισκευή</span>
              <strong>{countOrDash(homeRepairItems.length)}</strong>
              <small>{countOrDash(homeAttentionRepairItems.length)} πάνω από 7 ημέρες</small>
            </button>
            <button className="dash-stat" onClick={()=>openWarehouseFilter('shipped')}>
              <span>Απεσταλμένα</span>
              <strong>{countOrDash(homeShippedItems.length)}</strong>
              <small>τελευταία κατάσταση έξοδος</small>
            </button>
          </div>

          <section className="dashboard-panel fleet-panel">
            <div className="dashboard-panel-head">
              <div>
                <div className="panel-title">Πού βρίσκονται τα μηχανήματα</div>
                <div className="panel-sub">{countOrDash(homeInventory.length)} μηχανήματα συνολικά, με βάση την τελευταία τους κίνηση</div>
              </div>
            </div>
            <FleetBar counts={fleetCounts} ready={inventorySnapshotReady}
              onSelect={key => key === 'avail' ? openWarehouseFilter('new') : key === 'repair' ? openWarehouseFilter('repair') : handleTabClick('inventory')} />
          </section>

          <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-head">
                <div>
                  <div className="panel-title">Κινήσεις ανά εβδομάδα</div>
                  <div className="panel-sub">{allMovements ? `${chartWeeksTotal} κινήσεις τις τελευταίες 8 εβδομάδες` : 'Φόρτωση ιστορικού κινήσεων…'}</div>
                </div>
                <button className="note-add-btn" onClick={()=>handleTabClick('inventory')}>Όλες οι κινήσεις</button>
              </div>
              <WeeklyChart weeks={chartWeeks} />
            </section>

            <section className={`dashboard-panel attention-panel${(homeAttentionCount + missingTicketsCount + newTicketsCount) > 0 ? ' attention-panel--active' : ''}`}>
              <div className="dashboard-panel-head">
                <div>
                  <div className="panel-title">Θέλουν προσοχή {inventorySnapshotReady && (homeAttentionCount + missingTicketsCount + newTicketsCount) > 0 && <span className="attention-badge">{homeAttentionCount + missingTicketsCount + newTicketsCount}</span>}</div>
                  <div className="panel-sub">Σημεία που αξίζει να δεις πρώτα</div>
                </div>
              </div>
              <button className={`attention-row attention-row--tickets${freshTickets.length ? ' is-fresh' : ''}`}
                onClick={()=>openTicketsFiltered('Νέο', newTickets[0]?.ticketId)}>
                <span className="attention-row-main">
                  <span>Νέα tickets {freshTickets.length > 0 && <em className="fresh-chip">ΝΕΟ</em>}</span>
                  {newTickets[0] && (
                    <small className="attention-row-sub">{newTickets[0].store || newTickets[0].from || newTickets[0].ticketId} · {ticketAgo(newTickets[0].createdAt)}{newTickets.length > 1 ? ` · +${newTickets.length - 1} ακόμα` : ''}</small>
                  )}
                </span>
                <strong style={newTicketsCount > 0 ? {color:'var(--orange)'} : {}}>{newTicketsCount}</strong>
              </button>
              <button className={`attention-row attention-row--tickets${freshMissingTickets.length ? ' is-fresh' : ''}`}
                onClick={()=>openTicketsFiltered('Ελλιπές', missingTickets[0]?.ticketId)}>
                <span className="attention-row-main">
                  <span>Ελλιπή tickets από καταστήματα {freshMissingTickets.length > 0 && <em className="fresh-chip">ΝΕΟ</em>}</span>
                  {missingTickets[0] && (
                    <small className="attention-row-sub">{missingTickets[0].store || missingTickets[0].from || missingTickets[0].ticketId} · {ticketAgo(missingTickets[0].createdAt)}{missingTickets.length > 1 ? ` · +${missingTickets.length - 1} ακόμα` : ''}</small>
                  )}
                </span>
                <strong style={missingTicketsCount > 0 ? {color:'var(--orange)'} : {}}>{missingTicketsCount}</strong>
              </button>
              <button className="attention-row" onClick={()=>openWarehouseFilter('repair')}>
                <span>Σε επισκευή πάνω από 7 ημέρες</span>
                <strong style={inventorySnapshotReady && homeAttentionRepairItems.length > 0 ? {color:'var(--orange)'} : {}}>{countOrDash(homeAttentionRepairItems.length)}</strong>
              </button>
              <button className="attention-row" onClick={()=>openWarehouseFilter('all')}>
                <span>Μηχανήματα χωρίς σημείωση</span>
                <strong style={inventorySnapshotReady && homeMissingNoteItems.length > 0 ? {color:'var(--orange)'} : {}}>{countOrDash(homeMissingNoteItems.length)}</strong>
              </button>
              <button className="attention-row" onClick={()=>handleTabClick('settings')}>
                <span>Καταστήματα με ελλιπή στοιχεία</span>
                <strong style={inventorySnapshotReady && homeIncompleteStoreRows.length > 0 ? {color:'var(--orange)'} : {}}>{countOrDash(homeIncompleteStoreRows.length)}</strong>
              </button>
              <button className="attention-row" onClick={()=>handleTabClick('settings')}>
                <span>Συμβόλαια που λήγουν (≤60 ημέρες)</span>
                <strong style={inventorySnapshotReady && homeExpiringContracts.length > 0 ? {color:'var(--orange)'} : {}}>{countOrDash(homeExpiringContracts.length)}</strong>
              </button>
            </section>
          </div>

          <div className="dashboard-grid even">
            <section className="dashboard-panel">
              <div className="dashboard-panel-head">
                <div>
                  <div className="panel-title">Μηχανήματα σε καταστήματα</div>
                  <div className="panel-sub">Ανά αλυσίδα</div>
                </div>
              </div>
              {chainRows.length
                ? <HBarChart rows={chainRows} color="var(--c-store)" onSelect={()=>handleTabClick('history')} />
                : <div className="empty">{inventorySnapshotReady ? 'Κανένα μηχάνημα σε κατάστημα.' : '—'}</div>}
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-panel-head">
                <div>
                  <div className="panel-title">Χρόνος σε επισκευή</div>
                  <div className="panel-sub">{countOrDash(homeRepairItems.length)} μηχανήματα, ανά ημέρες στην επισκευή</div>
                </div>
                <button className="note-add-btn" onClick={()=>openWarehouseFilter('repair')}>Προβολή</button>
              </div>
              <AgingChart buckets={agingBuckets} onSelect={()=>openWarehouseFilter('repair')} />
            </section>
          </div>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <div className="panel-title">Τελευταίες κινήσεις</div>
                <div className="panel-sub">Τα 5 πιο πρόσφατα events</div>
              </div>
              <button className="note-add-btn" onClick={()=>handleTabClick('inventory')}>Άνοιγμα κινήσεων</button>
            </div>
            <div className="recent-list">
              {homeRecentMovements.map((item, i) => (
                <a key={`${item.serialNumber}-${item.timestamp}-${i}`} className="recent-row row-link" href={historyHref(item.serialNumber)} onClick={e=>handleHistoryLinkClick(e, item.serialNumber)}>
                  <span className="recent-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                  <div>
                    <strong>{item.model || 'Χωρίς κωδικό'}</strong>
                    <small>{item.serialNumber || '—'} · {displayStore(item)}</small>
                  </div>
                  <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                  <em>{item.date || '—'}</em>
                </a>
              ))}
              {homeRecentMovements.length === 0 && (
                <div className="empty">{inventorySnapshotReady ? 'Δεν υπάρχουν κινήσεις ακόμα.' : 'Δεν έχει φορτωθεί αποθήκη ακόμα.'}</div>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'scan' && (
        <div key="scan" className="fade-in">
          {step===1 && (
            <div className="card">
              <div className="card-title">Φωτογράφισε το μηχάνημα</div>
              <div className="card-sub">Ανέβασε φωτογραφία για αυτόματη αναγνώριση serial & κωδικού είδους</div>
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
              {imagePreview && <button className="btn-primary" onClick={handleScan} disabled={scanning}>{scanning ? '🔍 Αναγνώριση...' : '🔍 Αναγνώριση serial & κωδικού είδους'}</button>}
              <button className="btn-ghost" onClick={handleSkipScan}>✏️ Συμπλήρωσε χειροκίνητα</button>
            </div>
          )}
          {step===2 && (
            <div className="card fade-in">
              {scanError && <div className="error-banner">⚠️ {scanError}</div>}
              {!scanError && imagePreview && <div className="ai-badge">✨ Αναγνωρίστηκε — έλεγξε τα στοιχεία</div>}
              <div className="section-label">Στοιχεία μηχανήματος</div>
              <div className="field-group">
                <label className="field-label">Κατηγορία</label>
                <div className="category-tabs">
                  {MACHINE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`category-tab ${machineCategory === cat ? 'active' : ''}`}
                      onClick={() => {
                        setMachineCategory(cat);
                        setStoreSearch('');
                        setStoreChain('all');
                        setShipmentItemDescription('');
                        if (store && !matchesStoreMachineCategory(store, cat)) setStore('');
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Serial Number *</label>
                <input className="text-input" value={serialNumber}
                  onChange={e=>{
                    const value = e.target.value;
                    const found = findExistingSerial(value);
                    setSerialNumber(value);
                    setExistingItem(found);
                    if (found) setMachineCategory(getMachineCategory(found));
                  }}
                  onBlur={e=>{
                    const found = findExistingSerial(e.target.value);
                    setExistingItem(found);
                    if (found) setMachineCategory(getMachineCategory(found));
                  }}
                  placeholder="π.χ. A4829301" />
              </div>

              {existingItem && (
                <div className="existing-item-banner">
                  <div className="existing-item-title">⚠️ Αυτό το serial υπάρχει ήδη</div>
                  <div className="existing-item-note">Μπορείς να κάνεις νέα κίνηση, αλλά όχι νέα καταχώρηση ως Καινούριο Μηχάνημα.</div>
                  {renderMachineCard(existingItem, { compact: true, showHistoryButton: true })}
                </div>
              )}
              <div className="field-group">
                <label className="field-label">Κωδικός Είδους</label>
                {!manualItemEntry ? (
                  <div className="item-picker">
                    <button type="button" className="item-picker-trigger" onClick={()=>setShowItemPicker(v=>!v)}>
                      <span>{model || 'Επίλεξε κωδικό είδους...'}</span>
                      <small>{shipmentItemDescription || `Πάτα για λίστα κωδικών ${machineCategory}`}</small>
                    </button>
                    {showItemPicker && (
                      <div className="item-picker-menu">
                        <button className="item-option manual" type="button" onClick={()=>{setManualItemEntry(true);setShowItemPicker(false);setItemSearch('');}}>
                          <span>✏️ Χειροκίνητη καταχώρηση</span>
                          <small>Γράψε ελεύθερα κωδικό και περιγραφή</small>
                        </button>
                        <input className="text-input" value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="Αναζήτηση κωδικού ή περιγραφής..." autoFocus />
                        <div className="item-list">
                          {filteredItems.map(item => (
                            <button key={item.code} type="button" className={`item-option ${model===item.code?'active':''}`} onClick={()=>handleSelectItem(item)}>
                              <span>{item.code}</span>
                              <small>{item.description || 'Χωρίς περιγραφή'}</small>
                            </button>
                          ))}
                          {filteredItems.length === 0 && <div className="item-empty">Δεν βρέθηκε κωδικός.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input className="text-input" value={model} onChange={e=>setModel(e.target.value)} placeholder="π.χ. BV-11-SO-EU" />
                    <textarea value={shipmentItemDescription} onChange={e=>setShipmentItemDescription(e.target.value)} placeholder="Περιγραφή είδους..." style={{marginTop:'8px'}} />
                    <button className="btn-ghost" type="button" onClick={()=>setManualItemEntry(false)}>↩ Επιλογή από λίστα</button>
                  </div>
                )}
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
                    <div className="text-input store-display" onClick={()=>setShowStorePicker(true)} style={{cursor:'pointer',color:store?'var(--t1)':'var(--t3)'}}>{store || 'Επίλεξε κατάστημα...'}</div>
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
                        return matchesStoreMachineCategory(s, machineCategory)
                          && matchesStoreChain(s, storeChain)
                          && (storeSearch===''||s.toLowerCase().includes(storeSearch.toLowerCase()));
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
              {isShipmentAction() && (
                <div className="shipment-box">
                  <div className="section-label">Στοιχεία αποστολής</div>
                  {store && (
                    <div className="shipment-destination">
                      <strong>{getSelectedStoreDetails().name}</strong>
                      <span>{getSelectedStoreDetails().address || 'Χωρίς διεύθυνση'} · {getSelectedStoreDetails().phone || 'χωρίς τηλέφωνο'} · ΑΦΜ {getSelectedStoreDetails().vat || '—'}</span>
                    </div>
                  )}
                  <div className="shipment-method-row">
                    <button type="button" className={`shipment-method ${shipmentMethod==='ours'?'active':''}`} onClick={()=>setShipmentMethod('ours')}>Με εμάς</button>
                    <button type="button" className={`shipment-method ${shipmentMethod==='courier'?'active':''}`} onClick={()=>setShipmentMethod('courier')}>Courier</button>
                  </div>
                  {shipmentMethod === 'courier' && (
                    <div className="field-group">
                      <label className="field-label">Courier εταιρεία</label>
                      <input className="text-input" value={shipmentCourier} onChange={e=>setShipmentCourier(e.target.value)} placeholder="π.χ. ACS, Γενική Ταχυδρομική" />
                    </div>
                  )}
                  <div className="field-group">
                    <label className="field-label">Περιγραφή Είδους</label>
                    <textarea value={shipmentItemDescription} onChange={e=>setShipmentItemDescription(e.target.value)} placeholder={`Περιγραφή είδους ${machineCategory}...`} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Τιμή</label>
                    <input className="text-input" value={shipmentPrice} onChange={e=>setShipmentPrice(e.target.value)} placeholder="π.χ. 0,00 €" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Σκοπός Διακίνησης</label>
                    <input className="text-input" value={shipmentPurpose} onChange={e=>setShipmentPurpose(e.target.value)} placeholder="π.χ. Επισκευή, Αντικατάσταση, Πώληση..." />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Παρατηρήσεις</label>
                    <textarea value={shipmentNotes} onChange={e=>setShipmentNotes(e.target.value)} placeholder="π.χ. Να παραδοθεί πρωί, εύθραυστο, παραλαβή από Χάρη..." />
                  </div>
                </div>
              )}
              <div className="field-group">
                <label className="field-label">🔧 Πρόβλημα</label>
                <input className="text-input" value={problem} onChange={e=>setProblem(e.target.value)} placeholder="π.χ. Χαλασμένη οθόνη, δεν ανάβει..." />
              </div>
              <div className="field-group">
                <label className="field-label">📝 Σημειώσεις</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Οποιαδήποτε επιπλέον πληροφορία..." />
              </div>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting || isDuplicateNewMachine() || isShipmentBlockedByWarehouse()}>
                {submitting ? '⏳ Καταχώριση...' : isDuplicateNewMachine() ? '⚠️ Υπάρχει ήδη ως καινούριο' : isShipmentBlockedByWarehouse() ? '⚠️ Δεν βρίσκεται στην αποθήκη' : '✅ Καταχώριση κίνησης'}
              </button>
              <button className="btn-ghost" onClick={handleReset}>← Πίσω</button>
            </div>
          )}
          {step===3 && (
            <div className="card fade-in success-card">
              <div className="success-icon">✅</div>
              <div className="success-title">Καταχωρήθηκε!</div>
              <div className="success-sub"><strong>{model || 'Κωδικός είδους'}</strong> · {serialNumber}<br/>🏪 {store}<br/>{action}{problem ? ` · 🔧 ${problem}` : ''}</div>
              {isShipmentAction() && (
                <div className="shipment-email-card">
                  <div className="shipment-email-head">
                    <div>
                      <div className="shipment-email-title">Έτοιμο email αποστολής</div>
                      <div className="shipment-email-sub">Κάνε αντιγραφή και επικόλληση στο email σου.</div>
                    </div>
                    <button className="btn-quick-action" onClick={copyShipmentEmail}>{copiedShipmentEmail ? '✓ Αντιγράφηκε' : 'Αντιγραφή email'}</button>
                  </div>
                  {getShipmentBlocks().map((rows, bi) => (
                  <div className="shipment-table-preview" key={bi}>
                    <div className="shipment-table-top">
                      <div>A/A</div>
                      <div>CashDro &amp; McDonald's</div>
                      <div>Εξαγωγή ειδών{bi > 0 ? ' · Ανταλλακτικό' : ''}</div>
                    </div>
                    <div className="shipment-table-body">
                      <div className="shipment-table-index">{bi + 1}</div>
                      <div className="shipment-table-labels">
                        {rows.map(([label]) => <div key={label}>{label}:</div>)}
                      </div>
                      <div className="shipment-table-values">
                        {rows.map(([label, value]) => <div key={label}>{value}</div>)}
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              )}
              <button className="btn-primary" onClick={handleReset}>📷 Νέο scan</button>
            </div>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div key="inventory" className="fade-in">
          {/* Desktop: table view */}
          <div className="desktop-only">
            <div className="warehouse-category-tabs">
              <button className={`warehouse-category-tab ${inventoryCategoryFilter === 'all' ? 'active' : ''}`} onClick={()=>setInventoryCategoryFilter('all')}>Όλα</button>
              {MACHINE_CATEGORIES.map(cat => (
                <button key={cat} className={`warehouse-category-tab ${inventoryCategoryFilter === cat ? 'active' : ''}`} onClick={()=>setInventoryCategoryFilter(cat)}>
                  {cat}
                </button>
              ))}
            </div>
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
                  <div className="dt-th">Κωδικός / Serial</div>
                  <div className="dt-th">Κατάστημα</div>
                  <div className="dt-th">Κατάσταση</div>
                  <div className="dt-th">Ημερομηνία</div>
                  <div className="dt-th">Χρήστης</div>
                </div>
                {filtered.map((item, i) => (
                  <div key={i}>
                    <a className="dt-row row-link" href={historyHref(item.serialNumber)} onClick={e=>handleHistoryLinkClick(e, item.serialNumber)}>
                      <div className="dt-td">
                        <span className="dt-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                        <div><div className="dt-model">{item.model || '—'}</div><div className="dt-serial"><span className="sn-label">S/N:</span> {item.serialNumber}</div></div>
                      </div>
                      <div className="dt-td dt-muted">{displayStore(item)}</div>
                      <div className="dt-td"><span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span></div>
                      <div className="dt-td dt-muted">{item.date}</div>
                      <div className="dt-td dt-muted">{item.user || '—'}</div>
                    </a>
                    {warehouseNotes[item.serialNumber]?.[0] && (
                      <div className="dt-note-row">
                        <span className="note-text">📌 {warehouseNotes[item.serialNumber][0].note} <span className="note-inline-meta">· {warehouseNotes[item.serialNumber][0].createdAt}{warehouseNotes[item.serialNumber][0].createdBy ? ` · ${warehouseNotes[item.serialNumber][0].createdBy}` : ''}</span></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!loadingInv && filtered.length === 0 && <div className="empty">Δεν βρέθηκαν εγγραφές.</div>}
          </div>
          {/* Mobile: card view */}
          <div className="mobile-only">
            <div className="warehouse-category-tabs">
              <button className={`warehouse-category-tab ${inventoryCategoryFilter === 'all' ? 'active' : ''}`} onClick={()=>setInventoryCategoryFilter('all')}>Όλα</button>
              {MACHINE_CATEGORIES.map(cat => (
                <button key={cat} className={`warehouse-category-tab ${inventoryCategoryFilter === cat ? 'active' : ''}`} onClick={()=>setInventoryCategoryFilter(cat)}>
                  {cat}
                </button>
              ))}
            </div>
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
              <a key={i} className="machine-row row-link" href={historyHref(item.serialNumber)} onClick={e=>handleHistoryLinkClick(e, item.serialNumber)}>
                <div className="machine-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                <div className="machine-info">
                  <div className="machine-name-row">
                    <div className="machine-name">{item.model || 'Άγνωστος κωδικός είδους'}</div>
                    <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                  </div>
                  <div className="machine-serial"><span className="sn-label">S/N:</span> {item.serialNumber}</div>
                  <div className="machine-bottom">
                    <span className="machine-store">🏪 {displayStore(item)}</span>
                    <span className="machine-date">📅 {item.date}</span>
                  </div>
                  {item.problem && <div className="machine-problem">🔧 {item.problem}</div>}
                  {item.user && <div className="machine-user">👤 {item.user}</div>}
                  {warehouseNotes[item.serialNumber]?.[0] && (
                    <div className="machine-note">📌 {warehouseNotes[item.serialNumber][0].note} <span className="note-inline-meta">· {warehouseNotes[item.serialNumber][0].createdAt}{warehouseNotes[item.serialNumber][0].createdBy ? ` · ${warehouseNotes[item.serialNumber][0].createdBy}` : ''}</span></div>
                  )}
                </div>
              </a>
            ))}
          </div>
          <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
        </div>
      )}

      {tab === 'warehouse' && (
        <div key="warehouse" className="fade-in">
          <div className="warehouse-category-tabs">
            <button className={`warehouse-category-tab ${warehouseCategoryFilter === 'all' ? 'active' : ''}`} onClick={()=>setWarehouseCategoryFilter('all')}>Όλα</button>
            {MACHINE_CATEGORIES.map(cat => (
              <button key={cat} className={`warehouse-category-tab ${warehouseCategoryFilter === cat ? 'active' : ''}`} onClick={()=>setWarehouseCategoryFilter(cat)}>
                {cat}
              </button>
            ))}
          </div>
          <div className="inv-stats">
            <button className={`stat-card stat-card-btn ${warehouseFilter==='all'?'active':''}`} onClick={()=>setWarehouseFilter('all')}><div className="stat-label">Σύνολο αποθήκης</div><div className="stat-val">{countOrDash(warehouseItems.length)}</div><div className="stat-sub">μηχανήματα</div></button>
            <button className={`stat-card stat-card-btn ${warehouseFilter==='new'?'active':''}`} onClick={()=>setWarehouseFilter('new')}><div className="stat-label">Καινούρια</div><div className="stat-val">{countOrDash(availableItems.length)}</div><div className="stat-sub">έτοιμα για αποστολή</div></button>
            <button className={`stat-card stat-card-btn ${warehouseFilter==='repair'?'active':''}`} onClick={()=>setWarehouseFilter('repair')}><div className="stat-label">Σε επισκευή</div><div className="stat-val">{countOrDash(repairItems.length)}</div><div className="stat-sub">στην αποθήκη</div></button>
            <button className={`stat-card stat-card-btn ${warehouseFilter==='shipped'?'active':''}`} onClick={()=>setWarehouseFilter('shipped')}><div className="stat-label">Αποσταλμένα</div><div className="stat-val">{countOrDash(shippedItems.length)}</div><div className="stat-sub">έχουν φύγει</div></button>
          </div>
          {loadingInv && <div className="loading">⏳ Φόρτωση...</div>}
          {!loadingInv && warehouseVisibleItems.length === 0 && <div className="empty">{inventorySnapshotReady ? 'Δεν υπάρχουν μηχανήματα για αυτό το φίλτρο.' : 'Δεν έχει φορτωθεί αποθήκη ακόμα.'}</div>}
          {!loadingInv && warehouseVisibleItems.length > 0 && (
            <div className="dt-table desktop-only">
              <div className="dt-head">
                <div className="dt-th">Κωδικός / Serial</div>
                <div className="dt-th">Από κατάστημα</div>
                <div className="dt-th">Κατάσταση</div>
                <div className="dt-th">Ημερομηνία</div>
                <div className="dt-th">Χρήστης</div>
              </div>
              {warehouseVisibleItems.map((item, i) => {
                const badge = getRepairBadge(item);
                const itemNote = warehouseNotes[item.serialNumber]; // array ή undefined
                const itemParts = supportsSpareParts(item) ? (machineParts[item.serialNumber] || []) : [];
                const itemLogLinks = machineLogLinks[item.serialNumber] || [];
                return (
                  <div key={i}>
                    <a className="dt-row row-link" href={historyHref(item.serialNumber)} onClick={e=>handleHistoryLinkClick(e, item.serialNumber)}>
                      <div className="dt-td">
                        <span className="dt-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                        <div>
                          <div className="dt-model">{item.model || '—'}</div>
                          <div className="dt-serial"><span className="sn-label">S/N:</span> {item.serialNumber}</div>
                        </div>
                        {badge && <span className={`repair-badge repair-badge-${badge.type}`}>{badge.type==='danger'?'🔴':'🟡'} {badge.label}</span>}
                      </div>
                      <div className="dt-td" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
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
                          <span className="store-edit-display dt-muted"
                            onClick={!isViewer ? ()=>setEditingStore(item.serialNumber) : undefined}
                            style={{cursor: isViewer ? 'default' : 'pointer'}}
                            title={isViewer ? undefined : 'Κλικ για αλλαγή καταστήματος'}>
                            {displayStore(item)}{!isViewer && ' ✏️'}
                          </span>
                        )}
                      </div>
                      <div className="dt-td"><span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span></div>
                      <div className="dt-td dt-muted" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
                        {editingDate === item.serialNumber ? (
                          <div className="date-edit-picker">
                            <input
                              className="text-input date-edit-input"
                              type="date"
                              value={editDateValue}
                              onChange={e=>setEditDateValue(e.target.value)}
                              autoFocus
                            />
                            <button className="date-save-btn" onClick={()=>handleUpdateDate(item.serialNumber)} disabled={savingDate}>✓</button>
                            <button className="date-cancel-btn" onClick={cancelEditingDate}>×</button>
                          </div>
                        ) : (
                          <span className="date-edit-display"
                            onClick={!isViewer ? ()=>startEditingDate(item) : undefined}
                            style={{cursor: isViewer ? 'default' : 'pointer'}}
                            title={isViewer ? undefined : 'Κλικ για αλλαγή ημερομηνίας'}>
                            {item.date || '—'}{!isViewer && ' ✏️'}
                          </span>
                        )}
                      </div>
                      <div className="dt-td dt-muted" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span>{item.user || '—'}</span>
                        {renderWarehouseActions(item)}
                      </div>
                    </a>
                    {itemParts.length > 0 && (
                      <div className="dt-part-row" onClick={e=>e.stopPropagation()}>
                        <span className="part-label">Ανταλλακτικά</span>
                        {itemParts.slice(0, 3).map((part, idx) => (
                          <span key={`${part.code}-${idx}`} className="part-chip">
                            {part.code}{part.description ? ` · ${part.description}` : ''}{part.partSerial ? ` · SN ${part.partSerial}` : ''}
                            <button className="part-remove" onClick={e=>{e.stopPropagation();handleDeletePart(item.serialNumber, part);}} title="Αφαίρεση ανταλλακτικού">×</button>
                          </span>
                        ))}
                        {itemParts.length > 3 && <span className="part-more">+{itemParts.length - 3}</span>}
                      </div>
                    )}
                    {itemLogLinks[0] && (
                      <div className="dt-part-row log-row" onClick={e=>e.stopPropagation()}>
                        <span className="part-label">{getLinkLabel(item)}</span>
                        <a className="log-link" href={itemLogLinks[0].url} target="_blank" rel="noreferrer">
                          {getOpenLinkLabel(item)}
                        </a>
                        <span className="note-inline-meta">· {itemLogLinks[0].createdAt}</span>
                      </div>
                    )}
                    {/* Note row με ιστορικό */}
                    <div className="dt-note-row" onClick={e=>e.stopPropagation()}>
                      {editingNote === item.serialNumber ? (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',width:'100%'}}>
                          <input className="text-input note-input-inline" value={noteInput}
                            onChange={e=>setNoteInput(e.target.value)}
                            placeholder="Γράψε νέα σημείωση..."
                            autoFocus
                            onKeyDown={e=>{if(e.key==='Enter')handleSaveNote(item.serialNumber);if(e.key==='Escape'){setEditingNote(null);setNoteInput('');}}} />
                          <button className="btn-quick-action" onClick={()=>handleSaveNote(item.serialNumber)} disabled={savingNote}>{savingNote?'...':'Αποθήκευση'}</button>
                          <button className="btn-note-cancel" onClick={()=>{setEditingNote(null);setNoteInput('');}}>✕</button>
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',justifyContent:'flex-start',flexWrap:'wrap'}}>
                          {itemNote && itemNote.length > 0 ? (
                            <>
                              <span className="note-text">📌 {itemNote[0].note} <span className="note-inline-meta">· {itemNote[0].createdAt}{itemNote[0].createdBy ? ` · ${itemNote[0].createdBy}` : ''}</span></span>
                              <span className="note-count" onClick={()=>setExpandedNotes(p=>({...p,[item.serialNumber]:!p[item.serialNumber]}))}>
                                {itemNote.length > 1 ? `${itemNote.length} σημ. ${expandedNotes[item.serialNumber]?'▲':'▼'}` : ''}
                              </span>
                            </>
                          ) : (
                            <span className="note-empty">+ Σημείωση</span>
                          )}
                          <button className="note-add-btn" onClick={()=>{setEditingNote(item.serialNumber);setNoteInput('');}}>+ Νέα σημείωση</button>
                        </div>
                      )}
                      {/* Ιστορικό σημειώσεων */}
                      {expandedNotes[item.serialNumber] && itemNote && itemNote.length > 1 && (
                        <div className="note-history">
                          {itemNote.slice(1).map((n, i) => (
                            <div key={i} className="note-history-item">
                              <span className="note-history-text">📌 {n.note}</span>
                              <span className="note-history-meta">{n.createdAt} · {n.createdBy}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mobile-only">
            {warehouseVisibleItems.map((item, i) => {
              const badge = getRepairBadge(item);
              const itemParts = supportsSpareParts(item) ? (machineParts[item.serialNumber] || []) : [];
              const itemLogLinks = machineLogLinks[item.serialNumber] || [];
              const mobMenuId = `${item.serialNumber}-${item.model || ''}`;
              const isSwiped = swipedItem === item.serialNumber;
              return (
                <div key={i} className="swipe-container"
                  onTouchStart={!isViewer ? e=>onSwipeStart(e, item.serialNumber) : undefined}
                  onTouchEnd={!isViewer ? onSwipeEnd : undefined}
                >
                  {!isViewer && isSwiped && (() => {
                    const sw = (fn) => { setSwipedItemSynced(null); fn(); };
                    const act = normalizeAction(item.action);
                    return (
                      <div className="swipe-actions-bg">
                        <button className="swipe-action-btn sa-action" onClick={e=>{e.stopPropagation();sw(()=>startNewAction(item.serialNumber,item.model));}}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Κίνηση
                        </button>
                        {act === 'Καινούριο Μηχάνημα' && (
                          <button className="swipe-action-btn sa-repair" onClick={e=>{e.stopPropagation();sw(()=>handleMoveToRepair(item));}}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                            Επισκευή
                          </button>
                        )}
                        {act === 'Εισαγωγή για επισκευή' && (
                          <button className="swipe-action-btn sa-done" onClick={e=>{e.stopPropagation();sw(()=>handleMarkRepaired(item));}}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Έτοιμο
                          </button>
                        )}
                        {supportsSpareParts(item) && (
                          <button className="swipe-action-btn sa-part" onClick={e=>{e.stopPropagation();sw(()=>openPartModal(item));}}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                            Ανταλ.
                          </button>
                        )}
                        <button className="swipe-action-btn sa-delete" onClick={e=>{e.stopPropagation();sw(()=>handleDeleteItem(item));}}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          Διαγραφή
                        </button>
                      </div>
                    );
                  })()}
                <a data-swipe-row className={`machine-row row-link${openActionMenu === mobMenuId ? ' menu-open' : ''}${isSwiped ? ' swiped' : ''}`} href={historyHref(item.serialNumber)} onClick={e=>{ if(isSwiped){e.preventDefault();setSwipedItemSynced(null);return;} handleHistoryLinkClick(e, item.serialNumber);}}>
                  <div className="machine-dot" style={{background:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                  <div className="machine-info">
                    <div className="machine-name-row">
                      <div className="machine-name">{item.model || 'Άγνωστος κωδικός είδους'}</div>
                      <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                    </div>
                    <div className="machine-serial"><span className="sn-label">S/N:</span> {item.serialNumber}</div>
                    <div className="machine-bottom" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
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
                        <span className="machine-store"
                          onClick={!isViewer ? ()=>setEditingStore(item.serialNumber) : undefined}
                          style={{cursor: isViewer ? 'default' : 'pointer'}}>
                          🏪 {displayStore(item)}{!isViewer && ' ✏️'}
                        </span>
                      )}
                      {editingDate === item.serialNumber ? (
                        <span className="mobile-date-edit">
                          <input
                            className="text-input date-edit-input"
                            type="date"
                            value={editDateValue}
                            onChange={e=>setEditDateValue(e.target.value)}
                            autoFocus
                          />
                          <button className="date-save-btn" onClick={()=>handleUpdateDate(item.serialNumber)} disabled={savingDate}>✓</button>
                          <button className="date-cancel-btn" onClick={cancelEditingDate}>×</button>
                        </span>
                      ) : (
                        <span className="machine-date"
                          onClick={!isViewer ? ()=>startEditingDate(item) : undefined}
                          style={{cursor: isViewer ? 'default' : 'pointer'}}>
                          📅 {item.date}{!isViewer && ' ✏️'}
                        </span>
                      )}
                    </div>
                    {badge && <div className={`repair-badge repair-badge-${badge.type}`}>{badge.type==='danger'?'🔴':'🟡'} Σε επισκευή {badge.label}</div>}
                    {itemParts.length > 0 && (
                      <div className="machine-parts" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
                        <span className="part-label">Ανταλλακτικά</span>
                        {itemParts.map((part, idx) => (
                          <span key={`${part.code}-${idx}`} className="part-chip">
                            {part.code}{part.description ? ` · ${part.description}` : ''}{part.partSerial ? ` · SN ${part.partSerial}` : ''}
                            <button className="part-remove" onClick={e=>{e.stopPropagation();handleDeletePart(item.serialNumber, part);}} title="Αφαίρεση ανταλλακτικού">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {itemLogLinks[0] && (
                      <div className="machine-parts log-row" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
                        <span className="part-label">{getLinkLabel(item)}</span>
                        <button className="log-link" onClick={()=>openLogLink(itemLogLinks[0].url)}>
                          {getOpenLinkLabel(item)}
                        </button>
                        <span className="note-inline-meta">· {itemLogLinks[0].createdAt}</span>
                      </div>
                    )}
                    {/* Note section mobile */}
                    {editingNote === item.serialNumber ? (
                      <div className="note-edit" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
                        <textarea className="note-input" value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Γράψε νέα σημείωση..." autoFocus />
                        <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
                          <button className="btn-quick-action" onClick={()=>handleSaveNote(item.serialNumber)} disabled={savingNote}>{savingNote?'...':'💾 Αποθήκευση'}</button>
                          <button className="btn-note-cancel" onClick={()=>{setEditingNote(null);setNoteInput('');}}>Άκυρο</button>
                        </div>
                      </div>
                    ) : (
                      <div className="note-display" onClick={e=>{e.preventDefault();e.stopPropagation();}}>
                        {warehouseNotes[item.serialNumber]?.length > 0 ? (
                          <>
                            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                              <span className="note-text" style={{flex:1}}>📌 {warehouseNotes[item.serialNumber][0].note} <span className="note-inline-meta">· {warehouseNotes[item.serialNumber][0].createdAt}{warehouseNotes[item.serialNumber][0].createdBy ? ` · ${warehouseNotes[item.serialNumber][0].createdBy}` : ''}</span></span>
                              {warehouseNotes[item.serialNumber].length > 1 && (
                                <span className="note-count" onClick={()=>setExpandedNotes(p=>({...p,[item.serialNumber]:!p[item.serialNumber]}))}>
                                  {warehouseNotes[item.serialNumber].length} σημ. {expandedNotes[item.serialNumber]?'▲':'▼'}
                                </span>
                              )}
                            </div>
                            {expandedNotes[item.serialNumber] && warehouseNotes[item.serialNumber].slice(1).map((n,i) => (
                              <div key={i} className="note-history-item">
                                <span className="note-history-text">📌 {n.note}</span>
                                <span className="note-history-meta">{n.createdAt} · {n.createdBy}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <span className="note-empty">+ Προσθήκη σημείωσης</span>
                        )}
                        {!isViewer && <button className="note-add-btn" style={{marginTop:'6px',width:'100%'}} onClick={()=>{setEditingNote(item.serialNumber);setNoteInput('');}}>
                          + Νέα σημείωση
                        </button>}
                      </div>
                    )}
                    {!isViewer && <div className="mobile-actions-row">
                      <button className="action-menu-btn" onClick={e=>{e.preventDefault();e.stopPropagation();setMobileSheet(item);setSwipedItemSynced(null);}}>⋯</button>
                    </div>}
                  </div>
                </a>
                </div>
              );
            })}
          </div>
          <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadInventory}>🔄 Ανανέωση</button>
        </div>
      )}

      {tab === 'history' && (
        <div key="history" className="fade-in">
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
              <div className="text-input store-display" style={{cursor:'pointer',color:historyStore?'var(--t1)':'var(--t3)',flex:1}} onClick={()=>setShowStorePicker('history')}>{historyStore || 'Επίλεξε κατάστημα...'}</div>
              {historyStore && <button className="btn-clear" onClick={()=>{setHistoryStore('');closeStoreDetails();}}>✕</button>}
              <button className="btn-search" onClick={()=>loadHistory('', historyStore)}>Αναζήτηση</button>
            </div>
            {showStorePicker === 'history' && (
              <div className="store-picker" style={{marginTop:'8px'}}>
                <input className="text-input" placeholder="🔍 Αναζήτηση..." value={storeSearch} onChange={e=>{setStoreSearch(e.target.value);setStoreChain('all');}} autoFocus />
                <div className="category-tabs" style={{padding:'6px 0'}}>
                  <button className={`category-tab ${historyStoreCategoryFilter === 'all' ? 'active' : ''}`} onClick={()=>setHistoryStoreCategoryFilter('all')}>Όλα</button>
                  {MACHINE_CATEGORIES.map(cat => (
                    <button key={cat} className={`category-tab ${historyStoreCategoryFilter === cat ? 'active' : ''}`} onClick={()=>setHistoryStoreCategoryFilter(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="chain-tabs">
                  {STORE_CHAINS.map(c => <button key={c.id} className={`chain-tab ${storeChain===c.id?'active':''}`} onClick={()=>{setStoreChain(c.id);setStoreSearch('');}}>{c.label}</button>)}
                </div>
                <div className="store-list">
                  {(() => {
                    const visibleStores = historyStoreOptions.filter(s => {
                      const mc = matchesStoreChain(s, storeChain);
                      return mc && (storeSearch===''||s.toLowerCase().includes(storeSearch.toLowerCase()));
                    });
                    const canOpenManualStore = storeSearch.trim() && !visibleStores.some(s => s.toLowerCase() === storeSearch.trim().toLowerCase());
                    return (
                      <>
                        {visibleStores.map(s => <div key={s} className={`store-item ${historyStore===s?'active':''}`} onClick={()=>{setHistoryStore(s);openStoreDetails(getStoreDetailsByName(s));setShowStorePicker(false);setStoreSearch('');setStoreChain('all');}}>{s}</div>)}
                        {canOpenManualStore && (
                          <button
                            className="store-item store-item-manual"
                            onClick={()=>{const manualName=storeSearch.trim();setHistoryStore(manualName);openStoreDetails(getStoreDetailsByName(manualName));setShowStorePicker(false);setStoreSearch('');setStoreChain('all');}}
                          >
                            + Άνοιγμα καρτέλας για “{storeSearch.trim()}”
                          </button>
                        )}
                        {visibleStores.length === 0 && !canOpenManualStore && (
                          <div className="store-picker-empty">Δεν βρέθηκε κατάστημα. Γράψε όνομα για χειροκίνητο άνοιγμα καρτέλας.</div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <button className="btn-ghost" style={{marginTop:'8px'}} onClick={()=>setShowStorePicker(false)}>Άκυρο</button>
              </div>
            )}
            {historyStore && selectedStoreDetails?.name === historyStore && (
              <div style={{marginTop:'10px'}}>
                {renderStoreDetailsEditor()}
              </div>
            )}
          </div>
          {history === null && <div className="empty">Γράψε serial number για να δεις το ιστορικό.</div>}
          {history && history.length === 0 && <div className="empty">Δεν βρέθηκε ιστορικό.</div>}
          {history && history.length > 0 && historySerial && (
            renderMachineCard(history[0])
          )}
          {history && history.length > 0 && historySerial && warehouseNotes[history[0]?.serialNumber]?.length > 0 && (
            <div className="history-notes-card">
              <div className="wh-section-title">Σημειώσεις μηχανήματος</div>
              <div className="note-history">
                {warehouseNotes[history[0]?.serialNumber].map((n, i) => (
                  <div key={i} className="note-history-item">
                    <span className="note-history-text">📌 {n.note}</span>
                    <span className="note-history-meta">{n.createdAt}{n.createdBy ? ` · ${n.createdBy}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {history && history.length > 0 && !historySerial && (
            <div className="history-store-header">
              <span className="history-store-count">{history.length} κινήσεις για <strong>{historyStore}</strong></span>
            </div>
          )}
          {history && historyTimeline.map((entry, i) => {
            if (entry.type === 'part') {
              const part = entry.part;
              return (
                <div key={`part-${part.code}-${part.createdAt}-${i}`} className="history-item">
                  <div className="h-dot-wrap">
                    <div className="h-dot part-dot" />
                    {i < historyTimeline.length-1 && <div className="h-line" />}
                  </div>
                  <div className="h-card part-history-card">
                    <div className="h-action-row">
                      <div className="h-action">Ανταλλακτικό</div>
                      <span className="status-pill pill-blue">Προστέθηκε</span>
                    </div>
                    <div className="h-notes part-history-text">
                      <span>{part.code}{part.description ? ` · ${part.description}` : ''}{part.partSerial ? ` · SN ${part.partSerial}` : ''}</span>
                      {!isViewer && <button className="part-remove" onClick={()=>handleDeletePart(history[0]?.serialNumber, part)} title="Αφαίρεση ανταλλακτικού">×</button>}
                    </div>
                    <div className="h-meta">🧩 {part.createdAt}{part.createdBy ? ` · 👤 ${part.createdBy}` : ''}</div>
                  </div>
                </div>
              );
            }
            if (entry.type === 'logLink') {
              const link = entry.link;
              const linkMachine = history?.[0] || {};
              return (
                <div key={`log-${link.url}-${link.createdAt}-${i}`} className="history-item">
                  <div className="h-dot-wrap">
                    <div className="h-dot log-dot" />
                    {i < historyTimeline.length-1 && <div className="h-line" />}
                  </div>
                  <div className="h-card log-history-card">
                    <div className="h-action-row">
                      <div className="h-action">{getLinkActionLabel(linkMachine)}</div>
                      <span className="status-pill pill-purple">{getLinkLabel(linkMachine)}</span>
                    </div>
                    <div className="h-notes">
                      <a className="log-link" href={link.url} target="_blank" rel="noreferrer">{getOpenLinkLabel(linkMachine)}</a>
                    </div>
                    <div className="h-meta">🔗 {link.createdAt}{link.createdBy ? ` · 👤 ${link.createdBy}` : ''}</div>
                  </div>
                </div>
              );
            }
            const item = entry.item;
            return (
            <div key={`movement-${i}`} className="history-item">
              <div className="h-dot-wrap">
                <div className="h-dot" style={{borderColor:STATUS_COLOR[normalizeAction(item.action)]||'#888'}} />
                {i < historyTimeline.length-1 && <div className="h-line" />}
              </div>
              <div className="h-card">
                <div className="h-action-row">
                  <div className="h-action">{normalizeAction(item.action)}</div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <span className={`status-pill ${STATUS_PILL[normalizeAction(item.action)]?.cls||'pill-gray'}`}>{STATUS_PILL[normalizeAction(item.action)]?.label||normalizeAction(item.action)}</span>
                    {!isViewer && item.timestamp && (
                      <button className="h-del-btn" title="Διαγραφή κίνησης" disabled={deletingMovement===item.timestamp}
                        onClick={e=>{e.stopPropagation();handleDeleteMovement(item);}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {!historySerial && (
                  <div className="h-machine">
                    <span className="h-machine-model">{item.model || '—'}</span>
                    <span className="h-machine-serial">{item.serialNumber}</span>
                    {!isViewer && <button className="btn-quick-action" style={{marginLeft:'auto'}} onClick={e=>{e.stopPropagation();startNewAction(item.serialNumber,item.model);}}>+ Νέα κίνηση</button>}
                  </div>
                )}
                <div className="h-meta">🏪 {item.store} · 📅 {item.date}{item.user ? ` · 👤 ${item.user}` : ''}</div>
                {item.problem && <div className="h-notes">🔧 {item.problem}</div>}
                {item.notes && <div className="h-notes">📝 {item.notes}</div>}
                {!historySerial && warehouseNotes[item.serialNumber]?.[0] && (
                  <div className="h-notes">📌 {warehouseNotes[item.serialNumber][0].note} <span className="note-inline-meta">· {warehouseNotes[item.serialNumber][0].createdAt}{warehouseNotes[item.serialNumber][0].createdBy ? ` · ${warehouseNotes[item.serialNumber][0].createdBy}` : ''}</span></div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {tab === 'tickets' && (() => {
        const STATUS_META = {
          'Νέο':        { cls: 'st-new',      label: 'Νέο' },
          'Ελλιπές':    { cls: 'st-missing',  label: 'Ελλιπές' },
          'Σε εξέλιξη': { cls: 'st-progress', label: 'Σε εξέλιξη' },
          'Κλειστό':    { cls: 'st-closed',   label: 'Κλειστό' },
        };
        const STATUS_ORDER = ['Νέο', 'Ελλιπές', 'Σε εξέλιξη', 'Κλειστό'];
        const MISSING_LABEL = { store: 'Υποκατάστημα', address: 'Διεύθυνση', postalCode: 'Τ.Κ.', contactName: 'Υπεύθυνος', contactPhone: 'Τηλέφωνο', problem: 'Πρόβλημα' };
        const missingOf = t => (t.missing || '').split(',').map(x => x.trim()).filter(Boolean);
        const count = s => tickets.filter(t => t.status === s).length;

        const q = normalizeSearch(ticketSearch);
        const visible = tickets.filter(t => {
          if (ticketFilter === 'open' && t.status === 'Κλειστό') return false;
          if (ticketFilter !== 'open' && ticketFilter !== 'all' && t.status !== ticketFilter) return false;
          if (!q) return true;
          return normalizeSearch([t.ticketId, t.store, t.contactName, t.contactPhone, t.serialNumber, t.problem, t.from].join(' ')).includes(q);
        });

        const fmtFull = iso => { const d = new Date(iso); return isNaN(d) ? (iso || '—') : d.toLocaleString('el-GR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); };
        const ago = iso => {
          const d = new Date(iso); if (isNaN(d)) return '';
          const m = Math.round((Date.now() - d.getTime()) / 60000);
          if (m < 1) return 'μόλις τώρα';
          if (m < 60) return `πριν ${m}′`;
          const h = Math.round(m / 60);
          if (h < 24) return `πριν ${h} ώρ${h === 1 ? 'α' : 'ες'}`;
          const days = Math.round(h / 24);
          if (days === 1) return 'χθες';
          if (days < 7) return `πριν ${days} μέρες`;
          return d.toLocaleDateString('el-GR', { day:'2-digit', month:'2-digit' });
        };
        const telHref = p => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;
        const selected = tickets.find(t => t.ticketId === openTicketId) || null;

        const Field = ({ label, value, required, mono, children }) => (
          <div className="tk-field">
            <span className="tk-field-label">{label}</span>
            {children || (value
              ? <span className={`tk-field-value ${mono ? 'mono' : ''}`}>{value}</span>
              : required
                ? <span className="tk-field-missing">Λείπει</span>
                : <span className="tk-field-empty">—</span>)}
          </div>
        );

        const renderDetail = (t) => {
          const missing = missingOf(t);
          const busy = savingTicketId === t.ticketId;
          const editing = editingTicketId === t.ticketId;
          const meta = STATUS_META[t.status] || { cls: 'st-closed', label: t.status || '—' };

          return (
            <div className="tk-detail">
              <div className="tk-detail-head">
                <div className="tk-detail-titles">
                  <div className="tk-detail-id-row">
                    <span className="tk-id">{t.ticketId}</span>
                    <span className={`tk-status ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <div className="tk-detail-store">{t.store || 'Χωρίς υποκατάστημα'}</div>
                  <div className="tk-detail-sub">Παραλήφθηκε {ago(t.createdAt)} · {String(t.threadId || '').startsWith('web-') ? `φόρμα web${t.from ? ` · ${t.from}` : ''}` : (t.from || '—')}</div>
                </div>
                <button className="tk-close desktop-split-hide" onClick={()=>openTicket(t)} aria-label="Κλείσιμο">×</button>
              </div>

              {editing ? (
                <>
                  <div className="tk-edit-grid">
                    {TICKET_EDIT_FIELDS.map(f => (
                      <label key={f.key} className={`tk-edit-field ${f.multiline ? 'wide' : ''}`}>
                        <span className="tk-field-label">{f.label}{['store','address','postalCode','contactName','contactPhone','problem'].includes(f.key) ? ' *' : ''}</span>
                        {f.multiline
                          ? <textarea className="text-input" rows={3} value={ticketDraft[f.key] || ''} onChange={e=>setTicketDraft(d=>({...d,[f.key]:e.target.value}))} />
                          : <input className="text-input" value={ticketDraft[f.key] || ''} onChange={e=>setTicketDraft(d=>({...d,[f.key]:e.target.value}))} />}
                      </label>
                    ))}
                  </div>
                  <div className="tk-edit-actions">
                    <button className="tk-btn" onClick={()=>setEditingTicketId(null)} disabled={busy}>Άκυρο</button>
                    <button className="tk-btn primary" onClick={()=>saveTicketEdit(t)} disabled={busy}>{busy ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'}</button>
                  </div>
                </>
              ) : (
                <>
                  {missing.length > 0 && (
                    <div className="tk-missing-banner">
                      <div>
                        <strong>Λείπουν στοιχεία:</strong> {missing.map(m => MISSING_LABEL[m] || m).join(', ')}
                      </div>
                      {!isViewer && <button className="tk-btn small" onClick={()=>startEditTicket(t)}>Συμπλήρωση</button>}
                    </div>
                  )}

                  <div className="tk-quick">
                    <a className={`tk-btn ${t.contactPhone ? '' : 'disabled'}`} href={t.contactPhone ? telHref(t.contactPhone) : undefined}>📞 Κλήση</a>
                    <a className={`tk-btn ${t.from ? '' : 'disabled'}`} href={t.from ? `mailto:${t.from}?subject=${encodeURIComponent(`${t.ticketId} — ${t.subject || 'Αίτημα'}`)}` : undefined}>✉️ Email</a>
                    {!isViewer && <button className="tk-btn" onClick={()=>startEditTicket(t)}>✏️ Επεξεργασία</button>}
                    {!isViewer && <button className="tk-btn primary" disabled={!t.serialNumber} onClick={()=>ticketToMovement(t)} title={t.serialNumber ? '' : 'Χρειάζεται σειριακός Cashdro'}>🔧 Καταχώρηση επισκευής</button>}
                  </div>

                  {!isViewer && (
                    <div className="tk-segment" role="group" aria-label="Κατάσταση">
                      {STATUS_ORDER.map(s => (
                        <button key={s} className={`tk-seg ${STATUS_META[s].cls} ${t.status===s?'active':''}`} disabled={busy}
                          onClick={()=>t.status!==s && updateTicket(t.ticketId, { status: s })}>{s}</button>
                      ))}
                    </div>
                  )}

                  <div className="tk-problem">
                    <span className="tk-field-label">Περιγραφή προβλήματος</span>
                    {t.problem ? <p>{t.problem}</p> : <span className="tk-field-missing">Λείπει</span>}
                  </div>

                  <div className="tk-sections">
                    <section className="tk-section">
                      <div className="tk-section-title">Κατάστημα</div>
                      <Field label="Υποκατάστημα" value={t.store} required />
                      <Field label="Διεύθυνση" value={t.address} required />
                      <Field label="Τ.Κ." value={t.postalCode} required />
                    </section>
                    <section className="tk-section">
                      <div className="tk-section-title">Επικοινωνία</div>
                      <Field label="Υπεύθυνος" value={t.contactName} required />
                      <Field label="Τηλέφωνο" required>
                        {t.contactPhone
                          ? <a className="tk-link mono" href={telHref(t.contactPhone)}>{t.contactPhone}</a>
                          : <span className="tk-field-missing">Λείπει</span>}
                      </Field>
                      <Field label="Email">
                        {t.from ? <a className="tk-link" href={`mailto:${t.from}`}>{t.from}</a> : <span className="tk-field-empty">—</span>}
                      </Field>
                    </section>
                    <section className="tk-section">
                      <div className="tk-section-title">Μηχάνημα</div>
                      <Field label="Σειριακός Cashdro" value={t.serialNumber} mono />
                      <Field label="IP" value={t.ip} mono />
                      <Field label="Μεταφορική" value={t.courier} />
                    </section>
                  </div>

                  {(() => {
                    // Logs: του ticket (προσθήκη/αφαίρεση) + του μηχανήματος με τον ίδιο σειριακό (μόνο προβολή)
                    const own = t.logLinks || [];
                    const sn = String(t.serialNumber || '').trim().toUpperCase();
                    const machKey = sn && Object.keys(machineLogLinks || {}).find(k => k.trim().toUpperCase() === sn);
                    const mach = machKey ? (machineLogLinks[machKey] || []) : [];
                    const shortUrl = u => String(u || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
                    const addLog = async () => {
                      if (!ticketLogDraft.trim()) return;
                      const ok = await updateTicket(t.ticketId, { addLogLink: { url: ticketLogDraft.trim() } });
                      if (ok) setTicketLogDraft('');
                    };
                    return (
                      <div className="tk-block">
                        <span className="tk-field-label">Logs {own.length + mach.length > 0 && <em>({own.length + mach.length})</em>}</span>
                        {own.length + mach.length === 0 && <div className="tk-field-empty tk-logs-empty">Δεν υπάρχουν logs ακόμα.</div>}
                        {(own.length > 0 || mach.length > 0) && (
                          <ul className="tk-logs">
                            {own.map((l, i) => (
                              <li key={`o-${l.url}-${l.createdAt}-${i}`}>
                                <a className="tk-link" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>🔗 {shortUrl(l.url)}</a>
                                <span className="tk-log-meta">{l.createdAt ? fmtFull(l.createdAt) : ''}{l.createdBy ? ` · ${l.createdBy}` : ''}</span>
                                {!isViewer && <button className="tk-log-del" disabled={busy} aria-label="Αφαίρεση link"
                                  onClick={()=>updateTicket(t.ticketId, { removeLogLink: { url: l.url, createdAt: l.createdAt || '' } })}>×</button>}
                              </li>
                            ))}
                            {mach.map((l, i) => (
                              <li key={`m-${l.url}-${i}`} className="from-machine">
                                <a className="tk-link" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>🔗 {shortUrl(l.url)}</a>
                                <span className="tk-log-meta">μηχάνημα {machKey}{l.createdAt ? ` · ${l.createdAt}` : ''}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {!isViewer && (
                          <div className="tk-log-add">
                            <input className="text-input" value={ticketLogDraft} onChange={e=>setTicketLogDraft(e.target.value)}
                              onKeyDown={e=>{ if (e.key === 'Enter') addLog(); }} placeholder="Επικόλλησε link logs…" />
                            <button className="tk-btn small primary" disabled={!ticketLogDraft.trim() || busy} onClick={addLog}>+ Προσθήκη</button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {t.storeRemarks && (
                    <div className="tk-block">
                      <span className="tk-field-label">Παρατηρήσεις καταστήματος</span>
                      <p>{t.storeRemarks}</p>
                    </div>
                  )}

                  {!isViewer && (
                    <div className="tk-block">
                      <span className="tk-field-label">Εσωτερικές σημειώσεις <em>(δεν στέλνονται στο κατάστημα)</em></span>
                      <textarea className="text-input" rows={2} value={ticketNoteDraft} onChange={e=>setTicketNoteDraft(e.target.value)} placeholder="Γράψε μια σημείωση…" />
                      {ticketNoteDraft !== (t.notes || '') && (
                        <div className="tk-note-actions">
                          <button className="tk-btn small" onClick={()=>setTicketNoteDraft(t.notes || '')} disabled={busy}>Άκυρο</button>
                          <button className="tk-btn small primary" onClick={()=>updateTicket(t.ticketId, { notes: ticketNoteDraft })} disabled={busy}>Αποθήκευση</button>
                        </div>
                      )}
                    </div>
                  )}
                  {isViewer && t.notes && (
                    <div className="tk-block"><span className="tk-field-label">Εσωτερικές σημειώσεις</span><p>{t.notes}</p></div>
                  )}

                  {t.lastMessage && (
                    <details className="tk-original">
                      <summary>Αρχικό email{t.subject ? ` — ${t.subject}` : ''}</summary>
                      <pre>{t.lastMessage}</pre>
                    </details>
                  )}

                  <div className="tk-footer">
                    <span>Δημιουργήθηκε {fmtFull(t.createdAt)} · Αλλαγή {fmtFull(t.updatedAt)}{t.updatedBy ? ` (${t.updatedBy})` : ''}</span>
                    {!isViewer && <button className="tk-delete" onClick={()=>setTicketDeleteConfirm(t)} disabled={busy}>Διαγραφή</button>}
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <div key="tickets" className="fade-in tk-page">
            <div className="tk-header">
              <div>
                <div className="tk-title">Tickets</div>
                <div className="tk-subtitle">Αιτήματα από τις φόρμες των καταστημάτων</div>
              </div>
              <div className="tk-header-actions">
                <button className="tk-btn" onClick={copyFormLink} title="Το link της φόρμας αιτήματος για τα καταστήματα">{formLinkState === 'copied' ? '✓ Αντιγράφηκε' : formLinkState === 'error' ? '⚠️ Σφάλμα' : '🔗 Link φόρμας'}</button>
                <button className="tk-btn" onClick={loadTickets} disabled={loadingTickets}>{loadingTickets ? 'Φόρτωση…' : '↻ Ανανέωση'}</button>
              </div>
            </div>

            <div className="tk-stats">
              {STATUS_ORDER.map(s => (
                <button key={s} className={`tk-stat ${STATUS_META[s].cls} ${ticketFilter===s?'active':''}`}
                  onClick={()=>setTicketFilter(ticketFilter===s ? 'open' : s)}>
                  <span className="tk-stat-num">{count(s)}</span>
                  <span className="tk-stat-label">{s === 'Κλειστό' ? 'Κλειστά' : s === 'Νέο' ? 'Νέα' : s === 'Ελλιπές' ? 'Ελλιπή' : s}</span>
                </button>
              ))}
            </div>

            <div className="tk-toolbar">
              <input className="text-input tk-search" placeholder="🔍 Αναζήτηση: αριθμός, κατάστημα, υπεύθυνος, σειριακός…" value={ticketSearch} onChange={e=>setTicketSearch(e.target.value)} />
              <div className="tk-scope">
                <button className={ticketFilter!=='all'?'active':''} onClick={()=>setTicketFilter('open')}>Ανοιχτά</button>
                <button className={ticketFilter==='all'?'active':''} onClick={()=>setTicketFilter('all')}>Όλα</button>
              </div>
            </div>

            {ticketsError && <div className="error-banner">⚠️ {ticketsError}</div>}

            <div className={`tk-layout ${selected ? 'has-selection' : ''}`}>
              <div className="tk-list">
                {loadingTickets && tickets.length === 0 && <div className="tk-empty">Φόρτωση…</div>}
                {!loadingTickets && !ticketsError && visible.length === 0 && (
                  <div className="tk-empty">
                    {q ? 'Κανένα ticket δεν ταιριάζει στην αναζήτηση.' : 'Δεν υπάρχουν tickets εδώ.'}
                  </div>
                )}
                {visible.map(t => {
                  const isOpen = openTicketId === t.ticketId;
                  const missing = missingOf(t);
                  const meta = STATUS_META[t.status] || { cls: 'st-closed', label: t.status || '—' };
                  return (
                    <div key={t.ticketId} className="tk-item-wrap">
                      <button className={`tk-item ${meta.cls} ${isOpen ? 'selected' : ''}`} onClick={()=>openTicket(t)}>
                        <div className="tk-item-top">
                          <span className="tk-id">{t.ticketId}</span>
                          <span className={`tk-status ${meta.cls}`}>{meta.label}</span>
                          <span className="tk-ago">{ago(t.createdAt)}</span>
                        </div>
                        <div className="tk-item-store">{t.store || t.from || 'Χωρίς υποκατάστημα'}</div>
                        <div className="tk-item-problem">{t.problem || <em>Χωρίς περιγραφή</em>}</div>
                        <div className="tk-item-meta">
                          {t.contactName && <span>👤 {t.contactName}</span>}
                          {t.contactPhone && <span>📞 {t.contactPhone}</span>}
                          {t.serialNumber && <span className="mono">#{t.serialNumber}</span>}
                          {missing.length > 0 && <span className="tk-chip-missing">Λείπουν {missing.length}</span>}
                        </div>
                      </button>
                      {isOpen && <div className="tk-inline">{renderDetail(t)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="tk-panel">
                {selected
                  ? renderDetail(selected)
                  : <div className="tk-panel-empty">Επίλεξε ένα ticket για να δεις τα στοιχεία του.</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {tab === 'settings' && (
        <div key="settings" className="fade-in">
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
          {!isViewer && <div className="card">
            <div className="card-title">Ρυθμίσεις</div>
            <div className="card-sub">Διαχείριση καταστημάτων</div>
            <div className="section-label">Προσθήκη νέου καταστήματος</div>
            <div className="field-group">
              <label className="field-label">Όνομα καταστήματος *</label>
              <input className="text-input" value={newStoreName} onChange={e=>{setNewStoreName(e.target.value);setAddStoreMsg(null);}} placeholder="π.χ. ΚΩΤΣΟΒΟΛΟΣ 999 Νέα Πόλη" onKeyDown={e=>{if(e.key==='Enter')handleAddStore();}} />
            </div>
            <div className="store-extra-grid">
              <div className="field-group">
                <label className="field-label">Τηλέφωνο</label>
                <input className="text-input" value={newStorePhone} onChange={e=>{setNewStorePhone(e.target.value);setAddStoreMsg(null);}} placeholder="π.χ. 2101234567" />
              </div>
              <div className="field-group">
                <label className="field-label">ΑΦΜ</label>
                <input className="text-input" value={newStoreVat} onChange={e=>{setNewStoreVat(e.target.value);setAddStoreMsg(null);}} placeholder="π.χ. 123456789" />
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Διεύθυνση</label>
              <input className="text-input" value={newStoreAddress} onChange={e=>{setNewStoreAddress(e.target.value);setAddStoreMsg(null);}} placeholder="π.χ. Πατησίων 100, Αθήνα" />
            </div>
            {addStoreMsg && <div className={addStoreMsg.type==='success'?'banner-success':'error-banner'} style={{marginBottom:'12px'}}>{addStoreMsg.type==='success'?'✅ ':'⚠️ '}{addStoreMsg.text}</div>}
            <button className="btn-primary" onClick={handleAddStore} disabled={addingStore||!newStoreName.trim()}>{addingStore?'⏳ Προσθήκη...':'➕ Προσθήκη καταστήματος'}</button>
          </div>}
          <div className="card">
            <div className="section-label">Λίστα καταστημάτων ({filteredStoreRows.length}/{storesList.length})</div>
            <div className="settings-store-search">
              <input
                className="text-input"
                value={settingsStoreSearch}
                onChange={e=>setSettingsStoreSearch(e.target.value)}
                placeholder="🔍 Αναζήτηση με όνομα, τηλέφωνο, ΑΦΜ ή διεύθυνση..."
              />
              {settingsStoreSearch && <button className="btn-clear" onClick={()=>setSettingsStoreSearch('')}>✕</button>}
            </div>
            <div className="settings-store-layout">
              <div className="settings-store-list">
                {filteredStoreRows.map((store,i) => {
                  const isIncomplete = !store.phone || !store.address || !store.vat;
                  const cs = getContractStatus(store);
                  return (
                    <button
                      key={`${store.name}-${i}`}
                      className={`settings-store-item ${selectedStoreDetails?.name===store.name?'active':''} ${isIncomplete?'incomplete':''}`}
                      onClick={()=>openStoreDetails(store)}
                    >
                      {isIncomplete && <span className="store-incomplete-dot" title="Ελλιπή στοιχεία" />}
                      <span className="settings-store-name">{store.name}</span>
                      {cs && cs.level === 'expired' && <span className="contract-badge expired" title={`Έληξε πριν ${Math.abs(cs.daysLeft)} ημέρες`}>Έληξε</span>}
                      {cs && cs.level === 'soon' && <span className="contract-badge soon" title={`Λήγει σε ${cs.daysLeft} ημέρες`}>{cs.daysLeft}η</span>}
                    </button>
                  );
                })}
                {filteredStoreRows.length === 0 && (
                  <div className="settings-store-empty">Δεν βρέθηκε κατάστημα.</div>
                )}
              </div>
              {renderStoreDetailsEditor()}
            </div>
            <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadStores}>🔄 Ανανέωση</button>
          </div>
          {!isViewer && (
            <div className="card">
              <div className="section-label">🗑️ Κάδος διαγραμμένων{trashItems.length > 0 ? ` (${trashItems.length})` : ''}</div>
              <div className="card-sub">Τα ολοκληρωτικά διαγραμμένα μηχανήματα αρχειοθετούνται εδώ και μπορούν να επαναφερθούν.</div>
              {loadingTrash ? (
                <div className="trash-empty">Φόρτωση...</div>
              ) : trashItems.length === 0 ? (
                <div className="trash-empty">Ο κάδος είναι άδειος.</div>
              ) : (
                <div className="trash-list">
                  {trashItems.map(t => (
                    <div key={t.batchId} className="trash-item">
                      <div className="trash-info">
                        <div className="trash-model">{t.model || t.serialNumber}</div>
                        <div className="trash-serial"><span className="sn-label">S/N:</span> {t.serialNumber}</div>
                        <div className="trash-meta">🗓️ {t.deletedAt}{t.deletedBy ? ` · 👤 ${t.deletedBy}` : ''} · {t.total} εγγραφές</div>
                      </div>
                      <div className="trash-actions">
                        <button className="trash-restore" disabled={trashBusy===t.batchId} onClick={()=>restoreTrashItem(t.batchId)}>
                          {trashBusy===t.batchId ? '...' : '↩ Επαναφορά'}
                        </button>
                        <button className="trash-purge" disabled={trashBusy===t.batchId} onClick={()=>purgeTrashItem(t.batchId)}>
                          Οριστική
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-ghost" style={{marginTop:'12px'}} onClick={loadTrash}>🔄 Ανανέωση</button>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <Head>
        <title>TrackMate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#080810" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TrackMate" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/favicon-v2.png" />
        <link rel="apple-touch-icon" href="/icon-192-v2.png" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className={`desktop-layout${darkMode?'':' light'}`}>
        <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sb-logo" onClick={()=>handleTabClick('home')} style={{cursor:'pointer'}}>
            <div className="sb-logo-mark">
              <div className="sb-logo-icon">
                <img src="/icon-192-v2.png" alt="" />
              </div>
              <span className="sb-logo-text sb-label">Track<span>Mate</span></span>
            </div>
          </div>
          <nav className="sb-nav">
            <div className="sb-section">Κύριο μενού</div>
            <button className={`sb-item ${tab==='home'?'active':''}`} onClick={()=>handleTabClick('home')} data-tip="Αρχική" aria-label="Αρχική">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span>
              <span className="sb-label">Αρχική</span>
            </button>
            {!isViewer && <button className={`sb-item ${tab==='scan'?'active':''}`} onClick={()=>handleTabClick('scan')} data-tip="Scan" aria-label="Scan">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2m10-16h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M12 12h.01"/></svg></span>
              <span className="sb-label">Scan</span>
            </button>}
            <button className={`sb-item ${tab==='inventory'?'active':''}`} onClick={()=>handleTabClick('inventory')} data-tip="Κινήσεις" aria-label="Κινήσεις">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span>
              <span className="sb-label">Κινήσεις</span>
            </button>
            <button className={`sb-item ${tab==='warehouse'?'active':''}`} onClick={()=>handleTabClick('warehouse')} data-tip="Αποθήκη" aria-label="Αποθήκη">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></span>
              <span className="sb-label">Αποθήκη</span>
            </button>
            <button className={`sb-item ${tab==='history'?'active':''}`} onClick={()=>handleTabClick('history')} data-tip="Ιστορικό" aria-label="Ιστορικό">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></span>
              <span className="sb-label">Ιστορικό</span>
            </button>
            <button className={`sb-item ${tab==='tickets'?'active':''}`} onClick={()=>handleTabClick('tickets')} data-tip="Tickets" aria-label="Tickets">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg></span>
              <span className="sb-label">Tickets</span>
              {openTicketsCount > 0 && <span className="sb-badge">{openTicketsCount}</span>}
            </button>
            <div className="sb-section" style={{marginTop:'12px'}}>Διαχείριση</div>
            <button className={`sb-item ${tab==='settings'?'active':''}`} onClick={()=>handleTabClick('settings')} data-tip="Ρυθμίσεις" aria-label="Ρυθμίσεις">
              <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></span>
              <span className="sb-label">Ρυθμίσεις</span>
            </button>
          </nav>
          <button className="sb-toggle" onClick={toggleSidebar} data-tip={sidebarCollapsed ? 'Άνοιγμα μενού' : 'Σύμπτυξη μενού'} aria-label={sidebarCollapsed ? 'Άνοιγμα μενού' : 'Σύμπτυξη μενού'} aria-expanded={!sidebarCollapsed}>
            <span className="sb-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M15.5 10l-2 2 2 2"/></svg></span>
            <span className="sb-label">Σύμπτυξη</span>
          </button>
          {currentUser && (
            <div className="sb-footer">
              <div className="sb-avatar">{currentUser.fullName.slice(0,2).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()}</div>
              <div className="sb-username">{currentUser.fullName}</div>
              <button className="sb-dark-btn" onClick={toggleDarkMode} title={darkMode?'Light mode':'Dark mode'}>
                {darkMode
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'15px',height:'15px'}}><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'15px',height:'15px'}}><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                }
              </button>
              <button className="sb-logout" onClick={handleLogout} title="Αποσύνδεση">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'15px',height:'15px'}}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              </button>
            </div>
          )}
        </aside>
        <div className="desktop-main">
          <div className="desktop-header">
            <div className="desktop-title">
              {tab==='home'?'Αρχική':tab==='scan'?'Scan':tab==='inventory'?'Κινήσεις':tab==='warehouse'?'Αποθήκη':tab==='history'?'Ιστορικό':tab==='tickets'?'Tickets':'Ρυθμίσεις'}
            </div>
            {(tab==='inventory' || tab==='warehouse') && (
              <div className="desktop-header-actions">
                {tab==='inventory' && ['Όλα','Επισκευή'].map(f => (
                  <button key={f} className={`filter-pill ${filterAction===(f==='Επισκευή'?'Εισαγωγή για επισκευή':f)?'active':''}`}
                    onClick={()=>setFilterAction(f==='Επισκευή'?'Εισαγωγή για επισκευή':'Όλα')}>
                    {f}
                  </button>
                ))}
                {!isViewer && <button className="btn-new" onClick={()=>handleTabClick('scan')}>+ Νέα καταχώρηση</button>}
              </div>
            )}
          </div>
          <div className="desktop-content">
            {tabContent}
          </div>
        </div>
      </div>

      {/* ─── MOBILE LAYOUT ─── */}
      <div className={`mobile-layout${darkMode?'':' light'}`}>
        <header className="mob-header">
          <div className="mob-header-top">
            <div className="mob-logo" onClick={()=>handleTabClick('home')} style={{cursor:'pointer'}}>
              <div className="mob-logo-icon">
                <img src="/icon-192-v2.png" alt="" />
              </div>
              <span>Track<span>Mate</span></span>
            </div>
            {currentUser && (
              <div className="user-area">
                <button className="mob-dark-btn" onClick={toggleDarkMode}>
                  {darkMode
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'16px',height:'16px'}}><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'16px',height:'16px'}}><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                  }
                </button>
                <span className="user-name">{currentUser.fullName}</span>
                <button className="btn-logout" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:'14px',height:'14px'}}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
              </div>
            )}
          </div>
          <nav className="mob-nav">
            <button className={`mob-nav-btn ${tab==='home'?'active':''}`} onClick={()=>handleTabClick('home')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
              <span>Αρχική</span>
            </button>
            {!isViewer && <button className={`mob-nav-btn ${tab==='scan'?'active':''}`} onClick={()=>handleTabClick('scan')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2m10-16h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M12 12h.01"/></svg>
              <span>Scan</span>
            </button>}
            <button className={`mob-nav-btn ${tab==='inventory'?'active':''}`} onClick={()=>handleTabClick('inventory')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              <span>Κινήσεις</span>
            </button>
            <button className={`mob-nav-btn ${tab==='warehouse'?'active':''}`} onClick={()=>handleTabClick('warehouse')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              <span>Αποθήκη</span>
            </button>
            <button className={`mob-nav-btn ${tab==='history'?'active':''}`} onClick={()=>handleTabClick('history')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>Ιστορικό</span>
            </button>
            <button className={`mob-nav-btn ${tab==='tickets'?'active':''}`} onClick={()=>handleTabClick('tickets')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
              <span>Tickets</span>
            </button>
            <button className={`mob-nav-btn ${tab==='settings'?'active':''}`} onClick={()=>handleTabClick('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>Ρυθμίσεις</span>
            </button>
          </nav>
        </header>
        <main
          className="mob-main"
          ref={mobMainRef}
          onTouchStart={handlePullTouchStart}
          onTouchMove={handlePullTouchMove}
          onTouchEnd={handlePullTouchEnd}
        >
          <div className="pull-indicator" style={{height: pullRefreshing ? 44 : pullDistance * 0.5, overflow:'hidden'}}>
            <div className="pull-inner">
              {pullRefreshing
                ? <span className="pull-spinner" />
                : <span className="pull-arrow" style={{opacity: pullDistance > 15 ? 1 : 0, transform:`rotate(${pullDistance > 60 ? 180 : pullDistance * 2.5}deg)`}}>↓</span>
              }
            </div>
          </div>
          {tabContent}
        </main>
      </div>

      {mobileSheet && (() => {
        const sheetAction = normalizeAction(mobileSheet.action);
        const isRepair = sheetAction === 'Εισαγωγή για επισκευή';
        const isAvailable = sheetAction === 'Καινούριο Μηχάνημα';
        const close = () => setMobileSheet(null);
        return (
          <div className="mob-sheet-backdrop" onClick={close}>
            <div className="mob-sheet" onClick={e=>e.stopPropagation()}>
              <div className="mob-sheet-handle" />
              <div className="mob-sheet-title">{mobileSheet.model || 'Χωρίς κωδικό'}</div>
              <div className="mob-sheet-sub">{mobileSheet.serialNumber}</div>
              <div className="mob-sheet-actions">
                {!isViewer && <button className="mob-sheet-btn" onClick={()=>{close();startNewAction(mobileSheet.serialNumber,mobileSheet.model);}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Νέα κίνηση
                </button>}
                {!isViewer && isAvailable && (
                  <button className="mob-sheet-btn" onClick={()=>{close();handleMoveToRepair(mobileSheet);}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                    Σε επισκευή
                  </button>
                )}
                {!isViewer && isRepair && (
                  <button className="mob-sheet-btn success" onClick={()=>{close();handleMarkRepaired(mobileSheet);}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Επισκευάστηκε
                  </button>
                )}
                {!isViewer && supportsSpareParts(mobileSheet) && (
                  <button className="mob-sheet-btn" onClick={()=>{close();openPartModal(mobileSheet);}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                    Ανταλλακτικό
                  </button>
                )}
                <button className="mob-sheet-btn" onClick={()=>{close();openLogLinkModal(mobileSheet);}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  {getLinkActionLabel(mobileSheet)}
                </button>
                {!isViewer && <button className="mob-sheet-btn danger" onClick={()=>{close();handleDeleteItem(mobileSheet);}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Διαγραφή
                </button>}
              </div>
            </div>
          </div>
        );
      })()}

      {deleteConfirmItem && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmItem(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-title">Διαγραφή μηχανήματος</div>
            <div className="delete-modal-sub">
              <strong>{deleteConfirmItem.model || deleteConfirmItem.serialNumber}</strong>
              {deleteConfirmItem.model && <span> · {deleteConfirmItem.serialNumber}</span>}
            </div>
            <div className="delete-modal-options">
              <button className="delete-opt-btn" onClick={() => confirmDelete(false)}>
                <div className="delete-opt-icon">🗂️</div>
                <div>
                  <div className="delete-opt-label">Διαγραφή από αποθήκη</div>
                  <div className="delete-opt-desc">Το ιστορικό κινήσεων παραμένει</div>
                </div>
              </button>
              <button className="delete-opt-btn danger" onClick={() => confirmDelete(true)}>
                <div className="delete-opt-icon">🗑️</div>
                <div>
                  <div className="delete-opt-label">Ολοκληρωτική διαγραφή</div>
                  <div className="delete-opt-desc">Ιστορικό, σημειώσεις & ανταλλακτικά → Κάδος (επαναφέρσιμο)</div>
                </div>
              </button>
            </div>
            <button className="delete-opt-cancel" onClick={() => setDeleteConfirmItem(null)}>Ακύρωση</button>
          </div>
        </div>
      )}

      {ticketDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setTicketDeleteConfirm(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-title">Διαγραφή ticket</div>
            <div className="delete-modal-sub">
              <strong>{ticketDeleteConfirm.ticketId}</strong>
              {ticketDeleteConfirm.store && <span> · {ticketDeleteConfirm.store}</span>}
            </div>
            <div className="delete-modal-sub">Το ticket θα διαγραφεί οριστικά από το TrackMate και το Sheet. Δεν γίνεται επαναφορά.</div>
            <div className="delete-modal-options">
              <button className="delete-opt-btn danger" onClick={confirmDeleteTicket} disabled={savingTicketId===ticketDeleteConfirm.ticketId}>
                <div className="delete-opt-icon">🗑️</div>
                <div>
                  <div className="delete-opt-label">{savingTicketId===ticketDeleteConfirm.ticketId ? 'Διαγραφή...' : 'Οριστική διαγραφή'}</div>
                </div>
              </button>
            </div>
            <button className="delete-opt-cancel" onClick={() => setTicketDeleteConfirm(null)}>Ακύρωση</button>
          </div>
        </div>
      )}

      {partModalItem && (
        <div className="modal-backdrop" onClick={closePartModal}>
          <div className="part-modal" onClick={e=>e.stopPropagation()}>
            <div className="part-modal-head">
              <div>
                <div className="part-modal-title">Προσθήκη ανταλλακτικού</div>
                <div className="part-modal-sub">{partModalItem.model || 'Χωρίς κωδικό'} · {partModalItem.serialNumber}</div>
              </div>
              <button className="modal-close" onClick={closePartModal}>×</button>
            </div>
            <div className="part-search-wrap">
              <span className="part-search-icon">🔍</span>
              <input
                className="text-input part-search-input"
                value={partSearch}
                onChange={e=>setPartSearch(e.target.value)}
                placeholder="Γράψε κωδικό ή περιγραφή για αναζήτηση..."
                autoFocus
              />
            </div>
            <div className="part-picker-hint">
              {filteredParts.length} διαθέσιμα ανταλλακτικά για {getMachineCategory(partModalItem)}
            </div>
            <div className="part-picker-list">
              <button
                className={`part-picker-item manual-part-option ${manualPartEntry ? 'active' : ''}`}
                onClick={() => {
                  setManualPartEntry(true);
                  setSelectedPart(null);
                  setManualPartCode(partSearch.trim());
                }}
              >
                <span className="part-picker-code">+ Νέο ανταλλακτικό</span>
                <span className="part-picker-desc">Δεν υπάρχει στη λίστα; γράψε κωδικό και περιγραφή.</span>
              </button>
              {manualPartEntry && (
                <div className="manual-part-fields">
                  <input
                    className="text-input"
                    value={manualPartCode}
                    onChange={e=>setManualPartCode(e.target.value)}
                    placeholder="Κωδικός ανταλλακτικού *"
                  />
                  <textarea
                    value={manualPartDescription}
                    onChange={e=>setManualPartDescription(e.target.value)}
                    placeholder="Περιγραφή ανταλλακτικού"
                  />
                </div>
              )}
              {filteredParts.map(part => (
                <button
                  key={`${part.code}-${part.description}`}
                  className={`part-picker-item ${selectedPart?.code === part.code ? 'active' : ''}`}
                  onClick={() => {
                    setManualPartEntry(false);
                    setManualPartCode('');
                    setManualPartDescription('');
                    setSelectedPart(part);
                  }}
                >
                  <span className="part-picker-code">{part.code}</span>
                  <span className="part-picker-desc">{part.description || 'Χωρίς περιγραφή'}</span>
                </button>
              ))}
              {filteredParts.length === 0 && (
                <div className="part-empty">Δεν βρέθηκε ανταλλακτικό για {getMachineCategory(partModalItem)}. Βάλε τους κωδικούς στο tab Parts με στήλες code, description και category.</div>
              )}
            </div>
            {(manualPartEntry || selectedPart) && (
              <div className="part-serial-field">
                <label className="field-label">Serial ανταλλακτικού <span>(αν υπάρχει)</span></label>
                <input
                  className="text-input"
                  value={partSerialInput}
                  onChange={e=>setPartSerialInput(e.target.value)}
                  placeholder="π.χ. 000057504700100572"
                />
              </div>
            )}
            <div className="part-modal-actions">
              <button className="btn-note-cancel" onClick={closePartModal}>Άκυρο</button>
              <button className="btn-search" onClick={handleSavePart} disabled={savingPart || (manualPartEntry ? !manualPartCode.trim() : !selectedPart)}>
                {savingPart ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {logLinkModalItem && (
        <div className="modal-backdrop" onClick={closeLogLinkModal}>
          <div className="part-modal" onClick={e=>e.stopPropagation()}>
            <div className="part-modal-head">
              <div>
                <div className="part-modal-title">{getLinkActionLabel(logLinkModalItem)}</div>
                <div className="part-modal-sub">{logLinkModalItem.model || 'Χωρίς κωδικό'} · {logLinkModalItem.serialNumber}</div>
              </div>
              <button className="modal-close" onClick={closeLogLinkModal}>×</button>
            </div>
            <input
              className="text-input"
              value={logLinkInput}
              onChange={e=>setLogLinkInput(e.target.value)}
              placeholder="https://..."
              autoFocus
            />
            <div className="part-picker-hint">Βάλε εδώ το link από το {getLinkLabel(logLinkModalItem).toLowerCase()} του συγκεκριμένου μηχανήματος</div>
            <div className="part-modal-actions">
              <button className="btn-note-cancel" onClick={closeLogLinkModal}>Άκυρο</button>
              <button className="btn-search" onClick={handleSaveLogLink} disabled={!logLinkInput.trim() || savingLogLink}>
                {savingLogLink ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #080810;
          --bg2:      #0d0d18;
          --bg3:      #12121f;
          --bg4:      #181828;
          --glass:    rgba(255,255,255,0.04);
          --glass2:   rgba(255,255,255,0.07);
          --border:   rgba(167,139,250,0.12);
          --border2:  rgba(167,139,250,0.25);
          --border3:  rgba(167,139,250,0.4);
          --acc:      #a78bfa;
          --acc2:     #7c3aed;
          --glow:     rgba(167,139,250,0.2);
          --glow2:    rgba(167,139,250,0.06);
          --t1:       #f5f3ff;
          --t2:       #d7d9f4;
          --t3:       #a8add2;
          --t4:       #7d84ad;
          --green:    #34d399;
          --gbg:      rgba(52,211,153,0.08);
          --gg:       rgba(52,211,153,0.25);
          --glow-g:   rgba(52,211,153,0.15);
          --orange:   #fb923c;
          --obg:      rgba(251,146,60,0.08);
          --og:       rgba(251,146,60,0.25);
          --glow-o:   rgba(251,146,60,0.15);
          --red:      #f87171;
          --rbg:      rgba(248,113,113,0.08);
          --rg:       rgba(248,113,113,0.25);
          --blue:     #60a5fa;
          --bbg:      rgba(96,165,250,0.08);
          --bg-l:     rgba(96,165,250,0.25);
          --font:     'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --mono:     'JetBrains Mono', monospace;
          --r:        10px;
          --r-sm:     6px;
          --r-lg:     14px;
          --topbar-h: 64px;
          /* Χρώματα γραφημάτων (ελεγμένα: φωτεινότητα, αχρωματοψία, αντίθεση) */
          --c-avail:   #3b82f6;
          --c-repair:  #ea580c;
          --c-store:   #059669;
          --c-central: #8b5cf6;
        }

        html { font-size: 14px; }
        body {
          font-family: var(--font);
          background: var(--bg);
          color: var(--t1);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
          background-image:
            radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(52,211,153,0.04) 0%, transparent 50%);
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(167,139,250,0.5) rgba(255,255,255,0.04);
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 999px; }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(167,139,250,0.78), rgba(96,165,250,0.55));
          border: 2px solid rgba(8,8,16,0.8);
          border-radius: 999px;
        }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, var(--acc), var(--blue)); }

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

        /* ══════════════════════════
           SIDEBAR
        ══════════════════════════ */
        .sidebar {
          width: 220px; flex-shrink: 0;
          background: rgba(8,8,16,0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          position: relative;
        }
        .sidebar::after {
          content: ''; position: absolute;
          top: 0; right: 0; width: 1px; height: 100%;
          background: linear-gradient(to bottom, transparent, var(--acc), transparent);
          opacity: 0.2; pointer-events: none;
        }

        /* Logo */
        .sb-logo { height: var(--topbar-h); box-sizing: border-box; padding: 0 14px; display: flex; align-items: center; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .sb-logo-mark { display: flex; align-items: center; gap: 12px; }
        .sb-logo-icon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: var(--bg3);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 18px var(--glow);
          overflow: hidden;
        }
        .sb-logo-icon svg { width: 17px; height: 17px; }
        .sb-logo-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sb-logo-text { font-size: 16px; font-weight: 700; letter-spacing: -0.5px; color: var(--t1); }
        .sb-logo-text span { color: var(--acc); text-shadow: 0 0 20px var(--glow); }

        /* Nav */
        .sb-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
        .sb-section {
          font-size: 9px; font-weight: 700; color: var(--t4);
          padding: 12px 12px 5px; letter-spacing: 0.15em; text-transform: uppercase;
        }
        .sb-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 9px 12px;
          border-radius: var(--r-sm); border: 1px solid transparent;
          background: transparent; font-size: 12px; font-weight: 500;
          font-family: var(--font); color: var(--t3);
          cursor: pointer; transition: all 0.2s ease;
          margin-bottom: 2px; text-align: left;
        }
        .sb-item:hover { background: var(--glass2); color: var(--t2); border-color: var(--border); }
        .sb-item.active {
          background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(124,58,237,0.07));
          color: var(--t1); font-weight: 600; border-color: var(--border2);
          box-shadow: 0 0 20px rgba(167,139,250,0.08), inset 0 0 20px rgba(167,139,250,0.04);
        }
        .sb-icon {
          width: 20px; height: 20px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.35; transition: all 0.2s;
        }
        .sb-icon svg { width: 20px; height: 20px; }
        .sb-item:hover .sb-icon { opacity: 0.65; }
        .sb-item.active .sb-icon {
          opacity: 1;
          filter: drop-shadow(0 0 5px var(--acc));
        }
        .sb-item.active .sb-icon svg { stroke: var(--acc); }

        /* Footer */
        .sb-footer {
          padding: 14px 12px;
          border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 8px;
        }
        .sb-avatar {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--acc), #4f46e5);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          box-shadow: 0 0 14px var(--glow); font-family: var(--font);
        }
        .sb-username { flex: 1; font-size: 11px; font-weight: 500; color: var(--t3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-dark-btn {
          background: none; border: none; cursor: pointer;
          color: var(--t4); padding: 3px; transition: color 0.15s; border-radius: 4px;
          display: flex; align-items: center;
        }
        .sb-dark-btn:hover { color: var(--acc); }
        .sb-logout {
          background: none; border: none; cursor: pointer;
          color: var(--t4); padding: 3px; transition: color 0.15s; border-radius: 4px;
          display: flex; align-items: center;
        }
        .sb-logout:hover { color: var(--red); }


        /* Σύμπτυξη μενού */
        /* z-index: το μενού (και τα tooltips του) πάντα πάνω από το περιεχόμενο της σελίδας */
        .sidebar { transition: width .2s ease; z-index: 40; }
        .sb-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-item { position: relative; }
        .sb-badge { margin-left: auto; min-width: 20px; padding: 1px 7px; border-radius: 999px; background: var(--obg); color: var(--orange); border: 1px solid var(--og); font-size: 10px; font-weight: 700; text-align: center; }
        .sb-toggle { display: flex; align-items: center; gap: 10px; margin: 0 8px 8px; padding: 9px 12px; border: 1px solid transparent; border-radius: var(--r-sm); background: transparent; color: var(--t4); font: 500 12px var(--font); cursor: pointer; position: relative; text-align: left; }
        .sb-toggle:hover { background: var(--glass2); color: var(--t2); border-color: var(--border); }
        .sb-toggle .sb-icon { opacity: .7; }
        .sidebar.collapsed { width: 68px; }
        .sidebar.collapsed .sb-label,
        .sidebar.collapsed .sb-section,
        .sidebar.collapsed .sb-username { display: none; }
        .sidebar.collapsed .sb-logo { padding: 0; justify-content: center; }
        .sidebar.collapsed .sb-nav { padding: 12px 10px; overflow: visible; }
        .sidebar.collapsed .sb-item,
        .sidebar.collapsed .sb-toggle { justify-content: center; padding: 10px 0; }
        .sidebar.collapsed .sb-toggle { margin: 0 10px 8px; }
        .sidebar.collapsed .sb-toggle svg { transform: scaleX(-1); }
        .sidebar.collapsed .sb-badge { position: absolute; top: 4px; right: 8px; min-width: 0; width: 8px; height: 8px; padding: 0; font-size: 0; border: none; background: var(--orange); }
        .sidebar.collapsed .sb-footer { flex-direction: column; padding: 12px 0; gap: 10px; }
        .sidebar.collapsed .sb-item:hover::after,
        .sidebar.collapsed .sb-toggle:hover::after,
        .sidebar.collapsed .sb-item:focus-visible::after {
          content: attr(data-tip); position: absolute; left: calc(100% + 12px); top: 50%; transform: translateY(-50%);
          padding: 6px 10px; border-radius: 7px; background: var(--bg2); color: var(--t1);
          border: 1px solid var(--border2); font-size: 12px; font-weight: 600; white-space: nowrap;
          box-shadow: 0 8px 20px rgba(0,0,0,.3); z-index: 50; pointer-events: none;
        }
        /* ══════════════════════════
           DESKTOP MAIN
        ══════════════════════════ */
        .desktop-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
        .desktop-header {
          /* Ίδιο ύψος με το logo του μενού, ώστε οι δύο γραμμές να ενώνονται */
          height: var(--topbar-h); box-sizing: border-box; flex-shrink: 0;
          padding: 0 24px;
          background: rgba(8,8,16,0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .desktop-title { font-size: 16px; font-weight: 700; color: var(--t1); letter-spacing: -0.4px; }
        .desktop-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .desktop-content { flex: 1; overflow-y: auto; padding: 20px 24px; }

        /* ══════════════════════════
           BUTTONS
        ══════════════════════════ */
        .btn-new {
          padding: 8px 16px;
          background: linear-gradient(135deg, var(--acc), var(--acc2));
          color: #fff; border: none; border-radius: var(--r-sm);
          font-size: 12px; font-family: var(--font); cursor: pointer;
          font-weight: 700; transition: all 0.2s;
          box-shadow: 0 0 20px var(--glow), 0 4px 12px rgba(124,58,237,0.3);
          letter-spacing: 0.02em;
        }
        .btn-new:hover { transform: translateY(-2px); box-shadow: 0 0 30px var(--glow), 0 8px 20px rgba(124,58,237,0.4); opacity: 0.92; }
        .btn-primary {
          width: 100%; padding: 12px;
          background: linear-gradient(135deg, var(--acc), var(--acc2));
          color: #fff; border: none; border-radius: var(--r);
          font-size: 13px; font-weight: 700; font-family: var(--font);
          cursor: pointer; margin-top: 10px; transition: all 0.2s; display: block;
          box-shadow: 0 0 20px var(--glow), 0 4px 16px rgba(124,58,237,0.3);
          letter-spacing: 0.02em;
        }
        .btn-primary:hover { transform: translateY(-2px); opacity: 0.9; box-shadow: 0 0 30px var(--glow), 0 8px 20px rgba(124,58,237,0.4); }
        .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-ghost {
          width: 100%; padding: 10px;
          background: var(--glass2); color: var(--t3);
          border: 1px solid var(--border2);
          border-radius: var(--r); font-size: 12px;
          font-family: var(--font); cursor: pointer;
          margin-top: 8px; display: block; transition: all 0.2s;
        }
        .btn-ghost:hover { border-color: var(--acc); color: var(--acc); background: var(--glow2); }
        .btn-search {
          padding: 10px 16px;
          background: linear-gradient(135deg, var(--acc), var(--acc2));
          color: #fff; border: none; border-radius: var(--r);
          font-size: 12px; font-family: var(--font); cursor: pointer;
          white-space: nowrap; transition: all 0.2s; font-weight: 700;
          box-shadow: 0 0 16px var(--glow);
        }
        .btn-search:hover { transform: translateY(-1px); opacity: 0.9; }
        .btn-export {
          width: 100%; padding: 11px;
          background: var(--glass2); color: var(--t2);
          border: 1px solid var(--border2);
          border-radius: var(--r); font-size: 13px; font-weight: 600;
          font-family: var(--font); cursor: pointer; margin-top: 12px;
          transition: all 0.2s; display: block;
        }
        .btn-export:hover { border-color: var(--acc); color: var(--acc); background: var(--glow2); }
        .btn-repaired {
          padding: 5px 10px; background: var(--gbg); color: var(--green);
          border: 1px solid var(--gg); border-radius: var(--r-sm);
          font-size: 10px; font-family: var(--font); cursor: pointer;
          font-weight: 700; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-repaired:hover { background: rgba(52,211,153,0.15); box-shadow: 0 0 10px var(--glow-g); }
        .btn-quick-action {
          padding: 5px 11px; background: var(--glass2); color: var(--t2);
          border: 1px solid var(--border2); border-radius: var(--r-sm);
          font-size: 10px; font-family: var(--font); cursor: pointer;
          font-weight: 600; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-quick-action:hover { border-color: var(--acc); color: var(--acc); background: var(--glow2); }
        .btn-delete {
          padding: 5px 10px; background: var(--rbg); color: var(--red);
          border: 1px solid var(--rg); border-radius: var(--r-sm);
          font-size: 10px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; flex-shrink: 0; font-family: var(--font);
        }
        .btn-delete:hover { background: rgba(248,113,113,0.15); box-shadow: 0 0 10px rgba(248,113,113,0.2); }
        .item-actions {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .action-menu-btn {
          width: 30px; height: 30px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--glass2); color: var(--t2);
          border: 1px solid var(--border2); border-radius: var(--r-sm);
          font-size: 20px; line-height: 1; font-family: var(--font);
          cursor: pointer; transition: all 0.2s;
        }
        .action-menu-btn:hover {
          border-color: var(--acc);
          color: var(--acc);
          background: var(--glow2);
        }
        .action-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          z-index: 30;
          min-width: 168px;
          padding: 6px;
          background: rgba(16,16,28,0.98);
          border: 1px solid var(--border2);
          border-radius: var(--r);
          box-shadow: 0 16px 36px rgba(0,0,0,0.38);
        }
        .action-menu-item {
          width: 100%;
          display: flex; align-items: center;
          padding: 8px 10px;
          background: transparent;
          border: 0;
          border-radius: var(--r-sm);
          color: var(--t2);
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
        }
        .action-menu-item:hover {
          background: var(--glow2);
          color: var(--acc);
        }
        .action-menu-item.success { color: var(--green); }
        .action-menu-item.danger { color: var(--red); }
        .mobile-actions-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .btn-half {
          padding: 9px; background: var(--glass2); color: var(--t2);
          border: 1px solid var(--border2); border-radius: var(--r);
          font-size: 12px; font-family: var(--font); cursor: pointer; transition: all 0.2s;
        }
        .btn-half:hover { border-color: var(--acc); color: var(--acc); }
        .category-tabs, .warehouse-category-tabs {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .warehouse-category-tabs { margin-bottom: 12px; }
        .dashboard-category-tabs { margin-top: -4px; margin-bottom: 16px; }
        .category-tab, .warehouse-category-tab {
          min-height: 34px;
          padding: 7px 12px;
          border: 1px solid var(--border2);
          border-radius: var(--r);
          background: var(--glass2);
          color: var(--t3);
          font-family: var(--font);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
        }
        .category-tab:hover, .warehouse-category-tab:hover {
          border-color: var(--acc);
          color: var(--acc);
          background: var(--glow2);
        }
        .category-tab.active, .warehouse-category-tab.active {
          border-color: var(--acc);
          color: var(--acc);
          background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(124,58,237,0.07));
          box-shadow: 0 0 12px var(--glow2);
        }
        .btn-note-cancel {
          padding: 5px 10px; border: 1px solid var(--border2);
          border-radius: var(--r-sm); background: var(--glass2);
          font-size: 10px; cursor: pointer; color: var(--t3); font-family: var(--font);
        }
        .btn-clear {
          padding: 7px 11px; border: 1px solid var(--border2);
          border-radius: var(--r); background: var(--glass2);
          color: var(--t3); cursor: pointer; font-size: 12px; flex-shrink: 0; transition: all 0.2s;
        }
        .btn-clear:hover { border-color: var(--red); color: var(--red); }

        /* ══════════════════════════
           STATS
        ══════════════════════════ */
        .inv-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
        .stat-card {
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 14px 16px;
          transition: all 0.25s ease; position: relative; overflow: hidden; cursor: default;
        }
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--acc), transparent);
          opacity: 0.5;
        }
        .stat-card:hover { border-color: var(--border2); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--border); }
        .stat-card-btn { width: 100%; text-align: left; font-family: var(--font); color: inherit; cursor: pointer; }
        .stat-card-btn.active { border-color: var(--acc); background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(124,58,237,0.07)); box-shadow: 0 0 22px var(--glow), inset 0 0 18px rgba(167,139,250,0.04); }
        .stat-card-btn.active::before { opacity: 1; }
        .stat-label { font-size: 9px; color: var(--t3); margin-bottom: 6px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
        .stat-val { font-size: 28px; font-weight: 800; line-height: 1; color: var(--t1); }
        .stat-sub { font-size: 10px; color: var(--t3); margin-top: 4px; font-weight: 600; }

        .dashboard { display: flex; flex-direction: column; gap: 14px; }
        .dashboard-greeting {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 14px 18px;
          border: 1px solid var(--border2);
          border-radius: var(--r-lg);
          background: linear-gradient(135deg, var(--glass2), rgba(167,139,250,0.06));
          box-shadow: 0 0 26px var(--glow2);
        }
        .dashboard-kicker { color: var(--acc); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
        .greeting-name { color: var(--t1); font-size: 20px; font-weight: 800; margin-top: 3px; }
        .quick-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .quick-action-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          border: 1px solid var(--border2); border-radius: var(--r);
          background: var(--glass2); color: var(--t2);
          font-family: var(--font); font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.16s; white-space: nowrap;
        }
        .quick-action-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
        .quick-action-btn:hover { border-color: var(--acc); color: var(--t1); background: var(--glass); }
        .dashboard-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .dash-stat {
          min-height: 116px;
          display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--glass);
          color: inherit;
          font-family: var(--font);
          text-align: left;
          cursor: pointer;
          transition: all 0.16s;
        }
        .dash-stat:hover { border-color: var(--border2); transform: translateY(-2px); background: var(--glass2); }
        .dash-stat span { color: var(--t3); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
        .dash-stat strong { color: var(--t1); font-size: 34px; line-height: 1; font-weight: 800; }
        .dash-stat small { color: var(--t3); font-size: 11px; font-weight: 600; }
        .dash-stat.warn strong { color: var(--orange); }
        .dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr); gap: 12px; }
        .dashboard-panel { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--glass); padding: 14px; }
        .dashboard-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .panel-title { color: var(--t1); font-size: 14px; font-weight: 800; }
        .panel-sub { color: var(--t3); font-size: 11px; font-weight: 600; margin-top: 2px; }
        .movement-breakdown { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .movement-breakdown-item, .attention-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 11px;
          border: 1px solid var(--border);
          border-radius: var(--r);
          background: var(--glass2);
        }
        .movement-breakdown-item span, .attention-row span { color: var(--t2); font-size: 12px; font-weight: 700; line-height: 1.35; }
        .movement-breakdown-item strong, .attention-row strong { color: var(--t1); font-size: 18px; font-weight: 800; }
        .attention-panel { display: flex; flex-direction: column; gap: 8px; }
        .attention-panel--active { border-color: var(--orange); box-shadow: 0 0 0 1px var(--orange), 0 0 18px rgba(255,165,0,0.08); }
        .attention-panel--active .panel-title { color: var(--orange); }
        .attention-badge {
          display: inline-flex; align-items: center; justify-content: center;
          margin-left: 7px; padding: 1px 7px;
          background: var(--orange); color: #fff;
          border-radius: 20px; font-size: 10px; font-weight: 800;
        }
        .attention-row-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .attention-row-main > span { display: inline-flex; align-items: center; gap: 8px; }
        .attention-row .attention-row-sub { color: var(--t4); font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fresh-chip {
          font-style: normal; font-size: 10px; font-weight: 800; letter-spacing: .6px;
          color: #fff; background: #059669; padding: 2px 7px; border-radius: 999px;
          animation: freshPulse 1.6s ease-in-out infinite;
        }
        @keyframes freshPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(5,150,105,.55); } 50% { box-shadow: 0 0 0 6px rgba(5,150,105,0); } }
        .attention-row.is-fresh { border-color: #059669; background: rgba(5,150,105,0.10); }
        .attention-row.is-fresh .attention-row-sub { color: var(--t2); }
        @media (prefers-reduced-motion: reduce) { .fresh-chip { animation: none; } }
        .attention-row { width: 100%; color: inherit; font-family: var(--font); cursor: pointer; text-align: left; }
        .attention-row:hover { border-color: var(--orange); background: var(--obg); }
        .recent-list { display: flex; flex-direction: column; gap: 7px; }
        .recent-row {
          display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px;
          padding: 10px 11px;
          border: 1px solid var(--border);
          border-radius: var(--r);
          background: var(--glass2);
          text-decoration: none;
        }
        .recent-row:hover { border-color: var(--border2); }
        .recent-dot { width: 9px; height: 9px; border-radius: 50%; }
        .recent-row strong { display: block; color: var(--t1); font-size: 12px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .recent-row small { display: block; color: var(--t3); font-size: 10px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .recent-row em { color: var(--t3); font-size: 11px; font-style: normal; font-weight: 600; }

        /* ══════════════════════════
           TABLE
        ══════════════════════════ */
        .dt-table {
          background: var(--glass);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: var(--r-lg); overflow: visible;
        }
        .dt-head {
          display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr;
          background: rgba(8,8,16,0.6); border-bottom: 1px solid var(--border);
        }
        .dt-th { font-size: 9px; font-weight: 800; color: var(--t3); padding: 9px 14px; text-transform: uppercase; letter-spacing: 0.12em; }
        .dt-row {
          display: grid; grid-template-columns: 2fr 2fr 1.2fr 1fr 1fr;
          border-bottom: 1px solid rgba(167,139,250,0.05); cursor: pointer; transition: background 0.15s;
        }
        .row-link {
          color: inherit;
          text-decoration: none;
        }
        .dt-row:last-child { border-bottom: none; }
        .dt-row:hover { background: rgba(167,139,250,0.04); }
        .dt-td { font-size: 11px; color: var(--t2); padding: 10px 14px; display: flex; align-items: center; gap: 7px; font-weight: 500; }
        .dt-td.dt-muted { color: var(--t3); font-size: 11px; font-weight: 500; }
        .dt-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dt-model { font-size: 12px; font-weight: 600; color: var(--t1); }
        .dt-serial { font-family: var(--mono); font-size: 10px; color: var(--t2); margin-top: 2px; letter-spacing: 0.03em; font-weight: 600; }
        .sn-label { font-family: var(--sans); font-size: 9px; font-weight: 700; color: var(--t3); letter-spacing: 0.06em; text-transform: uppercase; margin-right: 1px; }
        .dt-note-row { padding: 5px 14px 8px; background: rgba(8,8,16,0.4); border-bottom: 1px solid var(--border); }

        /* ══════════════════════════
           STATUS PILLS
        ══════════════════════════ */
        .status-pill { font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; letter-spacing: 0.04em; }
        .pill-green  { background: var(--gbg);  color: var(--green);  border: 1px solid var(--gg);    box-shadow: 0 0 8px var(--glow-g); }
        .pill-amber  { background: var(--obg);  color: var(--orange); border: 1px solid var(--og);    box-shadow: 0 0 8px var(--glow-o); }
        .pill-gray   { background: var(--glass2); color: var(--t3);   border: 1px solid var(--border2); }
        .pill-blue   { background: var(--bbg);  color: var(--blue);   border: 1px solid var(--bg-l);  }
        .pill-purple { background: var(--glow2); color: var(--acc);   border: 1px solid var(--border2); box-shadow: 0 0 8px var(--glow); }

        /* ══════════════════════════
           MOBILE HEADER
        ══════════════════════════ */
        .mob-header {
          background: rgba(8,8,16,0.97);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 10;
        }
        .mob-header-top { padding: 12px 16px 10px; display: flex; align-items: center; justify-content: space-between; }
        .mob-logo {
          display: flex; align-items: center; gap: 10px;
          font-size: 16px; font-weight: 700; letter-spacing: -0.4px; cursor: pointer;
        }
        .mob-logo-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: var(--bg3);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 14px var(--glow);
          overflow: hidden;
        }
        .mob-logo-icon svg { width: 15px; height: 15px; }
        .mob-logo-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mob-logo span:first-of-type { color: var(--t1); }
        .mob-logo span:last-of-type { color: var(--acc); text-shadow: 0 0 16px var(--glow); }
        .user-area { display: flex; align-items: center; gap: 8px; }
        .user-name { font-size: 11px; color: var(--t3); font-weight: 500; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-logout {
          background: var(--glass2); border: 1px solid var(--border2);
          border-radius: var(--r-sm); padding: 5px 8px; cursor: pointer;
          color: var(--t3); transition: all 0.15s; font-family: var(--font);
          display: flex; align-items: center;
        }
        .btn-logout:hover { border-color: var(--red); color: var(--red); }
        .mob-dark-btn { background: none; border: none; cursor: pointer; color: var(--t4); padding: 3px; display: flex; align-items: center; }
        .mob-nav { display: flex; padding: 0 10px 10px; gap: 2px; overflow-x: auto; }
        .mob-nav-btn {
          flex: 1 0 58px; display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 7px 4px; border-radius: var(--r-sm); border: none;
          background: transparent; font-size: 9px; font-family: var(--font);
          cursor: pointer; color: var(--t4); transition: all 0.2s; font-weight: 700;
          letter-spacing: 0.03em;
        }
        .mob-nav-btn svg { width: 19px; height: 19px; stroke: currentColor; fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.4; transition: all 0.2s; }
        .mob-nav-btn.active {
          background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(124,58,237,0.07));
          color: var(--acc);
        }
        .mob-nav-btn.active svg { opacity: 1; filter: drop-shadow(0 0 4px var(--acc)); stroke: var(--acc); }
        .mob-nav-btn:hover svg { opacity: 0.7; }
        .mob-main { flex: 1; padding: 14px 16px; background: var(--bg); }

        /* ─── DATE INPUT ─── */
        input[type="date"].text-input { width: 100%; max-width: 100%; min-width: 0; appearance: none; -webkit-appearance: none; color-scheme: dark; }

        /* ══════════════════════════
           CARDS & INPUTS
        ══════════════════════════ */
        .card {
          background: var(--glass);
          backdrop-filter: blur(16px);
          border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 18px; margin-bottom: 12px;
          position: relative; overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent);
        }
        .card-title { font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
        .card-sub { font-size: 12px; color: var(--t3); margin-bottom: 16px; }
        .section-label { font-size: 9px; font-weight: 700; color: var(--t4); text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; }
        .field-group { margin-bottom: 12px; }
        .field-label { font-size: 10px; color: var(--t3); display: block; margin-bottom: 5px; font-weight: 600; letter-spacing: 0.03em; }
        select, textarea, .text-input {
          width: 100%; padding: 10px 12px;
          border-radius: var(--r); border: 1px solid var(--border2);
          background: rgba(255,255,255,0.04); font-size: 12px; color: var(--t1);
          font-family: var(--font); outline: none; transition: all 0.2s;
        }
        select:focus, textarea:focus, .text-input:focus {
          border-color: var(--acc); background: rgba(167,139,250,0.05);
          box-shadow: 0 0 0 3px var(--glow2), 0 0 16px var(--glow2);
        }
        select option { background: var(--bg3); }
        textarea { resize: none; height: 70px; }
        .text-input::placeholder { color: var(--t4); }

        .upload-area {
          border: 1px dashed var(--border2); border-radius: var(--r-lg);
          padding: 36px 20px; text-align: center; cursor: pointer;
          transition: all 0.25s; background: var(--glass3);
          position: relative; overflow: hidden;
        }
        .upload-area:hover { border-color: var(--acc); background: var(--glow2); box-shadow: 0 0 30px var(--glow2) inset; }
        .upload-icon { font-size: 32px; margin-bottom: 10px; display: block; }
        .upload-title { font-size: 13px; font-weight: 600; color: var(--t2); margin-bottom: 4px; }
        .upload-sub { font-size: 12px; color: var(--t4); }
        .preview-img { width: 100%; border-radius: var(--r); max-height: 240px; object-fit: contain; }

        .ai-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; background: var(--gbg); color: var(--green);
          padding: 5px 12px; border-radius: 20px; margin-bottom: 14px;
          font-weight: 700; border: 1px solid var(--gg); box-shadow: 0 0 12px var(--glow-g);
        }
        .error-banner { background: var(--rbg); border: 1px solid var(--rg); border-radius: var(--r); padding: 10px 14px; font-size: 12px; color: var(--red); margin-bottom: 14px; }
        .banner-success { background: var(--gbg); color: var(--green); padding: 10px 14px; border-radius: var(--r); font-size: 12px; margin-bottom: 14px; border: 1px solid var(--gg); }

        /* ── ACTION TILES ── */
        .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .action-tile {
          background: var(--glass2); border: 1px solid var(--border2);
          border-radius: var(--r-lg); padding: 14px;
          cursor: pointer; transition: all 0.2s;
        }
        .action-tile:hover { border-color: var(--acc); background: var(--glow2); }
        .action-tile.selected { border-color: var(--acc); background: linear-gradient(135deg, rgba(167,139,250,0.12), rgba(124,58,237,0.07)); box-shadow: 0 0 20px var(--glow); }
        .action-icon { font-size: 20px; margin-bottom: 6px; display: block; }
        .action-title { font-size: 12px; font-weight: 600; color: var(--t2); }
        .action-sub { font-size: 10px; color: var(--t4); margin-top: 3px; }
        .sub-action-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; animation: fadeIn 0.15s ease; }
        .sub-action-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid var(--border2);
          border-radius: var(--r); cursor: pointer; transition: all 0.2s; background: var(--glass2);
        }
        .sub-action-item:hover { border-color: var(--acc); background: var(--glow2); }
        .sub-action-item.selected { border-color: var(--acc); background: linear-gradient(135deg, rgba(167,139,250,0.12), rgba(124,58,237,0.07)); }
        .sub-action-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
        .sub-action-label { font-size: 12px; font-weight: 600; color: var(--t2); }
        .sub-action-desc { font-size: 10px; color: var(--t4); margin-top: 2px; }
        .selected-action-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--glow2); color: var(--acc); font-size: 11px; font-weight: 700;
          padding: 5px 12px; border-radius: 20px; margin-bottom: 6px;
          border: 1px solid var(--border2); box-shadow: 0 0 12px var(--glow);
        }

        /* ── STORE PICKER ── */
        .machine-card {
          background: var(--glass);
          border: 1px solid var(--border2);
          border-radius: var(--r-lg);
          padding: 14px;
          margin-bottom: 14px;
          box-shadow: 0 0 18px var(--glow2);
        }
        .machine-card.compact { margin-top: 10px; margin-bottom: 0; background: rgba(8,8,16,0.24); }
        .machine-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .machine-card-title { font-size: 16px; font-weight: 800; color: var(--t1); }
        .machine-card-serial { font-family: var(--mono); font-size: 11px; color: var(--t2); margin-top: 3px; font-weight: 700; }
        .machine-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin-bottom: 10px; }
        .machine-card-grid div { border: 1px solid var(--border); border-radius: var(--r); background: var(--glass2); padding: 9px 10px; min-width: 0; }
        .machine-card-grid span, .machine-card-label { display: block; font-size: 9px; color: var(--t3); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
        .machine-card-grid strong { display: block; font-size: 12px; color: var(--t1); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .machine-card-section { margin-top: 10px; }
        .machine-card-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .machine-card-note { font-size: 12px; color: var(--t2); line-height: 1.5; }
        .machine-card-note span { color: var(--t3); font-size: 10px; font-weight: 700; margin-left: 4px; }
        .machine-card-actions { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 12px; }
        @media (max-width: 767px) {
          .machine-card-grid { grid-template-columns: 1fr 1fr; }
        }
        .store-display { display: flex; align-items: center; min-height: 40px; flex: 1; }
        .store-picker { border: 1px solid var(--border2); border-radius: var(--r-lg); padding: 12px; background: var(--glass2); backdrop-filter: blur(12px); }
        .chain-tabs { display: flex; gap: 5px; overflow-x: auto; padding: 6px 0; scrollbar-width: none; }
        .chain-tabs::-webkit-scrollbar { display: none; }
        .chain-tab {
          flex-shrink: 0; padding: 4px 10px; border-radius: 20px;
          border: 1px solid var(--border2); font-size: 10px; cursor: pointer;
          background: var(--glass2); color: var(--t3); transition: all 0.15s;
          font-family: var(--font); white-space: nowrap; font-weight: 600;
        }
        .chain-tab.active { background: var(--acc); color: #fff; border-color: var(--acc); box-shadow: 0 0 12px var(--glow); }
        .store-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; margin-top: 6px; }
        .store-item { padding: 8px 10px; border-radius: var(--r-sm); font-size: 12px; cursor: pointer; color: var(--t2); transition: all 0.1s; }
        .store-item:hover { background: var(--glass2); color: var(--t1); }
        .store-item.active { background: var(--glow2); color: var(--acc); font-weight: 600; }
        .store-item-manual { width: 100%; border: 1px dashed var(--border2); background: var(--glass2); text-align: left; font-family: var(--font); }
        .store-picker-empty { padding: 12px; color: var(--t3); font-size: 12px; font-weight: 600; text-align: center; line-height: 1.5; }
        .item-picker { position: relative; }
        .item-picker-trigger { width: 100%; display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1px solid var(--border2); border-radius: var(--r); background: var(--glass2); color: var(--t1); text-align: left; cursor: pointer; font-family: var(--font); transition: all 0.15s; }
        .item-picker-trigger:hover { border-color: var(--acc); background: var(--glow2); }
        .item-picker-trigger span { font-size: 12px; font-weight: 800; }
        .item-picker-trigger small { font-size: 11px; color: var(--t3); line-height: 1.35; }
        .item-picker-menu { border: 1px solid var(--border2); border-radius: var(--r-lg); background: var(--bg3); padding: 10px; margin-top: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.35), 0 0 18px var(--glow2); }
        .item-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; margin-top: 8px; }
        .item-option { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r); background: var(--glass2); color: var(--t2); text-align: left; cursor: pointer; font-family: var(--font); transition: all 0.15s; }
        .item-option.manual { margin-bottom: 8px; border-color: var(--border2); color: var(--acc); background: var(--glow2); }
        .item-option:hover, .item-option.active { border-color: var(--acc); background: var(--glow2); color: var(--t1); }
        .item-option span { font-size: 12px; font-weight: 800; }
        .item-option small { font-size: 11px; color: var(--t3); line-height: 1.35; }
        .item-empty { padding: 10px; color: var(--t3); font-size: 12px; text-align: center; }

        /* ── FILTERS ── */
        .filter-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .filter-pill { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border2); background: var(--glass2); font-size: 10px; cursor: pointer; color: var(--t3); font-family: var(--font); transition: all 0.15s; font-weight: 600; }
        .filter-pill:hover { border-color: var(--acc); color: var(--acc); background: var(--glow2); }
        .filter-pill.active { background: var(--glow2); color: var(--acc); border-color: var(--border2); box-shadow: 0 0 10px var(--glow); }
        .period-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .period-pill { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border2); background: var(--glass2); font-size: 10px; cursor: pointer; color: var(--t3); font-family: var(--font); transition: all 0.15s; font-weight: 600; }
        .period-pill:hover { border-color: var(--acc); color: var(--acc); }
        .period-pill.active { background: var(--glow2); color: var(--acc); border-color: var(--border2); box-shadow: 0 0 10px var(--glow); }
        .sort-btn { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border2); background: var(--glass2); font-size: 10px; cursor: pointer; color: var(--t3); font-family: var(--font); transition: all 0.15s; white-space: nowrap; font-weight: 600; }
        .sort-btn:hover { border-color: var(--acc); color: var(--acc); }
        .custom-date-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .custom-date-row .field-label { margin: 0; white-space: nowrap; }

        /* ── MACHINE CARDS ── */
        .swipe-container { position: relative; margin-bottom: 8px; border-radius: var(--r-lg); overflow: hidden; }
        .swipe-actions-bg {
          position: absolute; right: 0; top: 0; bottom: 0; width: 200px;
          display: flex; border-radius: 0 var(--r-lg) var(--r-lg) 0;
          overflow: hidden;
        }
        .swipe-action-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; border: none; cursor: pointer;
          font-size: 9px; font-weight: 800; font-family: var(--font); color: #fff;
          padding: 0 2px;
        }
        .swipe-action-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
        .sa-action  { background: var(--acc); }
        .sa-repair  { background: var(--orange); }
        .sa-done    { background: #1D9E75; }
        .sa-part    { background: #4A6FA5; }
        .sa-delete  { background: var(--red); }
        .machine-row {
          background: var(--glass); backdrop-filter: blur(10px);
          border: 1px solid var(--border); border-radius: var(--r-lg);
          padding: 12px 14px; margin-bottom: 0;
          display: flex; align-items: flex-start; gap: 10px;
          cursor: pointer; transition: transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94), border-color 0.2s, background 0.2s;
          position: relative; z-index: 0;
        }
        .machine-row:hover { border-color: var(--border2); background: rgba(167,139,250,0.04); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .machine-row.menu-open { z-index: 50; }
        .machine-row.swiped { transform: translateX(-200px); border-radius: var(--r-lg) 0 0 var(--r-lg); }
        .pull-inner { height: 44px; display: flex; align-items: center; justify-content: center; }
        .pull-spinner {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid var(--border2); border-top-color: var(--acc);
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .pull-arrow { font-size: 20px; color: var(--acc); display: inline-block; transition: transform 0.15s, opacity 0.15s; }
        .machine-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .machine-info { flex: 1; min-width: 0; }
        .machine-name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
        .machine-name { font-size: 13px; font-weight: 700; color: var(--t1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .machine-serial { font-family: var(--mono); font-size: 10px; color: var(--t2); font-weight: 500; letter-spacing: 0.03em; }
        .machine-bottom { display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
        .machine-store { font-size: 11px; color: var(--t3); font-weight: 500; }
        .machine-date { font-size: 11px; color: var(--t3); font-weight: 500; }
        .date-edit-display {
          cursor: pointer;
          color: var(--t3);
          font-size: 11px;
          font-weight: 700;
        }
        .date-edit-display:hover { color: var(--acc); }
        .date-edit-picker, .mobile-date-edit {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 100%;
        }
        .date-edit-input {
          width: 128px;
          min-width: 128px;
          padding: 5px 7px;
          font-size: 12px;
        }
        .date-save-btn, .date-cancel-btn {
          width: 25px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--r-sm);
          border: 1px solid var(--border2);
          background: var(--glass2);
          color: var(--t2);
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          flex-shrink: 0;
        }
        .date-save-btn { color: var(--green); border-color: rgba(52,211,153,0.28); }
        .date-cancel-btn { color: var(--red); border-color: rgba(248,113,113,0.28); }
        .date-save-btn:hover { background: rgba(52,211,153,0.12); }
        .date-cancel-btn:hover { background: rgba(248,113,113,0.12); }
        .machine-problem { font-size: 11px; color: var(--orange); margin-top: 3px; }
        .machine-user { font-size: 11px; color: var(--green); margin-top: 2px; }
        .machine-note { font-size: 11px; color: var(--t2); margin-top: 6px; padding: 6px 8px; background: var(--glass); border-left: 2px solid var(--border2); border-radius: var(--r-sm); font-weight: 500; }

        /* ── HISTORY ── */
        .history-item { display: flex; gap: 12px; margin-bottom: 12px; }
        .h-dot-wrap { display: flex; flex-direction: column; align-items: center; }
        .h-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 2px solid var(--acc); background: var(--bg);
          flex-shrink: 0; margin-top: 4px; box-shadow: 0 0 8px var(--glow);
        }
        .h-line { width: 1px; flex: 1; background: var(--border); margin-top: 4px; min-height: 18px; }
        .h-card {
          flex: 1; background: var(--glass); backdrop-filter: blur(10px);
          border: 1px solid var(--border); border-radius: var(--r);
          padding: 10px 13px; transition: border-color 0.2s;
        }
        .h-card:hover { border-color: var(--border2); }
        .h-action-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
        .h-action { font-size: 12px; font-weight: 700; color: var(--t1); }
        .h-del-btn {
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--border2); background: var(--glass); cursor: pointer;
          padding: 4px; border-radius: 7px; color: var(--t2);
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .h-del-btn svg { width: 15px; height: 15px; display: block; }
        .h-del-btn:hover:not(:disabled) { color: #fff; background: #ef4444; border-color: #ef4444; }
        .h-del-btn:disabled { opacity: 0.45; cursor: default; }
        .light .h-del-btn { border-color: var(--border); color: var(--t2); }
        .h-meta { font-size: 10px; color: var(--t3); font-weight: 500; }
        .h-notes { font-size: 11px; color: var(--t3); margin-top: 4px; font-weight: 500; }
        .h-machine { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
        .h-machine-model { font-size: 12px; font-weight: 700; color: var(--t1); }
        .h-machine-serial { font-family: var(--mono); font-size: 11px; color: var(--t2); font-weight: 500; letter-spacing: 0.03em; }
        .history-machine-header {
          background: var(--glass); backdrop-filter: blur(16px);
          border: 1px solid var(--acc); border-radius: var(--r-lg);
          padding: 14px 16px; margin-bottom: 16px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          box-shadow: 0 0 24px var(--glow), 0 0 0 1px rgba(167,139,250,0.1);
        }
        .history-machine-info { flex: 1; min-width: 0; }
        .history-machine-model { font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 3px; }
        .history-machine-serial { font-family: var(--mono); font-size: 12px; color: var(--t2); margin-bottom: 4px; font-weight: 500; letter-spacing: 0.03em; }
        .history-machine-count { font-size: 10px; color: var(--t3); font-weight: 600; }
        .history-store-header { padding: 8px 0 12px; }
        .history-store-count { font-size: 13px; color: var(--t3); }
        .quick-action-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--glass); backdrop-filter: blur(10px);
          border: 1px solid var(--border2); border-radius: var(--r-lg);
          padding: 12px 16px; margin-bottom: 16px;
        }
        .quick-action-info { display: flex; flex-direction: column; gap: 3px; }
        .quick-serial { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--t1); }
        .quick-model { font-size: 11px; color: var(--t3); font-weight: 500; }

        /* ── SUCCESS ── */
        .success-card { text-align: center; padding: 40px 20px; }
        .success-icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .success-title { font-size: 20px; font-weight: 700; color: var(--t1); margin-bottom: 8px; }
        .success-sub { font-size: 13px; color: var(--t3); line-height: 1.8; margin-bottom: 20px; }
        .shipment-box { border: 1px solid var(--border2); border-radius: var(--r-lg); background: var(--glass); padding: 14px; margin: 16px 0 12px; }
        .shipment-destination { display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--border); border-radius: var(--r); background: var(--glass2); padding: 10px 12px; margin-bottom: 10px; }
        .shipment-destination strong { color: var(--t1); font-size: 13px; }
        .shipment-destination span { color: var(--t3); font-size: 11px; line-height: 1.5; }
        .shipment-method-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .shipment-method { padding: 9px 12px; border-radius: var(--r); border: 1px solid var(--border2); background: var(--glass2); color: var(--t3); font-family: var(--font); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .shipment-method:hover, .shipment-method.active { border-color: var(--acc); color: var(--acc); background: var(--glow2); box-shadow: 0 0 12px var(--glow2); }
        .shipment-email-card { text-align: left; border: 1px solid var(--border2); border-radius: var(--r-lg); background: var(--glass); padding: 14px; margin: 0 0 18px; }
        .shipment-email-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .shipment-email-title { font-size: 13px; font-weight: 800; color: var(--t1); }
        .shipment-email-sub { font-size: 11px; color: var(--t3); margin-top: 2px; }
        .shipment-email-preview { white-space: pre-wrap; color: var(--t2); background: rgba(0,0,0,0.16); border: 1px solid var(--border); border-radius: var(--r); padding: 12px; font-family: var(--font); font-size: 12px; line-height: 1.6; max-height: 360px; overflow: auto; }
        .shipment-table-preview + .shipment-table-preview { margin-top: 12px; }
        .shipment-table-preview { border: 1px solid var(--border2); border-radius: var(--r); overflow: hidden; background: rgba(255,255,255,0.95); color: #0f1020; max-width: 680px; }
        .shipment-table-top { display: grid; grid-template-columns: 44px 1fr 1.6fr; background: #c9c1ff; border-bottom: 1px solid #b4a9ef; font-size: 12px; font-weight: 800; }
        .shipment-table-top > div { padding: 7px 8px; border-right: 1px solid #b4a9ef; }
        .shipment-table-top > div:last-child { border-right: none; text-align: center; }
        .shipment-table-body { display: grid; grid-template-columns: 44px 160px minmax(0, 1fr); align-items: stretch; font-size: 12px; line-height: 1.45; }
        .shipment-table-index { display: flex; align-items: flex-start; justify-content: center; padding: 22px 6px; border-right: 1px solid #d9d5ff; }
        .shipment-table-labels { background: #d8d1ff; padding: 10px 8px; font-weight: 500; }
        .shipment-table-values { padding: 10px 8px; font-weight: 600; }
        .shipment-table-labels > div, .shipment-table-values > div { min-height: 21px; overflow-wrap: anywhere; }

        /* ── MISC ── */
        .repair-badge { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 20px; white-space: nowrap; margin-left: 6px; letter-spacing: 0.04em; }
        .repair-badge-warning { background: var(--obg); color: var(--orange); border: 1px solid var(--og); box-shadow: 0 0 6px var(--glow-o); }
        .repair-badge-danger  { background: var(--rbg); color: var(--red);    border: 1px solid var(--rg);  box-shadow: 0 0 6px rgba(248,113,113,0.2); }
        .existing-item-banner { background: var(--obg); border: 1px solid var(--og); border-radius: var(--r-lg); padding: 14px 16px; margin-bottom: 16px; box-shadow: 0 0 16px var(--glow-o); }
        .existing-item-title { font-size: 12px; font-weight: 700; color: var(--orange); margin-bottom: 6px; }
        .existing-item-info { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 13px; color: var(--t1); }
        .existing-item-meta { font-size: 11px; color: var(--t3); margin-bottom: 6px; }
        .existing-item-note { font-size: 10px; color: var(--orange); font-style: italic; }
        .note-display-desktop { cursor: pointer; display: inline-flex; align-items: center; }
        .note-add-btn { padding: 3px 10px; background: var(--glass2); color: var(--t3); border: 1px solid var(--border2); border-radius: var(--r-sm); font-size: 10px; cursor: pointer; font-family: var(--font); transition: all 0.15s; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
        .note-add-btn:hover { border-color: var(--acc); color: var(--acc); }
        .note-count { font-size: 10px; color: var(--acc); cursor: pointer; font-weight: 600; padding: 2px 7px; background: var(--glow2); border-radius: 20px; border: 1px solid var(--border2); white-space: nowrap; transition: all 0.15s; flex-shrink: 0; }
        .note-count:hover { background: rgba(167,139,250,0.15); }
        .note-history { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
        .part-history-list { display: flex; flex-direction: column; gap: 6px; }
        .note-history-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; background: var(--glass); border-radius: var(--r-sm); border-left: 2px solid var(--border2); }
        .note-history-text { font-size: 11px; color: var(--t2); font-weight: 500; }
        .note-history-meta { font-size: 9px; color: var(--t3); font-weight: 600; }
        .note-inline-meta { color: var(--t3); font-size: 10px; font-weight: 600; }
        .dt-part-row {
          display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
          padding: 7px 14px;
          background: rgba(96,165,250,0.05);
          border-bottom: 1px solid var(--border);
        }
        .machine-parts {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          margin-top: 7px; padding: 7px 8px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: rgba(96,165,250,0.05);
        }
        .part-label {
          font-size: 9px; font-weight: 800; color: var(--blue);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .part-chip, .part-more {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px; color: var(--t2); font-weight: 700;
          border: 1px solid rgba(96,165,250,0.25);
          background: rgba(96,165,250,0.08);
          border-radius: 999px;
          padding: 3px 8px;
          max-width: 360px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .part-remove {
          width: 16px; height: 16px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(248,113,113,0.28);
          border-radius: 50%;
          background: rgba(248,113,113,0.08);
          color: var(--red);
          font-size: 12px;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
          flex-shrink: 0;
        }
        .part-remove:hover { background: rgba(248,113,113,0.18); }
        .part-history-text {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .part-dot {
          border-color: var(--blue) !important;
          background: rgba(96,165,250,0.16);
        }
        .part-history-card {
          border-color: rgba(96,165,250,0.22);
          background: rgba(96,165,250,0.05);
        }
        .log-row { background: rgba(167,139,250,0.05); }
        .log-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          border: 1px solid var(--border2);
          border-radius: 999px;
          background: var(--glow2);
          color: var(--acc);
          padding: 4px 9px;
          font-family: var(--font);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.2;
          text-decoration: none;
          cursor: pointer;
        }
        .log-link:hover {
          border-color: var(--acc);
          background: rgba(167,139,250,0.12);
        }
        .log-dot {
          border-color: var(--acc) !important;
          background: rgba(167,139,250,0.16);
        }
        .log-history-card {
          border-color: rgba(167,139,250,0.22);
          background: rgba(167,139,250,0.05);
        }
        .mob-sheet-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end;
          animation: fadeIn 0.15s ease;
        }
        .mob-sheet {
          width: 100%; background: var(--bg3);
          border-radius: 18px 18px 0 0;
          padding: 12px 16px 32px;
          border-top: 1px solid var(--border2);
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .mob-sheet-handle { width: 36px; height: 4px; background: var(--border2); border-radius: 2px; margin: 0 auto 14px; }
        .mob-sheet-title { color: var(--t1); font-size: 15px; font-weight: 800; }
        .mob-sheet-sub { color: var(--t3); font-size: 11px; font-weight: 600; margin-bottom: 14px; font-family: var(--mono); }
        .mob-sheet-actions { display: flex; flex-direction: column; gap: 6px; }
        .mob-sheet-btn {
          display: flex; align-items: center; gap: 12px;
          width: 100%; padding: 13px 14px;
          background: var(--glass); border: 1px solid var(--border);
          border-radius: var(--r); color: var(--t1);
          font-size: 13px; font-weight: 700; font-family: var(--font);
          cursor: pointer; text-align: left; transition: all 0.15s;
        }
        .mob-sheet-btn svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--t3); }
        .mob-sheet-btn:active { background: var(--glass2); }
        .mob-sheet-btn.success { color: var(--green); }
        .mob-sheet-btn.success svg { color: var(--green); }
        .mob-sheet-btn.danger { color: var(--red); }
        .mob-sheet-btn.danger svg { color: var(--red); }
        .light .mob-sheet { background: #fff; border-color: var(--border); }
        .light .mob-sheet-btn { background: rgba(0,0,0,0.02); border-color: var(--border); }

        .modal-backdrop {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 18px;
          background: rgba(4,4,10,0.68);
          backdrop-filter: blur(10px);
        }
        .delete-modal {
          width: min(360px, 100%);
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: var(--r-lg);
          padding: 20px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .delete-modal-title { font-size: 16px; font-weight: 600; color: var(--t1); }
        .delete-modal-sub { font-size: 13px; color: var(--t2); }
        .delete-modal-options { display: flex; flex-direction: column; gap: 8px; }
        .delete-opt-btn {
          display: flex; align-items: center; gap: 12px;
          background: var(--bg2); border: 1px solid var(--border2);
          border-radius: var(--r); padding: 12px 14px;
          cursor: pointer; text-align: left; width: 100%;
          transition: border-color 0.15s, background 0.15s;
        }
        .delete-opt-btn:hover { border-color: var(--acc); background: var(--glass); }
        .delete-opt-btn.danger { border-color: rgba(239,68,68,0.3); }
        .delete-opt-btn.danger:hover { border-color: #ef4444; background: rgba(239,68,68,0.08); }
        .delete-opt-icon { font-size: 22px; flex-shrink: 0; }
        .delete-opt-label { font-size: 14px; font-weight: 500; color: var(--t1); margin-bottom: 2px; }
        .delete-opt-btn.danger .delete-opt-label { color: #f87171; }
        .delete-opt-desc { font-size: 12px; color: var(--t3); }
        .delete-opt-cancel {
          background: none; border: none; color: var(--t3);
          font-size: 13px; cursor: pointer; padding: 4px; text-align: center;
        }
        .delete-opt-cancel:hover { color: var(--t2); }

        .trash-empty { font-size: 13px; color: var(--t3); padding: 12px 0; }
        .trash-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        .trash-item {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-lg);
          background: var(--glass);
        }
        .trash-info { min-width: 0; }
        .trash-model { font-size: 14px; font-weight: 600; color: var(--t1); }
        .trash-serial { font-family: var(--mono); font-size: 10px; color: var(--t2); margin-top: 1px; letter-spacing: 0.03em; }
        .trash-meta { font-size: 11px; color: var(--t3); margin-top: 3px; }
        .trash-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .trash-restore {
          padding: 7px 12px; border-radius: 8px; border: 1px solid var(--acc);
          background: var(--glow2); color: var(--acc); font-size: 12px; font-weight: 600; cursor: pointer;
          white-space: nowrap; transition: background 0.15s, opacity 0.15s;
        }
        .trash-restore:hover:not(:disabled) { background: var(--acc); color: #fff; }
        .trash-restore:disabled { opacity: 0.5; cursor: default; }
        .trash-purge {
          padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border2);
          background: transparent; color: var(--t3); font-size: 12px; cursor: pointer;
          white-space: nowrap; transition: color 0.15s, border-color 0.15s;
        }
        .trash-purge:hover:not(:disabled) { color: #f87171; border-color: rgba(239,68,68,0.4); }
        .trash-purge:disabled { opacity: 0.5; cursor: default; }

        .part-modal {
          width: min(560px, 100%);
          max-height: min(680px, 92vh);
          display: flex; flex-direction: column; gap: 12px;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: var(--r-lg);
          padding: 16px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.55), 0 0 28px var(--glow2);
        }
        .part-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .part-modal-title { font-size: 16px; font-weight: 800; color: var(--t1); }
        .part-modal-sub { margin-top: 3px; font-size: 11px; color: var(--t3); font-weight: 600; }
        .part-search-wrap { position: relative; }
        .part-search-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          font-size: 12px; color: var(--t3);
          pointer-events: none;
        }
        .part-search-input { padding-left: 34px; }
        .part-picker-hint {
          margin-top: -6px;
          font-size: 10px;
          font-weight: 700;
          color: var(--t3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .modal-close {
          width: 30px; height: 30px; border-radius: var(--r-sm);
          border: 1px solid var(--border2);
          background: var(--glass2); color: var(--t2);
          font-size: 20px; line-height: 1; cursor: pointer;
        }
        .part-picker-list {
          display: flex; flex-direction: column; gap: 6px;
          max-height: 360px; overflow: auto;
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: 6px;
          background: var(--glass);
        }
        .part-picker-item {
          display: flex; flex-direction: column; gap: 3px;
          width: 100%; text-align: left;
          padding: 9px 10px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          background: transparent;
          font-family: var(--font);
          cursor: pointer;
          transition: all 0.15s;
        }
        .part-picker-item:hover, .part-picker-item.active {
          border-color: var(--border2);
          background: var(--glow2);
        }
        .manual-part-option { border-style: dashed; }
        .manual-part-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          border: 1px solid var(--border2);
          border-radius: var(--r);
          background: var(--glass2);
        }
        .manual-part-fields textarea {
          min-height: 76px;
          resize: vertical;
        }
        .part-picker-code { font-family: var(--mono); color: var(--t1); font-size: 12px; font-weight: 800; }
        .part-picker-desc { color: var(--t3); font-size: 11px; font-weight: 600; line-height: 1.4; }
        .part-empty { padding: 14px; color: var(--t3); font-size: 12px; line-height: 1.5; }
        .part-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .history-notes-card { background: var(--glass); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 12px 14px; margin-bottom: 14px; }
        .light .note-add-btn { background: rgba(255,255,255,0.8); color: var(--t3); border-color: var(--border2); }
        .light .note-count { color: var(--acc); background: var(--glow2); }
        .light .note-history-item { background: rgba(124,58,237,0.03); border-left-color: var(--border2); }
        .light .note-history-text { color: var(--t3); }
        .light .note-history-meta { color: var(--t4); }
        .light .history-notes-card { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .dt-part-row, .light .machine-parts { background: rgba(96,165,250,0.06); border-color: var(--border); }
        .light .part-chip, .light .part-more { background: rgba(96,165,250,0.08); color: var(--t2); }
        .light .log-row { background: rgba(124,58,237,0.05); }
        .light .log-link { background: rgba(124,58,237,0.08); }
        .light .log-history-card { background: rgba(124,58,237,0.05); }
        .light .part-modal { background: #fff; border-color: var(--border2); }
        .light .part-picker-list { background: rgba(124,58,237,0.03); border-color: var(--border); }
        .light .part-picker-item:hover, .light .part-picker-item.active { background: rgba(124,58,237,0.08); }
        .light .part-picker-code { color: var(--t1); }
        .light .part-picker-desc, .light .part-empty { color: var(--t3); }
        .note-input-inline { flex: 1; padding: 6px 10px; font-size: 12px; }
        .note-edit { margin-top: 8px; }
        .note-input { width: 100%; padding: 8px 11px; border: 1px solid var(--border2); border-radius: var(--r); font-size: 12px; font-family: var(--font); resize: none; height: 60px; background: var(--glass2); color: var(--t1); transition: border-color 0.2s; }
        .note-input:focus { border-color: var(--acc); outline: none; box-shadow: 0 0 12px var(--glow2); }
        .note-display { margin-top: 6px; cursor: pointer; padding: 4px 0; }
        .note-text { font-size: 11px; color: var(--t2); font-weight: 500; }
        .note-empty { font-size: 11px; color: var(--t3); font-weight: 500; }
        .store-edit-picker { min-width: 240px; background: var(--bg3); backdrop-filter: blur(16px); border: 1px solid var(--border2); border-radius: var(--r-lg); padding: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px var(--glow2); }
        .store-edit-display { cursor: pointer; color: var(--t3); font-size: 12px; transition: color 0.15s; }
        .store-edit-display:hover { color: var(--acc); }
        .wh-section-title { font-size: 11px; font-weight: 700; color: var(--t2); margin: 16px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); letter-spacing: 0.04em; text-transform: uppercase; }
        .divider-or { text-align: center; color: var(--t4); font-size: 11px; margin: 8px 0; position: relative; }
        .divider-or::before, .divider-or::after { content: ''; position: absolute; top: 50%; width: 44%; height: 1px; background: var(--border2); }
        .divider-or::before { left: 0; } .divider-or::after { right: 0; }
        .settings-store-search { display: flex; align-items: center; gap: 8px; margin: 8px 0 10px; }
        .settings-store-layout { display: grid; grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr); gap: 12px; margin-top: 8px; align-items: start; }
        .settings-store-list { max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--r); background: var(--glass); }
        .settings-store-item { width: 100%; padding: 10px 12px; font-size: 12px; color: var(--t3); border: none; border-bottom: 1px solid var(--border); font-weight: 600; background: transparent; font-family: var(--font); text-align: left; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 7px; }
        .settings-store-item:last-child { border-bottom: none; }
        .settings-store-item:hover, .settings-store-item.active { color: var(--t1); background: var(--glow2); }
        .settings-store-item.incomplete { color: var(--orange); }
        .settings-store-item.incomplete.active { color: var(--orange); }
        .store-incomplete-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--orange); flex-shrink: 0; }
        .settings-store-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .contract-badge { flex-shrink: 0; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px; letter-spacing: 0.02em; }
        .contract-badge.soon { color: #f59e0b; background: rgba(245,158,11,0.14); border: 1px solid rgba(245,158,11,0.35); }
        .contract-badge.expired { color: #f87171; background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.4); }
        .contract-inline { font-weight: 800; }
        .contract-inline.ok { color: var(--t2); }
        .contract-inline.soon { color: #f59e0b; }
        .contract-inline.expired { color: #f87171; }
        .settings-store-empty { padding: 14px 12px; color: var(--t3); font-size: 12px; font-weight: 600; text-align: center; }
        .store-detail-card { border: 1px solid var(--border2); border-radius: var(--r-lg); background: var(--glass2); padding: 14px; box-shadow: 0 0 18px var(--glow2); }
        .store-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .store-detail-title { font-size: 15px; font-weight: 800; color: var(--t1); }
        .store-detail-sub { font-size: 10px; color: var(--t3); font-weight: 600; margin-top: 2px; }
        .store-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .store-detail-field { border: 1px solid var(--border); border-radius: var(--r); padding: 10px 11px; background: var(--glass); min-width: 0; }
        .store-detail-field.wide { grid-column: 1 / -1; }
        .store-detail-field span { display: block; font-size: 9px; color: var(--t3); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
        .store-detail-field strong { display: block; font-size: 12px; color: var(--t1); font-weight: 700; overflow-wrap: anywhere; }
        .store-detail-input { padding: 7px 9px; font-size: 12px; }
        .store-contract-box { margin-top: 10px; border: 1px solid var(--border); border-radius: var(--r); background: var(--glass); padding: 10px; }
        .store-contract-toggle { display: inline-flex; align-items: center; gap: 8px; color: var(--t2); font-weight: 800; font-size: 12px; cursor: pointer; margin-bottom: 10px; }
        .store-contract-toggle input { width: 16px; height: 16px; accent-color: var(--acc); }
        .store-contract-duration { grid-column: 1 / -1; padding: 9px 11px; border: 1px solid var(--border2); border-radius: var(--r); background: var(--glow2); color: var(--t3); font-size: 12px; font-weight: 700; }
        .store-contract-duration strong { color: var(--t1); }
        .store-detail-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .store-extra-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .loading { text-align: center; padding: 48px; color: var(--t3); font-size: 13px; font-weight: 600; }
        .empty { text-align: center; padding: 48px 20px; color: var(--t3); font-size: 13px; line-height: 1.7; font-weight: 600; }
        .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }

        /* ══════════════════════════
           ANIMATIONS
        ══════════════════════════ */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(14px) scale(0.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glowPulse { 0%,100% { box-shadow: 0 0 16px var(--glow); } 50% { box-shadow: 0 0 32px var(--glow), 0 0 48px rgba(124,58,237,0.15); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .fade-in { animation: fadeIn 0.28s cubic-bezier(0.22,1,0.36,1); }

        /* ══════════════════════════
           LIGHT MODE
        ══════════════════════════ */
        .light {
          --c-avail:   #2563eb;
          --c-repair:  #c2410c;
          --c-store:   #047857;
          --c-central: #7c3aed;
          --bg:      #f4f4f8;
          --bg2:     #ffffff;
          --bg3:     #f0f0f5;
          --bg4:     #e8e8f0;
          --glass:   rgba(255,255,255,0.8);
          --glass2:  rgba(255,255,255,0.9);
          --border:  rgba(124,58,237,0.12);
          --border2: rgba(124,58,237,0.2);
          --border3: rgba(124,58,237,0.35);
          --acc:     #7c3aed;
          --acc2:    #5b21b6;
          --glow:    rgba(124,58,237,0.18);
          --glow2:   rgba(124,58,237,0.06);
          --t1:      #17172a;
          --t2:      #34344f;
          --t3:      #5d5d7a;
          --t4:      #74748f;
          --green:   #059669;
          --gbg:     rgba(5,150,105,0.08);
          --gg:      rgba(5,150,105,0.25);
          --glow-g:  rgba(5,150,105,0.12);
          --orange:  #d97706;
          --obg:     rgba(217,119,6,0.08);
          --og:      rgba(217,119,6,0.25);
          --glow-o:  rgba(217,119,6,0.12);
          --red:     #dc2626;
          --rbg:     rgba(220,38,38,0.07);
          --rg:      rgba(220,38,38,0.2);
          --blue:    #2563eb;
          --bbg:     rgba(37,99,235,0.08);
          --bg-l:    rgba(37,99,235,0.2);
        }
        .light * {
          scrollbar-color: rgba(124,58,237,0.55) rgba(124,58,237,0.08);
        }
        .light ::-webkit-scrollbar-track { background: rgba(124,58,237,0.08); }
        .light ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(124,58,237,0.72), rgba(37,99,235,0.5));
          border-color: rgba(244,244,248,0.95);
        }
        .light body { background: var(--bg); color: var(--t1); background-image: radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(16,185,129,0.03) 0%, transparent 50%); }
        .light .sidebar { background: rgba(255,255,255,0.95); border-right-color: var(--border); }
        .light .sidebar::after { opacity: 0.15; }
        .light .sb-logo { border-bottom-color: var(--border); }
        .light .sb-section { color: var(--t4); }
        .light .sb-item { color: var(--t3); }
        .light .sb-item:hover { background: rgba(124,58,237,0.05); color: var(--t2); }
        .light .sb-item.active { background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(91,33,182,0.05)); border-color: var(--border2); }
        .light .sb-footer { border-top-color: var(--border); }
        .light .sb-username { color: var(--t3); }
        .light .desktop-header { background: rgba(255,255,255,0.9); border-bottom-color: var(--border); }
        .light .desktop-title { color: var(--t1); }
        .light .desktop-content { background: var(--bg); }
        .light .desktop-main { background: var(--bg); }
        .light .dt-table { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .dt-head { background: rgba(124,58,237,0.03); border-bottom-color: var(--border); }
        .light .dt-th { color: var(--t3); }
        .light .dt-row { border-bottom-color: rgba(124,58,237,0.05); }
        .light .dt-row:hover { background: rgba(124,58,237,0.03); }
        .light .dt-td { color: var(--t2); }
        .light .dt-td.dt-muted { color: var(--t3); }
        .light .dt-model { color: var(--t1); }
        .light .dt-serial { color: #4a4a6a; }
        .light .dt-note-row { background: rgba(124,58,237,0.02); border-bottom-color: var(--border); }
        .light .stat-card { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .stat-card:hover { box-shadow: 0 8px 32px rgba(124,58,237,0.08); }
        .light .stat-label { color: var(--t3); }
        .light .stat-val { color: var(--t1); }
        .light .stat-sub { color: var(--t3); }
        /* ══════════════════════════
           ΓΡΑΦΗΜΑΤΑ ΑΡΧΙΚΗΣ
        ══════════════════════════ */
        .dashboard-grid.even { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 900px) { .dashboard-grid.even { grid-template-columns: 1fr; } }

        .chart-tip {
          position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
          z-index: 20; pointer-events: none; white-space: nowrap;
          background: var(--bg2); color: var(--t1); border: 1px solid var(--border2);
          border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        }
        .chart-tip strong { font-weight: 700; }
        .chart-tip.wide { min-width: 180px; padding: 8px 10px; bottom: auto; top: 0; left: calc(100% + 6px); transform: none; }
        .chart-tip.wide.left { left: auto; right: calc(100% + 6px); }
        .tip-title { font-size: 11px; font-weight: 700; color: var(--t1); margin-bottom: 6px; }
        .tip-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--t2); padding: 2px 0; }
        .tip-row i { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .tip-row strong { margin-left: auto; color: var(--t1); font-variant-numeric: tabular-nums; }
        .tip-row.total { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 5px; color: var(--t1); font-weight: 600; }

        .chart-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-bottom: 12px; }
        .chart-legend span { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--t2); }
        .chart-legend i { width: 10px; height: 10px; border-radius: 3px; }

        /* Κατανομή στόλου */
        .fleet-bar { display: flex; gap: 2px; height: 28px; border-radius: 8px; margin-top: 4px; }
        .fleet-empty { flex: 1; border-radius: 8px; background: var(--glass2); }
        .fleet-seg { position: relative; flex-basis: 0; min-width: 6px; border: none; padding: 0; cursor: pointer; transition: opacity .15s, filter .15s; }
        .fleet-seg:first-child { border-radius: 8px 0 0 8px; }
        .fleet-seg:last-child { border-radius: 0 8px 8px 0; }
        .fleet-seg:only-child { border-radius: 8px; }
        .fleet-seg.dim { opacity: .35; }
        .fleet-seg:focus-visible { outline: 2px solid var(--t1); outline-offset: 2px; }
        .fleet-legend { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
        .fleet-key { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 2px 8px; padding: 10px 12px; border-radius: var(--r); border: 1px solid var(--border); background: transparent; cursor: pointer; text-align: left; font-family: var(--font); transition: border-color .15s, background .15s; }
        .fleet-key:hover, .fleet-key.on { border-color: var(--border2); background: var(--glass2); }
        .fleet-swatch { width: 10px; height: 10px; border-radius: 3px; align-self: center; }
        .fleet-key-label { font-size: 12px; color: var(--t2); font-weight: 600; }
        .fleet-key-pct { font-size: 11px; color: var(--t4); font-variant-numeric: tabular-nums; }
        .fleet-key-num { grid-column: 1 / 3; font-size: 22px; font-weight: 800; color: var(--t1); font-variant-numeric: tabular-nums; line-height: 1.2; }
        @media (max-width: 700px) { .fleet-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

        /* Κινήσεις ανά εβδομάδα */
        .wchart-plot { position: relative; height: 230px; margin-left: 26px; }
        .wchart-grid { position: absolute; inset: 0 0 22px 0; display: flex; flex-direction: column; justify-content: space-between; }
        .wchart-gridline { position: relative; border-top: 1px solid var(--border); height: 0; }
        .wchart-gridline span { position: absolute; left: -26px; top: -7px; width: 20px; text-align: right; font-size: 10px; color: var(--t4); font-variant-numeric: tabular-nums; }
        .wchart-cols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
        .wchart-col { position: relative; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 22px; outline: none; border-radius: 6px; }
        .wchart-col::before { content: ''; position: absolute; inset: 0 -4px 22px; border-radius: 6px; background: transparent; transition: background .15s; }
        .wchart-col.on::before { background: var(--glass2); }
        .wchart-stack { position: relative; display: flex; flex-direction: column-reverse; gap: 2px; width: 62%; max-width: 30px; margin: 0 auto; min-height: 0; }
        .wchart-seg { flex-basis: 0; min-height: 2px; }
        .wchart-stack .wchart-seg:last-child { border-radius: 4px 4px 0 0; }
        .wchart-x { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: var(--t4); font-variant-numeric: tabular-nums; }
        .wchart-col.on .wchart-x { color: var(--t1); font-weight: 600; }

        /* Οριζόντιες μπάρες */
        .hbars { display: flex; flex-direction: column; gap: 4px; }
        .hbar-row { display: grid; grid-template-columns: minmax(90px, 34%) 1fr 32px; align-items: center; gap: 10px; padding: 6px 4px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-family: var(--font); text-align: left; }
        .hbar-row:hover { background: var(--glass2); }
        .hbar-label { font-size: 12px; color: var(--t2); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hbar-track { height: 12px; border-radius: 0 4px 4px 0; position: relative; }
        .hbar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 0 4px 4px 0; }
        .hbar-value { font-size: 13px; font-weight: 700; color: var(--t1); text-align: right; font-variant-numeric: tabular-nums; }

        /* Χρόνος σε επισκευή */
        .aging-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; height: 170px; border-bottom: 1px solid var(--border); }
        .aging-col { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; border: none; background: transparent; cursor: pointer; padding: 0 0 0; font-family: var(--font); }
        .aging-bar { width: 58%; max-width: 48px; min-height: 2px; border-radius: 4px 4px 0 0; background: color-mix(in srgb, var(--t3) 45%, transparent); transition: filter .15s; }
        .aging-col.late .aging-bar { background: var(--c-repair); }
        .aging-col:hover .aging-bar { filter: brightness(1.15); }
        .aging-val { font-size: 14px; font-weight: 800; color: var(--t1); font-variant-numeric: tabular-nums; }
        .aging-x { position: absolute; bottom: -20px; font-size: 11px; color: var(--t3); }
        .aging-note { margin-top: 28px; font-size: 11px; color: var(--t3); display: flex; align-items: center; gap: 6px; }
        .aging-note i { width: 10px; height: 10px; border-radius: 3px; background: var(--c-repair); }

        .part-serial-field { padding: 10px 16px 0; display: flex; flex-direction: column; gap: 6px; }
        .part-serial-field .field-label span { font-weight: 500; color: var(--t4); text-transform: none; letter-spacing: 0; }
        /* ══════════════════════════
           TICKETS
        ══════════════════════════ */
        .tk-page { --tk-new: var(--blue); --tk-missing: var(--orange); --tk-progress: var(--acc); --tk-closed: var(--t4); }
        .tk-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .tk-title { font-size: 20px; font-weight: 800; color: var(--t1); letter-spacing: -0.01em; }
        .tk-subtitle { font-size: 12px; color: var(--t3); margin-top: 2px; }

        /* Στατιστικά = φίλτρα */
        .tk-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
        .tk-stat {
          --c: var(--tk-closed);
          display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
          padding: 12px 14px; border-radius: var(--r-lg); cursor: pointer; text-align: left;
          background: var(--glass); border: 1px solid var(--border); font-family: var(--font);
          border-top: 3px solid var(--c); transition: border-color .15s, background .15s, transform .15s;
        }
        .tk-stat:hover { transform: translateY(-1px); border-color: var(--border2); }
        .tk-stat.active { background: color-mix(in srgb, var(--c) 12%, transparent); border-color: var(--c); }
        .tk-stat-num { font-size: 22px; font-weight: 800; color: var(--t1); line-height: 1.1; font-variant-numeric: tabular-nums; }
        .tk-stat-label { font-size: 11px; font-weight: 600; color: var(--t3); }
        .tk-stat.st-new { --c: var(--tk-new); } .tk-stat.st-missing { --c: var(--tk-missing); }
        .tk-stat.st-progress { --c: var(--tk-progress); } .tk-stat.st-closed { --c: var(--tk-closed); }

        .tk-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
        .tk-search { flex: 1; min-width: 0; }
        .tk-scope { display: flex; padding: 3px; border-radius: var(--r); background: var(--glass); border: 1px solid var(--border); flex-shrink: 0; }
        .tk-scope button { padding: 7px 12px; border: none; border-radius: 7px; background: transparent; color: var(--t3); font: 600 12px var(--font); cursor: pointer; }
        .tk-scope button.active { background: var(--glass2); color: var(--t1); box-shadow: 0 1px 0 var(--border2) inset; }

        /* Κατάσταση */
        .tk-status { --c: var(--tk-closed); display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); white-space: nowrap; }
        .tk-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
        .st-new { --c: var(--tk-new); } .st-missing { --c: var(--tk-missing); } .st-progress { --c: var(--tk-progress); } .st-closed { --c: var(--tk-closed); }
        .tk-id { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--acc); }

        /* Λίστα */
        .tk-layout { display: block; }
        .tk-list { display: flex; flex-direction: column; gap: 8px; }
        .tk-panel { display: none; }
        .tk-item {
          --c: var(--tk-closed);
          width: 100%; display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer;
          padding: 12px 14px 12px 16px; border-radius: var(--r-lg); position: relative; overflow: hidden;
          background: var(--glass); border: 1px solid var(--border); color: inherit; font-family: var(--font);
          transition: border-color .15s, background .15s;
        }
        .tk-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); }
        .tk-item:hover { border-color: var(--border2); }
        .tk-item.selected { border-color: var(--acc); background: var(--glow2); }
        .tk-item-top { display: flex; align-items: center; gap: 8px; }
        .tk-logs { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .tk-logs li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; min-width: 0; }
        .tk-logs li .tk-link { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .tk-logs li.from-machine { border-style: dashed; }
        .tk-log-meta { font-size: 11px; color: var(--t4); white-space: nowrap; }
        .tk-log-del { background: none; border: none; color: var(--t4); font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px; }
        .tk-log-del:hover { color: #ef4444; }
        .tk-logs-empty { font-size: 13px; margin-top: 4px; }
        .tk-log-add { display: flex; gap: 8px; margin-top: 8px; }
        .tk-log-add .text-input { flex: 1; min-width: 0; margin: 0; }
        @media (max-width: 640px) { .tk-logs li { flex-wrap: wrap; } .tk-log-meta { width: 100%; } }
        .tk-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .tk-ago { margin-left: auto; font-size: 11px; color: var(--t4); white-space: nowrap; }
        .tk-item-store { font-size: 14px; font-weight: 700; color: var(--t1); }
        .tk-item-problem { font-size: 12px; color: var(--t2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tk-item-problem em { color: var(--t4); }
        .tk-item-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--t3); margin-top: 2px; }
        .tk-item-meta .mono { font-family: var(--mono); }
        .tk-chip-missing { color: var(--orange); font-weight: 700; }
        .tk-empty, .tk-panel-empty { padding: 28px 16px; text-align: center; color: var(--t3); font-size: 13px; border: 1px dashed var(--border2); border-radius: var(--r-lg); }
        .tk-inline { margin-top: 6px; }

        /* Λεπτομέρειες */
        .tk-detail { background: var(--glass); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        .tk-detail-head { display: flex; justify-content: space-between; gap: 10px; }
        .tk-detail-id-row { display: flex; align-items: center; gap: 8px; }
        .tk-detail-store { font-size: 18px; font-weight: 800; color: var(--t1); margin-top: 4px; }
        .tk-detail-sub { font-size: 11px; color: var(--t4); margin-top: 2px; word-break: break-all; }
        .tk-close { width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--t3); font-size: 18px; cursor: pointer; }
        .tk-missing-banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: var(--r); background: var(--obg); border: 1px solid var(--og); color: var(--orange); font-size: 12px; }
        .tk-missing-banner strong { font-weight: 700; }

        .tk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: var(--r); border: 1px solid var(--border2); background: var(--glass2); color: var(--t1); font: 600 12px var(--font); cursor: pointer; text-decoration: none; white-space: nowrap; transition: border-color .15s, background .15s; }
        .tk-btn:hover:not(:disabled):not(.disabled) { border-color: var(--acc); }
        .tk-btn.primary { background: linear-gradient(135deg, var(--acc), var(--acc2)); border-color: transparent; color: #fff; }
        .tk-btn.small { padding: 5px 10px; font-size: 11px; }
        .tk-btn:disabled, .tk-btn.disabled { opacity: .45; cursor: not-allowed; pointer-events: none; }
        .tk-quick { display: flex; flex-wrap: wrap; gap: 6px; }
        .tk-quick .primary { margin-left: auto; }

        .tk-segment { display: grid; grid-template-columns: repeat(4, 1fr); padding: 3px; gap: 3px; border-radius: var(--r); background: var(--bg3); border: 1px solid var(--border); }
        .tk-seg { padding: 7px 4px; border: none; border-radius: 7px; background: transparent; color: var(--t3); font: 600 11px var(--font); cursor: pointer; }
        .tk-seg:hover:not(.active) { color: var(--t1); }
        .tk-seg.active { background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent) inset; }

        .tk-field-label { display: block; font-size: 9px; font-weight: 700; color: var(--t4); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 3px; }
        .tk-field-label em { text-transform: none; letter-spacing: 0; font-weight: 500; font-style: normal; }
        .tk-problem { padding: 12px 14px; border-radius: var(--r); background: var(--bg3); border-left: 3px solid var(--acc); }
        .tk-problem p { margin: 0; font-size: 14px; color: var(--t1); line-height: 1.5; white-space: pre-wrap; }

        .tk-sections { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .tk-section { padding: 12px; border-radius: var(--r); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 9px; min-width: 0; }
        .tk-section-title { font-size: 11px; font-weight: 700; color: var(--acc); }
        .tk-field { min-width: 0; }
        .tk-field-value { font-size: 13px; color: var(--t1); word-break: break-word; }
        .tk-field-value.mono, .tk-link.mono { font-family: var(--mono); }
        .tk-field-missing { font-size: 12px; font-weight: 700; color: var(--orange); }
        .tk-field-empty { font-size: 13px; color: var(--t4); }
        .tk-link { font-size: 13px; color: var(--acc); text-decoration: none; font-weight: 600; word-break: break-all; }
        .tk-link:hover { text-decoration: underline; }

        .tk-block p { margin: 0; font-size: 13px; color: var(--t2); white-space: pre-wrap; }
        .tk-note-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
        .tk-original { border: 1px solid var(--border); border-radius: var(--r); }
        .tk-original summary { padding: 9px 12px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--t3); }
        .tk-original pre { margin: 0; padding: 0 12px 12px; white-space: pre-wrap; font: 12px/1.5 var(--font); color: var(--t2); max-height: 260px; overflow-y: auto; }
        .tk-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 10px; color: var(--t4); }
        .tk-delete { border: none; background: none; color: var(--red); font: 600 12px var(--font); cursor: pointer; padding: 4px 6px; border-radius: 6px; }
        .tk-delete:hover { background: var(--rbg); }

        .tk-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
        .tk-edit-field { display: flex; flex-direction: column; min-width: 0; }
        .tk-edit-field.wide { grid-column: 1 / -1; }
        .tk-edit-actions { display: flex; justify-content: flex-end; gap: 8px; }

        /* Desktop: λίστα αριστερά, λεπτομέρειες δεξιά */
        @media (min-width: 1100px) {
          .tk-layout { display: grid; grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 14px; align-items: start; }
          .tk-list { max-height: calc(100vh - 290px); overflow-y: auto; padding-right: 4px; }
          .tk-inline { display: none; }
          .tk-panel { display: block; position: sticky; top: 0; max-height: calc(100vh - 290px); overflow-y: auto; }
          .desktop-split-hide { display: none; }
        }
        @media (min-width: 768px) {
          .tk-title { display: none; } /* υπάρχει ήδη στην κεφαλίδα της σελίδας */
          .tk-subtitle { margin-top: 0; font-size: 13px; }
        }
        @media (max-width: 760px) {
          .tk-sections { grid-template-columns: 1fr; }
          .tk-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .tk-edit-grid { grid-template-columns: 1fr; }
          .tk-toolbar { flex-direction: column; align-items: stretch; }
          .tk-quick .tk-btn { flex: 1 1 calc(50% - 6px); }
          .tk-quick .primary { margin-left: 0; flex-basis: 100%; }
          .tk-segment { grid-template-columns: repeat(2, 1fr); }
        }
        .light .tk-detail, .light .tk-item, .light .tk-stat { background: rgba(255,255,255,0.9); }
        .light .tk-item.selected { background: rgba(124,58,237,0.05); }
        .light .tk-problem, .light .tk-segment { background: #f3f2fa; }
        .light .tk-scope button.active { background: #fff; }


        .light .card { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .card-title { color: var(--t1); }
        .light .card-sub { color: var(--t3); }
        .light .machine-row { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .machine-row:hover { border-color: var(--border2); box-shadow: 0 4px 16px rgba(124,58,237,0.08); }
        .light .machine-name { color: var(--t1); }
        .light .machine-serial { color: #4a4a6a; }
        .light .machine-store { color: var(--t3); }
        .light .machine-date { color: var(--t3); }
        .light .date-edit-display { color: var(--t3); }
        .light .date-edit-display:hover { color: var(--acc); }
        .light .date-save-btn, .light .date-cancel-btn { background: rgba(255,255,255,0.86); }
        .light .h-card { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .h-action { color: var(--t1); }
        .light .h-meta { color: var(--t3); }
        .light .h-dot { background: #fff; }
        .light .h-line { background: var(--border); }
        .light .history-machine-header { background: rgba(255,255,255,0.95); }
        .light .history-machine-model { color: var(--t1); }
        .light .history-machine-serial { color: #4a4a6a; }
        .light .machine-card { background: rgba(255,255,255,0.92); border-color: var(--border); box-shadow: 0 8px 24px rgba(124,58,237,0.08); }
        .light .machine-card.compact { background: rgba(255,255,255,0.72); }
        .light .machine-card-grid div { background: rgba(255,255,255,0.78); border-color: var(--border); }
        .light .machine-card-serial { color: #4a4a6a; }
        .light .h-machine-serial { color: #4a4a6a; }
        .light .quick-action-bar { background: rgba(255,255,255,0.9); border-color: var(--border2); }
        .light .quick-serial { color: var(--t1); }
        .light .filter-pill { background: rgba(255,255,255,0.9); color: var(--t3); border-color: var(--border2); }
        .light .filter-pill.active { background: var(--glow2); color: var(--acc); }
        .light .period-pill { background: rgba(255,255,255,0.9); color: var(--t3); border-color: var(--border2); }
        .light .period-pill.active { background: var(--glow2); color: var(--acc); }
        .light .sort-btn { background: rgba(255,255,255,0.9); color: var(--t3); border-color: var(--border2); }
        .light select, .light textarea, .light .text-input { background: rgba(255,255,255,0.9); border-color: var(--border2); color: var(--t1); }
        .light .text-input::placeholder { color: var(--t4); }
        .light .upload-area { background: rgba(255,255,255,0.7); border-color: var(--border2); }
        .light .upload-title { color: var(--t2); }
        .light .action-tile { background: rgba(255,255,255,0.8); border-color: var(--border2); }
        .light .action-title { color: var(--t2); }
        .light .sub-action-item { background: rgba(255,255,255,0.8); border-color: var(--border2); }
        .light .sub-action-label { color: var(--t2); }
        .light .store-picker { background: rgba(255,255,255,0.9); border-color: var(--border2); }
        .light .store-item { color: var(--t2); }
        .light .store-item:hover { background: rgba(124,58,237,0.05); color: var(--t1); }
        .light .chain-tab { background: rgba(255,255,255,0.8); color: var(--t3); border-color: var(--border2); }
        .light .btn-ghost { background: rgba(255,255,255,0.8); border-color: var(--border2); color: var(--t3); }
        .light .btn-half { background: rgba(255,255,255,0.8); border-color: var(--border2); color: var(--t2); }
        .light .category-tab, .light .warehouse-category-tab { background: rgba(255,255,255,0.86); border-color: var(--border2); color: var(--t3); }
        .light .category-tab.active, .light .warehouse-category-tab.active { background: var(--glow2); color: var(--acc); }
        .light .btn-quick-action { background: rgba(255,255,255,0.8); border-color: var(--border2); color: var(--t2); }
        .light .action-menu-btn { background: rgba(255,255,255,0.85); border-color: var(--border2); color: var(--t2); }
        .light .action-menu { background: rgba(255,255,255,0.98); border-color: var(--border2); box-shadow: 0 16px 32px rgba(124,58,237,0.14); }
        .light .action-menu-item { color: var(--t2); }
        .light .action-menu-item:hover { background: rgba(124,58,237,0.08); color: var(--acc); }
        .light .btn-clear { background: rgba(255,255,255,0.8); border-color: var(--border2); }
        .light .btn-export { background: rgba(255,255,255,0.8); border-color: var(--border2); color: var(--t2); }
        .light .note-input { background: rgba(255,255,255,0.9); border-color: var(--border2); color: var(--t1); }
        .light .note-text { color: var(--t2); }
        .light .note-empty { color: var(--t3); }
        .light .store-edit-picker { background: #fff; border-color: var(--border2); }
        .light .store-edit-display { color: var(--t3); }
        .light .wh-section-title { color: var(--t2); border-bottom-color: var(--border); }
        .light .divider-or { color: var(--t4); }
        .light .divider-or::before, .light .divider-or::after { background: var(--border2); }
        .light .settings-store-item { color: var(--t3); border-bottom-color: var(--border); }
        .light .section-label { color: var(--t3); }
        .light .field-label { color: var(--t3); }
        .light .loading { color: var(--t3); }
        .light .empty { color: var(--t3); }
        .light .dashboard-greeting, .light .dashboard-panel, .light .dash-stat, .light .recent-row, .light .movement-breakdown-item, .light .attention-row { background: rgba(255,255,255,0.9); border-color: var(--border); }
        .light .attention-row.is-fresh { background: rgba(5,150,105,0.08); border-color: #047857; }
        .light .quick-action-btn { background: rgba(255,255,255,0.7); border-color: var(--border); }
        .light .success-title { color: var(--t1); }
        .light .mob-header { background: rgba(255,255,255,0.97); border-bottom-color: var(--border); }
        .light .mob-logo span:first-of-type { color: var(--t1); }
        .light .user-name { color: var(--t3); }
        .light .btn-logout { background: rgba(255,255,255,0.8); border-color: var(--border2); color: var(--t3); }
        .light .mob-nav-btn { color: var(--t3); }
        .light .mob-nav-btn.active { background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(91,33,182,0.05)); color: var(--acc); }
        .light .mob-main { background: var(--bg); }
        .light .dt-table { backdrop-filter: none; }
        .light .card { backdrop-filter: none; }
        .light .stat-card { backdrop-filter: none; }

        @media (prefers-reduced-motion: reduce) {
          *, .fade-in { animation: none !important; transition: none !important; }
        }
        @media (max-width: 767px) {
          .inv-stats { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
          .stat-card { padding: 12px; }
          .stat-val { font-size: 24px; }
          .dashboard-greeting { flex-direction: column; align-items: flex-start; gap: 10px; padding: 12px 14px; }
          .quick-actions { width: 100%; }
          .quick-action-btn { flex: 1; justify-content: center; }
          .dashboard-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dashboard-grid, .movement-breakdown { grid-template-columns: 1fr; }
          .dash-stat { min-height: 96px; }
          .recent-row { grid-template-columns: auto minmax(0, 1fr) auto; }
          .recent-row em { grid-column: 2 / -1; }
          .settings-store-layout { grid-template-columns: 1fr; }
          .settings-store-list { max-height: 220px; }
          .store-detail-grid { grid-template-columns: 1fr; }
          .store-extra-grid { grid-template-columns: 1fr; gap: 0; }
          .shipment-method-row { grid-template-columns: 1fr; }
          .shipment-email-head { flex-direction: column; }
          .shipment-table-preview { max-width: 100%; overflow-x: auto; }
          .shipment-table-top { grid-template-columns: 38px 120px 180px; min-width: 338px; }
          .shipment-table-body { grid-template-columns: 38px 120px 180px; min-width: 338px; }
          select, textarea, .text-input, input[type="date"].text-input { font-size: 16px; }
          .store-item, .item-option, .item-picker-trigger { font-size: 16px; }
          .item-option span, .item-picker-trigger span { font-size: 14px; }
          .item-option small, .item-picker-trigger small { font-size: 12px; }
        }
      `}</style>
    </>
  );
}
