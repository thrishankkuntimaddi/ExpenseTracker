// Packs dist-native/ as an over-the-air bundle for the Android app and
// writes the manifest the app checks (published with the website):
//   dist/app/bundle-<build>.zip   dist/app/update.json
// Run after `npm run build` and `npm run build:native`.
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const code = (v) => { const [a = 0, b = 0, c = 0] = v.split('.').map(Number); return a * 10000 + b * 100 + c; };
const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const build = Number(run('git log -1 --format=%ct'));
const commit = run('git rev-parse --short HEAD');
const base = 'https://thrishankkuntimaddi.github.io/ExpenseTracker/app';

if (!fs.existsSync('dist-native/index.html')) throw new Error('dist-native/ missing — run npm run build:native first');
fs.mkdirSync('dist/app', { recursive: true });
const zip = `bundle-${build}.zip`;
// index.html at the zip root (the updater requires it)
execSync(`cd dist-native && zip -qr -X ${path.resolve('dist/app', zip)} .`);
const manifest = {
  version: pkg.version,
  build,
  commit,
  minNativeBuild: code(pkg.expensetracker?.minNativeVersion ?? pkg.version),
  url: `${base}/${zip}`,
  // the updater refuses bundles without a matching checksum
  sha256: crypto.createHash('sha256').update(fs.readFileSync(`dist/app/${zip}`)).digest('hex'),
  publishedAt: new Date().toISOString(),
};
fs.writeFileSync('dist/app/update.json', JSON.stringify(manifest, null, 2));
console.log(`✓ OTA bundle ${zip} (${Math.round(fs.statSync(`dist/app/${zip}`).size / 1024)} kB) for Android ≥ ${pkg.expensetracker?.minNativeVersion}`);
