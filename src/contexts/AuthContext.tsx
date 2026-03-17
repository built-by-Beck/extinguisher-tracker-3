import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase.ts';
import type { UserProfile } from '../types/index.ts';

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state and user profile doc
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous profile listener
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        // Listen to usr/{uid} doc in real-time
        const userDocRef = doc(db, 'usr', firebaseUser.uid);
        unsubProfile = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data() as UserProfile);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          () => {
            // On error, still mark loading as done
            setUserProfile(null);
            setLoading(false);
          },
        );
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    // Update lastLoginAt on the user profile
    const userDocRef = doc(db, 'usr', credential.user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      await setDoc(userDocRef, { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string): Promise<void> => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    // Set display name on Firebase Auth profile
    await updateProfile(credential.user, { displayName });
    // Create usr/{uid} document with defaults
    const userDocRef = doc(db, 'usr', credential.user.uid);
    const newProfile: UserProfile = {
      displayName,
      email,
      photoURL: null,
      defaultOrgId: null,
      activeOrgId: null,
      createdAt: serverTimestamp() as UserProfile['createdAt'],
      updatedAt: serverTimestamp() as UserProfile['updatedAt'],
      lastLoginAt: serverTimestamp() as UserProfile['lastLoginAt'],
    };
    await setDoc(userDocRef, newProfile);
  }, []);

  const signOutFn = useCallback(async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  }, []);

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut: signOutFn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
