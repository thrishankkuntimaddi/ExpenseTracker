// Builds latest.json for the desktop auto-updater from the signed update
// artifacts in a folder (CI release job). Usage: node make-latest-json.mjs <dir> <tag>
import fs from 'node:fs';

const [dir, tag] = process.argv.slice(2);
const version = tag.replace(/^v/, '');
const url = (f) => `https://github.com/thrishankkuntimaddi/ExpenseTracker/releases/download/${tag}/${f}`;
const PLATFORMS = {
  'darwin-aarch64': 'ExpenseTracker-Mac-AppleSilicon.app.tar.gz',
  'darwin-x86_64':  'ExpenseTracker-Mac-Intel.app.tar.gz',
  'windows-x86_64': 'ExpenseTracker-Windows-Setup.exe',
  'linux-x86_64':   'ExpenseTracker-Linux.AppImage',
};
const platforms = {};
for (const [key, file] of Object.entries(PLATFORMS)) {
  const sig = `${dir}/${file}.sig`;
  if (!fs.existsSync(`${dir}/${file}`) || !fs.existsSync(sig)) { console.warn(`! no signed update for ${key} (${file})`); continue; }
  platforms[key] = { signature: fs.readFileSync(sig, 'utf8').trim(), url: url(file) };
}
if (!Object.keys(platforms).length) throw new Error('no signed desktop update artifacts found');
const notes = fs.existsSync('.github/release-notes.md') ? `Expense Tracker ${version}` : '';
fs.writeFileSync(`${dir}/latest.json`, JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2));
console.log(`✓ latest.json for ${Object.keys(platforms).join(', ')}`);
