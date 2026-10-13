import { google } from 'googleapis';

function getAuth() {
  const keyJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function appendRow(data) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    data.serialNumber,
    data.model || '',
    data.action,
    data.store || '',
    data.date || new Date().toLocaleDateString('el-GR'),
    data.problem || '',
    data.notes || '',
    new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
    data.user || '',
    data.category || 'CashDro',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
    // RAW prevents formula injection: a value starting with '=' is stored as
    // literal text instead of being evaluated as a Sheets formula.
    valueInputOption: 'RAW',
    resource: { values: [row] },
  });
}

export async function getInventory() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  const data = rows.slice(1).map(r => ({
    serialNumber: r[0] || '',
    model:        r[1] || '',
    action:       r[2] || '',
    store:        r[3] || '',
    date:         r[4] || '',
    problem:      r[5] || '',
    notes:        r[6] || '',
    timestamp:    r[7] || '',
    user:         r[8] || '',
    category:     r[9] || 'CashDro',
  }));

  const latest = {};
  data.forEach(row => { if (row.serialNumber) latest[row.serialNumber] = row; });
  return Object.values(latest);
}

// Όλες οι κινήσεις (για τα γραφήματα της Αρχικής)
export async function getAllMovements() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(r => r[0])
    .map(r => ({
      serialNumber: r[0] || '',
      model:        r[1] || '',
      action:       r[2] || '',
      store:        r[3] || '',
      date:         r[4] || '',
      timestamp:    r[7] || '',
      category:     r[9] || 'CashDro',
    }));
}

export async function getHistory(serialNumber) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .filter(r => r[0] === serialNumber)
    .map(r => ({
      serialNumber: r[0] || '',
      model:        r[1] || '',
      action:       r[2] || '',
      store:        r[3] || '',
      date:         r[4] || '',
      problem:      r[5] || '',
      notes:        r[6] || '',
      timestamp:    r[7] || '',
      user:         r[8] || '',
      category:     r[9] || 'CashDro',
    }))
    .reverse();
}

export async function getHistoryByStore(store) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .filter(r => r[3] && r[3].toLowerCase().includes(store.toLowerCase()))
    .map(r => ({
      serialNumber: r[0] || '',
      model:        r[1] || '',
      action:       r[2] || '',
      store:        r[3] || '',
      date:         r[4] || '',
      problem:      r[5] || '',
      notes:        r[6] || '',
      timestamp:    r[7] || '',
      user:         r[8] || '',
      category:     r[9] || 'CashDro',
    }))
    .reverse();
}

export async function getUsers() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Users!A:E',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map(r => ({
    username: r[0] || '',
    password: r[1] || '',
    fullName: r[2] || '',
    active:   r[3] || '',
    role:     r[4] || 'admin', // E column — empty = admin for backward compat
  }));
}

export async function getItems() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Items!A:C',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .map(r => ({
      code: r[0] || '',
      description: r[1] || '',
      category: r[2] || 'CashDro',
    }))
    .filter(item => item.code.trim() !== '');
}

async function getValuesFromFirstAvailableRange(sheets, ranges) {
  for (const range of ranges) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range,
      });
      return res.data.values || [];
    } catch (err) {
      const status = err?.code || err?.response?.status;
      if (status !== 400 && status !== 404) throw err;
    }
  }
  return [];
}

export async function getParts() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = await getValuesFromFirstAvailableRange(sheets, ['Parts!A:C', 'SpareParts!A:C']);
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .map(r => ({
      code: r[0] || '',
      description: r[1] || '',
      category: r[2] || 'CashDro',
    }))
    .filter(part => part.code.trim() !== '');
}

async function ensureSheetExists(sheets, title, headers) {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${title}!A1:A1`,
    });
    return;
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status !== 400 && status !== 404) throw err;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    resource: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  if (headers?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });
  }
}

async function formatSheetColumnsAsText(sheets, title, columnCount) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === title);
  if (!sheet) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    resource: {
      requests: [{
        repeatCell: {
          range: {
            sheetId: sheet.properties.sheetId,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'TEXT' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      }],
    },
  });
}

const MACHINE_PARTS_HEADERS = ['serialNumber', 'code', 'description', 'createdAt', 'createdBy', 'machineModel', 'partSerial'];

function rowToMachinePart(r) {
  return {
    code: r[1] || '',
    description: r[2] || '',
    createdAt: r[3] || '',
    createdBy: r[4] || '',
    machineModel: r[5] || '',
    partSerial: r[6] || '',
  };
}

export async function getMachineParts() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = await getValuesFromFirstAvailableRange(sheets, ['MachineParts!A:G']);
  if (rows.length <= 1) return {};

  const partsMap = {};
  rows.slice(1).forEach(r => {
    const serial = String(r[0] || '').trim();
    if (!serial || !String(r[1] || '').trim()) return;
    if (!partsMap[serial]) partsMap[serial] = [];
    partsMap[serial].unshift(rowToMachinePart(r));
  });
  return partsMap;
}

// Γράφει σε ΑΚΡΙΒΗ γραμμή (επόμενη μετά την τελευταία με δεδομένα), όχι με "append":
// το append του Google Sheets μαντεύει πού τελειώνει ο πίνακας και μπορεί να γράψει
// σε λάθος στήλες, οπότε το ανταλλακτικό "χανόταν" στην επόμενη ανάγνωση.
export async function saveMachinePart({ serialNumber, code, description, createdBy = '', machineModel = '', partSerial = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const createdAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
  const serial = String(serialNumber || '').trim();

  await ensureSheetExists(sheets, 'MachineParts', MACHINE_PARTS_HEADERS);

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'MachineParts!A:G',
  });
  const rows = current.data.values || [];

  // Παλιό φύλλο χωρίς τη στήλη partSerial → συμπληρώνουμε τις επικεφαλίδες
  if (!rows[0] || rows[0].length < MACHINE_PARTS_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'MachineParts!A1:G1',
      valueInputOption: 'RAW',
      resource: { values: [MACHINE_PARTS_HEADERS] },
    });
  }
  await formatSheetColumnsAsText(sheets, 'MachineParts', MACHINE_PARTS_HEADERS.length);

  // Τελευταία γραμμή που έχει οτιδήποτε στις A:G
  let last = rows.length;
  while (last > 1 && !(rows[last - 1] || []).some(v => String(v || '').trim())) last -= 1;
  const rowNumber = Math.max(2, last + 1);

  const values = [serial, code, description, createdAt, createdBy, machineModel, partSerial];
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `MachineParts!A${rowNumber}:G${rowNumber}`,
    valueInputOption: 'RAW',
    resource: { values: [values] },
  });

  // Επιβεβαίωση: ξαναδιαβάζουμε τη γραμμή
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `MachineParts!A${rowNumber}:G${rowNumber}`,
  });
  const back = (check.data.values || [])[0] || [];
  if (String(back[0] || '').trim() !== serial || String(back[1] || '') !== String(code)) {
    throw new Error(`MachineParts verify failed at row ${rowNumber}: ${JSON.stringify(back)}`);
  }

  return { code, description, createdAt, createdBy, machineModel, partSerial, row: rowNumber };
}

export async function deleteMachinePart({ serialNumber, code, createdAt }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'MachineParts!A:G',
  });

  const rows = valuesRes.data.values || [];
  let rowIndex = rows.findIndex((r, i) => (
    i > 0 && String(r[0] || '').trim() === String(serialNumber).trim() && r[1] === code && r[3] === createdAt
  ));

  if (rowIndex < 0) {
    rowIndex = rows.findIndex((r, i) => (
      i > 0 && String(r[0] || '').trim() === String(serialNumber).trim() && r[1] === code
    ));
  }

  if (rowIndex < 0) throw new Error('Machine part not found');

  // Get the numeric sheet ID needed for deleteDimension
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === 'MachineParts');
  if (!sheet) throw new Error('MachineParts sheet not found');
  const sheetId = sheet.properties.sheetId;

  // Delete the entire row (not just clear the values) so ghost rows don't accumulate
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,     // 0-indexed
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });
}

export async function getMachineLogLinks() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = await getValuesFromFirstAvailableRange(sheets, ['MachineLogLinks!A:E']);
  if (rows.length <= 1) return {};

  const linksMap = {};
  rows.slice(1).forEach(r => {
    if (!r[0] || !r[1]) return;
    const serial = r[0];
    if (!linksMap[serial]) linksMap[serial] = [];
    linksMap[serial].unshift({
      url: r[1] || '',
      createdAt: r[2] || '',
      createdBy: r[3] || '',
      machineModel: r[4] || '',
    });
  });
  return linksMap;
}

export async function saveMachineLogLink({ serialNumber, url, createdBy = '', machineModel = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const createdAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });

  await ensureSheetExists(sheets, 'MachineLogLinks', ['serialNumber', 'url', 'createdAt', 'createdBy', 'machineModel']);
  await formatSheetColumnsAsText(sheets, 'MachineLogLinks', 5);

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'MachineLogLinks!A:E',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [[serialNumber, url, createdAt, createdBy, machineModel]] },
  });

  return { url, createdAt, createdBy, machineModel };
}

export async function getStores() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:G',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  // Παραλείπουμε την κεφαλίδα και επιστρέφουμε μόνο τα ονόματα
  return rows.slice(1)
    .map(r => r[0] || '')
    .filter(name => name.trim() !== '');
}

export async function getStoreDetails() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:G',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .map(r => ({
      name: r[0] || '',
      phone: r[1] || '',
      address: r[2] || '',
      vat: r[3] || '',
      contract: r[4] || '',
      contractStart: r[5] || '',
      contractEnd: r[6] || '',
    }))
    .filter(store => store.name.trim() !== '');
}

export async function addStore(name) {
  return addStoreDetails({ name });
}

export async function addStoreDetails({ name, phone = '', address = '', vat = '', contract = '', contractStart = '', contractEnd = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:G',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        name.trim(),
        phone.trim(),
        address.trim(),
        vat.trim(),
        contract.trim(),
        contractStart.trim(),
        contractEnd.trim(),
      ]],
    },
  });
}

export async function updateStoreDetails({ originalName, name, phone = '', address = '', vat = '', contract = '', contractStart = '', contractEnd = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:G',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '') === originalName) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex < 0) throw new Error('Store not found');

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Stores!A${rowIndex}:G${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[
        name.trim(),
        phone.trim(),
        address.trim(),
        vat.trim(),
        contract.trim(),
        contractStart.trim(),
        contractEnd.trim(),
      ]],
    },
  });
}

export async function getNotes() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Notes!A:D',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return {};

  // Επιστρέφουμε map: { serialNumber: [ { note, createdAt, createdBy }, ... ] }
  // Κάθε serial έχει array από σημειώσεις (χρονολογική σειρά, νεότερη πρώτη)
  const notesMap = {};
  rows.slice(1).forEach(r => {
    if (!r[0]) return;
    const serial = r[0];
    if (!notesMap[serial]) notesMap[serial] = [];
    notesMap[serial].unshift({
      note:      r[1] || '',
      createdAt: r[2] || '',
      createdBy: r[3] || '',
    });
  });
  return notesMap;
}

export async function saveNote(serialNumber, note, createdBy) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const createdAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });

  // Πάντα προσθέτουμε νέα γραμμή — δεν αντικαθιστούμε ποτέ
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Notes!A:D',
    valueInputOption: 'RAW',
    resource: { values: [[serialNumber, note, createdAt, createdBy]] },
  });
}

// Ενημερώνει το κατάστημα της τελευταίας εγγραφής ενός serial
export async function updateStore(serialNumber, newStore) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });

  const rows = res.data.values || [];

  // Βρίσκουμε την τελευταία γραμμή με αυτό το serial
  let lastRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === serialNumber) lastRowIndex = i + 1; // 1-indexed
  }

  if (lastRowIndex < 0) throw new Error('Serial not found');

  // Ενημερώνουμε μόνο τη στήλη D (store)
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Tracking!D${lastRowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [[newStore]] },
  });
}

export async function updateItemDate(serialNumber, newDate) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
  });

  const rows = res.data.values || [];

  let lastRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === serialNumber) lastRowIndex = i + 1;
  }

  if (lastRowIndex < 0) throw new Error('Serial not found');

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Tracking!E${lastRowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [[newDate]] },
  });
}

// "Ολοκληρωτική διαγραφή": αφαιρεί ΟΛΕΣ τις γραμμές του serial από Tracking, Notes, MachineParts
// Source sheets that get fully wiped on "ολοκληρωτική διαγραφή", with the
// full column range so we can archive the complete row before removing it.
const SOFT_DELETE_TARGETS = [
  { name: 'Tracking',     range: 'Tracking!A:J' },
  { name: 'Notes',        range: 'Notes!A:D' },
  { name: 'MachineParts', range: 'MachineParts!A:G' },
];
const TRASH_HEADERS = ['batchId', 'deletedAt', 'deletedBy', 'serialNumber', 'model', 'sourceSheet', 'rowData'];
const TRASH_RANGE_BY_SOURCE = { Tracking: 'Tracking!A:J', Notes: 'Notes!A:D', MachineParts: 'MachineParts!A:G' };

// "Ολοκληρωτική διαγραφή" → soft delete: αρχειοθετεί κάθε γραμμή στο sheet
// "Trash" (με batchId) και μετά τη σβήνει από τα ενεργά sheets. Επαναφέρσιμο.
export async function deleteItemCompletely(serialNumber, meta = {}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const getSheetId = (name) => {
    const s = sheetMeta.data.sheets.find(sh => sh.properties.title === name);
    return s ? s.properties.sheetId : null;
  };

  const batchId = `${serialNumber}__${Date.now()}`;
  const deletedAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
  const deletedBy = meta.user || '';
  let model = meta.model || '';

  const archiveRows = [];    // πλήρεις γραμμές → Trash
  const deleteRequests = []; // deleteDimension από τα ενεργά sheets

  for (const target of SOFT_DELETE_TARGETS) {
    const sheetId = getSheetId(target.name);
    if (sheetId == null) continue;

    const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: target.range });
    const rows = valRes.data.values || [];

    const matches = [];
    rows.forEach((row, idx) => {
      if (idx === 0) return; // header
      if (row[0] === serialNumber) {
        matches.push({ idx, row });
        if (target.name === 'Tracking' && !model && row[1]) model = row[1];
      }
    });

    // archive σε αρχική σειρά
    matches.forEach(({ row }) => {
      archiveRows.push([batchId, deletedAt, deletedBy, serialNumber, '', target.name, JSON.stringify(row)]);
    });

    // delete descending ώστε να μην μετατοπίζονται τα indices
    matches
      .map(m => m.idx)
      .sort((a, b) => b - a)
      .forEach(rowIdx => {
        deleteRequests.push({
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } },
        });
      });
  }

  if (archiveRows.length === 0) return;

  // συμπληρώνουμε το model τώρα που το ξέρουμε
  archiveRows.forEach(r => { r[4] = model; });

  // 1) Πρώτα αρχειοθέτηση (ποτέ delete χωρίς αντίγραφο)
  await ensureSheetExists(sheets, 'Trash', TRASH_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Trash!A:G',
    valueInputOption: 'RAW',
    resource: { values: archiveRows },
  });

  // 2) Μετά διαγραφή από τα ενεργά sheets
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: deleteRequests },
  });
}

// Λίστα κάδου: γκρουπαρισμένη ανά batchId (μία εγγραφή ανά διαγραφή μηχανήματος)
export async function getTrash() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = await getValuesFromFirstAvailableRange(sheets, ['Trash!A:G']);
  if (rows.length <= 1) return [];

  const byBatch = {};
  rows.slice(1).forEach(r => {
    const batchId = r[0];
    if (!batchId) return;
    if (!byBatch[batchId]) {
      byBatch[batchId] = {
        batchId,
        deletedAt: r[1] || '',
        deletedBy: r[2] || '',
        serialNumber: r[3] || '',
        model: r[4] || '',
        total: 0,
      };
    }
    byBatch[batchId].total += 1;
  });

  // newest first — το batchId τελειώνει σε __<timestamp>
  return Object.values(byBatch).sort((a, b) => {
    const ta = Number(a.batchId.split('__').pop()) || 0;
    const tb = Number(b.batchId.split('__').pop()) || 0;
    return tb - ta;
  });
}

// Επαναφορά: ξανα-γράφει τις αρχειοθετημένες γραμμές στα αρχικά sheets
// και τις αφαιρεί από τον κάδο.
export async function restoreFromTrash(batchId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const trashMeta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const trashSheet = trashMeta.data.sheets.find(s => s.properties.title === 'Trash');
  if (!trashSheet) return;
  const trashSheetId = trashSheet.properties.sheetId;

  const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trash!A:G' });
  const rows = valRes.data.values || [];

  const restoreBySource = {};
  const trashIndices = [];

  rows.forEach((r, idx) => {
    if (idx === 0) return;
    if (r[0] !== batchId) return;
    trashIndices.push(idx);
    const src = r[5];
    const rowData = r[6];
    if (!src || !rowData) return;
    let parsed;
    try { parsed = JSON.parse(rowData); } catch { return; }
    if (!Array.isArray(parsed)) return;
    if (!restoreBySource[src]) restoreBySource[src] = [];
    restoreBySource[src].push(parsed);
  });

  if (trashIndices.length === 0) return;

  // 1) ξανα-append σε κάθε source sheet
  for (const [src, values] of Object.entries(restoreBySource)) {
    if (!values.length) continue;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: TRASH_RANGE_BY_SOURCE[src] || `${src}!A:Z`,
      valueInputOption: 'RAW',
      resource: { values },
    });
  }

  // 2) αφαίρεση από τον κάδο (descending)
  const requests = trashIndices
    .sort((a, b) => b - a)
    .map(rowIdx => ({
      deleteDimension: { range: { sheetId: trashSheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } },
    }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
}

// Οριστική διαγραφή ενός batch από τον κάδο (χωρίς επαναφορά)
export async function purgeTrashItem(batchId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const trashMeta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const trashSheet = trashMeta.data.sheets.find(s => s.properties.title === 'Trash');
  if (!trashSheet) return;
  const trashSheetId = trashSheet.properties.sheetId;

  const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trash!A:A' });
  const rows = valRes.data.values || [];
  const indices = rows
    .map((r, idx) => (idx > 0 && r[0] === batchId ? idx : -1))
    .filter(i => i >= 0)
    .sort((a, b) => b - a);
  if (!indices.length) return;

  const requests = indices.map(rowIdx => ({
    deleteDimension: { range: { sheetId: trashSheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } },
  }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
}

// "Διαγραφή": προσθέτει κίνηση "Διαγράφηκε" — το ιστορικό παραμένει
export async function deleteItem(data) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    data.serialNumber,
    data.model || '',
    'Διαγράφηκε',
    data.store || '',
    new Date().toISOString().split('T')[0],
    '',
    'Διαγράφηκε από την αποθήκη',
    new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
    data.user || '',
    data.category || 'CashDro',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:J',
    valueInputOption: 'RAW',
    resource: { values: [row] },
  });
}

// Διαγραφή μίας συγκεκριμένης κίνησης από το ιστορικό → Κάδος (επαναφέρσιμο).
// Ταυτοποίηση: serialNumber (στήλη A) + timestamp (στήλη H) [+ action αν δοθεί].
// Σβήνει μόνο την πρώτη γραμμή που ταιριάζει, ποτέ περισσότερες.
export async function deleteMovement({ serialNumber, timestamp, action = '', user = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const trackingSheet = meta.data.sheets.find(s => s.properties.title === 'Tracking');
  if (!trackingSheet) return { deleted: false };
  const trackingSheetId = trackingSheet.properties.sheetId;

  const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Tracking!A:J' });
  const rows = valRes.data.values || [];

  let matchIdx = -1;
  let matchRow = null;
  for (let idx = 1; idx < rows.length; idx++) {
    const r = rows[idx];
    if (r[0] !== serialNumber) continue;
    if (r[7] !== timestamp) continue;
    if (action && r[2] !== action) continue;
    matchIdx = idx;
    matchRow = r;
    break;
  }

  if (matchIdx < 0) return { deleted: false };

  const batchId = `${serialNumber}__mov__${Date.now()}`;
  const deletedAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
  const model = matchRow[1] || '';

  // 1) αρχειοθέτηση της γραμμής στο Trash
  await ensureSheetExists(sheets, 'Trash', TRASH_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Trash!A:G',
    valueInputOption: 'RAW',
    resource: { values: [[batchId, deletedAt, user, serialNumber, model, 'Tracking', JSON.stringify(matchRow)]] },
  });

  // 2) διαγραφή της γραμμής από το Tracking
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{
        deleteDimension: { range: { sheetId: trackingSheetId, dimension: 'ROWS', startIndex: matchIdx, endIndex: matchIdx + 1 } },
      }],
    },
  });

  return { deleted: true };
}

// ══════════════════════════════════════════════
// TICKETS (από email)
// Tab: Tickets
// A TicketID | B Status | C ThreadID | D LastMessageID | E From | F Store
// G Subject | H Serial | I Model | J Problem | K Missing | L LastMessage
// M CreatedAt (ISO) | N UpdatedAt (ISO) | O Notes | P UpdatedBy
// Q ContactName | R ContactPhone | S Address | T PostalCode | U IP | V Courier | W StoreRemarks
// ══════════════════════════════════════════════

const TICKETS_SHEET = 'Tickets';
const TICKETS_RANGE = 'Tickets!A:W';
const TICKET_HEADERS = [
  'TicketID', 'Status', 'ThreadID', 'LastMessageID', 'From', 'Store',
  'Subject', 'Serial', 'Model', 'Problem', 'Missing', 'LastMessage',
  'CreatedAt', 'UpdatedAt', 'Notes', 'UpdatedBy',
  'ContactName', 'ContactPhone',
  'Address', 'PostalCode', 'IP', 'Courier', 'StoreRemarks',
];

let ticketsSheetReady = false;

async function ensureTicketsSheet(sheets) {
  if (ticketsSheetReady) return;
  let exists = true;
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${TICKETS_SHEET}!A1:A1`,
    });
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status !== 400 && status !== 404) throw err;
    exists = false;
  }
  if (!exists) {
    await ensureSheetExists(sheets, TICKETS_SHEET, TICKET_HEADERS);
    // Όλα ως κείμενο, ώστε serials/τηλέφωνα να κρατούν τα μηδενικά μπροστά
    await formatSheetColumnsAsText(sheets, TICKETS_SHEET, TICKET_HEADERS.length);
  } else {
    // Παλιό tab με λιγότερες στήλες → συμπληρώνουμε τις επικεφαλίδες που λείπουν
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${TICKETS_SHEET}!1:1`,
    });
    const current = (head.data.values && head.data.values[0]) || [];
    if (current.length < TICKET_HEADERS.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${TICKETS_SHEET}!A1:W1`,
        valueInputOption: 'RAW',
        resource: { values: [TICKET_HEADERS] },
      });
      await formatSheetColumnsAsText(sheets, TICKETS_SHEET, TICKET_HEADERS.length);
    }
  }
  ticketsSheetReady = true;
}

function rowToTicket(r, index) {
  return {
    rowNumber:     index + 2, // +1 για header, +1 επειδή τα Sheets ξεκινούν από 1
    ticketId:      r[0] || '',
    status:        r[1] || '',
    threadId:      r[2] || '',
    lastMessageId: r[3] || '',
    from:          r[4] || '',
    store:         r[5] || '',
    subject:       r[6] || '',
    serialNumber:  r[7] || '',
    model:         r[8] || '',
    problem:       r[9] || '',
    missing:       r[10] || '',
    lastMessage:   r[11] || '',
    createdAt:     r[12] || '',
    updatedAt:     r[13] || '',
    notes:         r[14] || '',
    updatedBy:     r[15] || '',
    contactName:   r[16] || '',
    contactPhone:  r[17] || '',
    address:       r[18] || '',
    postalCode:    r[19] || '',
    ip:            r[20] || '',
    courier:       r[21] || '',
    storeRemarks:  r[22] || '',
  };
}

function ticketToRow(t) {
  return [
    t.ticketId, t.status, t.threadId, t.lastMessageId, t.from, t.store,
    t.subject, t.serialNumber, t.model, t.problem, t.missing, t.lastMessage,
    t.createdAt, t.updatedAt, t.notes, t.updatedBy,
    t.contactName, t.contactPhone,
    t.address, t.postalCode, t.ip, t.courier, t.storeRemarks,
  ].map(v => (v == null ? '' : String(v)));
}

export async function getTickets() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await ensureTicketsSheet(sheets);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: TICKETS_RANGE,
  });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map(rowToTicket).filter(t => t.ticketId);
}

export async function findTicketByThread(threadId) {
  if (!threadId) return null;
  const tickets = await getTickets();
  return tickets.find(t => t.threadId === threadId) || null;
}

export async function createTicket(data) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const existing = await getTickets();

  const maxNum = existing.reduce((max, t) => {
    const n = parseInt(String(t.ticketId).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const ticketId = `TM-${String(maxNum + 1).padStart(4, '0')}`;
  const now = new Date().toISOString();
  const ticket = { ...data, ticketId, createdAt: now, updatedAt: now };

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: TICKETS_RANGE,
    valueInputOption: 'RAW',
    resource: { values: [ticketToRow(ticket)] },
  });
  return ticket;
}

// Αντικαθιστά ολόκληρη τη γραμμή ενός υπάρχοντος ticket
export async function saveTicket(ticket) {
  if (!ticket?.rowNumber) throw new Error('saveTicket: missing rowNumber');
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const updated = { ...ticket, updatedAt: new Date().toISOString() };

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${TICKETS_SHEET}!A${ticket.rowNumber}:W${ticket.rowNumber}`,
    valueInputOption: 'RAW',
    resource: { values: [ticketToRow(updated)] },
  });
  return updated;
}

// Πεδία που μπορούν να αλλάξουν από το UI
const TICKET_EDITABLE = [
  'status', 'notes',
  'store', 'address', 'postalCode', 'contactName', 'contactPhone',
  'problem', 'serialNumber', 'ip', 'courier', 'storeRemarks',
];

// Αλλαγή πεδίων από το UI. requiredKeys: για επανέλεγχο του τι λείπει.
export async function updateTicketFields(ticketId, fields = {}, user = '', requiredKeys = []) {
  const tickets = await getTickets();
  const ticket = tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const changes = {};
  for (const k of TICKET_EDITABLE) {
    if (typeof fields[k] === 'string') changes[k] = fields[k].trim().slice(0, 2000);
  }
  const next = { ...ticket, ...changes };

  // Αν άλλαξαν στοιχεία, ξαναϋπολογίζουμε τι λείπει
  if (requiredKeys.length && Object.keys(changes).some(k => k !== 'status' && k !== 'notes')) {
    const missing = requiredKeys.filter(k => !String(next[k] || '').trim());
    next.missing = missing.join(', ');
    // Αυτόματη αλλαγή κατάστασης μόνο αν δεν την όρισε ρητά ο χρήστης
    if (changes.status === undefined) {
      if (!missing.length && next.status === 'Ελλιπές') next.status = 'Νέο';
      if (missing.length && next.status === 'Νέο') next.status = 'Ελλιπές';
    }
  }
  return saveTicket({ ...next, updatedBy: user });
}

// Οριστική διαγραφή ticket (αφαιρείται η γραμμή από το Sheet)
export async function deleteTicket(ticketId) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const tickets = await getTickets();
  const ticket = tickets.find(t => t.ticketId === ticketId);
  if (!ticket) return false;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets.find(s => s.properties.title === TICKETS_SHEET);
  if (!sheet) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: ticket.rowNumber - 1, // 0-based
            endIndex: ticket.rowNumber,
          },
        },
      }],
    },
  });
  return true;
}
