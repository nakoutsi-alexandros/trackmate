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
    range: 'Users!A:D',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map(r => ({
    username: r[0] || '',
    password: r[1] || '',
    fullName: r[2] || '',
    active:   r[3] || '',
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

export async function getMachineParts() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = await getValuesFromFirstAvailableRange(sheets, ['MachineParts!A:F']);
  if (rows.length <= 1) return {};

  const partsMap = {};
  rows.slice(1).forEach(r => {
    if (!r[0]) return;
    const serial = r[0];
    if (!partsMap[serial]) partsMap[serial] = [];
    partsMap[serial].unshift({
      code: r[1] || '',
      description: r[2] || '',
      createdAt: r[3] || '',
      createdBy: r[4] || '',
      machineModel: r[5] || '',
    });
  });
  return partsMap;
}

export async function saveMachinePart({ serialNumber, code, description, createdBy = '', machineModel = '' }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const createdAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });

  await ensureSheetExists(sheets, 'MachineParts', ['serialNumber', 'code', 'description', 'createdAt', 'createdBy', 'machineModel']);
  await formatSheetColumnsAsText(sheets, 'MachineParts', 6);

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'MachineParts!A:F',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [[serialNumber, code, description, createdAt, createdBy, machineModel]] },
  });

  return { code, description, createdAt, createdBy, machineModel };
}

export async function deleteMachinePart({ serialNumber, code, createdAt }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'MachineParts!A:F',
  });

  const rows = valuesRes.data.values || [];
  let rowIndex = rows.findIndex((r, i) => (
    i > 0 && r[0] === serialNumber && r[1] === code && r[3] === createdAt
  ));

  if (rowIndex < 0) {
    rowIndex = rows.findIndex((r, i) => (
      i > 0 && r[0] === serialNumber && r[1] === code
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
export async function deleteItemCompletely(serialNumber) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    fields: 'sheets.properties',
  });

  const getSheetId = (name) => {
    const s = meta.data.sheets.find(sh => sh.properties.title === name);
    return s ? s.properties.sheetId : null;
  };

  const targets = ['Tracking', 'Notes', 'MachineParts'];
  const allRequests = [];

  for (const name of targets) {
    const sheetId = getSheetId(name);
    if (sheetId == null) continue;

    const valRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${name}!A:A`,
    });

    const rows = valRes.data.values || [];
    // collect row indices (0-based) that match, skip header (index 0)
    const toDelete = rows
      .map((row, idx) => (idx > 0 && row[0] === serialNumber ? idx : -1))
      .filter(i => i >= 0)
      .sort((a, b) => b - a); // descending so indices don't shift

    toDelete.forEach(rowIdx => {
      allRequests.push({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
        },
      });
    });
  }

  if (allRequests.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    resource: { requests: allRequests },
  });
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
