// ─── Google Sheets — Frontend Service ────────────────────────────────────────
// All calls are proxied through the local Express server (server/).
// The browser NEVER touches the Google Sheets API directly.
//
// Env variable:  VITE_SHEETS_PROXY_URL  (default: http://localhost:3001)
//
// Flow:
//   Push:  App state → POST /api/sheets/push  → Server → Google Sheets
//   Pull:  GET  /api/sheets/pull  → Server → Google Sheets → App state → Firestore

const PROXY = import.meta.env.VITE_SHEETS_PROXY_URL || 'http://localhost:3001';

/* ── Internal fetch helper ── */
async function proxyPost(path, body) {
  const res = await fetch(`${PROXY}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ── Check if the proxy server is reachable ── */
export async function checkServerHealth() {
  try {
    const res = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * PUSH  — App (Firebase) → Google Sheets
 * Writes all transactions + income to the "ExpenseTracker" sheet tab.
 *
 * @param {string}   sheetUrl
 * @param {{ transactions: any[], income: any[] }} data  — live Firestore state
 */
export async function pushToSheet(sheetUrl, data) {
  if (!sheetUrl?.trim()) {
    return { success: false, message: 'No Google Sheet URL configured. Link your sheet first.' };
  }
  try {
    const json = await proxyPost('/api/sheets/push', { sheetUrl, ...data });
    return {
      success: true,
      message: `✅ Synced ${json.rowsWritten} records → "${json.sheetName}" tab`,
    };
  } catch (err) {
    const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch');
    return {
      success: false,
      message: isNetworkError
        ? '❌ Cannot reach sync server. Run: cd server && npm start'
        : `❌ Push failed: ${err.message}`,
    };
  }
}

/**
 * PULL  — Google Sheets → App
 * Reads the first sheet tab, detects income (A/B) and expense pairs dynamically,
 * and returns normalised records for the caller to write to Firestore.
 *
 * @param {string} sheetUrl
 * @returns {{ success: boolean, transactions: any[], income: any[], message: string }}
 */
export async function pullFromSheet(sheetUrl) {
  if (!sheetUrl?.trim()) {
    return { success: false, transactions: [], income: [], message: 'No Google Sheet URL configured.' };
  }
  try {
    const json = await proxyPost('/api/sheets/pull', { sheetUrl });
    return {
      success:      true,
      transactions: json.transactions ?? [],
      income:       json.income       ?? [],
      message:      `✅ Pulled ${json.transactions?.length ?? 0} transactions + ${json.income?.length ?? 0} income entries from "${json.sheetTitle}"`,
    };
  } catch (err) {
    const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch');
    return {
      success:      false,
      transactions: [],
      income:       [],
      message:      isNetworkError
        ? '❌ Cannot reach sync server. Run: cd server && npm start'
        : `❌ Pull failed: ${err.message}`,
    };
  }
}

/**
 * VALIDATE  — check the service account can access the sheet.
 * Returns { success, title, sheets[] } or { success: false, error }.
 */
export async function validateSheet(sheetUrl) {
  if (!sheetUrl?.trim()) return { success: false };
  try {
    return await proxyPost('/api/sheets/validate', { sheetUrl });
  } catch {
    return { success: false };
  }
}
