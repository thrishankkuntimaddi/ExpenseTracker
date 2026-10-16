// Assembles the GitHub Pages site in dist-pages/:
//   /             the product page (landing/)
//   /privacy.html the privacy policy (public/privacy.html)
//   /sw.js        retires the old web app's service worker at this address
//   /app/         app update files: Android over-the-air bundle + manifest,
//                 desktop updater manifest, mirrored installers (moved here
//                 from dist/app — the web app itself goes to Firebase Hosting)
import fs from 'node:fs';

const out = 'dist-pages';
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync('landing', out, { recursive: true });
fs.copyFileSync('public/privacy.html', `${out}/privacy.html`);
if (fs.existsSync('dist/app')) {
  fs.cpSync('dist/app', `${out}/app`, { recursive: true });
  fs.rmSync('dist/app', { recursive: true, force: true });
}
// GitHub Pages: serve files as they are (no Jekyll)
fs.writeFileSync(`${out}/.nojekyll`, '');
console.log('dist-pages ready:', fs.readdirSync(out).join(', '));
