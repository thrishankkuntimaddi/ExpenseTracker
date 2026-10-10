import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glass.css'
import App from './app/App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    // Safety net: #root not in DOM yet — retry shortly
    setTimeout(bootstrap, 16);
    return;
  }
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  // Hand off from the 3D splash — but let the intro play for a minimum time
  // so it doesn't flash. Skipped for reduced motion. Wall-clock based (not
  // rAF), so a page opened in a background tab is ready when it's shown.
  const splash = document.getElementById('app-splash');
  if (splash) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The apps open many times a day: a short intro. The website keeps the full one.
    const isApp = '__TAURI_INTERNALS__' in window || !!window.Capacitor?.isNativePlatform?.();
    const MIN_MS = reduced ? 0 : isApp ? 900 : 2600;
    const elapsed = Date.now() - performance.timeOrigin;
    setTimeout(() => {
      splash.classList.add('sp-exit');
      setTimeout(() => splash.remove(), 800);
    }, Math.max(0, MIN_MS - elapsed));
  }
}

// type="module" is spec-deferred, but added guard for extra safety on
// older mobile WebViews that may execute before DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
