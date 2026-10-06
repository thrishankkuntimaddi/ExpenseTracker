// ─── Firebase Initialisation ─────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  clearIndexedDbPersistence,
} from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { firebaseConfig, firebaseConfigError } from "./firebaseConfig";

export { firebaseConfigError };

// With no config, export null handles instead of crashing at import time;
// AuthGate shows a "setup required" screen in that case.
const app = firebaseConfigError ? null : initializeApp(firebaseConfig);

// App Check — blocks requests that don't come from this app (scripts, bots).
// Enabled when a reCAPTCHA v3 site key is provided at build time.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (app && appCheckKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Auth with IndexedDB persistence (survives tab close + token refresh)
export const auth = app ? getAuth(app) : null;
if (auth) setPersistence(auth, browserLocalPersistence).catch(() => {});

// Firestore with IndexedDB offline cache: instant first paint from disk,
// offline reads/writes, and only changed docs re-downloaded on reconnect.
export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}) : null;

/* Wipe the on-device Firestore cache (call on sign-out so the next person on
   a shared device can't read the previous user's data from IndexedDB).
   The Firestore instance is unusable afterwards — reload the page. */
export async function clearLocalFirestoreCache() {
  if (!db) return;
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

export default app;
