import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp();
const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

export { app, adminDb, adminAuth };
