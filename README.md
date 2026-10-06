# ⚡ Expense Tracker — Personal Finance, Reimagined

> **Smart, cloud-synced personal finance tracking with auto-categorised spending, monthly budgets with a daily "safe to spend", recurring entries, savings goals, plain-language insights, person ledgers, wastage analytics, billing sessions, Google Sheets integration, and a fully responsive offline-capable PWA.**

---

## 📌 Description

**Expense Tracker** is a production-grade personal finance web application built with React + Firebase. It solves the frustrating problem of losing track of where your money goes each month — including money lent to, borrowed from, or spent on behalf of other people.

Unlike basic spreadsheet trackers, this app:

- **Categorises spending automatically** — "Swiggy", "petrol", "Netflix" are tagged Food / Fuel / Subscriptions as you type, using an India-aware keyword engine. Override once and it remembers.
- **Budgets with pace, not just a cap** — a monthly limit (optionally per category) gives you a *safe-to-spend-today* number, a projected month end, and warnings when the run-rate will overshoot.
- **Logs recurring entries for you** — rent, EMIs, SIPs, salary and subscriptions post on schedule, either silently or with a one-tap confirm.
- **Explains your month in plain language** — an offline insights engine surfaces things like "Food is up 32% vs this time last month" and "5 no-spend days".
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
- **Quick entry**: type `chai 20` (or `250 swiggy`) in the description and press `Enter` — name and amount are split and saved in one go
- Full transaction history with **search, type and category filters**, and a period selector (This Month / Select Month / Year / Last 3 Months / Custom)
- Edit and delete any past transaction with optimistic UI updates
- Keyboard-first form: press `Enter` to jump between fields and save

### 🏷️ Smart Categories
- 16 spending categories (Food & Dining, Groceries, Transport, Fuel, Shopping, Bills & Utilities, Rent & Home, Health, Entertainment, Subscriptions, Education, Travel, Personal Care, Gifts & Donations, Family, Other)
- The category is **inferred from the description** with an India-aware keyword list (Swiggy, Zomato, Blinkit, Rapido, IRCTC, BESCOM, Jio, D-Mart, PVR …) — the suggestion is marked ✦ and can be overridden with one tap
- Overrides are **learned** (`settings.categoryRules`), so the next identical name is tagged your way; picking the inferred category again forgets the rule
- Older, untagged entries are categorised on the fly, so analytics cover your whole history without a migration
- Category breakdown bars on Stats and the desktop dashboard; category chips filter History

### 🎯 Monthly Budget
- Set a **total monthly cap** and/or **per-category caps** (Plan tab, or the pencil on any budget card); *Suggest from history* pre-fills them from your last three months
- Every budget bar carries a **pace marker** showing where the month is today, so "40% spent at 60% of the month" reads at a glance
- **Safe to spend today** — what's left, spread over the remaining days — shown on the Expenses tab header, Stats and the dashboard
- Status: on track · pace too fast (projected to exceed) · nearly spent (≥85%) · over budget, with a projected month-end figure

### 🔁 Recurring Entries
- Rules for **expenses, savings or income** that repeat daily / weekly / monthly / yearly (day-of-month clamps to short months: the 31st becomes the 28th in February)
- **Auto-post** rules are logged silently on their due date when you open the app; **ask-me** rules show a *Log / Skip* card on the Expenses tab, dashboard and Plan tab — handy when the amount varies
- Posted occurrences use a **deterministic id** (`rec_<rule>_<date>`), so two devices or a retry can never double-log
- Pause / resume, end dates, "next on …", and a monthly committed total ("₹18,649/mo goes to recurring expenses")

### 🏁 Savings Goals
- Goals (emergency fund, a trip, a laptop) with a target, optional deadline and a start date
- Progress is **derived from your savings entries** — optionally only one savings type (SIP, Mutual Fund …) or entries matching a keyword — so there is nothing to log twice
- Shows ₹/month needed to hit the deadline, on-track / behind-pace, or an ETA at the current rate

### 💡 Insights
- A rule-based, fully offline engine turns the ledger into short observations for the current month: month-to-date vs the same point last month, projected month end, biggest category and sharp category jumps, most frequent merchant, no-spend days, this week vs last, weekend vs weekday, wastage, savings rate, biggest single expense, money still owed to you, budget alerts and recurring commitments
- Sorted by what matters most (budget overruns first); shown on Stats and the dashboard

### 📅 Spending Calendar
- A month heat-map — each day shaded by how much was spent; tap a day for its entries, browse earlier months, and see no-spend days and the peak day at a glance

### 📥 Income Management
- Log multiple income sources per month (salary, freelance, dividends, etc.)
- Three kinds of inflow: **income**, **borrowed** money, and **repayments received** from people you lent to
- Income is displayed per-period with a live running balance

### ↪ Month Carry Forward
- From a start month (default **November 2026**), whatever was left at the end of a month appears as an **auto** income line in the next: "Carried forward from October 2026"
- The chain is cumulative — November's remainder (which already includes October's carry) rolls into December
- Nothing is stored: the line is recomputed from the ledger on every render, so a late edit to October corrects November automatically. It cannot be edited or deleted, only switched off
- Settings → *Month Carry Forward*: toggle on/off, pick the first month that receives a carry, and choose whether a **deficit** (negative leftover) is carried too (off by default — an overspent month simply carries nothing)
- Counted in that month's total income, remaining balance and the 6-month trend; **not** counted by budgets or the savings-rate insight, which look at real spending and earned income

### 👥 Person Ledgers
- Lent / borrowed / repaid / gifted entries roll up into **all-time per-person balances** (what you owe, what you're owed)

### 🔗 External / Proxy Transactions
- Record transactions where you pay on behalf of a client/person (e.g., buying materials for a freelance job)
- Log the **settlement amount** received back and a source label (client/project name)
- Net profit/loss is calculated and displayed in real-time as you type
- Full session management: open, track, close, and view closed sessions in separate tabs
- External sessions are stored in a dedicated `external_transactions` Firestore sub-collection

### 🧳 Trips & Splits (group expenses)
- Inside **Billings**, switch to *Trips & Splits*: add the people on a trip, log who paid for what, and choose whether each expense is split among everyone or a subset
- **Pay as one wallet**: mark two people as "pays with" each other (a couple, a family) and their spending and dues are combined
- Live **who-pays-whom plan** with the minimum number of transfers ("Dev pays Arjun ₹2,400"), per-person paid vs share, and what is still outstanding; tap **Paid** to record a settlement and the plan shrinks
- **Share** a WhatsApp-ready text summary; **Close** the trip to lock it and, in one step, log *your* share as a Travel expense and record what others still owe you as Lent (or what you owe as Borrowed) in your own ledger. Reopening removes those entries again
- Trips live in `users/{uid}/trips`, bounded by the Firestore rules

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
- **Export JSON**: download a full backup of all transactions, income, and settings (budgets, goals, category rules included)
- **Export CSV**: a spreadsheet with categories that the app's own CSV importer accepts — round-trips cleanly
- **Import JSON**: restore from a backup — batched writes; records keep their ids, so re-importing never duplicates
- **Import CSV**: RFC-4180 CSV importer (`date, name, amount, type`; quoted fields, `1,200`-style amounts, `DD/MM/YYYY` dates) with stable ids — importing the same file twice is safe
- **Recently Deleted**: deletes move items to a trash (atomically) from which they can be restored
- **Reset All Data**: permanently deletes all transactions, income, billings and trash
- **Theme toggle**: Light and MonoFlow (dark, gold-accented) themes, persisted to Firestore

### 🌙 Theming
- **Light**: clean white UI with indigo/violet accent
- **MonoFlow**: dark background (`#0c0c0c`) with gold accents — FOUC-free via a pre-React inline script

### 📱 Responsive PWA
- **Mobile**: a five-slot bottom bar (Expenses, History, Income, Stats, More). Plan, Billings and Settings live behind **More**, which shows a badge when recurring entries are waiting. **Swipe left or right** anywhere to move between all seven pages; the bar's last slot takes the name and icon of whichever More page you are on. Swipes are ignored inside chip rows, wide charts and dialogs, and near the screen edges so the OS back gesture keeps working
- **Desktop** (≥1024px): a unified `DesktopDashboard` with Dashboard / History / Billings / People / Plan / Settings sections and a planning row (insights · budget · categories · calendar)
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
| **Testing** | Vitest (unit tests for finance, categories, budget, recurring, insights, goals, dates and import/export; server-render smoke tests for every screen) |

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
│   │   ├── transactions/       # TodayTab (quick add, safe-to-spend, due recurring), HistoryTab (search, filters, wastage, edit)
│   │   ├── income/             # IncomeTab
│   │   ├── external/           # Billing sessions (ExternalTab) + share receipt, Billings ⇄ Trips switch
│   │   ├── trips/              # Trips & Splits: members, expenses, settle-up plan, close → ledger
│   │   ├── persons/            # Person ledgers
│   │   ├── plan/               # PlanTab: budget editor, recurring rules, savings goals (+ reusable cards)
│   │   ├── stats/              # Charts, key metrics, InsightsCard, CategoryBreakdown, SpendingCalendar
│   │   └── settings/           # Theme, import/export (JSON + CSV), Google Sheets, account
│   │
│   ├── components/             # DesktopDashboard, modals, CategoryPicker, ModalShell, PeriodSelector, LoadMonthlyData
│   │
│   ├── hooks/
│   │   ├── useAuth.js               # Auth state (grace period) + sign-out cache wipe
│   │   ├── useFirestoreData.js      # Real-time data + optimistic writes with rollback (+ patchSettings)
│   │   ├── useRecurring.js          # Recurring rules, due occurrences, auto-post, post/skip
│   │   ├── useExternalTransactions.js # Billing sessions (per-session debounced autosave)
│   │   ├── useStats.js              # Memoized wrapper around utils/finance.js
│   │   ├── useTransactions.js       # Period filtering + grouping (+ optional predicate)
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
│       ├── categories.js       # Category list, keyword inference, learned rules, per-category totals
│       ├── split.js            # Trip splitting: shares, pay-groups as one wallet, minimal who-pays-whom transfers
│       ├── carryForward.js     # Month-to-month leftover chain → synthetic "carried forward" income lines
│       ├── budget.js           # Budget status: spent vs limit, pace, projection, safe-to-spend-today
│       ├── recurring.js        # Occurrence generation, due/next, deterministic ids, entry builder
│       ├── goals.js            # Savings-goal progress, needed-per-month, ETA
│       ├── insights.js         # Rule-based insights engine (pure, offline)
│       ├── smartInput.js       # "chai 20" quick-entry parsing
│       ├── exportHelpers.js    # CSV export (round-trips through importHelpers)
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

```bash
cp .env.example .env     # then fill in VITE_FIREBASE_* from Firebase Console → Project settings → Your apps
```

The config is read from `VITE_FIREBASE_*` (see `src/services/firebaseConfig.js`). For the GitHub Pages deploy, give it to the build **one** of two ways:

1. **Repository variables** (keeps the key out of git): repo *Settings → Secrets and variables → Actions*, add the seven `VITE_FIREBASE_*` entries (Variables or Secrets tab both work).
2. **Commit `.env`** (simplest): `git add -f .env && git commit -m "firebase config" && git push`. Firebase web config values are public identifiers that ship in every browser bundle anyway; GitHub's secret scanner will flag the key once — close the alert as a false positive, or add a `.github/secret_scanning.yml` with `paths-ignore: [".env"]`.

Either way the API key must be **restricted by HTTP referrer** and the project should use **App Check** — see [SECURITY.md](SECURITY.md). The deploy refuses to publish if the config is missing (`scripts/check-config.mjs`), so a bundle without a backend can never reach the live site.

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
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | **Required.** Firebase web config (see `.env.example`). In CI these are GitHub repository *variables*. |
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
  │                                    settings = { theme, googleSheetUrl,
  │                                                 carryForward: { enabled, startMonth: 'YYYY-MM', includeNegative },
  │                                                 budgets: { total, categories: { food: 6000, … } },
  │                                                 categoryRules: { "swiggy": "food", … },
  │                                                 goals: [{ id, name, target, deadline?, startDate, savingsType?, keyword? }] }
  ├── transactions/{id}             ← { name, amount, type, date, month, category?, direction?, wasteAmount?, recurringId?, … }
  ├── income/{id}                   ← { name, amount, type, date, month, isBorrowed?, isRepaymentRec?, recurringId?, … }
  ├── recurring/{id}                ← { name, amount, kind, frequency, dayOfMonth?/weekday?, startDate, endDate?, autoPost, active, lastHandledKey?, category?, … }
  ├── trips/{id}                    ← { name, startDate, endDate?, status, meMemberId?, members[{id,name,groupId?}], expenses[{id,title,amount,paidBy,splitAmong[],date}], settlements[{id,fromUnit,toUnit,amount,date}], postedEntryIds[] }
  ├── external_transactions/{id}    ← billing session { name, items[], received[], status, net_balance, settlementId?, … }
  └── recently_deleted/{id}         ← { itemType, originalData, deletedAt, … }
```

Posted recurring occurrences are ordinary transaction / income documents whose id is `rec_<ruleId>_<YYYY-MM-DD>`, which is what makes posting idempotent.

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

- [x] **Budget Goals**: monthly caps (total + per category) with pace markers and safe-to-spend-today
- [x] **Recurring Transactions**: auto-post or one-tap confirm for rent, SIPs, salary, subscriptions
- [x] **Spending Categories**: auto-inferred, learnable, with breakdowns and filters
- [x] **Savings Goals**: progress derived from savings entries
- [x] **Insights**: rule-based, offline plain-language summaries
- [x] **CSV Export**
- [ ] **Multi-currency Support**: record transactions in foreign currencies with exchange rate conversion
- [ ] **Receipt OCR**: upload a photo of a receipt and auto-extract the amount and merchant name
- [ ] **Shared Budgets**: collaborative mode where two users (e.g., partners) share a budget workspace
- [ ] **Native Mobile App**: a store build (Capacitor / React Native) once there is a reason to go beyond the PWA
- [ ] **LLM-powered insights**: a natural-language layer over the rule-based engine (e.g. ask "why was October expensive?")
- [ ] **Backend Deployment for Sheets Sync**: host the (already authenticated) Express proxy on a cloud service and build with `VITE_SHEETS_PROXY_URL` so Sheets sync works on the deployed site

---

## 📸 UI Overview

| Screen | Description |
|---|---|
| **Expenses Tab** | Quick-add form with type selector, auto-suggested category chips, "chai 20" quick entry, safe-to-spend-today, due recurring card, today's entries |
| **History Tab** | Full transaction log with search, type and category filters, period selector, inline wastage marking, and edit modal |
| **Income Tab** | Month-grouped income entries with lock badges for closed months; add income with category |
| **Billings Tab** | Proxy session manager — open sessions with amount paid + settlement; closed session ledger |
| **Plan Tab** | Monthly budget (total + per category), recurring rules with due / upcoming, savings goals |
| **Stats Tab** | Insights, budget, category breakdown, spending calendar, pie, 14-day bar and 6-month area charts + KPI cards |
| **Settings Tab** | Theme toggle, export (JSON + CSV) / import (JSON + CSV), Google Sheets link + push/pull, account sign-out |
| **Desktop Dashboard** | Summary strip, quick entry, entries, income, analytics, plus a planning row (insights · budget · categories · calendar) |

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
