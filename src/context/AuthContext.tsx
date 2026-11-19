import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup,
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types/auth';

const PROFILE_CACHE_PREFIX = 'pony_user_profile_cache_v1_';
const PROFILE_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

function readCachedProfile(uid: string): { profile: UserProfile; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile: UserProfile; cachedAt: number };
    if (!parsed?.profile) return null;
    return {
      profile: parsed.profile,
      fresh: Date.now() - (parsed.cachedAt || 0) < PROFILE_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile) {
  try {
    localStorage.setItem(
      `${PROFILE_CACHE_PREFIX}${profile.uid}`,
      JSON.stringify({ profile, cachedAt: Date.now() })
    );
  } catch {}
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<boolean>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (targetUid: string, role: UserRole) => Promise<void>;
  claimAdminRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOrCreateProfile = async (firebaseUser: User, forceRefresh = false): Promise<UserProfile> => {
    const cached = readCachedProfile(firebaseUser.uid);
    if (cached && !forceRefresh) {
      setProfile(cached.profile);
      if (cached.fresh) {
        return cached.profile;
      }
    }

    const userRef = doc(db, 'users', firebaseUser.uid);
    const adminRef = doc(db, 'admins', firebaseUser.uid);

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const existingData = snap.data() as UserProfile;
        const effectiveRole: UserRole = existingData.role || 'user';

        const updated = { ...existingData, role: effectiveRole };
        writeCachedProfile(updated);
        setProfile(updated);
        return updated;
      } else {
        // Check if any admin exists in the system yet. If no admins exist, the first user to log in becomes admin.
        let initialRole: UserRole = 'user';
        try {
          const adminsSnap = await getDocs(query(collection(db, 'admins'), limit(1)));
          if (adminsSnap.empty) {
            initialRole = 'admin';
          }
        } catch (e) {}

        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pony Steward',
          photoURL: firebaseUser.photoURL || undefined,
          role: initialRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(userRef, newProfile);
          if (initialRole === 'admin') {
            await setDoc(adminRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              addedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('Initial profile sync to Firestore pending or offline:', err);
        }

        writeCachedProfile(newProfile);
        setProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      if (cached?.profile) {
        setProfile(cached.profile);
        return cached.profile;
      }
      
      const fallbackProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pony Steward',
        photoURL: firebaseUser.photoURL || undefined,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      writeCachedProfile(fallbackProfile);
      setProfile(fallbackProfile);

      // Attempt background non-blocking write so persistence queues it when connection is restored
      setDoc(userRef, fallbackProfile, { merge: true }).catch(() => {});

      console.warn('Firestore is temporarily offline or establishing connection; using authenticated profile:', err);
      return fallbackProfile;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
        return true;
      }
      return false;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // User intentionally closed the popup — do not treat as an error
        return false;
      }
      if (err?.code !== 'auth/user-cancelled') {
        console.error('Google Sign In Popup Error:', err);
      }
      throw err;
    }
  };

  const registerWithEmail = async (email: string, pass: string, displayName: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (displayName) {
        await updateProfile(res.user, { displayName });
      }
      await fetchOrCreateProfile(res.user);
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(res.user);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail) {
      throw new Error('Please enter your email address to receive a password reset link.');
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err) {
      console.error('Password reset error:', err);
      throw err;
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      console.error('Email verification error:', err);
      throw err;
    }
  };

  const logout = async () => {
    const prevUid = user?.uid || auth.currentUser?.uid;
    if (prevUid) {
      try {
        localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${prevUid}`);
      } catch {}
    }
    try {
      localStorage.removeItem('pony_network_onboarding_completed');
    } catch {}
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const setUserRole = async (targetUid: string, newRole: UserRole) => {
    if (!profile || profile.role !== 'admin') {
      throw new Error('Only admins can modify user account role flags.');
    }
    const userRef = doc(db, 'users', targetUid);
    const adminRef = doc(db, 'admins', targetUid);
    try {
      await updateDoc(userRef, { role: newRole, updatedAt: new Date().toISOString() });
      if (newRole === 'admin') {
        await setDoc(adminRef, { uid: targetUid, addedAt: new Date().toISOString() });
      } else {
        await deleteDoc(adminRef);
      }
      if (targetUid === user?.uid && profile) {
        const updatedProfile = { ...profile, role: newRole, updatedAt: new Date().toISOString() };
        writeCachedProfile(updatedProfile);
        setProfile(updatedProfile);
      } else {
        try {
          localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${targetUid}`);
        } catch {}
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const claimAdminRole = async () => {
    if (!user || !profile) return;
    const userRef = doc(db, 'users', user.uid);
    const adminRef = doc(db, 'admins', user.uid);
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(userRef, { role: 'admin', updatedAt: nowIso });
      await setDoc(adminRef, { uid: user.uid, email: user.email || '', addedAt: nowIso });
      const updatedProfile: UserProfile = { ...profile, role: 'admin', updatedAt: nowIso };
      writeCachedProfile(updatedProfile);
      setProfile(updatedProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        signInWithGoogle,
        registerWithEmail,
        signInWithEmail,
        resetPassword,
        sendVerificationEmail,
        logout,
        setUserRole,
        claimAdminRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
