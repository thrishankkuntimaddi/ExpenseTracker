// ─── Avatar ──────────────────────────────────────────────────────
// The account photo (Google) or initials on a soft gradient when there is
// none or it fails to load.
import { useState } from 'react';
import { initialsOf } from '../app/shellContext';

export default function Avatar({ user, size = 36 }) {
  const [broken, setBroken] = useState(false);
  const photo = !broken && user?.photoURL;
  return (
    <span className="et-avatar" style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--accent), var(--savings))',
      color: '#fff', fontSize: Math.round(size * 0.38), fontWeight: 700, letterSpacing: '0.02em',
    }}>
      {photo
        ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initialsOf(user)}
    </span>
  );
}
