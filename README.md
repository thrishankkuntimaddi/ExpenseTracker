# ⚡ Expense Tracker — Personal Finance, Reimagined

> **Smart, cloud-synced personal finance tracking with auto-categorised spending, monthly budgets with a daily "safe to spend", recurring entries, savings goals, a monthly report, debts, wastage analytics and billing sessions — on the web, Android, Mac, Windows and Linux, all on one account, with reminders and automatic updates.**

---

## 📌 Description

**Expense Tracker** is a production-grade personal finance app built with React + Firebase, shipped as a website, an Android app (Capacitor) and a desktop app for Mac, Windows and Linux (Tauri). It solves the frustrating problem of losing track of where your money goes each month — including money lent to, borrowed from, or spent on behalf of other people.

Unlike basic spreadsheet trackers, this app:

- **Categorises spending automatically** — "Swiggy", "petrol", "Netflix" are tagged Food / Fuel / Subscriptions as you type, using an India-aware keyword engine. Override once and it remembers.
- **Budgets with pace, not just a cap** — a monthly limit (optionally per category) gives you a *safe-to-spend-today* number, a projected month end, and warnings when the run-rate will overshoot.
- **Logs recurring entries for you** — rent, EMIs, SIPs, salary and subscriptions post on schedule, either silently or with a one-tap confirm.
- **A monthly report on the day you choose** — salary to salary: what went up, what went down, bills you missed, categories over budget.
- **Tracks money with people** — lent, borrowed, repaid and gifted amounts roll up into all-time per-person balances.
- **Tracks wastage** at the transaction level — mark any expense as wasted (single-tap) or set a partial waste amount (double-tap), giving you an instant "wastage percentage" of your spending.
- **Manages external/proxy transactions** — record money you spend on behalf of someone else, log the settlement, and track net profit/loss per session.
- **Syncs across every device** on one account and keeps working offline (Firestore's on-device cache); changes made offline upload when the connection is back.
- **Updates itself everywhere** — no reinstalling (see [Automatic updates](#-automatic-updates)).

---

## 🚀 Get the app

| Platform | How | Updates |
|---|---|---|
| **Web** (any browser, iPhone/iPad too) | **[thrishankkuntimaddi.github.io/ExpenseTracker](https://thrishankkuntimaddi.github.io/ExpenseTracker/)** — on iPhone: Share → *Add to Home Screen* | Each deploy, on the next open |
| **Android** 7+ | [ExpenseTracker-Android.apk](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Android.apk) — allow "install unknown apps" for your browser once | Over the air, in the background — applies on the next open |
| **Mac** (Apple Silicon) | [ExpenseTracker-Mac-AppleSilicon.dmg](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Mac-AppleSilicon.dmg) | Downloads in the background → *Restart to update* |
| **Mac** (Intel) | [ExpenseTracker-Mac-Intel.dmg](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Mac-Intel.dmg) | same |
| **Windows** 10/11 | [ExpenseTracker-Windows-Setup.exe](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Windows-Setup.exe) | same |
| **Linux** | [ExpenseTracker-Linux.AppImage](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Linux.AppImage) — `chmod +x`, then run | same |

All links always point at the newest [release](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest). You only download once — after that every platform updates itself.

**First launch on a Mac:** the app isn't notarised by Apple (that needs a paid developer account), so macOS says it "could not verify" it. Right-click the app → **Open** → **Open**, once. Or run `xattr -dr com.apple.quarantine /Applications/ExpenseTracker.app`.
**Windows:** SmartScreen may say "Windows protected your PC" → *More info* → *Run anyway*, once.

### What each platform can do

| | Web | Android | Desktop |
|---|---|---|---|
| Same data, live sync | ✅ | ✅ | ✅ |
| Works offline | ✅ (after first load) | ✅ | ✅ |
| Google sign-in | ✅ | ✅ (native account picker; falls back to Google's classic picker on phones where it fails) | ✅ (opens your browser) |
| Reminders when the app is closed | ✅ by cloud push (Chrome, Edge, Firefox; iPhone once added to the Home Screen) | ✅ pop up with sound (or quiet), optionally on the minute | ✅ while it runs in the menu bar / tray |
| App lock | ✅ PIN · passkey (Touch ID / Windows Hello) | ✅ PIN · fingerprint / face / screen lock | ✅ PIN · passkey where the system offers one |
| Google Drive backup | ✅ when you tap *Back up now* (browsers need a tap) | ✅ automatic | ✅ automatic |
| Open at login, menu bar / tray | — | — | ✅ |
| Updates without reinstalling | ✅ | ✅ | ✅ |
| System back button, status bar follows theme | — | ✅ | — |

These limits are the operating systems', not choices: a browser can't wake a closed tab, and a desktop app can only notify while it's running (closing the window keeps it in the menu bar / tray; *Quit* stops reminders).

---

## 🔐 Login / Demo Credentials

Sign in with **Google** or with **email + password** (create an account, verify the email, *Forgot password?* sends a reset link). The same account works on every platform.

All data is private and scoped strictly to your account — `firestore.rules` only lets a signed-in user read/write `users/{their uid}/**`, and validates transaction/income shapes.

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
- **The month's plan** on top: income (received, or your recurring salary before it arrives) − **fixed payments** (rent, EMIs, insurance, SIPs — from Bills) − the spending budget = **left to save or spare**
- **Taken from salary**: list deductions (Income tax/TDS, PF, professional tax …) to see your gross pay; they're shown, never subtracted twice
- A **total monthly cap** and/or **per-category caps**; with none set, a ready-made budget from your last three months, one tap to use
- Every budget bar carries a **pace marker**; **safe to spend today**, projected month end, an envelope per category, six months against the budget

### 🔁 Recurring Entries
- Rules for **expenses, savings or income** that repeat daily / weekly / monthly / yearly (day-of-month clamps to short months: the 31st becomes the 28th in February)
- **Auto-post** rules are logged silently on their due date when you open the app; **ask-me** rules show a *Log / Skip* card on Home and in Bills — handy when the amount varies
- Posted occurrences use a **deterministic id** (`rec_<rule>_<date>`), so two devices or a retry can never double-log
- Pause / resume, end dates, "next on …", and a monthly committed total ("₹18,649/mo goes to recurring expenses")

### 🏁 Savings Goals
- A goal has an amount, *needed by* month, a **monthly share** (suggested from the two), **where the money is kept** (cash, a person you trust, a bank) and a reminder day
- **Add money** logs a savings entry for that goal; **Moved it** hands the money to someone / somewhere else and keeps the history ("was with Pritam until 3 Mar"); **Used it** ends a goal used before it was reached; once reached, **Collected**
- Finished goals stay listed (reached & collected · used early · closed) and can be reopened. Goals made before 3.7 still count savings by type / keyword

### 🧾 Monthly report
- One report a month on the day you choose (Stats → Monthly report), instead of insights that change every time you look
- Covers **salary to salary**: from the day last month's main income arrived to the report day (or this month's salary, if that came first)
- Income, spent (vs the report before), saved (savings rate), left; categories that **went up**, **went down**, stayed about the same, started or stopped; bills **missed or skipped**; categories **over budget**; per-day spend, no-spend days, biggest expense. Browse earlier reports with ‹ ›

### 📅 One month for the whole app
- Every page shows **the same month**: switch it on Home's overview card, any page header, or the Stats calendar, and Home, History, Income, Stats, Bills, Budget and Savings all follow. **Now** jumps back to the current month
- Adding an entry while looking at an earlier month dates it in that month
- What carries over: debts (until settled), open billings, unpaid bills, and — with carry forward on — the month's leftover as next month's income

### 📥 Income Management
- Everything that came in, for the month on screen: income (salary, parents, freelance …), money **borrowed**, and money **paid back to you** — by source, with a running list

### ↪ Month Carry Forward
- From a start month (default **November 2026**), whatever was left at the end of a month appears as an **auto** income line in the next: "Carried forward from October 2026"
- The chain is cumulative — November's remainder (which already includes October's carry) rolls into December
- Nothing is stored: the line is recomputed from the ledger on every render, so a late edit to October corrects November automatically. It cannot be edited or deleted, only switched off
- Settings → *Month Carry Forward*: toggle on/off, pick the first month that receives a carry, and choose whether a **deficit** (negative leftover) is carried too (off by default — an overspent month simply carries nothing)
- Counted in that month's total income, remaining balance and the 6-month trend; **not** counted by budgets or the savings-rate insight, which look at real spending and earned income

### ↔ Debts
- Per person: **lent**, **got back**, **borrowed**, **paid back** — from transactions *and* income, so money returned to you closes the debt. Owe you · You owe · Settled
- **Given (no return expected)** is spending, logged from Expense → *Given to someone*; it never appears in Debts
- A person's page: the balance, one-tap *Got money back* / *Pay back* (pre-filled), and every entry to edit or delete

### 🔗 External / Proxy Transactions
- Record transactions where you pay on behalf of a client/person (e.g., buying materials for a freelance job)
- Log the **settlement amount** received back and a source label (client/project name)
- Net profit/loss is calculated and displayed in real-time as you type
- Full session management: open, track, close, and view closed sessions in separate tabs
- External sessions are stored in a dedicated `external_transactions` Firestore sub-collection

### 🧳 Trips & Splits (group expenses)
- Inside **Billings**, switch to *Trips & Splits*. Step 1 is the paper table you'd draw after a trip — **Person | What paid | Amount** — with the people as chips above it. Step 2 is the settlement
- **Pay as one wallet**: mark two people as "pays with" each other (a couple, a family) and their spending and dues are combined
- Live **who-pays-whom plan** with the minimum number of transfers ("Dev pays Arjun ₹2,400"), per-person paid vs share, and what is still outstanding; tap **Paid** to record a settlement and the plan shrinks
- **Share** a WhatsApp-ready text summary; **Close** the trip to lock it and, in one step, log *your* share as a Travel expense and record what others still owe you as Lent (or what you owe as Borrowed) in your own ledger. Reopening removes those entries again
- Trips live in `users/{uid}/trips`, bounded by the Firestore rules

### 🗑️ Wastage Tracking
- **Single-tap** any expense in History to toggle it as 100% wasted
- **Double-tap** to enter a custom partial waste amount
- The Stats tab shows **total waste** and **waste as % of total spending**

### 📊 Stats & Analytics
- For the month on screen: remaining balance and breakdown (income, spent, saved, wasted, you owe, owed to you, averages), the **spending calendar**, **spending by category**, where the money went (donut), then the **monthly report**

### 📱 Phone layout
Every way in leads somewhere different — nothing is offered twice.
- **Home**: greeting, search and your avatar; the month card (‹ month › switcher, spent, budget bar, today, safe to spend, balance); a **quick entry** bar with a live preview; **bills due** — only when something is due or late, each with **Pay**; **Explore** — Income, Trips, Billings, Bills, Budget, Debts, Savings (minus what's in your bar), each with a live line; recent activity
- **Bottom bar**: Home · two pages · **＋** · one page. ＋ adds anything — **Expense** (spent, or given to someone), **Income**, **Debt** (lent · borrowed · got back · paid back) and **Savings** (optionally for a goal, and where it's kept). Every kind opens on the amount with the keypad up
- **Bills & payments**: the month's timeline with one-tap **Pay**, skip, totals and every regular payment; common payments (Rent on the 5th, Electricity, Mobile, Internet, Send home, Loan EMI, SIP, FD/RD, Term & Health insurance, LIC, Subscription) while you set up
- **Budget**, **Savings & goals**, **Income**, **Stats**, **Debts**, **Trips & splits**, **Billings** — pages of their own, one header style everywhere
- Tap your **avatar** for **Profile**: account, **Theme** in one row, **Reminders** as tiles, **Customize** (bar pages, start page, Home sections), then Money · Sync & devices · Your data (incl. *Load past data*) · App · Account

### 💱 Currencies
Show money in any of 48 currencies (Profile → Currency): rupee, dollar, euro, pound, dirham, riyal, dinar, yuan, Taiwan dollar, dong, yen and more. Every entry keeps the currency it was entered in — tap the sign next to the amount, or just type it: “coffee $4.50”, “taxi 30 AED”, “€12 museum”. Abroad, switch once and the device keeps entering in that currency until you switch back.

How amounts in other currencies count — the rule the whole app follows:
- **What happened** (spending, income, history, reports, budgets) uses the rate of **the day it happened**. $10 of fuel in March stays what it cost in March, whatever the dollar does later; a list shows “$10.00 ≈ ₹952”.
- **What you still hold** — the balance — is kept **per currency** and valued at **today’s rate**. Paid $200 in the USA, spent $50 there and ₹10,000 back in India: the balance is $150 at today’s rate minus ₹10,000, and Home spells it out.
- Carry-forward carries each currency separately. Trips and recurring bills (rent in AED, a USD subscription) have their own currency too.
- Changing the display currency never rewrites history; budgets and goal targets can be re-stated at today’s rate in the same step.

Rates come from two free sources (fawazahmed0’s exchange-api for every currency, the European Central Bank via Frankfurter for long ranges), are cached on the device per day and never fetched twice; pegged Gulf currencies are exact. A new foreign entry also stores the rate it was entered at.

### 🔒 App lock & your devices
- **One PIN for every device** (only a salted, slow hash is stored), plus **fingerprint / face** on Android and a **passkey** (Touch ID, Windows Hello) on the web and desktop — per device
- Locks when the app opens, after the time away you choose (immediately … 1 hour), when a computer sits untouched, or from another of your devices
- **Wrong PINs**: from the 5th the app waits longer each time (30 s → 1 h), your other devices get an alert (“Lock it / Sign it out / It was me”) and you get an email; the 10th means only signing in again opens it. Nothing is erased
- **Forgot PIN?** Sign in again with Google or your password, choose a new one — your data stays exactly as it is
- **Unlock from another device**: a locked laptop asks; your phone shows *Approve / Deny*
- **Profile → Security → Your devices**: every device signed in, a pulsing **Live** tag on the ones on screen right now, **Locked** on locked ones; lock or sign out any of them, or all others at once
- Honest limits: the lock keeps people holding your unlocked phone or laptop out of the app; your data itself is protected by your account sign-in. A remote sign-out happens the moment that device is online

### ☁️ Google Drive backup
Like WhatsApp: a full copy of everything goes to a folder **“Expense Tracker backups” in your own Google Drive** — every day, week or month, keeping the newest 3–30 copies. The app asks only for the `drive.file` permission (it can see the files it creates, nothing else). Restore any copy from Profile, on this device or a new one; restoring writes entries back and deletes nothing. There is no copy on any server of ours.

### ⚙️ Settings & Data Management
- **Export JSON**: download a full backup of all transactions, income, and settings (budgets, goals, category rules included)
- **Export CSV**: a spreadsheet with categories that the app's own CSV importer accepts — round-trips cleanly
- **Import JSON**: restore from a backup — batched writes; records keep their ids, so re-importing never duplicates
- **Import CSV**: RFC-4180 CSV importer (`date, name, amount, type`; quoted fields, `1,200`-style amounts, `DD/MM/YYYY` dates) with stable ids — importing the same file twice is safe
- **Recently Deleted**: deletes move items to a trash (atomically) from which they can be restored
- **Reset All Data**: permanently deletes all transactions, income, billings and trash
- **Sync status** ("Synced", "Saving…", "Offline — changes are saved on this device"); your devices are under Security (devices unused for 30 days drop off)
- **Updates**: current version and build, *Check for updates*, and *Restart to update* / *Install* when one is waiting

### 🔔 Reminders
Six optional reminders, all off until you tap their tile (Profile → Reminders), each with its own time:
- **Bills due** — "Have you paid rent?" on the day a bill is due (never for auto-paid bills or income)
- **Log the day** — on the days you choose; skipped if you already logged something that day
- **Budget check** — once when the month passes 80 %, once at 100 %
- **Monthly report** — on your report day
- **Goals** — on each goal's day: this month's share to put aside, or, once reached, a nudge to collect it
- **Weekly summary** — your week in one line on the evening you pick

At most one per type per day. On Android they pop up with a sound (or arrive quietly — your choice per device) and can be set to arrive *on the minute*; the Reminders card also explains the battery setting that some phones (vivo, iQOO, Oppo, Xiaomi, Samsung) need. On the website they arrive by **cloud push** even with the page closed. Tapping one opens the right page. The settings sync across devices; *Reminders on this device* is per device. *Send a test* shows one right away. See [What each platform can do](#what-each-platform-can-do) for when they can arrive.

### 🌙 Theming
- **Light**, **dark** or **follow the device** — chosen per device, applied before the first paint (no flash)
- Liquid-glass surfaces; deep, smoked dark mode
- In the Android app the status and navigation bars follow the theme

### 📱 Responsive layout
- **Phone**: the bottom bar above; swipe between bar pages (ignored inside chip rows, charts, dialogs and near the screen edges)
- **Desktop & web** (≥1024px): the **same pages** with a sidebar — Overview (Home, History, Stats) · Money (Income, Bills, Budget, Savings) · With others (Trips, Billings, Debts) — **+ Add** at the top and your profile at the bottom; Home and Stats use two columns, the rest a comfortable reading width; Add opens as a centred dialog
- The website is installable (Add to Home Screen) and works offline; the Android and desktop apps carry the whole app inside, so they open instantly with no connection
- Firestore's persistent on-device cache paints the UI instantly and queues writes while offline. Sign-out waits until unsent changes are uploaded (or asks before discarding them)

---

## 🔄 Automatic updates

You install once; after that every platform updates itself.

| Platform | How it works |
|---|---|
| **Web** | Every push to `main` deploys the site. The service worker checks on open, when the tab comes back and every 30 minutes, then reloads once onto the new version. |
| **Android** | Over-the-air: each deploy also publishes the app's web bundle (`/app/update.json` + a zip with a SHA-256 checksum) next to the website. The app checks on launch, on return and every 30 minutes and downloads in the background. It switches when you tap **Restart**, when the app goes to the background, or — if it was swiped away first — during the splash of the next open. If the new bundle doesn't start, the app rolls back by itself. Only when a version needs new *native* code (`expensetracker.minNativeVersion` in `package.json`) does it say *"install the new app"* — once — with a link to the APK. |
| **Desktop** | Tauri's signed updater reads `latest.json` from the newest GitHub release, downloads in the background and offers **Restart to update**. Updates are signed with a minisign key; an update without a valid signature is refused. |

After any update the app says *"Updated to vX"* once. Settings shows the version, build date and commit.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 8 |
| **Backend / Database** | Firebase Firestore (NoSQL, real-time) |
| **Authentication** | Firebase Auth — Google + email/password (native Google picker on Android, browser sign-in with PKCE on desktop) |
| **Android app** | Capacitor 8 (local notifications, OTA updates via `@capgo/capacitor-updater`, a small native plugin for the system bars) |
| **Desktop app** | Tauri 2 (Rust): menu bar / tray, single instance, open at login, notifications, signed updater |
| **Charts** | Recharts 3 |
| **Icons** | Lucide React |
| **Fonts** | Inter (Google Fonts) |
| **CSS** | Vanilla CSS with CSS Custom Properties (design tokens) |
| **PWA** | Web App Manifest + custom Service Worker (website only) |
| **Build Tool** | Vite — `vite build` for the website (base `/ExpenseTracker/`), `vite build --mode native` for the apps (`dist-native/`, no service worker) |
| **Deployment** | GitHub Actions → GitHub Pages (website + Android OTA bundle) and GitHub Releases (APK, DMG, EXE, AppImage, `latest.json`) |
| **Linting** | ESLint 9 (flat config) |
| **Testing** | Vitest (unit tests for finance, categories, budget, recurring, report, debts, goals, dates and import/export; server-render smoke tests for every screen) |

---

## 📂 Project Structure

```
ExpenseTracker/
├── index.html                  # Entry point — preloader, PWA tags, SW registration
├── vite.config.js              # Vite config (base: /ExpenseTracker/) + SW build-ID stamping
├── firebase.json               # Firebase Firestore rules + indexes config
├── firestore.rules             # Security rules for the WHOLE shared project (see below)
├── firestore.indexes.json      # Composite index definitions
├── capacitor.config.json       # Android app config (app id, OTA updater, Google sign-in)
├── android/                    # Android project (Gradle); SystemThemePlugin.java, notification icon
├── src-tauri/                  # Desktop app (Rust): lib.rs (tray, commands), oauth.rs, reminders.rs
├── scripts/
│   ├── check-config.mjs        # Refuses to build without a Firebase config
│   ├── make-ota.mjs            # Android OTA bundle + update.json
│   ├── make-latest-json.mjs    # Desktop updater manifest
│   ├── render-icons.mjs        # App icons for every platform
│   └── clear-db.mjs            # Maintenance: wipe one user's data (prompts for password)
├── .github/workflows/          # deploy-web.yml (site + OTA), build-apps.yml (all apps → release)
│
├── src/
│   ├── main.jsx                # React 19 createRoot entry
│   ├── index.css               # Global styles, CSS tokens (light + MonoFlow themes)
│   ├── app/App.jsx             # Root: AuthGate → AuthenticatedApp — one shell: phone bar or desktop sidebar, the same pages
│   ├── app/month.js            # The app-wide month every page follows
│   │
│   ├── features/
│   │   ├── auth/               # AuthGate, login and sign-up pages
│   │   ├── transactions/       # TodayTab (Home), HistoryTab (search, filters, wastage, edit)
│   │   ├── income/             # IncomeTab
│   │   ├── external/           # Billing sessions (ExternalTab) + share receipt, Billings ⇄ Trips switch
│   │   ├── trips/              # Trips & Splits: members, expenses, settle-up plan, close → ledger
│   │   ├── debts/              # Debts: lent · borrowed · got back · paid back, per person
│   │   ├── bills/              # Bills & payments timeline
│   │   ├── budget/             # Budget: month plan, envelopes, six months
│   │   ├── savings/            # Savings & goals
│   │   ├── plan/               # Shared modals and cards: recurring rule, budget editor, goals
│   │   ├── stats/              # Stats, CategoryBreakdown, SpendingCalendar, ReportCard
│   │   ├── profile/            # Profile: theme, reminders, customize
│   │   └── settings/           # Settings sections, reminders card, import/export (JSON + CSV), account
│   │
│   ├── components/             # AddSheet, MonthSwitcher, Page (header/sections), modals, UpdateBanner, …
│   ├── native/                 # Platform layer: index.js (detection, back button, status bar), updates.js,
│   │                           #   reminders.js (delivery), googleSignIn.js (Android + desktop)
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
│   │   ├── firestore.js        # Firestore CRUD, batched import/reset, atomic trash/restore, devices
│   │   ├── sync.js             # Sync status store, background writes, readable errors
│   │
│   └── utils/
│       ├── finance.js          # ALL money maths: balances, person debts, settlement matching
│       ├── categories.js       # Category list, keyword inference, learned rules, per-category totals
│       ├── split.js            # Trip splitting: shares, pay-groups as one wallet, minimal who-pays-whom transfers
│       ├── carryForward.js     # Month-to-month leftover chain → synthetic "carried forward" income lines
│       ├── budget.js           # Budget status, suggested budget, the month's plan
│       ├── recurring.js        # Occurrence generation, due/next, deterministic ids, entry builder
│       ├── goals.js            # Goals: progress, monthly share, held with, move / used / collected
│       ├── debts.js            # Debts ledger across transactions and income
│       ├── report.js           # Monthly report: salary-to-salary window, what changed, missed bills
│       ├── bills.js            # Bill occurrences and status, presets
│       ├── smartInput.js       # "chai 20" quick-entry parsing
│       ├── exportHelpers.js    # CSV export (round-trips through importHelpers)
│       ├── importHelpers.js    # CSV parser, stable import ids
│       ├── dateHelpers.js      # Formatting + local-time date keys
│       ├── periodHelpers.js    # Period filtering (local calendar)
│       ├── typeConfig.js       # Transaction type metadata
│       ├── storage.js          # Id generation
│       ├── theme.js            # Light / dark / follow device
│       ├── reminders.js        # Reminder plan (pure): what fires when, and the wording
│       ├── backup.js           # Backup format v2: parse + validate before restoring
│       └── __tests__/          # Vitest unit tests
│
├── public/
│   ├── manifest.json           # PWA Web App Manifest
│   └── sw.js                   # Service Worker (cache name stamped per build)
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** ≥ 20.19 (required by Vite 8 / Vitest)
- A **Firebase project** with Firestore and Authentication (Email/Password + Google) enabled — this app uses `expensetracker-385b0`
- For the Android app: JDK 21 and the Android SDK (Android Studio installs both)
- For the desktop app: Rust (`rustup`) and, on Linux, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

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

> The app has its own Firebase project (`expensetracker-385b0`, set in `.firebaserc`), so these rules cover only Expense Tracker. It used to live in the shared `nistha-passi-core` project — never deploy this file there: that would replace the rules of every other app in it (`scripts/check-config.mjs` refuses builds pointed at it).

### 4. Run locally

```bash
npm run dev      # http://localhost:5173/ExpenseTracker/
npm run lint
npm test         # runs in Asia/Kolkata timezone to exercise local-date edge cases
```

### 5. Apps on your machine

```bash
# Android — debug APK (or open in Android Studio)
npm run android:apk            # → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open

# Desktop
npm run desktop:dev            # live-reloading desktop window
npm run desktop:build          # installers for this OS in src-tauri/target/release/bundle/
```

A local `desktop:build` also builds signed update files, so it needs the updater key in the environment (or turn them off with `--config '{"bundle":{"createUpdaterArtifacts":false}}'`):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.local/expensetracker-signing/tauri-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"   # in ~/.local/expensetracker-signing/secrets.txt on the release machine
```

### 6. Cloud push and alert emails (optional, free)

Website reminders while the page is closed, and security alerts, are sent by a small scheduled job — [`scripts/notifier/`](scripts/notifier/notifier.mjs), run every ~10 minutes by [`.github/workflows/notifier.yml`](.github/workflows/notifier.yml). No Cloud Functions, so it works on the free Spark plan. The apps upload their own reminder plan; the job only delivers what is due.

1. Firebase Console → Project settings → **Service accounts** → *Generate new private key*. Save the JSON as the repository secret `FIREBASE_SERVICE_ACCOUNT`.
2. Firebase Console → Project settings → **Cloud Messaging** → *Web Push certificates* → *Generate key pair*. Save the public key as the repository variable `VITE_FIREBASE_VAPID_KEY`.
3. Emails (optional): a Gmail **app password** (Google Account → Security → App passwords) as the secret `SMTP_URL` = `smtps://you%40gmail.com:APP-PASSWORD@smtp.gmail.com:465`, and the variable `MAIL_FROM` = `Expense Tracker <you@gmail.com>`.
4. Deploy the two collection-group indexes the job queries: `firebase deploy --only firestore:indexes`.

GitHub may start scheduled runs a few minutes late, and pauses schedules in a repository with no commits for 60 days (re-enable it in the Actions tab).

### 7. Google Drive backup on the website (optional)

The Android and desktop apps need nothing extra. For the website, create an OAuth client of type **Web application** in Google Cloud Console → APIs & Services → Credentials, add your site (e.g. `https://<you>.github.io`) to *Authorized JavaScript origins*, enable the **Google Drive API**, and set the repository variable `VITE_GOOGLE_WEB_CLIENT_ID`. Without it, people signed in with Google can still back up through a sign-in popup.

---

## 🚢 Releasing

| What | How |
|---|---|
| **Website + Android OTA** | Push to `main`. `deploy-web.yml` lints, tests, builds the site and the app bundle, and publishes both to GitHub Pages. Phones pick up the bundle on their own. |
| **New app version** (all platforms) | Bump `version` in `package.json` and `src-tauri/Cargo.toml` (the desktop app reads the rest from `package.json`), commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. `build-apps.yml` builds the signed APK, the Mac (Apple Silicon + Intel), Windows and Linux installers, writes `latest.json`, publishes the release and removes older releases. |
| **Needs a new APK?** | Only when native code or Capacitor plugins change. Then raise `expensetracker.minNativeVersion` in `package.json` to the new version, so older APKs are told to install it instead of receiving a bundle they can't run. |

**Repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Used for |
|---|---|
| `VITE_FIREBASE_*` (7), `VITE_GOOGLE_DESKTOP_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | App config (variables work too) |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Signing the APK. **Keep the keystore safe** (the release machine has a copy in `~/.local/expensetracker-signing/` — back it up somewhere else too); phones only accept updates signed with the same key. |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing desktop updates (the public key is in `tauri.conf.json`) |

---

## 🔑 Environment Variables

### Frontend (build time, all optional)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | **Required.** Firebase web config (see `.env.example`). In CI these are GitHub repository *variables*. |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key. When set, Firebase **App Check** is enabled so only this app can call your backend. Register the key in Firebase Console → App Check, then turn on enforcement for Firestore. |

| `VITE_GOOGLE_DESKTOP_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | Google sign-in in the desktop app (a "Desktop app" OAuth client). Empty = Google sign-in hidden on desktop. Also used for Drive backups on desktop. |
| `VITE_FIREBASE_VAPID_KEY` | Web push key pair (Cloud Messaging). Empty = the website shows reminders only while it's open. |
| `VITE_GOOGLE_WEB_CLIENT_ID` | "Web application" OAuth client for Drive backups on the website. |

The notifier job uses the secrets `FIREBASE_SERVICE_ACCOUNT` (required) and `SMTP_URL` (optional), and the variables `MAIL_FROM` and `APP_URL` (optional).

In CI these come from GitHub repository **variables** (or secrets) of the same name.

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
  │                                    settings = { theme, currency: 'INR' | 'USD' | …,
  │                                                 driveBackup: { enabled, frequency, keep },
  │                                                 carryForward: { enabled, startMonth: 'YYYY-MM', includeNegative },
  │                                                 budgets: { total, categories: { food: 6000, … } },
  │                                                 categoryRules: { "swiggy": "food", … },
  │                                                 goals: [{ id, name, target, deadline?, startDate, savingsType?, keyword? }] }
  ├── transactions/{id}             ← { name, amount, currency?, fx?, type, date, month, category?, direction?, wasteAmount?, recurringId?, … }
  ├── income/{id}                   ← { name, amount, currency?, fx?, type, date, month, isBorrowed?, isRepaymentRec?, recurringId?, … }
  │                                    currency missing = INR (entries from before multi-currency);
  │                                    fx = { USD: 1, INR: 95.2 } — the rates when a foreign entry was made
  ├── recurring/{id}                ← { name, amount, kind, frequency, dayOfMonth?/weekday?, startDate, endDate?, autoPost, active, lastHandledKey?, category?, … }
  ├── trips/{id}                    ← { name, startDate, endDate?, status, meMemberId?, members[{id,name,groupId?}], expenses[{id,title,amount,paidBy,splitAmong[],date}], settlements[{id,fromUnit,toUnit,amount,date}], postedEntryIds[] }
  ├── external_transactions/{id}    ← billing session { name, items[], received[], status, net_balance, settlementId?, … }
  ├── recently_deleted/{id}         ← { itemType, originalData, deletedAt, … }
  ├── devices/{deviceId}            ← { name, kind, platform, lastSeen, visible, locked?, command?, unlockRequest?, unlockApproval? }
  ├── security/lock                 ← { enabled, pinHash, salt, iterations, length, lockAfter, fails, lastFailAt }
  ├── security_events/{id}          ← { type, at, device, deviceId, count?, notified }
  ├── push_tokens/{deviceId}        ← { token, platform, reminders, security }
  ├── push_plan/current             ← { items[{ at, title, body, route }], nextAt, sentUpTo? }
  └── drive_backup/state            ← { lastAt, lastFile, lastDevice, error? }
```

Posted recurring occurrences are ordinary transaction / income documents whose id is `rec_<ruleId>_<YYYY-MM-DD>`, which is what makes posting idempotent.

**Transaction types**: `expense`, `savings`, `person` (with `direction`: lent / borrowed / repaid / repayment / given_gift), `external`
**Income kinds** (see `incomeKind()`): `income`, `borrowed` (`isBorrowed`), `repayment` (`isRepaymentRec`)

`firestore.rules` restricts every path under `users/{uid}` to that user and validates that transaction / income documents have a numeric `amount`, a string `date` and a non-empty `name`.

---

## 🚧 Challenges & Solutions

| Challenge | Solution |
|---|---|
| Shared Firebase project with other apps | Moved to its own project (`expensetracker-385b0`); data migrated from a full backup |
| Reinstalling for every fix | OTA bundles on Android, signed updater on desktop, service worker on the web |
| Old Android WebViews drawing ghost copies of cards | Settings shows the web engine version and links to the WebView update in the Play Store when it's older than Chrome 130 |
| Duplicate records from repeated imports | Deterministic import ids + batched `set()` writes |
| Dates landing on the wrong day near midnight | Local-calendar date keys instead of slicing UTC ISO strings |
| Lost edits in billing autosave | Pending edits are merged per session and flushed on unmount / before close |
| Flash of wrong theme on load | Inline script applies the cached theme before React mounts |
| Service Worker serving stale assets | Cache name stamped with the build ID; `SKIP_WAITING` + `controllerchange` reload |

---

## 🔮 Future Improvements

- [x] **Budget Goals**: monthly caps (total + per category) with pace markers and safe-to-spend-today
- [x] **Recurring Transactions**: auto-post or one-tap confirm for rent, SIPs, salary, subscriptions
- [x] **Spending Categories**: auto-inferred, learnable, with breakdowns and filters
- [x] **Savings Goals**: progress derived from savings entries
- [x] **Monthly report**: salary to salary, on the day you choose
- [x] **CSV Export**
- [ ] **Multi-currency Support**: record transactions in foreign currencies with exchange rate conversion
- [ ] **Receipt OCR**: upload a photo of a receipt and auto-extract the amount and merchant name
- [ ] **Shared Budgets**: collaborative mode where two users (e.g., partners) share a budget workspace
- [x] **Native apps**: Android (Capacitor) and Mac / Windows / Linux (Tauri) with reminders and automatic updates
- [ ] **Play Store / signed Mac build**: removes the "unknown apps" and "could not verify" steps (needs paid developer accounts)
- [ ] **LLM-powered insights**: a natural-language layer over the rule-based engine (e.g. ask "why was October expensive?")

---

## 📸 UI Overview

| Screen | Description |
|---|---|
| **Home** | Month card with the month switcher, quick entry, bills due (only when something is), Explore, recent activity |
| **History** | Every entry for the month on screen — search (this month or all months), type and category filters, wastage, edit |
| **Income** | What came in that month: total, by source, the list |
| **Stats** | Balance and breakdown, spending calendar, categories, distribution, monthly report |
| **Bills & payments** | The month's timeline with one-tap Pay, every regular payment |
| **Budget** | The month's plan (income − fixed − budget), salary deductions, envelopes, six months |
| **Savings & goals** | Savings rate, where it goes, goals with holder / move / used / collect |
| **Debts** | Owe you · You owe · Settled; a page per person |
| **Trips & Billings** | Group trips settled fairly; money spent for others |
| **Profile** | Account, theme, reminder tiles, customize, settings, data, updates |
| **Desktop & web** | The same pages with a sidebar and a centred Add dialog |

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
- Do not commit `.env` files

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
