import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from 'firebase/storage';
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from 'firebase/functions';
import {
  getAI,
  getGenerativeModel,
  VertexAIBackend,
  type GenerativeModel,
} from 'firebase/ai';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * App Check proves requests come from this web app (reCAPTCHA Enterprise), so the
 * public Firebase config can't be reused to call Auth, Firestore, or Gemini on our bill.
 * Must initialize before any other Firebase service makes a request.
 *
 * Local dev: the SDK prints a debug token to the browser console on first load —
 * register it in Firebase console → App Check → Apps → (web app) → Manage debug tokens,
 * or pin one with VITE_APPCHECK_DEBUG_TOKEN.
 */
function initAppCheck(): AppCheck | null {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') {
    return null;
  }
  if (!siteKey) {
    console.warn(
      '[firebase] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not set; App Check is disabled.',
    );
    return null;
  }
  if (import.meta.env.DEV) {
    (
      self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

const appCheck: AppCheck | null = initAppCheck();
const auth: Auth = getAuth(app);

// Enable Firestore offline persistence via persistentLocalCache (Firebase v12 API).
// This allows onSnapshot/getDoc to serve cached data when offline.
// Multi-tab manager coordinates the cache across browser tabs.
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

// Vertex AI (Gemini) — client-side generative AI
const ai = getAI(app, { backend: new VertexAIBackend() });
const geminiModel: GenerativeModel = getGenerativeModel(ai, {
  model: 'gemini-2.5-flash',
});

/**
 * Connect to Firebase emulators in development mode.
 * Call this once at app startup when running locally.
 */
function connectToEmulators(): void {
  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://localhost:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
}

// To use Firebase emulators locally, set VITE_USE_EMULATORS=true in your .env
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectToEmulators();
}

export {
  app,
  appCheck,
  auth,
  db,
  storage,
  functions,
  geminiModel,
  connectToEmulators,
};
