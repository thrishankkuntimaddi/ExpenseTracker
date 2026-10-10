// ─── useAuth hook ────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, clearLocalFirestoreCache } from "../services/firebase";
import { ensureUserDoc } from "../services/firestore";
import { clearLegacyDataCache } from "../utils/storage";

/**
 * Provides Firebase Auth state with a short (800 ms) grace period to
 * prevent false sign-outs during token refresh, plus every sign-in path:
 * email/password, Google, password reset and email verification.
 *
 * Returns: { user, loading, signIn, signUp, signInWithGoogle,
 *            resetPassword, resendVerification, signOut, error, setError }
 */
export function useAuth() {
  // With no Firebase handle (unconfigured build) start resolved: no user, not loading
  const [user, setUser]       = useState(auth ? undefined : null); // undefined = still loading
  const [loading, setLoading] = useState(!!auth);
  const [error, setError]     = useState(null);
  const graceTimer = useRef(null);

  useEffect(() => {
    if (!auth) return undefined;
    // Finish a Google sign-in that fell back to a full-page redirect
    getRedirectResult(auth).catch((err) => setError(friendlyError(err)));
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Clear any pending grace timer
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // Give 800ms before treating as signed out
        // (handles transient token-refresh null blips)
        graceTimer.current = setTimeout(() => {
          setUser(null);
          setLoading(false);
        }, 800);
      }
    });

    return () => {
      unsub();
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  const signUp = useCallback(async (email, password) => {
    setError(null);
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
    // The account exists now — neither of these may turn it into a failed sign-up.
    // (useFirestoreData also creates the user doc on first load.)
    sendEmailVerification(cred.user).catch((err) => console.warn("[signUp] verification email:", err));
    ensureUserDoc(cred.user.uid, email).catch((err) => console.warn("[signUp] user doc:", err));
  }, []);

  /* Google: popup first; browsers that block or can't host popups
     (some in-app browsers, installed PWAs on iOS) fall back to a redirect. */
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
        return;
      }
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  /* With email-enumeration protection Firebase reports success even for
     unknown addresses — the caller shows a neutral "if an account exists" note. */
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  const resendVerification = useCallback(async () => {
    if (!auth?.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    // Wipe this user's data from the device (shared-device privacy).
    // The Firestore instance can't be reused after clearing, so reload.
    clearLegacyDataCache();
    try {
      await clearLocalFirestoreCache();
    } catch (err) {
      console.warn("[signOut] Could not clear offline cache:", err);
    }
    window.location.reload();
  }, []);

  return { user, loading, signIn, signUp, signInWithGoogle, resetPassword, resendVerification, signOut, error, setError };
}

/* ── Map Firebase error codes to friendly messages ── */
const WRONG_LOGIN = "Wrong email or password. If you signed up with Google, use Continue with Google.";

export function friendlyError(err) {
  const map = {
    // One message for all three, so the screen never reveals whether an email has an account
    "auth/user-not-found":         WRONG_LOGIN,
    "auth/wrong-password":         WRONG_LOGIN,
    "auth/invalid-credential":     WRONG_LOGIN,
    "auth/email-already-in-use":   "An account with this email already exists — log in instead, or use Continue with Google.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/missing-email":          "Enter your email address first.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/too-many-requests":      "Too many attempts. Wait a few minutes, or reset your password.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/popup-blocked":          "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
    "auth/operation-not-allowed":  "This sign-in method isn't turned on for the app yet.",
    "auth/unauthorized-domain":    "This website isn't authorised for sign-in yet (Firebase → Authentication → Settings → Authorized domains).",
    "auth/account-exists-with-different-credential": "This email already has an account with a different sign-in method. Log in with email and password.",
  };
  return map[err?.code] || err?.message || "Something went wrong.";
}
