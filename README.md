# ⚡ Expense Tracker — Personal Finance, Reimagined

> **Smart, cloud-synced personal finance tracking with month-to-month carry-forward rollover, wastage analytics, Google Sheets integration, and a fully responsive PWA experience.**

---

## 📌 Description

**Expense Tracker** is a production-grade personal finance web application built with React + Firebase. It solves the frustrating problem of losing track of where your money goes each month — and critically, what happens to the leftover balance when a new month begins.

Unlike basic spreadsheet trackers, this app:

- **Automatically carries forward** positive or negative closing balances from any past month into the next, using atomic Firestore transactions — so your financial history is always accurate, even if you miss a month.
- **Tracks wastage** at the transaction level — mark any expense as wasted (single-tap) or set a partial waste amount (double-tap), giving you an instant "wastage percentage" of your spending.
- **Manages external/proxy transactions** — record money you spend on behalf of someone else, log the settlement, and track net profit/loss per session.
- Supports **Google Sheets two-way sync** (push all data to a sheet, pull data back), bridged through a local Express proxy so credentials never reach the browser.
- Works as an installable **Progressive Web App (PWA)** with offline caching and a service worker that auto-updates on deploy.

---

## 🚀 Live Demo

The app is deployed via **GitHub Pages**:

**🔗 [https://thrishankkuntimaddi.github.io/ExpenseTracker/](https://thrishankkuntimaddi.github.io/ExpenseTracker/)**

> The Google Sheets sync feature requires the local Express proxy server (`server/`) to be running. All other features (transactions, income, stats, external, settings) are fully functional on the deployed version.

---

## 🔐 Login / Demo Credentials

The app uses **Firebase Email/Password Authentication**. To explore it:

1. Click **"Create account"** on the login screen.
2. Register with any valid email + a password of 6+ characters.
3. All data is private and scoped strictly to your account (Firestore rules enforce `uid` isolation).

> There are no shared demo credentials — every user gets their own isolated data space.

---

## 🧩 Features

### 💸 Transaction Management
- Add **Expense**, **Savings** (personal savings deposits), and **Person** (money given to someone) entries
- Full transaction history with **search, filter by type, and period selector** (Today / This Week / This Month / custom)
- Edit and delete any past transaction with optimistic UI updates
- Keyboard-first form: press `Enter` to jump between fields and save

### 📥 Income Management
- Log multiple income sources per month (salary, freelance, dividends, etc.)
- Income is displayed per-month with a live running balance
- **Month locking**: once a month is "closed" by the rollover engine, it shows a locked badge

### 🔄 Automatic Monthly Carry-Forward Rollover
- On every login, the **rollover engine** (`useRollover`) bootstraps missing month summaries, identifies all unclosed past months, and processes them sequentially using atomic Firestore transactions
- **Positive closing balance** → a `carry_forward` income entry is created in the next month
- **Negative closing balance** → a `carry_forward_deficit` expense entry is created
- Fully **idempotent**: the deterministic document ID (`cf_{fromMonth}_{toMonth}`) means re-running is safe with zero side effects

### 🔗 External / Proxy Transactions
- Record transactions where you pay on behalf of a client/person (e.g., buying materials for a freelance job)
- Log the **settlement amount** received back and a source label (client/project name)
- Net profit/loss is calculated and displayed in real-time as you type
- Full session management: open, track, close, and view closed sessions in separate tabs
- External sessions are stored in a dedicated `external_transactions` Firestore sub-collection

### 🗑️ Wastage Tracking
- **Single-tap** any expense in History to toggle it as 100% wasted
- **Double-tap** to enter a custom partial waste amount
- The Stats tab shows **total waste** and **waste as % of total spending**

### 📊 Stats & Analytics
- **Pie chart**: breakdown of Expense vs. Savings vs. Given (money given to others)
- **Bar chart**: last 14 days of daily Expense + Savings
- **Area chart**: 6-month Income vs. Expense trend
- Key metrics: total income, total expense, total savings, total given, net balance, average daily/weekly/monthly spend, and wastage percentage

### 📤 Google Sheets Two-Way Sync
- **Push**: writes all Firestore transactions + income to an `ExpenseTracker` tab in your linked Google Sheet
- **Pull**: reads from your sheet (income from columns A/B, expense pairs from D/E, F/G, etc.) and saves records to Firestore
- All API calls are proxied through a local Express server — **your service account key never touches the browser**
- Live server-health indicator in Settings (green dot = online, red = offline with run command shown)

### ⚙️ Settings & Data Management
- **Export**: download full JSON backup of all transactions, income, and settings
- **Import JSON**: restore from a backup — writes directly to Firestore
- **Import CSV**: flexible CSV importer (`date, name, amount, type`) — maps income/expense/savings/person types
- **Migrate localStorage → Cloud**: one-click migration for users who used the previous localStorage-only version
- **Reset All Data**: permanently deletes all Firestore documents + clears local cache
- **Theme toggle**: Light and MonoFlow (dark, gold-accented) themes, persisted to Firestore

### 🌙 Theming
- **Light**: clean white UI with indigo/violet accent
- **MonoFlow**: dark background (`#0c0c0c`) with gold accents — FOUC-free via a pre-React inline script

### 📱 Responsive PWA
- **Mobile**: bottom navigation bar with 6 tabs (Today, History, Income, External, Stats, Settings)
- **Desktop** (≥1024px): a unified `DesktopDashboard` with a left-sidebar layout
- Installable as a PWA on iOS and Android (Web App Manifest + Service Worker)
- Service Worker auto-updates on new deploys (`SKIP_WAITING` + `controllerchange` reload)
- Offline-capable: localStorage cache seeds the UI instantly while Firestore loads

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 8 |
| **Backend / Database** | Firebase Firestore (NoSQL, real-time) |
| **Authentication** | Firebase Auth (Email/Password) |
| **Charts** | Recharts 3 |
| **Icons** | Lucide React |
| **Fonts** | Inter (Google Fonts) |
| **CSS** | Vanilla CSS with CSS Custom Properties (design tokens) |
| **PWA** | Web App Manifest + custom Service Worker |
| **Google Sheets Proxy** | Node.js + Express + `googleapis` |
| **Build Tool** | Vite (base path `/ExpenseTracker/`) |
| **Deployment** | GitHub Pages |
| **Linting** | ESLint 9 (flat config) |

---

## 📂 Project Structure

```
ExpenseTracker/
├── index.html                  # Entry point — preloader, PWA tags, SW registration
├── vite.config.js              # Vite config (base: /ExpenseTracker/)
├── firebase.json               # Firebase Firestore rules + indexes config
├── firestore.rules             # Security rules (strict uid-scoped access)
├── firestore.indexes.json      # Composite index definitions
│
├── src/
│   ├── main.jsx                # React 19 createRoot entry
│   ├── index.css               # Global styles, CSS tokens (light + MonoFlow themes)
│   │
│   ├── app/
│   │   └── App.jsx             # Root: AuthGate → AuthenticatedApp (mobile/desktop split)
│   │
│   ├── features/
│   │   ├── auth/               # AuthGate — login/register form with Firebase Auth
│   │   ├── transactions/
│   │   │   ├── TodayTab.jsx    # Quick-add form + today's entry list
│   │   │   └── HistoryTab.jsx  # Full history with search, filter, wastage, edit/delete
│   │   ├── income/
│   │   │   └── IncomeTab.jsx   # Income log with month grouping + lock indicators
│   │   ├── external/
│   │   │   └── ExternalTab.jsx # Proxy/billing session manager (open/closed sessions)
│   │   ├── stats/
│   │   │   └── StatsTab.jsx    # Analytics: pie, bar, area charts + key metrics
│   │   └── settings/
│   │       └── SettingsTab.jsx # Theme, data management, Google Sheets, account
│   │
│   ├── components/
│   │   ├── DesktopDashboard.jsx # Full desktop unified layout
│   │   ├── LoadMonthlyData.jsx  # Month-selector aware data loader
│   │   └── PeriodSelector.jsx   # Period filter UI component
│   │
│   ├── hooks/
│   │   ├── useAuth.js           # Firebase Auth state with grace-period guard
│   │   ├── useFirestoreData.js  # Real-time Firestore CRUD with optimistic UI
│   │   ├── useRollover.js       # Monthly carry-forward rollover engine
│   │   ├── useStats.js          # Financial KPIs + chart data (memoized)
│   │   ├── useTransactions.js   # Transaction-specific derived state
│   │   ├── useExternalTransactions.js # External sessions Firestore hook
│   │   └── useWastage.js        # Tap/double-tap wastage interaction logic
│   │
│   ├── services/
│   │   ├── firebase.js          # Firebase app + auth + db initialization
│   │   ├── firestore.js         # All Firestore CRUD + rollover transactions
│   │   └── googleSheets.js      # Push/pull/validate via proxy server
│   │
│   └── utils/
│       ├── typeConfig.js        # Single source of truth for transaction types
│       ├── periodHelpers.js     # Period filtering + default period logic
│       ├── dateHelpers.js       # Date formatting utilities
│       ├── storage.js           # localStorage cache helpers
│       └── balanceHelpers.js    # Balance computation utilities
│
├── public/
│   ├── manifest.json           # PWA Web App Manifest
│   ├── sw.js                   # Service Worker (caching + SKIP_WAITING)
│   ├── favicon.svg             # SVG favicon
│   └── icon-512.png            # PWA icon
│
└── server/                     # Google Sheets Proxy (Node.js / Express)
    ├── index.js                # Express server entry (CORS, health, /api/sheets/*)
    ├── .env.example            # Environment variable template
    ├── api/                    # Route handlers (push, pull, validate)
    └── services/               # Google Sheets API wrapper (googleapis)
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** ≥ 18
- A **Firebase project** with Firestore and Authentication (Email/Password) enabled
- *(Optional)* A Google Cloud service account with the Sheets API enabled, for the Sheets sync feature

---

### 1. Clone the Repository

```bash
git clone https://github.com/thrishankkuntimaddi/ExpenseTracker.git
cd ExpenseTracker
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Configure Firebase

Create a `.env` file in the project root (copy from `.env.example` if present, or create it):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

These values are found in your Firebase Console → Project Settings → Your apps → SDK setup.

### 4. Deploy Firestore Rules & Indexes

```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools
firebase login

# Deploy rules and indexes
firebase deploy --only firestore
```

### 5. Run the Frontend Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173/ExpenseTracker/`.

### 6. *(Optional)* Set Up the Google Sheets Proxy

```bash
cd server
cp .env.example .env
# → Fill in GOOGLE_SERVICE_ACCOUNT_KEY, PORT, FRONTEND_URL
npm install
npm run dev   # or: npm start
```

The proxy runs on `http://localhost:3001` by default. The frontend reads `VITE_SHEETS_PROXY_URL` (defaults to `http://localhost:3001`).

---

## 🔑 Environment Variables

### Frontend (`/.env`)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (`project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket (if used) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_SHEETS_PROXY_URL` | *(Optional)* URL of the Sheets proxy server (default: `http://localhost:3001`) |

### Server (`/server/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The full JSON content of the GCP service account key, minified to a single line |
| `PORT` | Port for the Express proxy server (default: `3001`) |
| `FRONTEND_URL` | CORS origin for the frontend (e.g., `http://localhost:5173`) |

---

## 🧠 How It Works

### Data Flow

```
User Action
    │
    ▼
React Component (e.g., TodayTab)
    │
    ▼
useFirestoreData hook
    │   ├─ Optimistic UI update (setState immediately)
    │   └─ Firestore write (addTransaction / updateTransaction / deleteTransaction)
    │           │
    │           └─ On error: rollback state (remove optimistic entry)
    ▼
Firestore real-time listener (subscribeToUserData)
    │
    └─ Fires onData → React state updated → localStorage cache written
```

### Key Design Decisions

1. **Client ID as Firestore Document ID**: Transaction IDs are generated client-side (`generateId()`) and used directly as Firestore document IDs. This means `d.id === txn.id` — no extra `_clientId` mapping needed.

2. **Grace Period in Auth**: `useAuth` holds off marking the user as signed-out for 800ms after Firebase emits `null`, preventing false sign-outs during token refresh.

3. **Rollover Atomicity**: The carry-forward engine uses `runTransaction()` with an idempotency guard (`rollover_processed === true` check) inside a deterministic document ID scheme. Even if the engine runs twice, the result is identical.

4. **Monthly Summary as Source of Truth**: Every mutation (add/update/delete transaction or income) triggers an `upsertMonthlySummary` call for the affected month, keeping `total_income`, `total_expense`, and `closing_balance` perpetually current without a full recalculation scan.

5. **FOUC Prevention**: A tiny inline `<script>` before React boots reads the theme from localStorage and sets `data-theme` on `<html>` and `background-color` on `<body>`, so there's never a flash of unstyled (wrong-theme) content.

6. **Google Sheets Security**: The frontend `googleSheets.js` never calls the Google Sheets API directly. All calls go to the local Express proxy which holds the service account credentials securely in environment variables.

---

## 🗃️ Firestore Data Model

```
users/{uid}                         ← User document (email, settings, createdAt)
  ├── transactions/{txnId}          ← { name, amount, type, date, month, wasteAmount?, updatedAt }
  ├── income/{incId}                ← { name, amount, type, date, month, updatedAt }
  ├── external_transactions/{id}    ← { name, amount, settlement, status, date, externalSource?, updatedAt }
  └── monthly_summaries/{YYYY-MM}   ← { total_income, total_expense, closing_balance, is_closed, rollover_processed }
```

**Transaction types**: `expense`, `savings`, `person`, `external`, `carry_forward_deficit`  
**Income types**: `income`, `carry_forward`

---

## 🚧 Challenges & Solutions

| Challenge | Solution |
|---|---|
| Month-to-month carry-forward without a backend function | Client-side rollover engine using Firestore `runTransaction()` with idempotency guards and deterministic document IDs |
| Flash of unstyled content (wrong theme on load) | Inline `<script>` before React hydrates reads theme from localStorage and applies `data-theme` immediately |
| False sign-out during Firebase token refresh | 800ms grace-period timer in `useAuth` before committing `user = null` |
| Service Worker causing blank screen on deploy | SW uses `SKIP_WAITING` + `controllerchange` listener to reload when a new SW activates, flushing stale asset references |
| Google Sheets credentials in the browser | All API calls proxied through a local Express server; credentials live only in `server/.env` |
| Optimistic UI with Firestore rollback | `addTransaction` updates state immediately, then on Firestore error, filters out the optimistic entry |
| Concurrent rollover runs (React StrictMode) | `runningRef` and `doneRef` flags prevent duplicate or concurrent execution |

---

## 🔮 Future Improvements

- [ ] **Budget Goals**: set monthly spending caps per category and get visual warnings when approaching limits
- [ ] **Recurring Transactions**: auto-log fixed monthly expenses (rent, subscriptions) without manual entry
- [ ] **Multi-currency Support**: record transactions in foreign currencies with exchange rate conversion
- [ ] **Receipt OCR**: upload a photo of a receipt and auto-extract the amount and merchant name
- [ ] **Shared Budgets**: collaborative mode where two users (e.g., partners) share a budget workspace
- [ ] **Native Mobile App**: React Native wrapper for full offline-first, camera, and push notification support
- [ ] **AI Spending Insights**: weekly natural-language summaries ("You spent 23% more on food this week vs. last")
- [ ] **Backend Deployment for Sheets Sync**: deploy the Express proxy to a cloud service (Railway, Render, Fly.io) so the Sheets sync works without running a local server
- [ ] **CSV Export**: in addition to JSON export, allow downloading data as a spreadsheet-compatible `.csv`

---

## 📸 UI Overview

| Screen | Description |
|---|---|
| **Today Tab** | Quick-add form with type selector (Expense / Person / Savings) + today's entries list with live totals |
| **History Tab** | Full transaction log with search, period filter, inline wastage marking, swipe-to-delete, and edit modal |
| **Income Tab** | Month-grouped income entries with lock badges for closed months; add income with category |
| **External Tab** | Proxy session manager — open sessions with amount paid + settlement; closed session ledger |
| **Stats Tab** | Pie, 14-day bar, and 6-month area charts + KPI cards (balance, waste %, averages) |
| **Settings Tab** | Theme toggle, export/import (JSON + CSV), Google Sheets link + push/pull, account sign-out |
| **Desktop Dashboard** | Unified sidebar layout showing Today + History + Stats simultaneously |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Make your changes** and ensure the app builds: `npm run build`
4. **Lint your code**: `npm run lint`
5. **Commit with a descriptive message**: `git commit -m "feat: add recurring transactions"`
6. **Push** to your fork: `git push origin feature/my-feature`
7. **Open a Pull Request** against `main`

### Guidelines
- Keep components focused and extract shared logic into hooks
- Add new transaction types to `src/utils/typeConfig.js` — do not define them locally in components
- All Firestore mutations should go through `useFirestoreData` to maintain optimistic UI consistency
- Do not commit `.env` files or `server/.env`

---

## 📜 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Thrishank Kuntimaddi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">
  <strong>Built with ⚡ React · Firebase · Recharts · Vite</strong><br/>
  <em>Personal finance that actually follows you month to month.</em>
</div>
