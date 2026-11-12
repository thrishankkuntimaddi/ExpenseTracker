# Publishing on Google Play

Everything the app needs for Play is in place. What's left needs **your** Google account — follow the steps in order; copy-paste the texts below.

## What's already done

| | |
|---|---|
| Store build | Every release (`v*` tag) attaches **`ExpenseTracker-Play.aab`**, signed with the same key as the APK. Upload that file to Play. It is the `play` build type (`./gradlew bundlePlay`), the only build with auto-capture — UPI-app notifications **and bank SMS**. The APK on the website leaves both out (checked on every build: it declares no SMS permission and no notification listener), because Play Protect blocks sideloaded apps that read notifications or SMS. |
| Auto-capture | Profile → Notifications → *Auto-capture payments*. One main switch, then two sources: *UPI app notifications* (Android's Notification access) and *Bank SMS* (Android's normal SMS prompt, `RECEIVE_SMS` only — never `READ_SMS`, the inbox is never read). Only business senders (letters, like `AD-HDFCBK`) are looked at; messages from phone numbers are skipped. Payments wait on Home for Add / ✕; anything already in the ledger (typed by hand, imported, or added before) is not offered again. |
| Package / version | `com.thrishank.expensetracker`; versionCode follows `package.json` (3.12.0 → 31200), so every release is higher than the last |
| Target API | Android 16 (API 36) — above Play's minimum |
| Updates | Play installs get native updates from Play: the app detects it was installed from Play and points “new version” prompts to the Play listing instead of the APK. Web-code updates still arrive over the air, which Play allows (code running in a WebView). |
| Privacy policy | https://thrishankkuntimaddi.github.io/ExpenseTracker/privacy.html (covers payment capture, shared trips, Drive) |
| Prominent disclosure | Profile → Auto-capture payments explains what is read and that it stays on the phone, before Android's SMS prompt or Notification access screen appears |

## Your steps

1. **Developer account** — https://play.google.com/console → sign up ($25 one-time). Choose a *personal* account; Google verifies your identity (ID + address), which can take a few days. Personal accounts created after Nov 2023 must run a **closed test with at least 12 testers for 14 days** before production — your trip friends are perfect for this.
2. **Create app** — name *Expense Tracker*, default language English (India), App, Free.
3. **Play App Signing** — when asked, choose *“Use my upload key”* … or simply upload the `.aab`: Play generates its app-signing key and treats the key the AAB was signed with as the **upload key**. (Keep using the same CI secret — nothing changes.)
4. **App content** (left menu → Policy → App content) — answers below.
5. **Store listing** — texts below; screenshots: take 4–8 phone screenshots (Home, Add, Stats, Trips, Debts) at 1080×1920 or larger; feature graphic 1024×500.
6. **Testing → Closed testing** — create a track, add testers by email (or a Google Group), upload `ExpenseTracker-Play.aab` from the latest GitHub release, roll out. After 14 days with 12+ testers, apply for production.

> Friends who already use the APK: a Play install is the same app, same signature only if Play signs with *your* key. Usually Play re-signs with its own key, so Android treats it as a different signer — they must **uninstall the APK and install from Play once** (their data is in the cloud; nothing is lost).

## Store listing

**App name** (30): `Expense Tracker`

**Short description** (80):
`Track spending, budgets, bills and trips. Split with friends. Private and free.`

**Full description** (4000):
```
Expense Tracker is a fast, private money app for everyday India — and anywhere else.

• Add an expense in a second: type “chai 20” or tap +. Smart categories learn as you go.
• Auto-capture payments (optional): spot Google Pay, PhonePe, Paytm and bank SMS payments on your phone and add them with one tap. Read on your phone only.
• Budgets that tell you what’s safe to spend, bills and recurring entries with reminders, savings goals.
• Trips & splits: invite friends by QR code or link. Everyone adds what they paid, sees who owes whom, and marks payments done. Couples can pay as one wallet.
• Billings: buying for someone else? Track what you spent and what you got back.
• Debts: lent and borrowed, with repayments.
• Stats: spending calendar, categories, and a monthly report from salary to salary.
• Multi-currency with the rate of the day.
• App lock with fingerprint and one PIN across your devices.
• Google Drive backup to your own Drive. Works offline.
• The same account on Android, web, Mac, Windows and Linux.

No ads. No selling data. Open source.
```

**Category**: Finance · **Tags**: Budget, Expense tracker, Money manager
**Contact email**: your email · **Website**: https://thrishankkuntimaddi.github.io/ExpenseTracker/

## App content answers

- **Privacy policy**: the URL above.
- **Ads**: No ads.
- **App access**: *All or some functionality is restricted* → give reviewers a test login: create an account in the app (e.g. `play-review@…` + password) and paste it here. Add: “Trips → Invite needs a second account; Auto-capture needs Notification access (Profile → Auto-capture payments).”
- **Content rating**: questionnaire → Category *Utility, Productivity, Communication, or Other*; answer No to violence, sexual content, gambling, etc. → *Everyone*.
- **Target audience**: 18+ (finance app; keeps you out of Families policy).
- **News app**: No. **COVID**: No. **Government app**: No.
- **Financial features**: *“My app doesn't provide any financial features”* is **not** right — choose **“Other”** / *personal finance management (budgeting, expense tracking)*; it does **not** offer loans, banking, payments, crypto or investments.
- **Data safety** (what leaves the device and is stored on Firebase):

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Personal info → Email address, Name | Yes | No | Account management | Required |
| Financial info → Other financial info (your entries) | Yes | No | App functionality | Required |
| Photos? | No | | | |
| App info & performance → Crash logs | No | | | |
| Device or other IDs → (device id for "Your devices") | Yes | No | App functionality, Security | Required |
| Messages → SMS / notifications | **No** — read on the device only, never transmitted (Play's definition of “collected” = sent off the device) | | | |

  Also tick: *Data is encrypted in transit* (HTTPS) · *Users can request deletion* (Profile → Delete all my data, and account deletion) · deletion URL: the privacy policy page.
- **SMS permission declaration** (Policy → App content → *Sensitive permissions*; Play asks when the first `.aab` with `RECEIVE_SMS` is uploaded):
  - Core functionality: **“SMS-based money management”** (the listed exception for SMS permissions).
  - Text: *“Expense Tracker is a personal expense tracker. With the user's permission it reads incoming bank transaction SMS (debits and credits from business senders such as AD-HDFCBK) on the device and offers each as an expense or income entry the user can add with one tap. Messages from people (phone numbers) are ignored. SMS content is processed on the device only and never uploaded; nothing is saved to the user's account unless they tap Add. Only RECEIVE_SMS is used — the inbox is never read.”*
  - Video (Play asks for one): Profile → Auto-capture payments → switch on → Android's SMS prompt → Allow → a bank SMS arrives → it appears on Home → Add. 30–60 s screen recording is enough.
  - **If Play rejects SMS** (it can — the exception is reviewed by people): delete the `<uses-permission … RECEIVE_SMS>` line and the `BankSmsReceiver` block from `android/app/src/play/AndroidManifest.xml`, release again. The app hides the *Bank SMS* row by itself; UPI-app notifications (and bank SMS via the SMS app's notifications) keep working.
- **Notification access declaration**: the app uses `BIND_NOTIFICATION_LISTENER_SERVICE` (Notification access, granted by the user in Settings). Justification: *“Optional feature that detects payments from UPI apps and bank SMS notifications on the device so users can add them to their expense log with one tap. Only allow-listed payment and SMS apps are read; data stays on the device unless the user adds an entry.”* Record a short screen video of Profile → Auto-capture → Notification access → a payment appearing on Home; Play may ask for it.
- `SCHEDULE_EXACT_ALARM` (On-time reminders, user-enabled): justification *“User-requested reminders for bills and recurring payments at an exact time.”*

## Notes

- Why both sources: on Android 15+ Android hides notifications that look like they hold a one-time code from every third-party app, so some bank SMS never reach the notification route. `RECEIVE_SMS` gets them straight from Android. When both see the same payment it shows once.
- The website APK keeps working for people who prefer it; both get the same over-the-air web updates.

## Credentials — what to hand over, and where

Nothing needs to be given to anyone in chat. When the Play account is ready:

| What | Where it goes | Needed for |
|---|---|---|
| Play Console account (your Google login) | You sign in yourself | Steps 1–6 above |
| Upload key | **Already set** — the GitHub secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` sign both the APK and the `.aab`. Don't make a new key. | Every release |
| Reviewer test login | Play Console → App content → App access | Review |
| *(Optional, later)* Service-account JSON with “Release manager” on the app | GitHub secret `PLAY_SERVICE_ACCOUNT_JSON` | Uploading each release to Play automatically instead of by hand |

Build locally without the CI: `npm run android:sync`, then `android/gradlew -p android :app:bundlePlay` (with the keystore env vars set, it's signed with the upload key; without them it's a debug-signed test build).
