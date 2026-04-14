// ─── Express Server Scaffold ─────────────────────────────────────
// Future home of:
//   POST /api/sheets/push  → proxy data → Google Sheets API
//   GET  /api/sheets/pull  → pull rows from Google Sheets
//   POST /api/auth/token   → Firebase Admin SDK token verification
//
// To run: cd server && npm install && node index.js

const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'https://thrishankkuntimaddi.github.io'] }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Google Sheets proxy (stub) ──────────────────────────────────
// Will use googleapis npm package once enabled
app.post('/api/sheets/push', async (req, res) => {
  const { sheetUrl, data } = req.body;
  if (!sheetUrl || !data) return res.status(400).json({ error: 'sheetUrl and data required' });
  // TODO: authenticate via Firebase Admin + Google OAuth
  // TODO: use googleapis to push data to the sheet
  res.json({ success: false, message: 'Not yet implemented' });
});

app.get('/api/sheets/pull', async (req, res) => {
  const { sheetUrl } = req.query;
  if (!sheetUrl) return res.status(400).json({ error: 'sheetUrl required' });
  // TODO: pull rows from Google Sheets
  res.json({ success: false, message: 'Not yet implemented' });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
