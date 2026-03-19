import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
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

/**
 * Connect to Firebase emulators in development mode.
 * Call this once at app startup when running locally.
 */
function connectToEmulators(): void {
  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
}

// Auto-connect to emulators in development mode
if (import.meta.env.DEV) {
  connectToEmulators();
}

export { app, auth, db, storage, functions, connectToEmulators };
