// ─── Mirror the latest release's installers and update files on the website ──
// Some networks (several Indian ISPs among them) take a minute or more just to
// connect to github's release file host, while GitHub Pages answers at once.
// So every website deploy copies the latest release's small files next to the
// site:
//   app/files/<installer>     APK, Mac dmgs, Windows setup, Mac update bundles
//   app/desktop.json          the desktop updater manifest, pointing at the mirror
// The Linux AppImage (~80 MB) stays on GitHub. Signatures are of the files
// themselves, so they stay valid at the new address.
//
// Usage: node scripts/mirror-release.mjs <dist/app>   (needs `gh`, GH_TOKEN)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'dist/app';
const repo = process.env.GITHUB_REPOSITORY || 'thrishankkuntimaddi/ExpenseTracker';
const SITE = 'https://thrishankkuntimaddi.github.io/ExpenseTracker/app/files/';
const PATTERNS = ['latest.json', '*.apk', '*.dmg', '*-Setup.exe', '*.app.tar.gz'];
const files = path.join(out, 'files');
fs.mkdirSync(files, { recursive: true });

try {
  execFileSync('gh', ['release', 'download', '--repo', repo, '--dir', files, '--clobber', ...PATTERNS.flatMap((p) => ['--pattern', p])], { stdio: 'inherit' });
} catch (err) {
  // No release yet, or GitHub is down: the site still deploys; apps fall back to GitHub
  console.warn('::warning::Could not mirror the latest release:', err.message);
  process.exit(0);
}

const manifestPath = path.join(files, 'latest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const p of Object.values(manifest.platforms ?? {})) {
    const name = decodeURIComponent(String(p.url).split('/').pop());
    if (fs.existsSync(path.join(files, name))) p.url = SITE + encodeURIComponent(name);
  }
  fs.writeFileSync(path.join(out, 'desktop.json'), JSON.stringify(manifest, null, 2));
  fs.rmSync(manifestPath);
  console.log(`Mirrored release ${manifest.version}:`, fs.readdirSync(files).join(', '));
}
