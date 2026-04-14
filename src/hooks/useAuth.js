// ─── useAuth hook ────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { ensureUserDoc } from "../services/firestore";

/**
 * Provides Firebase Auth state with a 5-second grace period to
 * prevent false sign-outs during token refresh.
 *
 * Returns: { user, loading, signIn, signUp, signOut, error }
 */
export function useAuth() {
  const [user, setUser]       = useState(undefined); // undefined = still loading
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const graceTimer = useRef(null);

  useEffect(() => {
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
        // Give 5 seconds before treating as signed out
        // (handles transient token-refresh null blips)
        graceTimer.current = setTimeout(() => {
          setUser(null);
          setLoading(false);
        }, 5000);
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
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Create empty Firestore user document
      await ensureUserDoc(cred.user.uid, email);
    } catch (err) {
      setError(friendlyError(err));
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setUser(null);
  }, []);

  return { user, loading, signIn, signUp, signOut, error, setError };
}

/* ── Map Firebase error codes to friendly messages ── */
function friendlyError(err) {
  const map = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/too-many-requests":    "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-credential":   "Invalid email or password.",
  };
  return map[err.code] || err.message || "Something went wrong.";
}
