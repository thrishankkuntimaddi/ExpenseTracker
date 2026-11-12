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
