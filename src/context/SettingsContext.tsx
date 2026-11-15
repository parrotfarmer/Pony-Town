import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SpeciesOption, ElementOption, LocationOption } from '../types/pony';
import { useAuth } from './AuthContext';
import { stripUndefined, sanitizeFirestoreId } from '../utils/firestoreHelpers';

export interface ThemeSettings {
  networkBgImage: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  borderHoverColor: string;
  buttonColor: string;
  buttonTextColor: string;
  transparentMapBorder: boolean;
  transparentAllBorders: boolean;
  graphCumulativeColor: string;
  graphDailyColor: string;
  graphMagicalColor: string;
  graphGridColor: string;
  connectionLineColor?: string;
  loveChannelColor?: string;
  friendshipColor?: string;
  sisterhoodColor?: string;
  magicalResonanceColor?: string;
  hiveNexusColor?: string;
  brotherhoodColor?: string;
  customConnectionColor?: string;
  borderEffectColor?: string;
  rainbowGlowColor?: string;
}

export const DEFAULT_THEME: ThemeSettings = {
  networkBgImage: '',
  bgColor: '#0c0a1d',
  textColor: '#f1f5f9',
  borderColor: '#a855f7',
  borderHoverColor: '#ec4899',
  buttonColor: '#db2777',
  buttonTextColor: '#ffffff',
  transparentMapBorder: false,
  transparentAllBorders: false,
  graphCumulativeColor: '#ec4899',
  graphDailyColor: '#a855f7',
  graphMagicalColor: '#c084fc',
  graphGridColor: 'rgba(255,255,255,0.08)',
  connectionLineColor: '#06b6d4',
  loveChannelColor: '#f43f5e',
  friendshipColor: '#06b6d4',
  sisterhoodColor: '#eab308',
  magicalResonanceColor: '#c084fc',
  hiveNexusColor: '#10b981',
  brotherhoodColor: '#525252',
  customConnectionColor: '#3b82f6',
  borderEffectColor: '#ec4899',
  rainbowGlowColor: '#ec4899',
};

export interface SavedTheme {
  id: string;
  name: string;
  theme: ThemeSettings;
}

export interface AdminAppSettings {
  allowAvatarImageUpload: boolean;
  allowMyPoniesSort: boolean;
  profileUpdateCooldownHours: number;
  allowUserAddPony: boolean;
  maxPoniesPerUser: number;
  allowExchangeStore: boolean;
  allowMainPonySelection: boolean;
  allowLivePulseUpdates: boolean;
  allowLiveFlowAnimations: boolean;
  allowAutoDailyAccrual: boolean;
  allowProfileBorders: boolean;
  perkPrices: Record<string, number>;
}

export const DEFAULT_ADMIN_SETTINGS: AdminAppSettings = {
  allowAvatarImageUpload: false,
  allowMyPoniesSort: false,
  profileUpdateCooldownHours: 24,
  allowUserAddPony: false,
  maxPoniesPerUser: 1,
  allowExchangeStore: false,
  allowMainPonySelection: false,
  allowLivePulseUpdates: false,
  allowLiveFlowAnimations: true,
  allowAutoDailyAccrual: false,
  allowProfileBorders: true,
  perkPrices: {
    bgColor: 500,
    textColor: 500,
    borderColor: 500,
    borderHoverColor: 500,
    buttonColor: 500,
    bgImage: 1000,
    graphColors: 750,
    connectionLineColors: 750,
    savedThemes: 1000,
  },
};

export interface StoreBorderCatalogItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  borderColor?: string;
  glowColor?: string;
  description?: string;
}

export const DEFAULT_STORE_BORDERS: StoreBorderCatalogItem[] = [
  { id: 'pulsing', name: 'Pulsing', price: 500, icon: '✨', borderColor: '#ec4899', glowColor: '#ec4899', description: 'Soft pulsing border highlight' },
  { id: 'double', name: 'Double', price: 750, icon: '🔳', borderColor: '#a855f7', glowColor: '#c084fc', description: 'Layered double-frame border' },
  { id: 'dashed', name: 'Dashed', price: 1000, icon: '⚡', borderColor: '#38bdf8', glowColor: '#06b6d4', description: 'Crisp dashed energy border' },
  { id: 'thick', name: 'Thick', price: 1250, icon: '🖼️', borderColor: '#f43f5e', glowColor: '#fb7185', description: 'Bold framed border' },
  { id: 'dotted', name: 'Dotted', price: 1500, icon: '📍', borderColor: '#eab308', glowColor: '#fbbf24', description: 'Sparkling dotted rim' },
  { id: 'neon', name: 'Neon', price: 2000, icon: '🌈', borderColor: '#06b6d4', glowColor: '#ec4899', description: 'High-contrast neon glow border' },
  { id: 'rainbow-glow', name: 'Rainbow Glow', price: 2500, icon: '🌟', borderColor: '#ec4899', glowColor: '#f43f5e', description: 'Vibrant pulsing rainbow halo border' },
  { id: 'golden-sparkle', name: 'Golden Sparkle', price: 2500, icon: '💫', borderColor: '#fbbf24', glowColor: '#f59e0b', description: 'Radiant sparkling gold border' },
  { id: 'neon-cyan', name: 'Neon Cyan', price: 2500, icon: '🌀', borderColor: '#06b6d4', glowColor: '#38bdf8', description: 'Electric neon cyan glow border' },
  { id: 'crystal-violet', name: 'Crystal Violet', price: 2500, icon: '🔮', borderColor: '#c084fc', glowColor: '#a855f7', description: 'Prismatic crystal purple border' },
];

interface SettingsContextType {
  speciesOptions: SpeciesOption[];
  elementOptions: ElementOption[];
  locationOptions: LocationOption[];
  addSpecies: (name: string) => Promise<void>;
  addElement: (name: string) => Promise<void>;
  addLocation: (name: string, code?: string) => Promise<void>;
  removeSpecies: (id: string) => Promise<void>;
  removeElement: (id: string) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  loading: boolean;
  theme: ThemeSettings;
  updateTheme: (newTheme: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
  savedThemes: SavedTheme[];
  saveCurrentTheme: (name: string) => void;
  deleteSavedTheme: (id: string) => void;
  applySavedTheme: (savedTheme: ThemeSettings) => void;
  adminSettings: AdminAppSettings;
  updateAdminSettings: (partial: Partial<AdminAppSettings>) => Promise<void>;
  storeBorders: StoreBorderCatalogItem[];
  addStoreBorder: (item: StoreBorderCatalogItem) => Promise<void>;
  updateStoreBorder: (id: string, partial: Partial<StoreBorderCatalogItem>) => Promise<void>;
  deleteStoreBorder: (id: string) => Promise<void>;
  unlockedBorders: string[];
  unlockedPerks: string[];
  unlockedBadges: string[];
  unlockStoreItems: (items: { borders?: string[]; perks?: string[]; badges?: string[] }) => void;
  dailyFreeGifts: Record<string, string>;
  recordDailyFreeGift: (viewerPonyId: string, targetPonyId: string, dateStr: string) => void;
  onboardingCompleted: boolean;
  markOnboardingCompleted: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SPECIES = ['Pegasus', 'Unicorn', 'Earth Pony', 'Alicorn', 'Changeling'];
const DEFAULT_ELEMENTS = ['Generosity', 'Kindness', 'Loyalty', 'Laughter', 'Honesty', 'Magic'];
const DEFAULT_COUNTRIES = [
  { name: 'United States', code: 'US' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'Germany', code: 'DE' },
  { name: 'France', code: 'FR' },
  { name: 'Japan', code: 'JP' },
  { name: 'Italy', code: 'IT' },
  { name: 'Brazil', code: 'BR' },
  { name: 'South Korea', code: 'KR' },
];

const STORAGE_KEY_ADMIN_SETTINGS = 'pony_network_admin_settings_v1';
const STORAGE_KEY_TAXONOMIES = 'pony_network_taxonomies_cache_v1';
const STORAGE_KEY_DEFAULTS_SEEDED = 'pony_network_defaults_seeded_v1';
const STORAGE_KEY_BORDERS_CACHE = 'store_custom_borders_v1';
const STORAGE_KEY_BORDERS_SEEDED = 'pony_network_borders_seeded_v1';

interface CachedTaxonomies {
  speciesOptions: SpeciesOption[];
  elementOptions: ElementOption[];
  locationOptions: LocationOption[];
  cachedAt: number;
}

function readCachedTaxonomies(): CachedTaxonomies | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TAXONOMIES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTaxonomies;
    if (
      Array.isArray(parsed?.speciesOptions) &&
      Array.isArray(parsed?.elementOptions) &&
      Array.isArray(parsed?.locationOptions)
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function writeCachedTaxonomies(
  speciesOptions: SpeciesOption[],
  elementOptions: ElementOption[],
  locationOptions: LocationOption[]
) {
  try {
    localStorage.setItem(
      STORAGE_KEY_TAXONOMIES,
      JSON.stringify({
        speciesOptions,
        elementOptions,
        locationOptions,
        cachedAt: Date.now(),
      })
    );
  } catch {}
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

interface UserSettingsDoc {
  uid: string;
  theme?: ThemeSettings;
  savedThemes?: SavedTheme[];
  unlockedBorders?: string[];
  unlockedPerks?: string[];
  unlockedBadges?: string[];
  dailyFreeGifts?: Record<string, string>;
  onboardingCompleted?: boolean;
  updatedAt?: string;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialTaxonomies = readCachedTaxonomies();
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>(
    () => initialTaxonomies?.speciesOptions || []
  );
  const [elementOptions, setElementOptions] = useState<ElementOption[]>(
    () => initialTaxonomies?.elementOptions || []
  );
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>(
    () => initialTaxonomies?.locationOptions || []
  );
  const [loading, setLoading] = useState(() => !initialTaxonomies);
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [adminSettings, setAdminSettings] = useState<AdminAppSettings>(() => ({
    ...DEFAULT_ADMIN_SETTINGS,
    ...readLocalJson<Partial<AdminAppSettings>>(STORAGE_KEY_ADMIN_SETTINGS, {}),
  }));

  const [storeBorders, setStoreBorders] = useState<StoreBorderCatalogItem[]>(() => {
    const cached = readLocalJson<{ items: StoreBorderCatalogItem[]; cachedAt?: number } | StoreBorderCatalogItem[]>(
      STORAGE_KEY_BORDERS_CACHE,
      DEFAULT_STORE_BORDERS
    );
    if (Array.isArray(cached) && cached.length > 0) return cached;
    if (!Array.isArray(cached) && Array.isArray(cached?.items) && cached.items.length > 0) {
      return cached.items;
    }
    return DEFAULT_STORE_BORDERS;
  });

  const [theme, setTheme] = useState<ThemeSettings>(() => ({
    ...DEFAULT_THEME,
    ...readLocalJson<Partial<ThemeSettings>>('pony_network_custom_theme_v1', {}),
  }));

  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(() =>
    readLocalJson<SavedTheme[]>('pony_network_saved_themes_v1', [])
  );

  const [unlockedBorders, setUnlockedBorders] = useState<string[]>(() =>
    readLocalJson<string[]>('unlocked_borders', [])
  );
  const [unlockedPerks, setUnlockedPerks] = useState<string[]>(() =>
    readLocalJson<string[]>('unlocked_perks', [])
  );
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>(() =>
    readLocalJson<string[]>('unlocked_badges', [])
  );
  const [dailyFreeGifts, setDailyFreeGifts] = useState<Record<string, string>>(() =>
    readLocalJson<Record<string, string>>('pony_free_gifts_map_v1', {})
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pony_network_onboarding_completed') === 'true';
    } catch {
      return false;
    }
  });

  // Debounced & deduplicated sync helper for /userSettings/{uid}
  const userSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUserSettingsRef = useRef<Partial<UserSettingsDoc> | null>(null);
  const lastUserSettingsHashRef = useRef<string>('');

  const flushUserSettings = useCallback(
    async (uidOverride?: string) => {
      const targetUid = uidOverride || user?.uid;
      const pending = pendingUserSettingsRef.current;
      pendingUserSettingsRef.current = null;
      if (userSettingsTimerRef.current) {
        clearTimeout(userSettingsTimerRef.current);
        userSettingsTimerRef.current = null;
      }
      if (!targetUid || !pending) return;

      const cleanPayload = stripUndefined({
        uid: targetUid,
        ...pending,
      });
      try {
        const hash = JSON.stringify(cleanPayload);
        if (hash === lastUserSettingsHashRef.current) return;
        lastUserSettingsHashRef.current = hash;
      } catch {}

      try {
        await setDoc(
          doc(db, 'userSettings', targetUid),
          {
            ...cleanPayload,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Failed syncing userSettings:', err);
      }
    },
    [user?.uid]
  );

  const queueUserSettingsSync = useCallback(
    (partial: Partial<UserSettingsDoc>, immediate = false) => {
      if (!user?.uid) return;
      pendingUserSettingsRef.current = {
        ...(pendingUserSettingsRef.current || {}),
        ...partial,
      };
      if (immediate) {
        void flushUserSettings(user.uid);
        return;
      }
      if (userSettingsTimerRef.current) clearTimeout(userSettingsTimerRef.current);
      userSettingsTimerRef.current = setTimeout(() => {
        void flushUserSettings(user.uid);
      }, 800);
    },
    [user?.uid, flushUserSettings]
  );

  useEffect(() => {
    const onPageHide = () => {
      void flushUserSettings();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      void flushUserSettings();
    };
  }, [flushUserSettings]);

  const seedDefaults = async () => {
    if (!isAdmin) return;
    try {
      if (localStorage.getItem(STORAGE_KEY_DEFAULTS_SEEDED) === '1') return;
    } catch {}

    try {
      const speciesSnap = await getDocs(query(collection(db, 'species'), limit(1)));
      if (speciesSnap.empty) {
        for (const name of DEFAULT_SPECIES) {
          await addDoc(collection(db, 'species'), { name, createdAt: new Date().toISOString() });
        }
      }

      const elementSnap = await getDocs(query(collection(db, 'elements'), limit(1)));
      if (elementSnap.empty) {
        for (const name of DEFAULT_ELEMENTS) {
          await addDoc(collection(db, 'elements'), { name, createdAt: new Date().toISOString() });
        }
      }

      const locationSnap = await getDocs(query(collection(db, 'locations'), limit(1)));
      if (locationSnap.empty) {
        for (const country of DEFAULT_COUNTRIES) {
          await addDoc(collection(db, 'locations'), { ...country, createdAt: new Date().toISOString() });
        }
      }

      try {
        localStorage.setItem(STORAGE_KEY_DEFAULTS_SEEDED, '1');
      } catch {}
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'taxonomies-seed');
    }
  };

  const seedDefaultStoreBorders = async () => {
    if (!isAdmin) return;
    try {
      if (localStorage.getItem(STORAGE_KEY_BORDERS_SEEDED) === '1') return;
      const snap = await getDocs(query(collection(db, 'storeBorders'), limit(1)));
      if (snap.empty) {
        for (const item of DEFAULT_STORE_BORDERS) {
          await setDoc(doc(db, 'storeBorders', item.id), stripUndefined(item));
        }
      }
      try {
        localStorage.setItem(STORAGE_KEY_BORDERS_SEEDED, '1');
      } catch {}
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'storeBorders-seed');
    }
  };

  const didSeedGlobalSettingsRef = useRef(false);
  const ensureGlobalAdminSettings = useCallback(async () => {
    if (!isAdmin || !user || didSeedGlobalSettingsRef.current) return;
    didSeedGlobalSettingsRef.current = true;
    try {
      const globalRef = doc(db, 'appSettings', 'global');
      const snap = await getDoc(globalRef);
      if (!snap.exists()) {
        await setDoc(
          globalRef,
          stripUndefined({
            ...DEFAULT_ADMIN_SETTINGS,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
          }),
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Could not ensure initial appSettings/global:', err);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (user && isAdmin) {
      void seedDefaults();
      void seedDefaultStoreBorders();
      void ensureGlobalAdminSettings();
    }
  }, [user, isAdmin, ensureGlobalAdminSettings]);

  // Keep latest taxonomy slices in refs so any individual real-time snapshot updates cache accurately
  const taxonomiesLatestRef = useRef({
    speciesOptions,
    elementOptions,
    locationOptions,
  });
  taxonomiesLatestRef.current = { speciesOptions, elementOptions, locationOptions };

  // Real-time public listeners for shared global admin settings, store borders, and taxonomies
  useEffect(() => {
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) {
        setLoading(false);
      }
    };

    const unsubAdminSettings = onSnapshot(
      doc(db, 'appSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AdminAppSettings>;
          const merged: AdminAppSettings = { ...DEFAULT_ADMIN_SETTINGS, ...data };
          setAdminSettings(merged);
          try {
            localStorage.setItem(STORAGE_KEY_ADMIN_SETTINGS, JSON.stringify(merged));
          } catch {}
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'appSettings/global');
      }
    );

    const unsubStoreBorders = onSnapshot(
      collection(db, 'storeBorders'),
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as StoreBorderCatalogItem))
            .sort((a, b) => (a.price || 0) - (b.price || 0) || (a.name || '').localeCompare(b.name || ''));
          setStoreBorders(items);
          try {
            localStorage.setItem(STORAGE_KEY_BORDERS_CACHE, JSON.stringify({ items, cachedAt: Date.now() }));
          } catch {}
        }
      },
      (err) => {
        console.warn('Could not load storeBorders from Firestore:', err);
      }
    );

    const unsubSpecies = onSnapshot(
      query(collection(db, 'species'), orderBy('name')),
      (snap) => {
        const nextSp = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SpeciesOption));
        taxonomiesLatestRef.current.speciesOptions = nextSp;
        setSpeciesOptions(nextSp);
        writeCachedTaxonomies(
          nextSp,
          taxonomiesLatestRef.current.elementOptions,
          taxonomiesLatestRef.current.locationOptions
        );
        markLoaded();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'species');
        setLoading(false);
      }
    );

    const unsubElements = onSnapshot(
      query(collection(db, 'elements'), orderBy('name')),
      (snap) => {
        const nextEl = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ElementOption));
        taxonomiesLatestRef.current.elementOptions = nextEl;
        setElementOptions(nextEl);
        writeCachedTaxonomies(
          taxonomiesLatestRef.current.speciesOptions,
          nextEl,
          taxonomiesLatestRef.current.locationOptions
        );
        markLoaded();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'elements');
        setLoading(false);
      }
    );

    const unsubLocations = onSnapshot(
      query(collection(db, 'locations'), orderBy('name')),
      (snap) => {
        const nextLoc = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LocationOption));
        taxonomiesLatestRef.current.locationOptions = nextLoc;
        setLocationOptions(nextLoc);
        writeCachedTaxonomies(
          taxonomiesLatestRef.current.speciesOptions,
          taxonomiesLatestRef.current.elementOptions,
          nextLoc
        );
        markLoaded();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'locations');
        setLoading(false);
      }
    );

    return () => {
      unsubAdminSettings();
      unsubStoreBorders();
      unsubSpecies();
      unsubElements();
      unsubLocations();
    };
  }, []);

  // User-specific settings sync (/userSettings/{uid})
  useEffect(() => {
    if (!user) {
      if (!authLoading) {
        if (userSettingsTimerRef.current) {
          clearTimeout(userSettingsTimerRef.current);
          userSettingsTimerRef.current = null;
        }
        pendingUserSettingsRef.current = null;
        lastUserSettingsHashRef.current = '';
        setOnboardingCompleted(false);
        setUnlockedBorders([]);
        setUnlockedPerks([]);
        setUnlockedBadges([]);
        setDailyFreeGifts({});
        try {
          localStorage.removeItem('pony_network_onboarding_completed');
          localStorage.removeItem('unlocked_borders');
          localStorage.removeItem('unlocked_perks');
          localStorage.removeItem('unlocked_badges');
          localStorage.removeItem('pony_free_gifts_map_v1');
        } catch {}
      }
      return;
    }

    let cancelled = false;

    const loadUserSettingsOnce = async () => {
      try {
        const snap = await getDoc(doc(db, 'userSettings', user.uid));
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as UserSettingsDoc;
        if (data.theme) {
          const mergedTheme = { ...DEFAULT_THEME, ...data.theme };
          setTheme(mergedTheme);
          try {
            localStorage.setItem('pony_network_custom_theme_v1', JSON.stringify(mergedTheme));
          } catch {}
        }
        if (Array.isArray(data.savedThemes)) {
          setSavedThemes(data.savedThemes);
          try {
            localStorage.setItem('pony_network_saved_themes_v1', JSON.stringify(data.savedThemes));
          } catch {}
        }
        if (Array.isArray(data.unlockedBorders)) {
          setUnlockedBorders(data.unlockedBorders);
          try {
            localStorage.setItem('unlocked_borders', JSON.stringify(data.unlockedBorders));
          } catch {}
        }
        if (Array.isArray(data.unlockedPerks)) {
          setUnlockedPerks(data.unlockedPerks);
          try {
            localStorage.setItem('unlocked_perks', JSON.stringify(data.unlockedPerks));
          } catch {}
        }
        if (Array.isArray(data.unlockedBadges)) {
          setUnlockedBadges(data.unlockedBadges);
          try {
            localStorage.setItem('unlocked_badges', JSON.stringify(data.unlockedBadges));
          } catch {}
        }
        if (data.dailyFreeGifts && typeof data.dailyFreeGifts === 'object') {
          setDailyFreeGifts(data.dailyFreeGifts);
          try {
            localStorage.setItem('pony_free_gifts_map_v1', JSON.stringify(data.dailyFreeGifts));
          } catch {}
        }
        if (typeof data.onboardingCompleted === 'boolean') {
          setOnboardingCompleted(data.onboardingCompleted);
          try {
            if (data.onboardingCompleted) {
              localStorage.setItem('pony_network_onboarding_completed', 'true');
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Could not load userSettings from Firestore:', err);
      }
    };

    void loadUserSettingsOnce();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const updateAdminSettings = async (partial: Partial<AdminAppSettings>) => {
    if (!isAdmin) return;
    const nextSettings: AdminAppSettings = { ...adminSettings, ...partial };
    setAdminSettings(nextSettings);
    try {
      localStorage.setItem(STORAGE_KEY_ADMIN_SETTINGS, JSON.stringify(nextSettings));
    } catch {}
    if (user) {
      try {
        await setDoc(
          doc(db, 'appSettings', 'global'),
          stripUndefined({
            ...nextSettings,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
          }),
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'appSettings/global');
      }
    }
  };

  const addStoreBorder = async (item: StoreBorderCatalogItem) => {
    if (!isAdmin) return;
    const safeId = sanitizeFirestoreId(item.id, 'border');
    const cleanItem: StoreBorderCatalogItem = { ...item, id: safeId };
    const next = [...storeBorders.filter((b) => b.id !== safeId), cleanItem];
    setStoreBorders(next);
    try {
      localStorage.setItem(STORAGE_KEY_BORDERS_CACHE, JSON.stringify({ items: next, cachedAt: Date.now() }));
    } catch {}
    try {
      await setDoc(doc(db, 'storeBorders', safeId), stripUndefined(cleanItem));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `storeBorders/${safeId}`);
    }
  };

  const updateStoreBorder = async (id: string, partial: Partial<StoreBorderCatalogItem>) => {
    if (!isAdmin) return;
    const existingItem = storeBorders.find((b) => b.id === id);
    if (!existingItem) return;
    const updatedItem = { ...existingItem, ...partial, id };
    const next = storeBorders.map((b) => (b.id === id ? updatedItem : b));
    setStoreBorders(next);
    try {
      localStorage.setItem(STORAGE_KEY_BORDERS_CACHE, JSON.stringify({ items: next, cachedAt: Date.now() }));
    } catch {}
    try {
      await setDoc(doc(db, 'storeBorders', id), stripUndefined(updatedItem), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `storeBorders/${id}`);
    }
  };

  const deleteStoreBorder = async (id: string) => {
    if (!isAdmin) return;
    const next = storeBorders.filter((b) => b.id !== id);
    setStoreBorders(next);
    try {
      localStorage.setItem(STORAGE_KEY_BORDERS_CACHE, JSON.stringify({ items: next, cachedAt: Date.now() }));
    } catch {}
    try {
      await deleteDoc(doc(db, 'storeBorders', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `storeBorders/${id}`);
    }
  };

  const addSpecies = async (name: string) => {
    if (!isAdmin) return;
    try {
      const createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'species'), { name, createdAt });
      const next = [...speciesOptions, { id: docRef.id, name } as SpeciesOption].sort((a, b) => a.name.localeCompare(b.name));
      setSpeciesOptions(next);
      writeCachedTaxonomies(next, elementOptions, locationOptions);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'species');
    }
  };

  const addElement = async (name: string) => {
    if (!isAdmin) return;
    try {
      const createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'elements'), { name, createdAt });
      const next = [...elementOptions, { id: docRef.id, name } as ElementOption].sort((a, b) => a.name.localeCompare(b.name));
      setElementOptions(next);
      writeCachedTaxonomies(speciesOptions, next, locationOptions);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'elements');
    }
  };

  const addLocation = async (name: string, code?: string) => {
    if (!isAdmin) return;
    try {
      const createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'locations'), { name, code: code || '', createdAt });
      const next = [...locationOptions, { id: docRef.id, name, code: code || '' } as LocationOption].sort((a, b) => a.name.localeCompare(b.name));
      setLocationOptions(next);
      writeCachedTaxonomies(speciesOptions, elementOptions, next);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'locations');
    }
  };

  const removeSpecies = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'species', id));
      const next = speciesOptions.filter((s) => s.id !== id);
      setSpeciesOptions(next);
      writeCachedTaxonomies(next, elementOptions, locationOptions);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `species/${id}`);
    }
  };

  const removeElement = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'elements', id));
      const next = elementOptions.filter((el) => el.id !== id);
      setElementOptions(next);
      writeCachedTaxonomies(speciesOptions, next, locationOptions);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `elements/${id}`);
    }
  };

  const removeLocation = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'locations', id));
      const next = locationOptions.filter((l) => l.id !== id);
      setLocationOptions(next);
      writeCachedTaxonomies(speciesOptions, elementOptions, next);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `locations/${id}`);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('pony_network_custom_theme_v1', JSON.stringify(theme));
      const root = document.documentElement;
      root.style.setProperty('--theme-bg', theme.bgColor);
      root.style.setProperty('--theme-text', theme.textColor);
      const effBorder = theme.transparentAllBorders ? 'transparent' : (theme.borderColor || '#a855f7');
      root.style.setProperty('--theme-border', effBorder);
      root.style.setProperty('--theme-border-hover', theme.transparentAllBorders ? 'transparent' : (theme.borderHoverColor || '#ec4899'));
      root.style.setProperty('--theme-button', theme.buttonColor);
      root.style.setProperty('--theme-button-text', theme.buttonTextColor || '#ffffff');
    } catch {}
  }, [theme]);

  const updateTheme = (newTheme: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const next = { ...prev, ...newTheme };
      queueUserSettingsSync({ theme: next });
      return next;
    });
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    queueUserSettingsSync({ theme: DEFAULT_THEME }, true);
  };

  const saveCurrentTheme = (name: string) => {
    if (!name.trim()) return;
    const newSaved: SavedTheme = {
      id: `theme-${Date.now()}`,
      name: name.trim(),
      theme: { ...theme },
    };
    const updated = [...savedThemes, newSaved];
    setSavedThemes(updated);
    try {
      localStorage.setItem('pony_network_saved_themes_v1', JSON.stringify(updated));
    } catch {}
    queueUserSettingsSync({ savedThemes: updated }, true);
  };

  const deleteSavedTheme = (id: string) => {
    const updated = savedThemes.filter((t) => t.id !== id);
    setSavedThemes(updated);
    try {
      localStorage.setItem('pony_network_saved_themes_v1', JSON.stringify(updated));
    } catch {}
    queueUserSettingsSync({ savedThemes: updated }, true);
  };

  const applySavedTheme = (savedTheme: ThemeSettings) => {
    const next = { ...DEFAULT_THEME, ...savedTheme };
    setTheme(next);
    queueUserSettingsSync({ theme: next }, true);
  };

  const unlockStoreItems = useCallback(
    (items: { borders?: string[]; perks?: string[]; badges?: string[] }) => {
      const syncPayload: Partial<UserSettingsDoc> = {};
      if (items.borders && items.borders.length > 0) {
        const nextBorders = Array.from(new Set([...unlockedBorders, ...items.borders]));
        setUnlockedBorders(nextBorders);
        syncPayload.unlockedBorders = nextBorders;
        try {
          localStorage.setItem('unlocked_borders', JSON.stringify(nextBorders));
        } catch {}
      }
      if (items.perks && items.perks.length > 0) {
        const nextPerks = Array.from(new Set([...unlockedPerks, ...items.perks]));
        setUnlockedPerks(nextPerks);
        syncPayload.unlockedPerks = nextPerks;
        try {
          localStorage.setItem('unlocked_perks', JSON.stringify(nextPerks));
        } catch {}
      }
      if (items.badges && items.badges.length > 0) {
        const nextBadges = Array.from(new Set([...unlockedBadges, ...items.badges]));
        setUnlockedBadges(nextBadges);
        syncPayload.unlockedBadges = nextBadges;
        try {
          localStorage.setItem('unlocked_badges', JSON.stringify(nextBadges));
        } catch {}
      }
      if (Object.keys(syncPayload).length > 0) {
        queueUserSettingsSync(syncPayload, true);
      }
    },
    [unlockedBorders, unlockedPerks, unlockedBadges, queueUserSettingsSync]
  );

  const recordDailyFreeGift = useCallback(
    (viewerPonyId: string, targetPonyId: string, dateStr: string) => {
      const key = `${viewerPonyId}__${targetPonyId}`;
      const next = { ...dailyFreeGifts, [key]: dateStr };
      setDailyFreeGifts(next);
      try {
        localStorage.setItem('pony_free_gifts_map_v1', JSON.stringify(next));
      } catch {}
      queueUserSettingsSync({ dailyFreeGifts: next }, true);
    },
    [dailyFreeGifts, queueUserSettingsSync]
  );

  const markOnboardingCompleted = useCallback(() => {
    if (onboardingCompleted) return;
    setOnboardingCompleted(true);
    try {
      localStorage.setItem('pony_network_onboarding_completed', 'true');
    } catch {}
    queueUserSettingsSync({ onboardingCompleted: true }, true);
  }, [onboardingCompleted, queueUserSettingsSync]);

  return (
    <SettingsContext.Provider
      value={{
        speciesOptions,
        elementOptions,
        locationOptions,
        addSpecies,
        addElement,
        addLocation,
        removeSpecies,
        removeElement,
        removeLocation,
        loading,
        theme,
        updateTheme,
        resetTheme,
        savedThemes,
        saveCurrentTheme,
        deleteSavedTheme,
        applySavedTheme,
        adminSettings,
        updateAdminSettings,
        storeBorders,
        addStoreBorder,
        updateStoreBorder,
        deleteStoreBorder,
        unlockedBorders,
        unlockedPerks,
        unlockedBadges,
        unlockStoreItems,
        dailyFreeGifts,
        recordDailyFreeGift,
        onboardingCompleted,
        markOnboardingCompleted,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
