// ─── Google Sheets Service (Prep Only) ───────────────────────────
// Actual API integration will be routed through /server proxy.
// These stubs exist so the Settings UI can call them safely.

/**
 * Push data to the linked Google Sheet.
 * @param {string} sheetUrl  - The Google Sheets URL from user settings
 * @param {{ transactions: any[], income: any[] }} data
 */
export async function pushToSheet(sheetUrl, data) {
  // TODO: POST to /api/sheets/push with sheetUrl + data
  console.warn("[GoogleSheets] pushToSheet — not yet implemented");
  return { success: false, message: "Coming soon" };
}

/**
 * Pull data from the linked Google Sheet.
 * @param {string} sheetUrl
 */
export async function pullFromSheet(sheetUrl) {
  // TODO: GET /api/sheets/pull?url=sheetUrl
  console.warn("[GoogleSheets] pullFromSheet — not yet implemented");
  return { success: false, message: "Coming soon" };
}
