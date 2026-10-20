// ─── HelpButton ──────────────────────────────────────────────────
// "?" at the top of a page: a short guide to that page.
import { HelpCircle } from 'lucide-react';
import { useShell } from '../app/shellContext';
import { startTour, hasGuide } from './tour';

export default function HelpButton({ page }) {
  const shell = useShell();
  const key = page ?? shell?.active;
  if (!shell || !hasGuide(key)) return null;
  return (
    <button id="btn-page-help" className="help-button" onClick={() => startTour(key)}
      aria-label="How this page works" title="How this page works">
      <HelpCircle size={18} />
    </button>
  );
}
