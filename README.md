# ⚡ Expense Tracker — Personal Finance, Reimagined

> **One account for your whole money life — expenses, income, bills, budgets, savings goals, debts with people, trip splits and a monthly report — in any currency, on the web, Android, Mac, Windows and Linux. Live sync, app lock across devices, backups in your own Google Drive, reminders that arrive, and automatic updates.**

**Current version: 3.15.1** · [Open the app](https://expensetracker-in.web.app/) · [Product page](https://thrishankkuntimaddi.github.io/ExpenseTracker/) · [Download](#-get-the-app) · [Privacy policy](https://thrishankkuntimaddi.github.io/ExpenseTracker/privacy.html) · [Releases](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest)

---

## 📑 Contents

- [Description](#-description)
- [Get the app](#-get-the-app)
- [Signing in](#-signing-in)
- [Features](#-features)
- [Automatic updates](#-automatic-updates)
- [Tech stack](#️-tech-stack)
- [Project structure](#-project-structure)
- [Installation & setup](#️-installation--setup)
- [Releasing](#-releasing)
- [Environment variables & secrets](#-environment-variables--secrets)
- [How it works](#-how-it-works)
- [Firestore data model](#️-firestore-data-model)
- [Privacy & security](#-privacy--security)
- [Troubleshooting](#-troubleshooting)
- [Challenges & solutions](#-challenges--solutions)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📌 Description

**Expense Tracker** is a personal finance app built with React and Firebase, shipped as a website (installable PWA), an Android app (Capacitor) and a desktop app for Mac, Windows and Linux (Tauri). One codebase, one account, the same pages everywhere.

It solves the problem of losing track of where money goes — including money lent to, borrowed from, or spent on behalf of other people, and money earned or spent abroad.

What makes it different from a spreadsheet or a basic tracker:

- **Categorises spending as you type** — "Swiggy", "petrol", "Netflix" become Food / Fuel / Subscriptions with an India-aware keyword engine. Override once and it learns.
- **Any currency, counted correctly** — what happened is valued at the rate of its day; what you still hold is valued at today's rate.
- **Budgets with pace** — a *safe to spend today* number, a projected month end and per-category envelopes.
- **Bills that ask** — "Have you paid rent?" on the 5th; rent, EMIs, SIPs and salary post on schedule.
- **A monthly report** on the day you choose, salary to salary.
- **Money with people** — lent, borrowed, paid back; trip splits with a minimal who-pays-whom plan that posts your share into your own ledger.
- **Trips with friends** — invite by QR code, link or email; everyone adds what they paid on their own phone, sees who owes whom live, and marks payments done.
- **Your data, your copy** — scheduled backups to your own Google Drive, export to JSON/CSV any time.
- **Locked when it should be** — one PIN for every device, fingerprint/face where available, and remote lock or sign-out from your phone.
- **Works offline and syncs** across every device; **updates itself** everywhere.

---

## 🚀 Get the app

| Platform | How | Updates |
|---|---|---|
| **Web** (any browser, iPhone/iPad too) | **[expensetracker-in.web.app](https://expensetracker-in.web.app/)** — on iPhone: Share → *Add to Home Screen* | Each deploy, on the next open |
| **Android** 7+ | [ExpenseTracker-Android.apk](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Android.apk) — allow "install unknown apps" for your browser once | Over the air, in the background |
| **Mac** (Apple Silicon) | [ExpenseTracker-Mac-AppleSilicon.dmg](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Mac-AppleSilicon.dmg) | Downloads in the background → *Restart to update* |
| **Mac** (Intel) | [ExpenseTracker-Mac-Intel.dmg](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Mac-Intel.dmg) | same |
| **Windows** 10/11 | [ExpenseTracker-Windows-Setup.exe](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Windows-Setup.exe) | same |
| **Linux** | [ExpenseTracker-Linux.AppImage](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest/download/ExpenseTracker-Linux.AppImage) — `chmod +x`, then run | same |

These links always point at the newest [release](https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/latest). You download once; after that every platform updates itself — except when a release adds new *native* Android code (as **3.11.0** did: fingerprint unlock, Drive backup and push). Then the Android app asks you, once, to install the new APK over the old one. Your data and sign-in stay.

**First launch on a Mac:** the app isn't notarised by Apple (that needs a paid developer account), so macOS says it "could not verify" it. Right-click the app → **Open** → **Open**, once — or run `xattr -dr com.apple.quarantine /Applications/ExpenseTracker.app`.
**Windows:** SmartScreen may say "Windows protected your PC" → *More info* → *Run anyway*, once.

### What each platform can do

| | Web | Android | Desktop |
|---|---|---|---|
| Same data, live sync | ✅ | ✅ | ✅ |
| Works offline | ✅ (after first load) | ✅ | ✅ |
| Google sign-in | ✅ | ✅ native picker, falls back to Google's classic picker on phones where it fails | ✅ opens your browser |
| Reminders when the app is closed | ✅ cloud push (Chrome, Edge, Firefox; iPhone once added to the Home Screen) | ✅ pop up with sound (or quiet), optionally on the minute | ✅ while it runs in the menu bar / tray |
| App lock | ✅ PIN · passkey (Touch ID / Windows Hello) | ✅ PIN · fingerprint / face / screen lock | ✅ PIN · passkey where the system offers one |
| Google Drive backup | ✅ when you tap *Back up now* (browsers need a tap) | ✅ automatic | ✅ automatic |
| Shared trips (invite, join, edit your rows live) | ✅ | ✅ join by pasting the link (a scanned QR opens the website) | ✅ |
| Open at login, menu bar / tray | — | — | ✅ |
| Updates without reinstalling | ✅ | ✅ | ✅ |
| System back button, status bar follows theme | — | ✅ | — |

These limits are the operating systems', not choices: a browser can't wake a closed tab without push, and a desktop app can only notify while it's running (closing the window keeps it in the menu bar / tray; *Quit* stops reminders).

---

## 🔐 Signing in

Sign in with **Google** or with **email + password** (create an account, verify the email; *Forgot password?* sends a reset link). The same account works on every platform. There are no shared demo credentials — every user has their own isolated data.

All data is private to your account: `firestore.rules` only lets a signed-in user read and write `users/{their uid}/**`, and validates the shape of transactions, income, recurring rules and trips. The one exception is a **shared trip** (`shared_trips/{id}`): the people who joined it can read it, each edits only their own rows (and their wallet partner's), and only its creator can change, close or delete it.

---

## 🧩 Features

### 💸 Entries
- Add **Expense** (spent, or *given to someone*), **Income**, **Debt** (lent · borrowed · got back · paid back) and **Savings** (optionally for a goal, and where it's kept) from the **＋** button — every form opens with what it's for first, then the amount. On a phone, **swipe sideways** in that window to switch kinds (what you typed comes along), and **drag its grip down** to close it
- **Home** on a phone: the month card, quick entry, bills (when something is due) and Explore. *Recent activity* is off by default — add it back in Profile → Customize → Home screen
- **Quick entry**: type `chai 20` or `250 swiggy` and press Enter — the name and amount are split and saved. **Several at once** works too: `coffee 250 water 50 tea 150` saves three expenses, each with its own category. A currency written with the amount is picked up: `coffee $4.50`, `taxi 30 AED`, `€12 museum`, `lunch 400rs`
- **History** — every entry of the month, money in *and* out, one compact row each: what it was for, the amount (**+ green** for money in, **− red** for money out), its kind (Income, Expense, Borrowed, Lent, Got back, Paid back, Savings…), category, status (debts stay *Open* until settled) and edit / delete. Only the most recent day starts open (tap a day, or *Expand all*, for the rest). Search this month or all months; filter by kind or category. History sits at the far right of the phone bar
- **Money in** (formerly *Income*) — everything that reached your account: what you earned, what you borrowed and what was paid back to you, with *Earned* shown on its own
- **Cash** — taking cash out isn't saving or spending: *Expense → Withdrew cash* moves it from your account to your wallet. Pay with it by picking **Paid with: Cash** on an expense; Home shows **cash in hand** (withdrawn − paid in cash) once you use it. Savings no longer offers "Cash Savings" (older entries read *Cash kept aside*)
- **App tour** — runs once for a new account; start it again any time from Profile → Help. Every page has a **?** at the top with a short guide to that page
- **Load past data**: paste a month of old entries, one per line (`5 groceries 450`)
- Every write is optimistic and rolls back with a clear message if the server refuses it

### 💱 Currencies
- Show money in any of **48 currencies** (Profile → Currency): rupee, dollar, euro, pound, dirham, riyal, Kuwaiti dinar, yuan, Taiwan dollar, dong, yen, Singapore dollar and more
- Every entry **keeps the currency it was entered in**. Tap the sign next to the amount to pick another; abroad, switch once and the device keeps entering in that currency until you switch back
- **The rule the whole app follows**
  - **What happened** — spending, income, history, reports, budgets — uses the rate of **the day it happened**. $10 of fuel in March stays what it cost in March, whatever the dollar does later. Lists show what you paid with the converted figure underneath: "$10.00 / ≈ ₹952"
  - **What you still hold** — the balance — is kept **per currency** and valued at **today's rate**. Paid $200 in the USA, spent $50 there and ₹10,000 back in India: the balance is $150 at today's rate minus ₹10,000, and Home spells it out
- Carry-forward carries each currency separately; **trips** and **recurring bills** (rent in AED, a USD subscription) have their own currency
- Changing the display currency never rewrites history; budgets and goal targets can be re-stated at today's rate in the same step
- Rates come from two free, key-less sources — [fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api) (every currency) and the European Central Bank via [Frankfurter](https://frankfurter.dev) (long ranges in one request). Each day's rates are cached on the device and never fetched twice; pegged Gulf currencies are exact; a new foreign entry also stores the rate it was entered at

### 🏷️ Smart categories
- 16 categories (Food & Dining, Groceries, Transport, Fuel, Shopping, Bills & Utilities, Rent & Home, Health, Entertainment, Subscriptions, Education, Travel, Personal Care, Gifts & Donations, Family, Other)
- Inferred from the description with an India-aware keyword list (Swiggy, Zomato, Blinkit, Rapido, IRCTC, BESCOM, Jio, D-Mart, PVR …); the suggestion is marked ✦ and can be changed with one tap
- Overrides are **learned** (`settings.categoryRules`); older untagged entries are categorised on the fly

### 🎯 Budget
- **The month's plan**: income (received, or your recurring salary before it arrives) − fixed payments (rent, EMIs, insurance, SIPs from Bills) − the spending budget = **left to save or spare**
- **Taken from salary**: deductions (TDS, PF, professional tax …) to see gross pay; shown, never subtracted twice
- A total cap and/or per-category caps; with none set, a ready-made budget from your last three months
- Pace markers, **safe to spend today**, projected month end, an envelope per category, six months against the budget

### 🧾 Bills & recurring entries
- Rules for **expenses, savings or income** repeating daily / weekly / monthly / yearly (the 31st becomes the 28th in February), each in its own currency
- **Auto-post** rules log silently on their due date; **ask-me** rules show *Log / Skip* — handy when the amount varies
- Posted occurrences use a deterministic id (`rec_<rule>_<date>`), so two devices or a retry can never double-log
- The **Bills & payments** page: the month's timeline with one-tap **Pay**, skip, totals, every regular payment, and common presets (Rent on the 5th, Electricity, Mobile, Internet, Send home, Loan EMI, SIP, FD/RD, insurance, LIC, Subscription)

### 🏁 Savings goals
- Amount, *needed by* month, a monthly share, **where the money is kept** (cash, a person, a bank) and a reminder day
- **Add money**, **Moved it** (keeps the history: "was with Pritam until 3 Mar"), **Used it**, **Collected**; finished goals stay listed and can be reopened

### 🧾 Monthly report
- One report a month on the day you choose, **salary to salary**
- Income, spent (vs last report), saved (savings rate), left; categories that went up, down, started or stopped; bills missed or skipped; categories over budget; per-day spend, no-spend days, biggest expense; earlier reports with ‹ ›

### 📅 One month for the whole app
- Every page shows **the same month**; switch it anywhere and every page follows. **Now** jumps back
- Adding an entry while looking at an earlier month dates it in that month
- What carries over: debts until settled, open billings, unpaid bills, and — with carry forward on — the month's leftover

### ↪ Month carry forward
- From a start month (default November 2026), what was left at the end of a month becomes an **auto** income line next month: "Carried forward from October 2026"; cumulative, recomputed from the ledger on every render, kept per currency
- Profile → Money → *Month Carry Forward*: on/off, first month, and whether a deficit carries too (off by default)

### ↔ Debts
- Per person: **lent**, **got back**, **borrowed**, **paid back** — across transactions and income. Owe you · You owe · Settled
- *Given (no return expected)* is spending and never appears in Debts
- A page per person with one-tap *Got money back* / *Pay back* (pre-filled) and spreadsheet-style quick entry

### 🧳 Trips & splits
- The table you'd draw after a trip — **Person | What | Amount** — with Excel-like entry (type, Enter to move, paste from Excel)
- **Pay as one wallet**: a couple or a family settles as one
- A live **who-pays-whom plan** with the fewest transfers; tap **Paid** to record a settlement
- **Share** the whole trip as an image or text — totals, who pays whom, what's already paid, paid vs share, wallets, where the money went, every row; **Close** to log *your* share as a Travel expense and what others owe as Lent (or Borrowed) — in the trip's currency
- **Shared trips** — **Invite friends** turns a trip into one everybody works on, live:
  - invite by **QR code**, **link**, the phone's share sheet (WhatsApp, contacts), **email** (with "create a free account" steps), or one tap for **friends** from earlier shared trips; they sign in (or sign up), pick their name, done — the apps take the link in **Join**
  - everyone **sees every row** but **edits only their own** — and their wallet partner's (pays together); the **creator** can correct any row, manage people, **close** and **reopen**
  - either side of a payment taps **Paid**; inside a wallet the app shows who still owes whom (e.g. *Hanudeep owes Muza*, assuming the one who paid most covered the wallet) and that can be marked paid too
  - closed trips stay in everyone's history; friends can **Add to my ledger** to post their own share
  - enforced by the security rules, not just the screen
- Trips stay personal until you invite — "one person handles it" works as before

### 🔗 Billings (money spent for others)
- Buying for a client or a person: goods purchased vs money received, net profit/loss live, a shareable receipt image, close to post the result to your ledger

### 🗑️ Wastage
- Tap an expense in History to mark it 100% wasted; double-tap for a partial amount; Stats shows total waste and its share of spending

### 📊 Stats
- Balance and breakdown for the month, the **spending calendar**, spending by category, where the money went (donut), and the monthly report

### 🔒 App lock & your devices
- **One PIN for every device** — only a salted PBKDF2 hash is stored, never the PIN
- **Fingerprint / face / screen lock** on Android; a **passkey** (Touch ID, Windows Hello) on the web and desktop — set up per device
- Locks when the app opens, after the time away you choose (immediately … 1 hour), when a computer sits untouched for 5 minutes, or **from another of your devices**
- **Wrong PINs**: from the 5th the app waits longer each time (30 s → 1 h), your other devices show an alert (*Lock it · Sign it out · It was me*) and you get an **email**; after the 10th only signing in again opens it. Nothing is erased
- **Forgot PIN?** Sign in again with Google or your password and choose a new PIN — your data stays exactly as it is
- **Unlock from another device**: a locked laptop asks; your phone shows *Approve / Deny*
- **Profile → Security → Your devices**: every device signed in, a pulsing **Live** tag on those on screen right now, **Locked** on locked ones; lock or sign out any of them, or all others at once
- While locked, the app doesn't render or load your data at all
- Honest limits: the lock keeps people holding your unlocked phone or laptop out of the app; your data itself is protected by your account sign-in. A remote sign-out takes effect the moment that device is online

### ☁️ Google Drive backup
- Like WhatsApp: a full copy of everything goes to **"Expense Tracker backups" in your own Google Drive** — every day, week or month, keeping the newest 3–30 copies
- Only the `drive.file` permission: the app sees the files it creates and nothing else in your Drive
- The Android and desktop apps back up by themselves; the website asks for a tap when a backup is due (browsers need one to reach Google)
- **Restore** any copy from Profile, on this device or a new one — entries are written back and nothing else is deleted
- No copy of your backups, and none of your Google tokens, is kept on any server of ours

### 🔔 Reminders
Six optional reminders, all off until you tap their tile (Profile → Reminders), each with its own time:
- **Bills due** — "Have you paid rent?" on the day a bill is due (never for auto-paid bills or income)
- **Log the day** — skipped if you already logged something that day
- **Budget check** — once at 80% of the month's budget, once at 100%
- **Monthly report** — on your report day
- **Goals** — each goal's day: this month's share to put aside, or a nudge to collect it
- **Weekly summary** — your week in one line on the evening you pick

At most one per type per day. On Android they **pop up with a sound** (or arrive quietly — per device) and can be set to arrive **on the minute**; the card also explains the battery setting some phones (vivo, iQOO, Oppo, Xiaomi, Samsung) need. On the website they arrive by **cloud push** even with the page closed. Tapping one opens the right page. *Send a test* shows one right away.

### ⚙️ Your data
- **Export JSON** (everything: entries, billings, trips, recurring, trash, settings) and **Export CSV** (opens in Excel / Google Sheets, re-importable)
- **Import JSON / CSV** — record ids are kept or derived deterministically, so importing twice never duplicates
- **Recently Deleted** — deletes go to a trash you can restore from
- **Delete all data** or **delete the account**
- **Sync status** ("Synced", "Syncing…", "Offline — saved on this device") and **Updates** (version, build, *Check for updates*, *Restart to update*)

### 🎨 Look & layout
- **Liquid-glass** surfaces; a deep ink-blue **Midnight** dark mode; light, dark or follow the device — per device, applied before the first paint
- Motion you can switch off: a coin that flies into the month card, rolling numbers, a liquid budget gauge, self-drawing signs (respects *reduce motion*)
- **Phone**: bottom bar *Home · two pages · ＋ · one page* (choose them in Profile → Customize), Explore tiles on Home for every other page, swipe between bar pages
- **Desktop, web and tablets** (≥768 px wide and ≥600 px tall): the same pages with a sidebar — Overview (Home, History, Stats) · Money (Income, Bills, Budget, Savings) · With others (Trips, Billings, Debts) — and the full Add form open on Home; Home fits the window without page scrolling
- Tap your **avatar** for **Profile**: account, theme, animations, Security, Google Drive backup, Currency, Reminders, Customize, then Money · Sync · Your data · App · Account

---

## 🔄 Automatic updates

You install once; after that every platform updates itself.

| Platform | How it works |
|---|---|
| **Web** | Every push to `main` deploys the app to Firebase Hosting. The page always loads its newest code when opened; the service worker checks on open, when the tab comes back and every 30 minutes, and refreshes the offline copy in the background. The page is never reloaded while you use it — the new version runs the next time you open the app. |
| **Android** | Over the air: each deploy also publishes the app's web bundle (`/app/update.json` + a zip with a SHA-256 checksum) next to the website. The app checks on launch, on return and every 30 minutes, downloads in the background and switches on **Restart**, when it goes to the background, or during the next splash. A bundle that doesn't start is rolled back automatically. When a version needs new *native* code (`expensetracker.minNativeVersion` in `package.json`, now **3.11.0**), older apps stop receiving bundles and say *"install the new app"* once, with a link to the APK. |
| **Desktop** | Tauri's signed updater reads `latest.json` from the newest GitHub release, downloads in the background and offers **Restart to update**. Updates without a valid minisign signature are refused. |

After an update the app says *"Updated to vX"* once.

---

## 🏗️ Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 8, vanilla CSS with custom properties (design tokens), Lucide icons, Recharts 3 |
| **Database** | Firebase Firestore with the persistent on-device cache (offline reads and queued writes) |
| **Auth** | Firebase Auth — Google + email/password. Native Google picker on Android (Credential Manager, with the classic picker as fallback); browser sign-in with PKCE on desktop |
| **Android** | Capacitor 8: local notifications, Firebase Cloud Messaging, OTA updates (`@capgo/capacitor-updater`), and three small native plugins of our own — system bars, **BiometricPrompt**, Google **AuthorizationClient** for Drive |
| **Desktop** | Tauri 2 (Rust): menu bar / tray, single instance, open at login, notifications, loopback OAuth, signed updater |
| **Push & alerts** | Firebase Cloud Messaging (Android + web push) sent by a scheduled GitHub Action; email over SMTP (nodemailer) |
| **Backups** | Google Drive REST API (`drive.file`), Google Identity Services on the web |
| **Exchange rates** | fawazahmed0/exchange-api (jsDelivr / Cloudflare Pages) + Frankfurter (ECB) |
| **App lock** | Web Crypto PBKDF2-SHA256, WebAuthn platform authenticators, Android BiometricPrompt |
| **PWA** | Web App Manifest + a custom service worker (offline cache, push, notification taps) |
| **Build & deploy** | Vite (`/` for the web app, `--mode native` for the apps); GitHub Actions → Firebase Hosting (web app), GitHub Pages (product page, privacy policy, Android OTA, desktop update manifest, mirrored installers) and GitHub Releases (APK, DMG, EXE, AppImage, `latest.json`) |
| **Quality** | ESLint 9 (flat config); Vitest — unit tests for money maths, currencies, PIN rules, categories, budget, recurring, report, debts, goals, dates, import/export, backups, and server-render smoke tests of every screen |

---

## 📂 Project structure

```
ExpenseTracker/
├── index.html                  # Entry: splash, theme before first paint, PWA tags, service-worker registration
├── vite.config.js              # Website vs native builds; build-ID stamping for the service worker
├── firebase.json, .firebaserc  # Firestore rules + indexes for project expensetracker-385b0
├── firestore.rules             # Owner-only access, shape validation
├── firestore.indexes.json      # Collection-group indexes used by the notifier
├── capacitor.config.json       # Android app: id, OTA updater, Google sign-in
├── android/                    # Gradle project; MainActivity + SystemThemePlugin, BiometricPlugin, GoogleDrivePlugin
├── src-tauri/                  # Desktop (Rust): lib.rs (tray, commands), oauth.rs (loopback sign-in), reminders.rs
├── scripts/
│   ├── check-config.mjs        # Refuses to build without a Firebase config
│   ├── make-ota.mjs            # Android OTA bundle + update.json
│   ├── make-latest-json.mjs    # Desktop updater manifest
│   ├── render-icons.mjs        # App icons for every platform
│   ├── clear-db.mjs            # Maintenance: wipe one user's data
│   └── notifier/               # Scheduled job: website reminders + security alerts (push + email)
├── .github/workflows/          # deploy-web.yml · build-apps.yml · notifier.yml
├── public/
│   ├── manifest.json, icons    # PWA manifest
│   ├── sw.js                   # Service worker: offline cache, push, notification taps
│   └── privacy.html            # Privacy policy (Google consent screen, Play listing)
│
└── src/
    ├── main.jsx                # React entry
    ├── index.css, styles/      # Tokens and global styles; glass.css (Liquid Glass), layout.css
    ├── app/                    # App.jsx (AuthGate → LockGate → one shell: phone bar or sidebar),
    │                           #   month.js (the app-wide month), pages.js, shellContext.js, ready.js
    ├── features/
    │   ├── auth/               # Sign-in and sign-up
    │   ├── transactions/       # Home (TodayTab), History
    │   ├── income/ debts/ bills/ budget/ savings/ stats/
    │   ├── trips/              # Trips & splits: TripDetail (sheet + settlement), invite (QR / link / email),
    │                           #   JoinTripModal, tripCard.js (share image)
    │   ├── external/           # Billings
    │   ├── plan/               # Shared modals and cards: recurring rule, budget editor, goals
    │   ├── profile/            # Profile page
    │   └── settings/           # Settings sections, Reminders, Currency, Google Drive backup
    ├── tour/                   # App tour + page guides: tour.js (steps), TourHost (spotlight card), HelpButton (?)
    ├── security/               # App lock: pin.js (hash + lockout rules), useAppLock.js (state machine),
    │                           #   LockScreen, SecurityCard (lock, devices, alerts), SecurityBanners,
    │                           #   biometric.js, reauth.js, events.js
    ├── components/             # AddSheet, Sheet (spreadsheet entry), ShareSummaryModal, CurrencySelect, modals, …
    ├── motion/                 # Coin drop, rolling numbers, liquid gauge, signs, tilt
    ├── native/                 # Platform layer: index.js, updates.js, reminders.js (delivery),
    │                           #   push.js (FCM), googleSignIn.js (Android + desktop)
    ├── hooks/                  # useAuth, useFirestoreData (data + currency views), useRecurring, useDevices,
    │                           #   useDriveBackup, useStats, useExternalTransactions, …
    ├── services/
    │   ├── firebase.js         # App, Auth, Firestore (persistent cache), optional App Check
    │   ├── firestore.js        # All Firestore reads/writes: entries, trash, devices, lock, security events
    │   ├── sharedTrips.js      # Shared trips: trip doc + one doc per row / settlement, join, invite friends
    │   ├── sync.js             # Sync status, background writes, readable errors
    │   ├── rates.js            # Exchange rates: fetch, per-day cache, lookups
    │   └── drive.js            # Google Drive: tokens per platform, backup, list, restore, prune
    └── utils/
        ├── finance.js          # Every balance rule
        ├── money.js            # Currencies, formatting, display / entry currency
        ├── fx.js               # Currency views: day-rate history, live-rate balance, per-currency carry
        ├── shareCard.js        # The share image (Trips, Billings)
        ├── categories.js, budget.js, recurring.js, bills.js, goals.js, debts.js, report.js, split.js,
        │   carryForward.js, reminders.js, smartInput.js, backup.js, import/exportHelpers.js, dateHelpers.js, …
        └── __tests__/          # Vitest
```

---

## ⚙️ Installation & setup

### Prerequisites

- **Node.js** ≥ 20.19
- A **Firebase project** with Firestore and Authentication (Email/Password + Google). This app uses `expensetracker-385b0`
- Android app: JDK 21 and the Android SDK (Android Studio installs both)
- Desktop app: Rust (`rustup`) and, on Linux, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### 1. Clone and install

```bash
git clone https://github.com/thrishankkuntimaddi/ExpenseTracker.git
cd ExpenseTracker
npm install
```

### 2. Configure Firebase

```bash
cp .env.example .env     # fill in VITE_FIREBASE_* from Firebase Console → Project settings → Your apps
```

For the CI deploy, put the same values in the repository's **Settings → Secrets and variables → Actions** (Variables or Secrets). The API key must be **restricted by HTTP referrer** and the project should use **App Check** — see [SECURITY.md](SECURITY.md). The build refuses to publish without a config (`scripts/check-config.mjs`).

### 3. Deploy Firestore rules and indexes

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project expensetracker-385b0
```

> The app has its own Firebase project. It used to live in the shared `nistha-passi-core` project — never deploy this file there; `scripts/check-config.mjs` refuses builds pointed at it.

### 4. Run locally

```bash
npm run dev      # http://localhost:5173/ExpenseTracker/
npm run lint
npm test         # runs in Asia/Kolkata to exercise local-date edge cases
```

### 5. Build the apps on your machine

```bash
# Android — debug APK (or open in Android Studio)
npm run android:apk            # → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open

# Desktop
npm run desktop:dev            # live-reloading window
npm run desktop:build          # installers for this OS in src-tauri/target/release/bundle/
```

A local `desktop:build` also signs update files, so it needs the updater key (or turn them off with `--config '{"bundle":{"createUpdaterArtifacts":false}}'`):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.local/expensetracker-signing/tauri-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"
```

### 6. Google Cloud setup for sign-in and Drive backup

The app uses two Google Cloud projects:

| Project | Used by | Needs |
|---|---|---|
| **ExpenseTracker** (`expensetracker-385b0`, the Firebase project) | Website and Android sign-in and Drive backup | **Google Drive API** enabled · the *Web client (auto created by Google Service)* with `https://<you>.github.io` in **Authorized JavaScript origins** (its ID is `VITE_GOOGLE_WEB_CLIENT_ID`) · the Android client registered with the release key's SHA-1 (in `android/app/google-services.json`) |
| **expense-tracker** (`trim-mile-511210-h3`) | Desktop sign-in and Drive backup (`VITE_GOOGLE_DESKTOP_CLIENT_ID` / `_SECRET`, a "Desktop app" client) | **Google Drive API** enabled · **Google Auth Platform → Branding** filled in (app name, support email, home page, [privacy policy](https://thrishankkuntimaddi.github.io/ExpenseTracker/privacy.html), authorised domain `thrishankkuntimaddi.github.io`) · **Audience → Publish app** (In production) |

Until Google verifies the app, people see an *"unverified app"* screen once — **Advanced → Go to Expense Tracker**. The only Drive scope is `drive.file`, which Google treats as non-sensitive.

### 7. Cloud push and alert emails (free)

Website reminders while the page is closed, and security alerts, are delivered by [`scripts/notifier/`](scripts/notifier/notifier.mjs), run every ~10 minutes by [`.github/workflows/notifier.yml`](.github/workflows/notifier.yml). No Cloud Functions, so it works on the free Spark plan. The apps upload their own reminder plan (`users/{uid}/push_plan/current`); the job only delivers what's due.

1. Firebase Console → Project settings → **Service accounts** → *Generate new private key* → repository secret `FIREBASE_SERVICE_ACCOUNT` (the whole JSON)
2. Firebase Console → Project settings → **Cloud Messaging** → *Web Push certificates* → *Generate key pair* → repository variable `VITE_FIREBASE_VAPID_KEY`
3. Emails: a Gmail **app password** (Google Account → Security → App passwords) as the secret `SMTP_URL` = `smtps://you%40gmail.com:APP-PASSWORD@smtp.gmail.com:465`, and optionally the variable `MAIL_FROM` = `Expense Tracker <you@gmail.com>`
4. Deploy the indexes (step 3). Run it once by hand from the **Actions** tab (*Notifier → Run workflow*) to check the setup

GitHub may start scheduled runs a few minutes late, and pauses schedules in repositories with no commits for 60 days — re-enable it in the Actions tab.

---

## 🚢 Releasing

| What | How |
|---|---|
| **Web app + product page + Android OTA** | Push to `main`. `deploy-web.yml` lints, tests and builds; the **web app** goes to **Firebase Hosting** (`expensetracker-in.web.app`, root of the site); **GitHub Pages** gets the **product page** (`landing/`), the privacy policy and the app update files under `/app/` (Android bundle + manifest, desktop manifest, mirrored installers) — `scripts/build-pages.mjs`. |
| **Hosting setup (once)** | The `FIREBASE_SERVICE_ACCOUNT` secret needs the **Firebase Hosting Admin** role (Google Cloud → IAM). A custom address (e.g. `expensetracker.web.app`): `firebase hosting:sites:create expensetracker`, point `firebase.json` at it, set the repository variable `APP_URL`, and add the domain to Firebase Auth's authorised domains, the reCAPTCHA (App Check) key and the web OAuth client's JavaScript origins. Without the secret the workflow skips the app deploy. |
| **New version** (all platforms) | Bump `version` in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, commit as `release: X.Y.Z — …`, then `git tag vX.Y.Z && git push origin main vX.Y.Z`. `build-apps.yml` builds the signed APK and the Mac (Apple Silicon + Intel), Windows and Linux installers, writes `latest.json`, publishes the release and removes older ones. |
| **Native code changed?** | When Android native code or Capacitor plugins change, raise `expensetracker.minNativeVersion` in `package.json` to the new version, so older APKs are asked to install the new one instead of receiving a bundle they can't run. |

---

## 🔑 Environment variables & secrets

`APP_URL` (repository variable): where the web app is served — used in trip invite links and emails. Default `https://expensetracker-in.web.app/`.


### Build time (`.env` locally; repository variables or secrets in CI)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | **Required.** Firebase web config |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key — turns on Firebase App Check |
| `VITE_GOOGLE_DESKTOP_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | "Desktop app" OAuth client: Google sign-in and Drive backup in the desktop app (empty = Google sign-in hidden there) |
| `VITE_GOOGLE_WEB_CLIENT_ID` | "Web application" OAuth client for Drive backup on the website |
| `VITE_FIREBASE_VAPID_KEY` | Web push key (empty = the website shows reminders only while it's open) |

### CI secrets

| Secret | Used for |
|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Signing the APK. **Keep the keystore safe** (backed up outside the release machine) — phones only accept updates signed with the same key |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing desktop updates (the public key is in `tauri.conf.json`) |
| `FIREBASE_SERVICE_ACCOUNT` | The notifier job (push + alert emails) |
| `SMTP_URL` | Alert emails (optional); `MAIL_FROM` and `APP_URL` are optional variables |

---

## 🧠 How it works

### Data flow

```
User action → component → useFirestoreData
    ├─ optimistic setState (stored form; the UI sees currency views)
    └─ Firestore write ──(rejected)──▶ roll back + error banner
                     ──(offline)───▶ queued in IndexedDB, synced on reconnect
Firestore listeners ─▶ stored entries ─▶ views in the display currency (day rates) ─▶ pages
```

### Key design decisions

1. **Client ids as document ids** — imports derive deterministic ids, so re-imports overwrite instead of duplicating.
2. **Atomic trash** — delete = write to `recently_deleted` + remove the original in one batch; restore is the reverse.
3. **Local calendar everywhere** — dates are UTC ISO strings, bucketed with `localDateKey` / `localMonthKey`, so 00:30 IST lands on the right day.
4. **Money in paise** — totals are summed as integers and stored amounts rounded to 2 decimals.
5. **One home for the maths** — `utils/finance.js` holds every balance rule; `utils/fx.js` every currency rule. Both are unit-tested.
6. **Stored entries never change currency** — the app works on *views*: copies whose money is in the display currency, with the originals in `orig`. Entries already in the display currency pass through untouched, so a one-currency account behaves exactly as before. Edits are mapped back: a rename keeps the original dollars; a typed amount is stored in the currency it was typed in.
7. **History at the day's rate, balance at today's** — balances are computed per currency (`liveBalance`) and only the remainder is valued live.
8. **The lock gates rendering** — while locked, the app component tree (and its Firestore listeners) isn't mounted.
9. **No server decides anything** — reminders are planned on the device (`buildSchedule`); the notifier only delivers what the apps uploaded.
10. **Grace period in auth** — 800 ms before a `null` user counts as signed out, avoiding false sign-outs during token refresh.

---

## 🗃️ Firestore data model

```
users/{uid}                         ← { email, settings, createdAt }
  │                                    settings = { currency: 'INR' | 'USD' | …,
  │                                                 budgets: { total, categories, deductions[] },
  │                                                 goals: [{ id, name, target, monthly?, heldWith?, status?, … }],
  │                                                 categoryRules, carryForward, reminders, report, ui,
  │                                                 driveBackup: { enabled, frequency, keep } }
  ├── transactions/{id}             ← { name, amount, currency?, fx?, type, date, month, category?, direction?, wasteAmount?, recurringId?, tripId?, … }
  ├── income/{id}                   ← { name, amount, currency?, fx?, date, month, isBorrowed?, isRepaymentRec?, recurringId?, … }
  │                                    currency missing = INR (entries from before 3.11);
  │                                    fx = { USD: 1, INR: 95.2 } — the rates when a foreign entry was made
  ├── recurring/{id}                ← { name, amount, currency?, kind, frequency, dayOfMonth?/weekday?, startDate, endDate?, autoPost, active, lastHandledKey?, … }
  ├── trips/{id}                    ← { name, currency?, startDate, endDate?, status, meMemberId?, members[], expenses[], settlements[], postedEntryIds[] }
  │                                    (personal trips; shared ones move to shared_trips)
  ├── external_transactions/{id}    ← billing session { name, items[], received[], status, net_balance, … }
  ├── recently_deleted/{id}         ← { itemType, originalData, deletedAt, … }
  ├── devices/{deviceId}            ← { name, kind, platform, lastSeen, visible, locked?, command?, unlockRequest?, unlockApproval? }
  ├── security/lock                 ← { enabled, pinHash, salt, iterations, length, lockAfter, fails, lastFailAt }
  ├── security_events/{id}          ← { type, at, device, deviceId, count?, notified, seenBy? }
  ├── push_tokens/{deviceId}        ← { token, platform, reminders, security, tz }
  ├── push_plan/current             ← { items[{ id, at, title, body, route, type }], nextAt, sentUpTo? }
  └── drive_backup/state            ← { lastAt, lastFile, lastDevice, error? }
```

```
shared_trips/{tripId}               ← { name, currency?, startDate, endDate?, status, ownerUid, ownerName, members[],
  │                                     memberUids[], uidMember{uid: memberId}, memberUnit{memberId: unit}, people{uid: {name, photo}}, … }
  ├── expenses/{id}                 ← { title, amount|null, paidBy, splitAmong[], by, updatedAt }
  └── settlements/{id}              ← { fromUnit, toUnit, amount, date, fromMember?, toMember?, by }
```
  The 20-character trip id travels only in the invite link; anyone signed in can read a trip by id and join it once while it is open. Rows: the payer's wallet or the creator. Settlements: either side or the creator.

- Posted recurring occurrences are ordinary entries with id `rec_<ruleId>_<YYYY-MM-DD>` — that is what makes posting idempotent
- **Transaction types**: `expense`, `savings`, `person` (`direction`: lent / borrowed / repaid / repayment / given_gift), `external`
- **Income kinds** (`incomeKind()`): `income`, `borrowed`, `repayment`

---

## 🛡️ Privacy & security

- No ads, no trackers, no selling or sharing of data — see the [privacy policy](https://thrishankkuntimaddi.github.io/ExpenseTracker/privacy.html)
- Firestore rules: a user can reach only `users/{their uid}/**`; entries, recurring rules and trips are shape-validated
- Shared trips: readable only with the invite link (a random 20-character id) or once joined; edit rights are enforced by the rules, not just hidden in the app — tested against the Firestore emulator
- Signing out (or a remote sign-out) wipes the device's offline copy of your data
- App lock stores only a salted PBKDF2-SHA256 hash (150,000 iterations); biometrics never leave the device
- Drive access is limited to files the app creates (`drive.file`); backups live only in your Drive
- Report a vulnerability: see [SECURITY.md](SECURITY.md)

---

## 🩺 Troubleshooting

| Problem | Fix |
|---|---|
| **Android: "No credentials available" on Google sign-in** | Update to 3.11.0 or later — it falls back to Google's classic account picker. Still failing: add a Google account in Android Settings → Accounts and update *Google Play services*, or sign in with email |
| **Android reminders arrive late or not at all** | Profile → Reminders → turn on *On the minute*; in Android Settings → Apps → Expense Tracker → Battery choose **Unrestricted** (vivo/iQOO/Oppo/Xiaomi: also allow *Auto-start*) |
| **Shared trip: "This invite isn't valid any more"** | The trip was deleted by its creator, or the link was cut off when pasted — ask for the link again |
| **Shared trip: can't edit a row** | Rows belong to the person who paid. Only they, their pay-together partner and the trip's creator can change it; a closed trip is locked until the creator reopens it |
| **Android app says "install the new app"** | A release added native code — download the latest APK and install it over the current one. Data and sign-in stay |
| **Drive backup: "Access blocked … not completed the Google verification process"** | The OAuth consent screen of that client's project is still in *Testing* — fill in Branding and *Publish app* (see [step 6](#6-google-cloud-setup-for-sign-in-and-drive-backup)) |
| **Drive backup: "Google Drive isn't switched on for this app yet"** | Enable the Google Drive API in the project that owns the client (see step 6), wait a few minutes, retry |
| **Website reminders don't arrive while closed** | Allow notifications for the site; on iPhone add it to the Home Screen first; check the Notifier workflow is enabled in the Actions tab |
| **Mac: "could not verify"** / **Windows SmartScreen** | See [Get the app](#-get-the-app) |
| **Forgot the app lock PIN** | On the lock screen: *Forgot PIN?* → sign in again → choose a new PIN. Nothing is deleted |

---

## 🚧 Challenges & solutions

| Challenge | Solution |
|---|---|
| Shared Firebase project with other apps | Moved to its own project (`expensetracker-385b0`), data migrated from a full backup |
| Reinstalling for every fix | OTA bundles on Android, signed updater on desktop, service worker on the web |
| Google sign-in failing on some Android phones | Credential Manager first, Google's classic picker as fallback, readable guidance when both fail |
| Converting money without rewriting history | Per-entry currency + rate snapshot; day-rate views for history, per-currency balances at the live rate |
| Thousands of historical rates | One ECB range request per year; per-day cache on the device; pegged currencies computed |
| Push and alert emails on the free plan | A scheduled GitHub Action delivers plans the apps uploaded — no Cloud Functions |
| One PIN, many devices, no server | Salted hash in Firestore, account-wide failure counter, device commands through each device's own document |
| Old Android WebViews drawing ghost copies of cards | Settings shows the web engine version and links to the WebView update when it's older than Chrome 130 |
| Dates landing on the wrong day near midnight | Local-calendar date keys instead of slicing UTC ISO strings |
| Service worker serving stale assets | Cache name stamped with the build ID; `index.html` loaded network-first, so each open runs the newest code — no forced reloads mid-use |

---

## 🔮 Roadmap

- [x] Budgets with pace and safe-to-spend
- [x] Recurring entries and bills
- [x] Smart, learnable categories
- [x] Savings goals with holders
- [x] Monthly report, salary to salary
- [x] Native apps (Android, Mac, Windows, Linux) with automatic updates
- [x] **Multi-currency** with day-rate history and live-rate balances (3.11)
- [x] **App lock** across devices, live devices, remote lock / sign-out, intrusion alerts (3.11)
- [x] **Google Drive backup** and restore (3.11)
- [x] **Cloud push** for website reminders, pop-up reminders on Android (3.11)
- [x] **Shared trips** — invite by QR / link / email / friends, per-person editing, wallet balances, full share images (3.12)
- [ ] **Sync only what changed** since the last visit (far fewer Firestore reads)
- [ ] **Auto-capture UPI and bank payments** on Android, on-device — Play Store build only (Android 15+ hides some bank SMS from all apps)
- [ ] **Play Store** release — waits for the developer account and payments setup
- [ ] Notarised Mac build
- [ ] Shared budgets for couples and families
- [ ] Receipt photos and OCR

---

## 🤝 Contributing

1. **Fork** the repository and create a branch: `git checkout -b feature/my-feature`
2. Make your changes; check `npm run lint && npm test && npm run build`
3. Commit with a descriptive message (`feat: …`, `fix: …`) and open a Pull Request against `main`

Guidelines:
- Money maths goes in `utils/finance.js`, currency rules in `utils/fx.js` — with tests
- All Firestore writes go through `useFirestoreData` / `services/firestore.js` so optimistic updates and rollback stay consistent
- New transaction types belong in `src/utils/typeConfig.js`
- Format money with `formatAmount` / `formatMoney` (never a hard-coded `₹`)
- Never commit `.env` files or signing keys

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
  <strong>Built with ⚡ React · Firebase · Capacitor · Tauri · Vite</strong><br/>
  <em>Personal finance that follows you — across months, devices and currencies.</em>
</div>
