/* global process */
// ─── Firebase web config ─────────────────────────────────────────
// Read from environment variables so the project's identifiers never sit in
// git (GitHub secret-scanning flags the API key even though Firebase web keys
// are public identifiers — access control lives in firestore.rules, App Check
// and the key's HTTP-referrer restriction; see SECURITY.md).
//
//   • Vite (the app):  VITE_FIREBASE_* in .env / .env.local / CI variables
//   • Node (scripts/): run with  node --env-file=.env scripts/clear-db.mjs
const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof process !== 'undefined' ? process.env : {});

/**
 * Values pasted into GitHub / .env files often carry junk: a trailing "\r"
 * from Windows line endings, surrounding quotes, or the whole "NAME=value"
 * line. Any of those makes Firebase reject the key, so normalise here.
 */
export function cleanEnvValue(raw, name) {
  let v = String(raw ?? '').trim();
  if (name && v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  return v;
}
const read = (name) => cleanEnvValue(env[name], name) || undefined;

export const firebaseConfig = {
  apiKey:            read('VITE_FIREBASE_API_KEY'),
  authDomain:        read('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:         read('VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     read('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             read('VITE_FIREBASE_APP_ID'),
  measurementId:     read('VITE_FIREBASE_MEASUREMENT_ID'),
};

const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter((k) => !firebaseConfig[k]);

/** Non-null when the build was made without the VITE_FIREBASE_* variables. */
export const firebaseConfigError = missing.length
  ? `This build has no Firebase configuration (missing ${missing.join(', ')}). ` +
    'Locally: copy .env.example to .env and fill in the VITE_FIREBASE_* values. ' +
    'On GitHub: add them as repository variables (Settings → Secrets and variables → Actions → Variables) and redeploy.'
  : null;
