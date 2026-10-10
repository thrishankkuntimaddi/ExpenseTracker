// Fails the build when the Firebase web config is missing, so a broken bundle
// (stuck splash screen) can never be published. Reads the same sources Vite
// does: .env files in the repo root, then the process environment.
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const missing = required.filter((k) => !env[k]);

if (missing.length) {
  console.error(`\n✖ Firebase config missing: ${missing.join(', ')}\n` +
    '  Provide it ONE of two ways (see README → Configure Firebase):\n' +
    '   1. GitHub → repo Settings → Secrets and variables → Actions → add the VITE_FIREBASE_* entries, or\n' +
    '   2. commit the .env file:  git add -f .env && git commit -m "firebase config" && git push\n');
  process.exit(1);
}
// ExpenseTracker moved to its own project (2026-10). The old shared project
// still holds a stale copy of the data — never ship a build pointing at it.
if (env.VITE_FIREBASE_PROJECT_ID === 'nistha-passi-core') {
  console.error('\n✖ The Firebase config still points at the old shared project (nistha-passi-core).\n' +
    '  Update the VITE_FIREBASE_* repository variables to the expensetracker-385b0 web app config.\n');
  process.exit(1);
}
console.log(`✓ Firebase config present (project ${env.VITE_FIREBASE_PROJECT_ID})`);
