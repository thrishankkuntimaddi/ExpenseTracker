// ─── Google Sheets proxy routes ───────────────────────────────────────────────
import express from 'express';
import { pushToSheet, pullFromSheet, validateSheet } from '../services/googleSheetsService.js';

const router = express.Router();

/* ── POST /api/sheets/push
   Body: { sheetUrl: string, transactions: [], income: [] }
   Writes everything to a dedicated "ExpenseTracker" tab in the sheet.
────────────────────────────────────────────────────────────────────────────── */
router.post('/push', async (req, res) => {
  try {
    const { sheetUrl, transactions = [], income = [] } = req.body;
    if (!sheetUrl) return res.status(400).json({ success: false, error: 'sheetUrl is required' });

    const result = await pushToSheet(sheetUrl, { transactions, income });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[sheets/push]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ── POST /api/sheets/pull
   Body: { sheetUrl: string }
   Reads the first sheet, detects income (cols A/B) and expense pairs dynamically,
   returns normalised { transactions[], income[] } ready to write to Firestore.
────────────────────────────────────────────────────────────────────────────── */
router.post('/pull', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    if (!sheetUrl) return res.status(400).json({ success: false, error: 'sheetUrl is required' });

    const result = await pullFromSheet(sheetUrl);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[sheets/pull]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ── POST /api/sheets/validate
   Body: { sheetUrl: string }
   Verifies the service account can access the sheet.
────────────────────────────────────────────────────────────────────────────── */
router.post('/validate', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    if (!sheetUrl) return res.status(400).json({ success: false, error: 'sheetUrl is required' });

    const result = await validateSheet(sheetUrl);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[sheets/validate]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
