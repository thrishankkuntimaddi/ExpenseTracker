# Security

This app is multi-user: every signed-in person gets a private slice of Firestore
(`users/{uid}/**`) and the rules in `firestore.rules` refuse everything else.
The things below keep that promise when the app is deployed publicly.

## 1. The Firebase web API key (GitHub "Google API Key" alert)

The value GitHub flagged is the **Firebase web API key**. Firebase ships this key
inside every web app bundle — it identifies the project, it does not grant
access (Firebase docs: *"API keys for Firebase services are ok to include in
code"*). Access is controlled by the Firestore rules, by Authentication, and by
restricting what the key may be used for. Do all of the following once:

1. **Rotate it** (the old value is in git history forever):
   Google Cloud Console → APIs & Services → Credentials → *Browser key (auto
   created by Firebase)* → **Regenerate key**. Put the new value in `.env`
   locally and in the GitHub repository variable `VITE_FIREBASE_API_KEY`.
2. **Restrict it** on the same page:
   - *Application restrictions → HTTP referrers*:
     `https://thrishankkuntimaddi.github.io/*`, `http://localhost:5173/*`
     (add any other origin you serve from).
   - *API restrictions → Restrict key* to: Identity Toolkit API, Token Service
     API, Cloud Firestore API, Firebase Installations API, Firebase App Check API.
3. **Close the GitHub alert** as *"Used in tests / Won't fix"* with a note that it
   is the Firebase web key and has been rotated + restricted. The alert cannot
   be resolved by removing the value from the current tree alone.

The config now comes from `VITE_FIREBASE_*` environment variables
(`.env.example` lists them) and is no longer committed.

## 2. Firebase App Check (recommended for public deployments)

Register a reCAPTCHA v3 site key in Firebase Console → App Check, set
`VITE_APPCHECK_SITE_KEY` (locally and as a repository variable), redeploy, then
turn on **enforcement** for Firestore. After that, only this app's bundle can
talk to your database even with the API key.

## 3. Authentication settings (Firebase Console → Authentication → Settings)

- **User actions → Email enumeration protection: ON** — stops "is this email
  registered?" probing on the login page.
- **Password policy**: require at least 8 characters.
- Consider **Email verification** before first sign-in if you open the app to
  people you don't know.

## 4. What the rules enforce

- Every path under `users/{uid}` is readable/writable only by that `uid`.
- `transactions` and `income` must have a numeric `amount` (bounded), a string
  `date` and a non-empty `name`.
- `recurring` rules must have a bounded name, a bounded amount and a valid kind.
- `trips` must have a bounded name and bounded member / expense lists.
- The project-wide catch-all for the other apps in this Firebase project
  explicitly excludes `users/**`.

Deploy after changes: `firebase deploy --only firestore:rules --project <id>`.

## 5. Secrets that must never be committed

| File | Contains |
|---|---|
| `.env`, `.env.local` | Firebase web config, App Check key |

These are ignored by `.gitignore`.

## 6. Reporting

Open a private security advisory on the GitHub repository, or email the
maintainer. Please do not file public issues for vulnerabilities.
