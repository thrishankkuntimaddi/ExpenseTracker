// ─── Delete my account ───────────────────────────────────────────
// Three steps, in an order that can't leave things half done:
//   1. Confirm it's you (Google, or your password) — Firebase deletes only a
//      fresh sign-in. Before 4.3 this came last: the data was deleted, then
//      the sign-in refused ("requires recent login") and the account stayed.
//   2. Delete everything: shared trips, invite code, the ledger, the sign-in.
//   3. Anything the app couldn't finish goes to the server, which completes
//      it within the hour — the person is signed out either way, and the
//      owner gets a note in Admin sees.
import { useState } from 'react';
import { UserX, ShieldCheck, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import ModalShell, { PrimaryButton, GhostButton } from '../../components/ModalShell';
import { fieldStyle } from '../../components/formTokens';
import { deleteAllUserData } from '../../services/firestore';
import { deleteAccountFootprint, deleteAccountDoc, requestServerDeletion } from '../../services/accountDeletion';
import { reportProblem } from '../../services/feedback';
import { t as tr } from '../../i18n';

const FRESH_MS = 4 * 60 * 1000;   // Firebase allows ~5 minutes after a sign-in

export default function DeleteAccountModal({ user, onReauthenticate, onDeleteAccount, onFinishSignedOut, onClose }) {
  const hasPassword = user?.providerData?.some((p) => p.providerId === 'password') ?? false;
  const hasGoogle = user?.providerData?.some((p) => p.providerId === 'google.com') ?? false;
  const signedInAt = Date.parse(user?.metadata?.lastSignInTime ?? '') || 0;
  const [step, setStep] = useState(Date.now() - signedInAt < FRESH_MS ? 'confirm' : 'verify');   // verify → confirm → working → handed
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  async function verify(withPassword) {
    setBusy(true); setError(null);
    try {
      const ok = await onReauthenticate(withPassword ? { password } : {});
      if (ok) setStep('confirm');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function run() {
    setStep('working'); setError(null);
    const uid = user.uid;
    let left = [];
    try {
      setProgress(tr('Removing shared trips and invites…'));
      left = await deleteAccountFootprint(uid);
      setProgress(tr('Deleting your entries and settings…'));
      await deleteAllUserData(uid);
      await deleteAccountDoc(uid).catch(() => {});
      if (left.length) await requestServerDeletion(uid, `left: ${left.join(', ')}`).catch(() => {});
      setProgress(tr('Deleting your sign-in…'));
      await onDeleteAccount();          // reloads to the sign-in screen
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') { setStep('verify'); setError(tr('Please confirm it’s you once more, then delete again.')); return; }
      // The app couldn't finish: the server does, and the owner hears about it
      try {
        await requestServerDeletion(uid, String(err?.message ?? err));
        reportProblem('deletion', `Account deletion handed to the server: ${err?.message ?? err}${left.length ? ` (left: ${left.join(', ')})` : ''}`);
        setStep('handed');
      } catch {
        setStep('confirm');
        setError(`${err?.message ?? err} — check your connection and try again.`);
      }
    }
  }

  const footer = {
    verify: <GhostButton onClick={onClose}>{tr('Cancel')}</GhostButton>,
    confirm: <>
      <GhostButton onClick={onClose}>{tr('Keep my account')}</GhostButton>
      <PrimaryButton id="delete-account-go" color="var(--expense)" disabled={typed.trim().toUpperCase() !== 'DELETE'} onClick={run}><UserX size={14} /> {tr('Delete forever')}</PrimaryButton>
    </>,
    working: null,
    handed: <PrimaryButton onClick={() => onFinishSignedOut?.()} color="var(--accent)">{tr('Done')}</PrimaryButton>,
  }[step];

  return (
    <ModalShell title={tr('Delete your account')} subtitle={user?.email} onClose={step === 'working' ? undefined : step === 'handed' ? () => onFinishSignedOut?.() : onClose} footer={footer} maxWidth={420} zIndex={2100}>
      {step === 'verify' && (
        <>
          <Note Icon={ShieldCheck} tone="accent" title={tr('First, confirm it’s you')}>
            {tr('So nobody else holding your phone can delete your account.')}
          </Note>
          {hasGoogle && (
            <PrimaryButton id="delete-verify-google" onClick={() => verify(false)} disabled={busy} color="var(--accent)">
              {busy ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />} {tr('Continue with Google')}
            </PrimaryButton>
          )}
          {hasPassword && (
            <form onSubmit={(e) => { e.preventDefault(); if (password) verify(true); }} style={{ display: 'grid', gap: 8 }}>
              <input id="delete-verify-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr('Your password')} style={fieldStyle} />
              <PrimaryButton type="submit" disabled={busy || !password} color="var(--accent)"><KeyRound size={14} /> {tr('Confirm')}</PrimaryButton>
            </form>
          )}
        </>
      )}

      {step === 'confirm' && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            {tr('Everything goes: your entries and settings, shared trips you created (for everyone on them), your place on trips you joined, and your sign-in. Rows you added to other people’s trips stay under your name on that trip so their totals still add up.')}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{tr('This can’t be undone. Export a backup first (Your data → Data management) if you might want it.')}</p>
          <input id="delete-account-type" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={tr('Type DELETE to confirm')} autoCapitalize="characters" autoComplete="off" style={{ ...fieldStyle, fontWeight: 700, letterSpacing: '0.04em' }} />
        </>
      )}

      {step === 'working' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px' }}>
          <Loader2 size={20} className="spin" style={{ color: 'var(--expense)', flexShrink: 0 }} />
          <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text)' }}>{progress || tr('Deleting…')}</div>
        </div>
      )}

      {step === 'handed' && (
        <Note Icon={CheckCircle2} tone="income" title={tr('Your account is being deleted')}>
          {tr('Most of it is gone already. Our server finishes the rest within the hour — you don’t need to do anything else. You’ll be signed out now.')}
        </Note>
      )}

      {error && <div role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--expense)', lineHeight: 1.45 }}>{error}</div>}
    </ModalShell>
  );
}

function Note({ Icon, tone, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, background: `var(--${tone}-bg)` }}>
      <Icon size={18} style={{ color: `var(--${tone})`, flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
