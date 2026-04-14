// ─── Google Sheets Proxy — Entry Point ────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sheetsRouter from './api/sheets.js';

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── CORS — allow only the frontend origin ── */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
}));

/* ── Body parsing (max 10 MB for large transaction lists) ── */
app.use(express.json({ limit: '10mb' }));

/* ── Health check ── */
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/* ── Routes ── */
app.use('/api/sheets', sheetsRouter);

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`✅  Sheets proxy running → http://localhost:${PORT}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY is not set — copy server/.env.example to server/.env and fill it in.');
  }
});
