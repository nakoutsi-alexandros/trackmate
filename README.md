# TrackMate 🔍
Σύστημα tracking μηχανημάτων με serial number — φωτογραφία → AI αναγνώριση → Google Sheets

## Τεχνολογίες
- **Next.js** — web app
- **Claude Vision API** — αναγνώριση serial/model από φωτογραφία
- **Google Sheets** — αποθήκευση δεδομένων
- **Vercel** — δωρεάν hosting

---

## Βήμα 1 — Google Sheets setup

1. Πήγαινε στο [sheets.google.com](https://sheets.google.com) και δημιούργησε νέο spreadsheet
2. Μετονόμασε το πρώτο sheet σε `Tracking`
3. Πρόσθεσε headers στην 1η γραμμή:
   `Serial Number | Model | Action | Store | Notes | Date | Previous Store`
4. Αντέγραψε το **Sheet ID** από το URL:
   `https://docs.google.com/spreadsheets/d/**ΑΥΤΟ_ΕΙΝΑΙ_ΤΟ_ID**/edit`

---

## Βήμα 2 — Google Service Account

1. Πήγαινε στο [console.cloud.google.com](https://console.cloud.google.com)
2. Δημιούργησε νέο project (π.χ. "trackmate")
3. Ενεργοποίησε **Google Sheets API**:
   - APIs & Services → Enable APIs → αναζήτησε "Google Sheets API" → Enable
4. Δημιούργησε Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Δώσε οποιοδήποτε όνομα → Create and Continue → Done
5. Κατέβασε JSON key:
   - Πάτα στο service account → Keys → Add Key → Create new key → JSON → Download
6. Μοιράσου το sheet με το service account email (από το JSON, πεδίο `client_email`):
   - Άνοιξε το Google Sheet → Share → βάλε το email → Editor
7. Κωδικοποίησε το JSON σε base64:
   ```bash
   # Linux/Mac:
   base64 -i service-account.json | tr -d '\n'
   # Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
   ```

---

## Βήμα 3 — Deploy στο Vercel

1. Ανέβασε τον κώδικα στο GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/trackmate.git
   git push -u origin main
   ```

2. Πήγαινε στο [vercel.com](https://vercel.com) → New Project → Import από GitHub
3. Πρόσθεσε Environment Variables:
   - `ANTHROPIC_API_KEY` = το API key σου
   - `GOOGLE_SHEET_ID` = το Sheet ID
   - `GOOGLE_SERVICE_ACCOUNT_KEY` = το base64 JSON
4. Deploy!

---

## Χρήση

- **Scan tab**: Ανέβασε φωτογραφία → AI αναγνωρίζει serial/model → επίλεξε action & κατάστημα → Καταχώρηση
- **Απόθεμα tab**: Δες όλα τα μηχανήματα με τρέχουσα κατάσταση
- **Ιστορικό tab**: Γράψε serial number → δες όλες τις κινήσεις

## Προσθήκη καταστημάτων
Επεξεργάσου το αρχείο `pages/index.js` και άλλαξε τη λίστα `STORES` στην αρχή.
