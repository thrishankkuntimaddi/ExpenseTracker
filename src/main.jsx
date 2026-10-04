import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glass.css'
import App from './app/App.jsx'

function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    // Safety net: #root not in DOM yet — retry on next tick
    requestAnimationFrame(bootstrap);
    return;
  }
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Hand off from the 3D splash once React has painted — but let the intro
  // play for a minimum time so it doesn't flash. Skipped for reduced motion.
  requestAnimationFrame(() => {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const MIN_MS = reduced ? 0 : 2600;
    const wait = Math.max(0, MIN_MS - performance.now());
    setTimeout(() => {
      splash.classList.add('sp-exit');
      setTimeout(() => splash.remove(), 800);
    }, wait);
  });
}

// type="module" is spec-deferred, but added guard for extra safety on
// older mobile WebViews that may execute before DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
