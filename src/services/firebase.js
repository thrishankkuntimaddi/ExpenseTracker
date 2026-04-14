// ─── Firebase Initialisation ─────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALUloNt0HWTMeP4IARvRMS9JY-R5_NnFM",
  authDomain: "nistha-passi-core.firebaseapp.com",
  projectId: "nistha-passi-core",
  storageBucket: "nistha-passi-core.firebasestorage.app",
  messagingSenderId: "299692286010",
  appId: "1:299692286010:web:4710e80698e055afaa5503",
  measurementId: "G-TSJLLWLE6K",
};

const app = initializeApp(firebaseConfig);

// Auth with IndexedDB persistence (survives tab close + token refresh)
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Firestore
export const db = getFirestore(app);

export default app;
