// ─── "Get the app" ───────────────────────────────────────────────
// Picks the right installer from the latest GitHub release for the visitor.
export const RELEASES = 'https://github.com/thrishankkuntimaddi/ExpenseTracker/releases';
const latest = (file) => `${RELEASES}/latest/download/${file}`;

/**
 * { label, file, url } for this device, or null when there's nothing to
 * download (iPhone/iPad: the web app is the app). `arch` is from
 * navigator.userAgentData (arm / x86) when the browser shares it.
 */
export function pickDownload(ua = '', arch = null, platformHint = '') {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))) return null;
  if (/Android/.test(ua)) return { label: 'Android app', file: 'ExpenseTracker-Android.apk' };
  if (/Windows/.test(ua)) return { label: 'Windows app', file: 'ExpenseTracker-Windows-Setup.exe' };
  if (/Macintosh|Mac OS X/.test(ua)) {
    // Safari doesn't share the CPU; Apple-chip Macs are the norm since 2021
    const intel = arch === 'x86';
    return intel
      ? { label: 'Mac app (Intel)', file: 'ExpenseTracker-Mac-Intel.dmg' }
      : { label: 'Mac app (Apple chip)', file: 'ExpenseTracker-Mac-AppleSilicon.dmg', unsure: arch == null };
  }
  if (/Linux|X11/.test(ua) || /Linux/.test(platformHint)) return { label: 'Linux app', file: 'ExpenseTracker-Linux.AppImage' };
  return null;
}

export const downloadUrl = (file) => latest(file);

/** The CPU architecture, where the browser exposes it (Chromium). */
export async function detectArch() {
  try { return (await navigator.userAgentData?.getHighEntropyValues?.(['architecture']))?.architecture ?? null; }
  catch { return null; }
}
