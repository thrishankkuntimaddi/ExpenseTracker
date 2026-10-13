// ─── Phone shell context ─────────────────────────────────────────
// Lets page headers reach the shell (open Profile) without threading props
// through every tab. Absent on desktop, so header buttons render nothing there.
import { createContext, useContext } from 'react';

export const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);

/** "Thrishank Kuntimaddi" → "TK"; falls back to the email's first letter. */
export function initialsOf(user) {
  const name = (user?.displayName || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return (user?.email?.[0] ?? '?').toUpperCase();
}

/** A friendly display name: the account name, else the email before the @. */
export function displayNameOf(user) {
  const name = (user?.displayName || '').trim();
  if (name) return name;
  const local = (user?.email || '').split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'You';
}
