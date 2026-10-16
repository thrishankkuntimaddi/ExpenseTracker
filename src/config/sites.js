// ─── Where things live ────────────────────────────────────────────
//   APP_URL   the web app (Firebase Hosting). Trip invite links point here.
//   SITE_URL  the product page on GitHub Pages: features, downloads, demo.
//             App update files (/app/update.json, installers) stay there too.
// VITE_APP_URL overrides the app's address (e.g. a custom domain later).
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://expensetracker-385b0.web.app/';
export const SITE_URL = 'https://thrishankkuntimaddi.github.io/ExpenseTracker/';
export const DOWNLOADS_URL = `${SITE_URL}#download`;
