import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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

  // Remove the preloader once React's first paint is done.
  // rAF ensures we wait until the browser has committed the frame.
  requestAnimationFrame(() => {
    setTimeout(() => {
      const preloader = document.getElementById('app-preloader');
      if (preloader) {
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
        setTimeout(() => preloader.remove(), 260);
      }
    }, 50);
  });
}

// type="module" is spec-deferred, but added guard for extra safety on
// older mobile WebViews that may execute before DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
