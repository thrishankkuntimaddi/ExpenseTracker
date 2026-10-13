// ─── BackButton ──────────────────────────────────────────────────
// Shown in the header of a phone page that isn't in the bottom bar (opened
// from a Home tile), so there's always an obvious way back. Renders nothing
// on bar pages and outside the phone shell.
import { ArrowLeft } from 'lucide-react';
import { useShell } from '../app/shellContext';

export default function BackButton() {
  const shell = useShell();
  if (!shell?.showBack) return null;
  return (
    <button id="btn-page-back" onClick={shell.back} aria-label="Back"
      style={{ width: 34, height: 34, border: 'none', background: 'var(--surface2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <ArrowLeft size={17} />
    </button>
  );
}
