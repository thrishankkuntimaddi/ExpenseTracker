import { createPortal } from 'react-dom';

/* Renders overlays (dialogs, sheets) into <body>, outside the app's own
   stacking context (#root is z-index 1 in glass.css, and animated or
   backdrop-filtered parents re-anchor position: fixed). Without this a
   dialog can end up under the floating tab bar on phones.
   Server rendering (smoke tests) has no document — render in place. */
export default function Portal({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}
