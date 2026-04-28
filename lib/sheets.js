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
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const row = [
    data.serialNumber,
    data.model,
    data.action,
    data.store,
    data.notes || '',
    new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' }),
    data.previousStore || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Tracking!A:G',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] },
  });
}

export async function getInventory() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Tracking!A:G',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  // Skip header row, get latest status per serial
  const headers = rows[0];
  const data = rows.slice(1).map(r => ({
    serialNumber: r[0] || '',
    model: r[1] || '',
    action: r[2] || '',
    store: r[3] || '',
    notes: r[4] || '',
    date: r[5] || '',
    previousStore: r[6] || '',
  }));

  // Get latest entry per serial number
  const latest = {};
  data.forEach(row => {
    if (row.serialNumber) latest[row.serialNumber] = row;
  });

  return Object.values(latest);
}

export async function getHistory(serialNumber) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Tracking!A:G',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .filter(r => r[0] === serialNumber)
    .map(r => ({
      serialNumber: r[0] || '',
      model: r[1] || '',
      action: r[2] || '',
      store: r[3] || '',
      notes: r[4] || '',
      date: r[5] || '',
      previousStore: r[6] || '',
    }))
    .reverse();
}
