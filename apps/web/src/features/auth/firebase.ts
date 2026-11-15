import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, type Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";

// APP-SPEC 6.1. Imported only by lazy routes, so the public pages never load Firebase (D-06).
// Never import firebase/analytics or call getAnalytics (D-05).

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let appCheck: AppCheck | undefined;

function getApp(): FirebaseApp {
  app ??= initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  return app;
}

/**
 * App Check with reCAPTCHA Enterprise (P3-04). Initialized only when a site key is
 * configured, so emulator runs and local builds without a key are unaffected. Once set,
 * the Firebase SDK attaches the App Check token to every Auth and Firestore call.
 */
export function getAppCheckInstance(): AppCheck | undefined {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return undefined;
  appCheck ??= initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
}

/** Firebase Auth, kept signed in across tabs (`browserLocalPersistence`). */
export function getAuthInstance(): Auth {
  getAppCheckInstance();
  if (!auth) {
    auth = initializeAuth(getApp(), {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    if (useEmulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

/** Firestore with a memory cache only: nothing stays on a shared computer after sign-out. */
export function getDb(): Firestore {
  getAppCheckInstance();
  if (!db) {
    db = initializeFirestore(getApp(), { localCache: memoryLocalCache() });
    if (useEmulators) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}
