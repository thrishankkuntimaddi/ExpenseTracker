# ⚡ Expense Tracker — Personal Finance, Reimagined

> **Smart, cloud-synced personal finance tracking with person ledgers, wastage analytics, billing sessions, Google Sheets integration, and a fully responsive offline-capable PWA.**

---

## 📌 Description

**Expense Tracker** is a production-grade personal finance web application built with React + Firebase. It solves the frustrating problem of losing track of where your money goes each month — including money lent to, borrowed from, or spent on behalf of other people.

Unlike basic spreadsheet trackers, this app:

- **Tracks money with people** — lent, borrowed, repaid and gifted amounts roll up into all-time per-person balances.
- **Tracks wastage** at the transaction level — mark any expense as wasted (single-tap) or set a partial waste amount (double-tap), giving you an instant "wastage percentage" of your spending.
- **Manages external/proxy transactions** — record money you spend on behalf of someone else, log the settlement, and track net profit/loss per session.
- Supports **Google Sheets two-way sync** (push all data to a sheet, pull data back), bridged through an authenticated Express proxy so credentials never reach the browser.
- Works as an installable **Progressive Web App (PWA)** that keeps working offline (Firestore IndexedDB cache) and auto-updates on deploy.

---

## 🚀 Live Demo

The app is deployed via **GitHub Pages**:

**🔗 [https://thrishankkuntimaddi.github.io/ExpenseTracker/](https://thrishankkuntimaddi.github.io/ExpenseTracker/)**

> Google Sheets sync needs the Express proxy (`server/`). The deployed build hides the Sheets controls unless it was built with `VITE_SHEETS_PROXY_URL`; every other feature works on the deployed version.

---

## 🔐 Login / Demo Credentials

The app uses **Firebase Email/Password Authentication**. To explore it:

1. Click **"Create account"** on the login screen.
2. Register with any valid email + a password of 6+ characters.
3. All data is private and scoped strictly to your account — `firestore.rules` only lets a signed-in user read/write `users/{their uid}/**`, and validates transaction/income shapes.

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
- Three kinds of inflow: **income**, **borrowed** money, and **repayments received** from people you lent to
- Income is displayed per-period with a live running balance

### 👥 Person Ledgers
- Lent / borrowed / repaid / gifted entries roll up into **all-time per-person balances** (what you owe, what you're owed)

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
- **Import JSON**: restore from a backup — batched writes; records keep their ids, so re-importing never duplicates
- **Import CSV**: RFC-4180 CSV importer (`date, name, amount, type`; quoted fields, `1,200`-style amounts, `DD/MM/YYYY` dates) with stable ids — importing the same file twice is safe
- **Recently Deleted**: deletes move items to a trash (atomically) from which they can be restored
- **Reset All Data**: permanently deletes all transactions, income, billings and trash
- **Theme toggle**: Light and MonoFlow (dark, gold-accented) themes, persisted to Firestore

### 🌙 Theming
- **Light**: clean white UI with indigo/violet accent
- **MonoFlow**: dark background (`#0c0c0c`) with gold accents — FOUC-free via a pre-React inline script

### 📱 Responsive PWA
- **Mobile**: bottom navigation bar with 6 tabs (Today, History, Income, External, Stats, Settings)
- **Desktop** (≥1024px): a unified `DesktopDashboard` with a left-sidebar layout
- Installable as a PWA on iOS and Android (Web App Manifest + Service Worker)
- Service Worker auto-updates on new deploys (`SKIP_WAITING` + `controllerchange` reload)
- Offline-capable: Firestore's persistent IndexedDB cache paints the UI instantly and queues writes while offline (cleared on sign-out)

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
| **Testing** | Vitest (unit tests for finance, date and import logic) |

---

## 📂 Project Structure

```
ExpenseTracker/
├── index.html                  # Entry point — preloader, PWA tags, SW registration
├── vite.config.js              # Vite config (base: /ExpenseTracker/) + SW build-ID stamping
├── firebase.json               # Firebase Firestore rules + indexes config
├── firestore.rules             # Security rules for the WHOLE shared project (see below)
├── firestore.indexes.json      # Composite index definitions
├── scripts/clear-db.mjs        # Maintenance: wipe one user's data (prompts for password)
│
├── src/
│   ├── main.jsx                # React 19 createRoot entry
│   ├── index.css               # Global styles, CSS tokens (light + MonoFlow themes)
│   ├── app/App.jsx             # Root: AuthGate → AuthenticatedApp (mobile/desktop split)
│   │
│   ├── features/
│   │   ├── auth/               # AuthGate, login and sign-up pages
│   │   ├── transactions/       # TodayTab (quick add), HistoryTab (search, wastage, edit)
│   │   ├── income/             # IncomeTab
│   │   ├── external/           # Billing sessions (ExternalTab) + share receipt
│   │   ├── persons/            # Person ledgers
│   │   ├── stats/              # Charts + key metrics
│   │   └── settings/           # Theme, import/export, Google Sheets, account
│   │
│   ├── components/             # DesktopDashboard, modals, PeriodSelector, LoadMonthlyData
│   │
│   ├── hooks/
│   │   ├── useAuth.js               # Auth state (grace period) + sign-out cache wipe
│   │   ├── useFirestoreData.js      # Real-time data + optimistic writes with rollback
│   │   ├── useExternalTransactions.js # Billing sessions (per-session debounced autosave)
│   │   ├── useStats.js              # Memoized wrapper around utils/finance.js
│   │   ├── useTransactions.js       # Period filtering + grouping
│   │   └── useWastage.js            # Tap/double-tap wastage interaction
│   │
│   ├── services/
│   │   ├── firebaseConfig.js   # Public Firebase web config (shared with scripts/)
│   │   ├── firebase.js         # App, Auth, Firestore (persistent cache), optional App Check
│   │   ├── firestore.js        # Firestore CRUD, batched import/reset, atomic trash/restore
│   │   └── googleSheets.js     # Authenticated calls to the Sheets proxy
│   │
│   └── utils/
│       ├── finance.js          # ALL money maths: balances, person debts, settlement matching
│       ├── importHelpers.js    # CSV parser, stable import ids, sheet-record prep
│       ├── dateHelpers.js      # Formatting + local-time date keys
│       ├── periodHelpers.js    # Period filtering (local calendar)
│       ├── typeConfig.js       # Transaction type metadata
│       ├── storage.js          # Theme preference + id generation
│       └── __tests__/          # Vitest unit tests
│
├── public/
│   ├── manifest.json           # PWA Web App Manifest
│   └── sw.js                   # Service Worker (cache name stamped per build)
│
└── server/                     # Google Sheets Proxy (Node.js / Express)
    ├── index.js                # Express entry (CORS, rate limit, auth, /api/sheets/*)
    ├── middleware/auth.js      # Firebase ID-token verification (+ optional UID allow-list)
    ├── api/sheets.js           # Route handlers (push, pull, validate)
    └── services/               # Google Sheets API wrapper (googleapis)
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** ≥ 20.19 (required by Vite 8 / Vitest)
- A **Firebase project** with Firestore and Authentication (Email/Password) enabled
- *(Optional)* A Google Cloud service account with the Sheets API enabled, for the Sheets sync feature

### 1. Clone and install

```bash
git clone https://github.com/thrishankkuntimaddi/ExpenseTracker.git
cd ExpenseTracker
npm install
```

### 2. Configure Firebase

The Firebase web config lives in `src/services/firebaseConfig.js`. These values are public identifiers, not secrets — to use your own project, replace them with the values from Firebase Console → Project Settings → Your apps → SDK setup.

### 3. Deploy Firestore rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project <your-project-id>
```

> ⚠️ **Shared project:** `nistha-passi-core` also hosts other apps. `firestore.rules` is the single source of truth for the *entire* project — add other apps' rules to this file rather than deploying a different rules file from another repo, or you will overwrite them.

### 4. Run locally

```bash
npm run dev      # http://localhost:5173/ExpenseTracker/
npm run lint
npm test         # runs in Asia/Kolkata timezone to exercise local-date edge cases
```

### 5. *(Optional)* Google Sheets proxy

```bash
cd server
cp .env.example .env   # fill in GOOGLE_SERVICE_ACCOUNT_KEY (see comments in the file)
npm install
npm run dev
```

The proxy listens on `127.0.0.1:3001`. Every `/api/sheets/*` call must carry the signed-in user's Firebase ID token (the app sends it automatically) and is rate-limited to 30 requests/minute. The service account needs **no** project IAM role — just share each sheet with its email.

---

## 🔑 Environment Variables

### Frontend (build time, all optional)

| Variable | Description |
|---|---|
| `VITE_SHEETS_PROXY_URL` | URL of the Sheets proxy. In dev it defaults to `http://localhost:3001`; a production build only shows Sheets sync when this is set. |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key. When set, Firebase **App Check** is enabled so only this app can call your backend. Register the key in Firebase Console → App Check, then turn on enforcement for Firestore. |

In CI these come from GitHub repository **variables** of the same name.

### Server (`server/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON of the service-account key, minified to one line |
| `PORT` / `HOST` | Listen port (default `3001`) and interface (default `127.0.0.1`) |
| `FRONTEND_URL` | CORS origin for the frontend (e.g. `http://localhost:5173`) |
| `FIREBASE_PROJECT_ID` | Project whose ID tokens are accepted (default `nistha-passi-core`) |
| `ALLOWED_UIDS` | Optional comma-separated UIDs allowed to use the proxy — recommended if it is reachable by anyone else |

---

## 🧠 How It Works

### Data Flow

```
User action → component → useFirestoreData
    ├─ optimistic setState
    └─ Firestore write ──(rejected)──▶ roll back state + show error banner
                     ──(offline)───▶ queued in IndexedDB, synced on reconnect
Firestore listeners (subscribeToUserData) ─▶ React state
```

### Key Design Decisions

1. **Client ID as document ID** — ids are generated client-side and used as Firestore document ids, so `d.id === txn.id`. Imports derive *deterministic* ids from the row content, so re-imports overwrite instead of duplicating.
2. **Atomic trash** — deleting writes the item to `recently_deleted` and removes the original in one `writeBatch`; restoring is the reverse batch.
3. **Local calendar everywhere** — dates are stored as UTC ISO strings but always bucketed with `localDateKey` / `localMonthKey`, so an entry made at 00:30 IST lands on the right day and month.
4. **Money in paise** — totals are summed as integer paise (`sumAmounts`) and stored amounts are rounded to 2 decimals.
5. **One home for the maths** — `utils/finance.js` holds every balance rule and is unit-tested; the hooks only memoize it.
6. **Full history is loaded on purpose** — person ledgers and the month/year selectors need all-time data, so the app subscribes to every document. The persistent cache keeps this cheap: the first paint comes from disk and reconnects only download changed documents.
7. **Grace period in auth** — `useAuth` waits 800 ms before treating a `null` user as signed out, avoiding false sign-outs during token refresh.
8. **FOUC prevention** — an inline script applies the cached theme before React boots.

---

## 🗃️ Firestore Data Model

```
users/{uid}                         ← { email, settings, createdAt }
  ├── transactions/{id}             ← { name, amount, type, date, month, direction?, wasteAmount?, … }
  ├── income/{id}                   ← { name, amount, type, date, month, isBorrowed?, isRepaymentRec?, … }
  ├── external_transactions/{id}    ← billing session { name, items[], received[], status, net_balance, settlementId?, … }
  └── recently_deleted/{id}         ← { itemType, originalData, deletedAt, … }
```

**Transaction types**: `expense`, `savings`, `person` (with `direction`: lent / borrowed / repaid / repayment / given_gift), `external`
**Income kinds** (see `incomeKind()`): `income`, `borrowed` (`isBorrowed`), `repayment` (`isRepaymentRec`)

`firestore.rules` restricts every path under `users/{uid}` to that user and validates that transaction / income documents have a numeric `amount`, a string `date` and a non-empty `name`.

---

## 🚧 Challenges & Solutions

| Challenge | Solution |
|---|---|
| Shared Firebase project with other apps | One rules file for the whole project; the catch-all for other apps explicitly excludes `users/**` |
| Duplicate records from repeated imports | Deterministic import ids + batched `set()` writes |
| Dates landing on the wrong day near midnight | Local-calendar date keys instead of slicing UTC ISO strings |
| Lost edits in billing autosave | Pending edits are merged per session and flushed on unmount / before close |
| Flash of wrong theme on load | Inline script applies the cached theme before React mounts |
| Service Worker serving stale assets | Cache name stamped with the build ID; `SKIP_WAITING` + `controllerchange` reload |
| Google Sheets credentials in the browser | Calls go through the Express proxy, which verifies Firebase ID tokens; credentials live only in `server/.env` |

---

## 🔮 Future Improvements

- [ ] **Budget Goals**: set monthly spending caps per category and get visual warnings when approaching limits
- [ ] **Recurring Transactions**: auto-log fixed monthly expenses (rent, subscriptions) without manual entry
- [ ] **Multi-currency Support**: record transactions in foreign currencies with exchange rate conversion
- [ ] **Receipt OCR**: upload a photo of a receipt and auto-extract the amount and merchant name
- [ ] **Shared Budgets**: collaborative mode where two users (e.g., partners) share a budget workspace
- [ ] **Native Mobile App**: React Native wrapper for full offline-first, camera, and push notification support
- [ ] **AI Spending Insights**: weekly natural-language summaries ("You spent 23% more on food this week vs. last")
- [ ] **Backend Deployment for Sheets Sync**: host the (already authenticated) Express proxy on a cloud service and build with `VITE_SHEETS_PROXY_URL` so Sheets sync works on the deployed site
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
4. **Lint and test your code**: `npm run lint && npm test`
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
