// ─── Google Sheets Service — Core Logic ───────────────────────────────────────
// Runs ONLY on the server. Never imported by the React app.
import { google } from 'googleapis';

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════════════════ */

/** Extract the spreadsheet ID from any valid Google Sheets URL. */
function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error(
      'Invalid Google Sheets URL. Expected format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...'
    );
  }
  return match[1];
}

/** Build an authenticated Google Sheets client from the service account env var. */
async function getSheetsClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is not set. Copy server/.env.example to server/.env and fill in your service account key.'
    );
  }
  let credentials;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Ensure the entire key file content is on one line with escaped newlines.'
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** Lightweight unique ID (mirrors the client-side generateId). */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Human-readable column letter from a 0-based index. */
function colLetter(idx) {
  let result = '';
  let n = idx + 1;
  while (n > 0) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/* ════════════════════════════════════════════════════════════════════════════
   DYNAMIC SHEET PARSER (used by pull)

   Sheet layout the user described:
     Income : Column A (name)  + Column B (amount)   — fixed
     Expenses: Dynamic pairs from column D onwards    — detected automatically
               Each pair = (text column, adjacent number column)
               e.g. D/E, F/G, H/I, J/K … and beyond

   Strategy:
   1. Skip any header row (detects by looking for word cells in row 0).
   2. For each data row:
      a. Cols 0 + 1 (A, B) → Income entry if both are non-empty.
      b. From col 3 (D) onwards scan pairs in steps of 2:
         If col[i] is a non-empty string AND col[i+1] parses as a positive number
         → Expense entry.
         This is fully dynamic — adding more pairs to the sheet works automatically.
════════════════════════════════════════════════════════════════════════════ */
function parseSheetData(rawValues) {
  const transactions = [];
  const income       = [];

  if (!rawValues || rawValues.length === 0) return { transactions, income };

  /* Check if first row is a header (contains word-like cells, no large numbers). */
  const firstRow  = rawValues[0] || [];
  const isHeader  = firstRow.some(
    (cell) => typeof cell === 'string' && /name|desc|amount|income|expense|date|category|item|source/i.test(cell)
  );
  const dataRows  = isHeader ? rawValues.slice(1) : rawValues;

  const today     = new Date().toISOString();
  const thisMonth = today.slice(0, 7);

  dataRows.forEach((row) => {
    if (!row || row.length === 0) return;

    /* ── Income: Columns A (0) + B (1) ── */
    const incomeName   = row[0]?.toString().trim();
    const incomeAmount = parseFloat(row[1]);
    if (incomeName && !isNaN(incomeAmount) && incomeAmount > 0) {
      income.push({
        id:     generateId(),
        name:   incomeName,
        amount: incomeAmount,
        type:   'income',
        date:   today,
        month:  thisMonth,
      });
    }

    /* ── Expense pairs: dynamic scan from column D (index 3) ──
       We intentionally do NOT hardcode which columns are pairs.
       Any (text, number) consecutive pair found from col D onwards is added. */
    for (let i = 3; i < row.length - 1; i += 2) {
      const expName   = row[i]?.toString().trim();
      const expAmount = parseFloat(row[i + 1]);
      if (expName && !isNaN(expAmount) && expAmount > 0) {
        transactions.push({
          id:     generateId(),
          name:   expName,
          amount: expAmount,
          type:   'expense',
          date:   today,
          month:  thisMonth,
        });
      }
    }
  });

  return { transactions, income };
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
════════════════════════════════════════════════════════════════════════════ */

/**
 * VALIDATE
 * Confirms the service account can open the sheet and returns its metadata.
 */
export async function validateSheet(sheetUrl) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const sheets        = await getSheetsClient();
  const meta          = await sheets.spreadsheets.get({ spreadsheetId });

  return {
    title:  meta.data.properties.title,
    sheets: meta.data.sheets.map((s) => s.properties.title),
  };
}

/**
 * PULL   (Google Sheets → App)
 * Reads the FIRST sheet tab, applies dynamic column detection, and returns
 * normalised { transactions[], income[] } ready to be written to Firestore.
 */
export async function pullFromSheet(sheetUrl) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const sheets        = await getSheetsClient();

  /* Get spreadsheet metadata → first sheet title */
  const meta       = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitle = meta.data.sheets[0].properties.title;

  /* Determine the actual data range (up to column Z, 5000 rows) */
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:            `${sheetTitle}!A1:Z5000`,
    valueRenderOption: 'UNFORMATTED_VALUE',   // numbers as numbers, not strings
  });

  const rawValues             = response.data.values || [];
  const { transactions, income } = parseSheetData(rawValues);

  return {
    transactions,
    income,
    sheetTitle,
    rowsRead: rawValues.length,
  };
}

/**
 * PUSH   (App → Google Sheets)
 * Writes all app data to a dedicated "ExpenseTracker" tab (created if missing).
 * The user's original sheet data is NEVER touched — we only write to our own tab.
 *
 * Output columns: Date | Name | Amount | Type | Settlement | Waste
 */
export async function pushToSheet(sheetUrl, { transactions = [], income = [] }) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const sheets        = await getSheetsClient();
  const TARGET_SHEET  = 'ExpenseTracker';

  /* ── Ensure the "ExpenseTracker" tab exists ── */
  const meta           = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = meta.data.sheets.map((s) => s.properties.title);

  if (!existingTitles.includes(TARGET_SHEET)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TARGET_SHEET } } }],
      },
    });
  }

  /* ── Build rows ── */
  const header = [['Date', 'Name', 'Amount', 'Type', 'Settlement', 'Waste/Notes']];

  const txnRows = transactions.map((t) => [
    new Date(t.date).toLocaleDateString('en-IN'),
    t.name,
    t.amount,
    t.type,
    t.settlement != null ? t.settlement : '',
    t.wasteAmount   ? `Waste: ${t.wasteAmount}` : '',
  ]);

  const incomeRows = income.map((i) => [
    new Date(i.date).toLocaleDateString('en-IN'),
    i.name,
    i.amount,
    'income',
    '',
    '',
  ]);

  const allRows = [...header, ...txnRows, ...incomeRows];

  /* ── Clear existing data, then write ── */
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${TARGET_SHEET}!A:Z`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range:            `${TARGET_SHEET}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody:      { values: allRows },
  });

  /* ── Auto-resize columns ── */
  const sheetId = meta.data.sheets.find((s) => s.properties.title === TARGET_SHEET)
    ?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension:  'COLUMNS',
            startIndex: 0,
            endIndex:   6,
          },
        },
      }],
    },
  }).catch(() => { /* non-critical — ignore if it fails */ });

  return {
    rowsWritten: allRows.length - 1,   // exclude header
    sheetName:   TARGET_SHEET,
    spreadsheetId,
  };
}
