# Server code (written, not running)

The app runs on Firebase's free **Spark** plan, which has no Cloud Functions.
Everything here is ready for when the project moves to **Blaze**
(pay-as-you-go; small apps usually stay inside its free tier). Until then the
features that need it stay switched off in the app, and nothing here is
deployed — `firebase.json` doesn't even list it, and CI deploys `--only hosting`.

| Function | Feature | Switch in the app |
|---|---|---|
| `razorpayWebhook` | Paid support on the website / APK (Razorpay) | `VITE_PAID_SUPPORT=1` |
| `verifyPlayPurchase` | Paid support in the Play app (Google Play Billing) | `VITE_PAID_SUPPORT=1` |
| `setuCreateConsent`, `setuFetch`, `setuWebhook` | Link a bank (Account Aggregator via Setu) | `VITE_BANK_LINK=1` |

Supporter days from invites need **no server** — the Firestore rules keep them honest.

## Turning paid support on (later)

1. Firebase console → Upgrade to **Blaze**. Set a budget alert (e.g. ₹500).
2. Add to `firebase.json`:
   ```json
   "functions": [{ "source": "server/functions", "codebase": "default" }]
   ```
3. Secrets (never in the repo):
   ```
   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
   firebase functions:secrets:set PLAY_SERVICE_ACCOUNT_JSON   # JSON of a service account with Play Console "View financial data" + "Manage orders"
   ```
4. `cd server/functions && npm install && cd ../.. && firebase deploy --only functions`
5. Razorpay Dashboard → Webhooks → the `razorpayWebhook` URL, event `payment.captured`.
   Play Console → Monetize → In-app products → create `supporter_month` and `supporter_year` (one-time).
6. Build the app with `VITE_PAID_SUPPORT=1` (GitHub → Settings → Variables).

Prices are set in Razorpay / Play Console, not in code. Plans and their days: `PLANS` in `supporters.js`.

## Turning bank linking on (later)

Bank linking reads transactions through an RBI Account Aggregator. It can never move money.
It needs a Setu FIU account, which needs a registered business (Setu walks you through FIU onboarding).

1. https://bridge.setu.co → create an **Account Aggregator (FIU)** product → sandbox keys first.
2. Secrets:
   ```
   firebase functions:secrets:set SETU_CLIENT_ID
   firebase functions:secrets:set SETU_CLIENT_SECRET
   firebase functions:secrets:set SETU_PRODUCT_INSTANCE_ID
   firebase functions:secrets:set SETU_WEBHOOK_TOKEN      # any long random string; set the same as the webhook auth header in Setu Bridge
   ```
   Sandbox is the default (`SETU_BASE`); for live, set `SETU_BASE=https://fiu.setu.co` in `server/functions/.env`.
3. `firebase deploy --only functions`, then in Setu Bridge set the webhook URL to the `setuWebhook` function.
4. **Check the endpoints and payloads in `setu.js` against Setu's current docs in the sandbox** (they were written from the v2 docs, not yet run against Setu).
5. Build the app with `VITE_BANK_LINK=1`. Profile → Bank accounts appears.
6. Update the privacy policy and Play data-safety form (*Financial info* is then collected) before switching it on for everyone.

How it fits with everything else: fetched transactions wait in `users/{uid}/bank_inbox` and are reviewed exactly like an
imported statement. Entries the person already has (typed, captured from SMS, imported) come up unticked, so the ledger
never doubles. Nothing is added without a tap.
