import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, limit } from 'firebase/firestore';
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
  signInWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
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

        // Skip redundant admins doc read if user profile already has admin role
        let adminSnapExists = existingData.role === 'admin';
        if (!adminSnapExists) {
          try {
            const adminSnap = await getDoc(adminRef);
            adminSnapExists = adminSnap.exists();
          } catch (e) {}
        }

        if (adminSnapExists && existingData.role !== 'admin') {
          const updated = { ...existingData, role: 'admin' as UserRole, updatedAt: new Date().toISOString() };
          try {
            await updateDoc(userRef, { role: 'admin', updatedAt: new Date().toISOString() });
          } catch (e) {}
          writeCachedProfile(updated);
          setProfile(updated);
          return updated;
        }

        writeCachedProfile(existingData);
        setProfile(existingData);
        return existingData;
      } else {
        // Check if any user exists using limit(1) to avoid scanning the entire users collection
        let initialRole: UserRole = 'user';
        try {
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
          if (usersSnap.empty) {
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
      
      const isKnownAdmin = Boolean(
        firebaseUser.email &&
        ['artandtraveltoday@gmail.com', 'ball.bryan.j@gmail.com'].includes(firebaseUser.email.toLowerCase())
      );
      const fallbackProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Pony Steward',
        photoURL: firebaseUser.photoURL || undefined,
        role: isKnownAdmin ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      writeCachedProfile(fallbackProfile);
      setProfile(fallbackProfile);

      // Attempt background non-blocking write so persistence queues it when connection is restored
      setDoc(userRef, fallbackProfile, { merge: true }).catch(() => {});
      if (isKnownAdmin) {
        setDoc(adminRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          addedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }

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

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await fetchOrCreateProfile(res.user);
    } catch (err) {
      console.error('Google Sign In Error:', err);
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

  const logout = async () => {
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
        await setDoc(adminRef, { uid: targetUid, revokedAt: new Date().toISOString() });
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
