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
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:I',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] },
  });
}

export async function getInventory() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:I',
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
    range: 'Tracking!A:I',
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
    }))
    .reverse();
}

export async function getHistoryByStore(store) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:I',
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

export async function getStores() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:A',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  // Παραλείπουμε την κεφαλίδα και επιστρέφουμε μόνο τα ονόματα
  return rows.slice(1)
    .map(r => r[0] || '')
    .filter(name => name.trim() !== '');
}

export async function addStore(name) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Stores!A:A',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[name.trim()]] },
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

  // Επιστρέφουμε map: { serialNumber: { note, updatedAt, updatedBy } }
  const notesMap = {};
  rows.slice(1).forEach(r => {
    if (r[0]) {
      notesMap[r[0]] = {
        note:      r[1] || '',
        updatedAt: r[2] || '',
        updatedBy: r[3] || '',
      };
    }
  });
  return notesMap;
}

export async function saveNote(serialNumber, note, updatedBy) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Διαβάζουμε τις υπάρχουσες σημειώσεις για να βρούμε αν υπάρχει ήδη
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Notes!A:D',
  });

  const rows = res.data.values || [];
  const updatedAt = new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' });

  // Ψάχνουμε υπάρχουσα γραμμή για αυτό το serial
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === serialNumber) { rowIndex = i + 1; break; } // +1 γιατί Sheets είναι 1-indexed
  }

  if (rowIndex > 0) {
    // Update υπάρχουσας γραμμής
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Notes!A${rowIndex}:D${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[serialNumber, note, updatedAt, updatedBy]] },
    });
  } else {
    // Νέα γραμμή
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Notes!A:D',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[serialNumber, note, updatedAt, updatedBy]] },
    });
  }
}
