// ─── ProfileButton ───────────────────────────────────────────────
// The avatar at the top-right of every phone page: opens Profile & settings.
// Renders nothing outside the phone shell (desktop has its own menu).
import { useShell } from '../app/shellContext';
import Avatar from './Avatar';

export default function ProfileButton() {
  const shell = useShell();
  if (!shell || shell.desktop) return null;   // desktop: Profile is in the sidebar
  return (
    <button id="btn-open-profile" className="profile-button" onClick={shell.openProfile}
      aria-label="Profile and settings" title="Profile and settings"
      style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, position: 'relative', lineHeight: 0 }}>
      <Avatar user={shell.user} size={34} />
      {shell.attention && (
        <span aria-hidden style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: 'var(--expense)', border: '2px solid var(--surface-solid, #fff)' }} />
      )}
    </button>
  );
}
