// ─── Links to the installable builds ─────────────────────────────
// The Android APK is published by .github/workflows/android.yml to a rolling
// GitHub Release. Override with VITE_ANDROID_APK_URL if you host it elsewhere.
const REPO = 'https://github.com/thrishankkuntimaddi/ExpenseTracker';

export const ANDROID_APK_URL =
  import.meta.env.VITE_ANDROID_APK_URL || `${REPO}/releases/download/android-latest/ExpenseTracker.apk`;
export const ANDROID_RELEASE_PAGE = `${REPO}/releases/tag/android-latest`;

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}
