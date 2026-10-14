// ─── Prove it's you again (forgot PIN, too many wrong PINs) ──────
// Re-authenticates the signed-in account with the same method it uses to
// sign in. Nothing is signed out and no data is touched.
import {
  reauthenticateWithPopup, reauthenticateWithCredential, GoogleAuthProvider, EmailAuthProvider,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { platform } from '../native';
import { nativeGoogleIdToken } from '../native/googleSignIn';

export const reauthMethods = (user) => {
  const ids = user?.providerData?.map((p) => p.providerId) ?? [];
  return { google: ids.includes('google.com'), password: ids.includes('password') };
};

/** Resolves true when verified, false when cancelled; throws with a readable message otherwise. */
export async function reauthWithGoogle() {
  const user = auth.currentUser;
  if (!user) throw new Error('You are signed out.');
  try {
    if (platform !== 'web') {
      const idToken = await nativeGoogleIdToken();
      if (!idToken) return false;
      await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
      return true;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', login_hint: user.email ?? '' });
    await reauthenticateWithPopup(user, provider);
    return true;
  } catch (err) {
    if (/popup-closed|cancelled-popup|cancel/i.test(err?.code ?? err?.message ?? '')) return false;
    if (err?.code === 'auth/user-mismatch') throw new Error(`That's a different Google account. Choose ${user.email}.`);
    throw new Error(err?.message || 'Could not verify with Google.');
  }
}

export async function reauthWithPassword(password) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You are signed out.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return true;
  } catch (err) {
    if (['auth/wrong-password', 'auth/invalid-credential'].includes(err?.code)) throw new Error('That password is not right.');
    if (err?.code === 'auth/too-many-requests') throw new Error('Too many attempts. Wait a few minutes, or reset your password from the sign-in screen.');
    throw new Error(err?.message || 'Could not verify your password.');
  }
}
