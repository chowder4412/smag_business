import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check — blocks unauthorized clients from accessing Firebase services.
// Uses debug token in dev, Play Integrity (Android) / DeviceCheck (iOS) in production.
// Set EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN in .env for local development.
if (process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN) {
  // @ts-expect-error — global debug token for App Check emulation
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
}

if (process.env.EXPO_PUBLIC_APPCHECK_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(process.env.EXPO_PUBLIC_APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  } catch { /* already initialized on hot reload */ }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

export async function businessSignIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function businessSignOut(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function checkAppVersion(): Promise<void> {
  if (!functions) return;
  try {
    const { httpsCallable } = await import("firebase/functions");
    const fn = httpsCallable<{ version: string }, { supported: boolean; minVersion: string }>(functions, "checkAppVersion");
    const { data } = await fn({ version: "1.0.0" });
    if (!data.supported) {
      throw new Error(`This version of Smag Business is no longer supported. Please update to version ${data.minVersion} or later.`);
    }
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    // Only throw if it's a version error, not a network/functions error
    if (msg.includes("no longer supported")) throw err;
  }
}
