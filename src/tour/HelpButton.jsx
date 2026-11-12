// ─── HelpButton ──────────────────────────────────────────────────
// "?" at the top of a page: a short guide to that page.
import { HelpCircle } from 'lucide-react';
import { useShell } from '../app/shellContext';
import { startTour, hasGuide } from './tour';

import { t as tr } from '../i18n';
export default function HelpButton({ page }) {
  const shell = useShell();
  const key = page ?? shell?.active;
  if (!shell || !hasGuide(key)) return null;
  return (
    <button id="btn-page-help" className="help-button" onClick={() => startTour(key)}
      aria-label={tr("How this page works")} title={tr("How this page works")}>
      <HelpCircle size={18} />
    </button>
  );
}
