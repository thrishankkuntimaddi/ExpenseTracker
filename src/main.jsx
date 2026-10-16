import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glass.css'
import './styles/layout.css'
import './motion/motion.css'
import App from './app/App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { confirmBundleBoots, startAutoUpdates } from './native/updates.js'
import { takeQuickBoot } from './app/quickBoot.js'
import { play, wireTapSounds } from './sound/sound.js'

// Android: tell the over-the-air updater this bundle boots, before anything
// else (a bundle that never gets here is rolled back automatically).
confirmBundleBoots()

function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    // Safety net: #root not in DOM yet — retry shortly
    setTimeout(bootstrap, 16);
    return;
  }
  startAutoUpdates();
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  // Hand off from the 3D splash once the first real screen is ready (signed
  // in with data, or the sign-in screen) — and not before the intro has had
  // a moment, so it doesn't flash. A slow network can't hold it forever.
  // Skipped for reduced motion. Wall-clock based (not rAF), so a page opened
  // in a background tab is ready when it's shown.
  wireTapSounds();   // a soft tick on anything pressable (Profile → Sounds)
  const splash = document.getElementById('app-splash');
  if (splash) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The apps open many times a day: a short intro. The website keeps the full one.
    const isApp = '__TAURI_INTERNALS__' in window || !!window.Capacitor?.isNativePlatform?.();
    // A restart the app did itself (update, stale screen): no intro again
    const quick = takeQuickBoot();
    if (quick) splash.classList.add('sp-quick');
    const MIN_MS = reduced || quick ? 0 : isApp ? 900 : 2600;
    const MAX_WAIT_MS = 8000;
    const elapsed = Date.now() - performance.timeOrigin;
    const minDelay = new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - elapsed)));
    const ready = new Promise((r) => {
      if (window.__etReady) r();
      window.addEventListener('et:ready', r, { once: true });
      setTimeout(r, Math.max(0, MAX_WAIT_MS - elapsed));
    });
    Promise.all([minDelay, ready]).then(() => {
      if (!quick) play('open');   // when it's switched on (off by default)
      splash.classList.add('sp-exit');
      setTimeout(() => splash.remove(), 800);
    });
  }
}

// type="module" is spec-deferred, but added guard for extra safety on
// older mobile WebViews that may execute before DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
