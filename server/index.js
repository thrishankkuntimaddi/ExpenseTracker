// ─── Google Sheets Proxy — Entry Point ────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import sheetsRouter from './api/sheets.js';
import { requireFirebaseAuth } from './middleware/auth.js';

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── CORS — allow only the frontend origin ── */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ── Body parsing (max 10 MB for large transaction lists) ── */
app.use(express.json({ limit: '10mb' }));

/* ── Health check ── */
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/* ── Rate limit — 30 sheet operations per minute per IP ── */
const sheetsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — slow down.' },
});

/* ── Routes (authenticated: Firebase ID token required) ── */
app.use('/api/sheets', sheetsLimiter, requireFirebaseAuth, sheetsRouter);

/* ── Start ── */
// Bind to localhost by default; set HOST=0.0.0.0 only when deliberately hosting it.
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`✅  Sheets proxy running → http://localhost:${PORT}`);
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY is not set — copy server/.env.example to server/.env and fill it in.');
  }
});
