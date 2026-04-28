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
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:H',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] },
  });
}

export async function getInventory() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:H',
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
  }));

  // Latest entry per serial
  const latest = {};
  data.forEach(row => { if (row.serialNumber) latest[row.serialNumber] = row; });
  return Object.values(latest);
}

export async function getHistory(serialNumber) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Tracking!A:H',
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
    }))
    .reverse();
}
