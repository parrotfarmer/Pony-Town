import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { 
  PonyNode, 
  WebConnection, 
  ConnectionType, 
  CustomStatus, 
  EditableHeaders,
  DestinationFilterScope,
  PonyLoveFlowStats
} from './types/pony';
import { INITIAL_PONIES, INITIAL_CONNECTIONS, DEFAULT_STATUSES, DEFAULT_HEADERS } from './data/defaultPonies';
import { 
  calculatePonyDailyRate, 
  calculatePonyAccumulatedLove, 
  calculateDaysActive,
  getNormalizedPonySplits,
  calculateScopedMetrics,
  calculateLoveFlowStats,
  sortPonies,
  filterPoniesBySearch,
  PONY_SORT_OPTIONS,
  PonySortKey,
  hasMagicAndAccountingAccess,
  getUserMainPony,
  getSortedStatuses
} from './utils/calculations';
import { resizeImageToMax } from './utils/imageUtils';
import { Navbar } from './components/Navbar';
import { NetworkWeb } from './components/NetworkWeb';
import { PonyDetailModal } from './components/PonyDetailModal';
import { AddPonyModal } from './components/AddPonyModal';
import { ThemeSettingsModal } from './components/ThemeSettingsModal';
import { AuthModal } from './components/AuthModal';
import { AdminConfirmModal, AdminActionType } from './components/AdminConfirmModal';

import { StatusStoreModal } from './components/StatusStoreModal';
const BulkEditorModal = lazy(() => import('./components/BulkEditorModal').then(m => ({ default: m.BulkEditorModal })));
const StatusManagerModal = lazy(() => import('./components/StatusManagerModal').then(m => ({ default: m.StatusManagerModal })));
const RankingsModal = lazy(() => import('./components/RankingsModal').then(m => ({ default: m.RankingsModal })));
const AdminControlModal = lazy(() => import('./components/AdminControlModal').then(m => ({ default: m.AdminControlModal })));
import { ReservoirAccounting } from './components/ReservoirAccounting';
import { OnboardingSplashModal } from './components/OnboardingSplashModal';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { stripUndefined, sanitizeFirestoreId } from './utils/firestoreHelpers';
import { Sparkles, Heart, Sliders, Plus, Link2, Eye, ArrowRight, PieChart, Landmark, ShieldCheck, Search, X, Upload } from 'lucide-react';

const STORAGE_KEY_PONIES = 'pony_network_nodes_clean_v5';
const STORAGE_KEY_CONNECTIONS = 'pony_network_connections_clean_v5';
const STORAGE_KEY_STATUSES = 'pony_network_statuses_v5';
const STORAGE_KEY_HEADERS = 'pony_network_headers_v5';
const STORAGE_KEY_RATIO = 'pony_network_ratio_v5';
const STORAGE_KEY_TARGET_DATE = 'pony_network_target_date_v5';
const STORAGE_KEY_SCOPE = 'pony_network_scope_v5';
const STORAGE_KEY_LAYOUT_LOCK = 'pony_network_layout_locked_v5';
const STORAGE_KEY_DEDUCTIONS = 'pony_network_reservoir_deductions_v5';

interface SecretBadgePageData {
  badgeRows?: CustomStatus['badgeRows'];
  specialPageContent?: string;
}

function stripBadgePageFields(status: CustomStatus): CustomStatus {
  const { badgeRows: _br, specialPageContent: _sp, ...publicStatus } = status;
  return publicStatus;
}

function reconcilePonyForToday(pony: PonyNode, todayStr: string, statuses: CustomStatus[]): PonyNode {
  if (!pony.lastAccruedDate || pony.lastAccruedDate >= todayStr) {
    return pony;
  }
  const prevMs = new Date(pony.lastAccruedDate + 'T00:00:00Z').getTime();
  const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
  if (isNaN(prevMs) || isNaN(todayMs) || todayMs <= prevMs) {
    return pony;
  }
  const deltaDays = Math.floor((todayMs - prevMs) / 86400000);
  if (deltaDays <= 0) return pony;
  const dailyRate = calculatePonyDailyRate(pony, statuses);
  const deltaLove = deltaDays * dailyRate;
  const baseOverall = pony.totalOverallLove ?? calculatePonyAccumulatedLove(pony, pony.lastAccruedDate, statuses, 0);
  const baseCurrent = pony.currentLoveTotal !== undefined ? pony.currentLoveTotal : Math.max(0, baseOverall - (pony.totalLoveSpent || 0));
  return {
    ...pony,
    totalOverallLove: baseOverall + deltaLove,
    currentLoveTotal: baseCurrent + deltaLove,
    lastAccruedDate: todayStr,
  };
}

export default function App() {
  const { theme, adminSettings, onboardingCompleted, markOnboardingCompleted } = useSettings();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Core State
  const [ponies, setPonies] = useState<PonyNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PONIES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_PONIES;
  });

  const [connections, setConnections] = useState<WebConnection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
      if (saved) {
        const parsed: WebConnection[] = JSON.parse(saved);
        // Migration: Ensure all connections have a startDate. 
        // If missing, use today's date as a safe default for legacy data.
        return parsed.map(c => ({
          ...c,
          startDate: c.startDate || new Date().toISOString().split('T')[0]
        }));
      }
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_CONNECTIONS;
  });

  const [statuses, setStatuses] = useState<CustomStatus[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATUSES);
      if (saved) return (JSON.parse(saved) as CustomStatus[]).map(stripBadgePageFields);
    } catch (e) {
      console.warn(e);
    }
    return DEFAULT_STATUSES.map(stripBadgePageFields);
  });
  const [badgePagesMap, setBadgePagesMap] = useState<Record<string, SecretBadgePageData>>({});
  const [legacyBadgePagesMap, setLegacyBadgePagesMap] = useState<Record<string, SecretBadgePageData>>({});

  const [headers, setHeaders] = useState<EditableHeaders>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEADERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_HEADERS,
          ...parsed,
          cardInflow: !parsed.cardInflow || parsed.cardInflow === 'Love Rate' || parsed.cardInflow === 'Love Inflow Rate' ? 'LOVE RATE' : parsed.cardInflow,
          cardHarvested: !parsed.cardHarvested || parsed.cardHarvested === 'Total Love' || parsed.cardHarvested === 'Total Love Harvested' ? 'CURRENT LOVE' : parsed.cardHarvested,
          analyticsTitle: '',
          matrixTitle: '',
          flowsTitle: '',
        };
      }
    } catch (e) {
      console.warn(e);
    }
    return DEFAULT_HEADERS;
  });

  const [loveToPowerRatio, setLoveToPowerRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RATIO);
      if (saved) return Number(saved);
    } catch (e) {}
    return 3.5;
  });

  const [targetDate, setTargetDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TARGET_DATE);
      if (saved) {
        const savedTime = new Date(saved + 'T00:00:00Z').getTime();
        const nowTime = new Date(todayStr + 'T00:00:00Z').getTime();
        // If saved date is not in the future, use it; otherwise default to today
        if (!isNaN(savedTime) && savedTime <= nowTime + 86400000) {
          return saved;
        }
      }
    } catch (e) {}
    return todayStr;
  });

  // Love Destination Filter Scope (All Connections, General Reservoir, or Specific Pony ID)
  const [destinationScope, setDestinationScope] = useState<DestinationFilterScope>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCOPE);
      if (saved) return saved;
    } catch (e) {}
    return 'all';
  });

  // Layout lock state (admin feature)
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAYOUT_LOCK) === 'true';
    } catch (e) {
      return false;
    }
  });

  // 2. Modals and Inspection
  const [selectedPonyId, setSelectedPonyId] = useState<string | null>(null);
  const [centerTrigger, setCenterTrigger] = useState<number>(0);
  const [fullDetailPonyId, setFullDetailPonyId] = useState<string | null>(null);
  const [isBulkEditorOpen, setIsBulkEditorOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStatusManagerOpen, setIsStatusManagerOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeModalPonyId, setStoreModalPonyId] = useState<string | null>(null);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [isRankingsModalOpen, setIsRankingsModalOpen] = useState(false);

  const storeModalPony = useMemo(() => {
    if (!storeModalPonyId) return null;
    return ponies.find(p => p.id === storeModalPonyId) || null;
  }, [ponies, storeModalPonyId]);

  useEffect(() => {
    if (!adminSettings.allowExchangeStore && isStoreModalOpen) {
      setIsStoreModalOpen(false);
    }
  }, [adminSettings.allowExchangeStore, isStoreModalOpen]);

  const handleOpenStore = () => {
    if (!adminSettings.allowExchangeStore) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    const userPony = getUserMainPony(ponies, user.uid);
    if (!userPony) {
      setIsOnboardingOpen(true);
      return;
    }
    setStoreModalPonyId(userPony.id);
    setIsStoreModalOpen(true);
  };
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('pony_network_onboarding_completed');
    } catch (e) {
      return false;
    }
  });
  const [addPonyInitialPos, setAddPonyInitialPos] = useState<{ x: number; y: number } | null>(null);

  // 2.1 Admin Confirmation Modal State
  const [adminPopup, setAdminPopup] = useState<{
    isOpen: boolean;
    type: AdminActionType;
    title: string;
    message: string;
    entityId?: string;
    entityName?: string;
    confirmLabel?: string;
    onConfirm: (val?: any) => void;
  }>({
    isOpen: false,
    type: 'delete',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const { user, loading: authLoading, isAdmin: authIsAdmin } = useAuth();
  const [isSimulatingNonAdmin, setIsSimulatingNonAdmin] = useState(false);
  const isAdmin = authIsAdmin && !isSimulatingNonAdmin;

  // Fallback to 'transfers' if non-admin attempts to access 'all' or 'general', or if target pony deleted
  const activeDestinationScope = useMemo(() => {
    if (!isAdmin && (destinationScope === 'all' || destinationScope === 'general')) {
      return 'transfers';
    }
    if (destinationScope === 'all' || destinationScope === 'general' || destinationScope === 'transfers') return destinationScope;
    if (ponies.some(p => p.id === destinationScope)) return destinationScope;
    return isAdmin ? 'all' : 'transfers';
  }, [destinationScope, ponies, isAdmin]);

  // 3. Search & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [ledgerSortKey, setLedgerSortKey] = useState<PonySortKey>('name_asc');

  // Firestore Realtime Subscriptions & Sync Guards
  const latestConnectionsRef = useRef(connections);
  latestConnectionsRef.current = connections;
  const latestStatusesRef = useRef(statuses);
  latestStatusesRef.current = statuses;
  const didMigrateLocalPoniesRef = useRef(false);
  const didMigrateLocalConnsRef = useRef(false);
  const didSeedStatusesRef = useRef(false);
  const didMigrateLegacyBadgePagesRef = useRef(false);
  const didSeedNetworkStateRef = useRef(false);
  const [isFirestorePoniesReady, setIsFirestorePoniesReady] = useState(false);
  const [isFirestoreConnsReady, setIsFirestoreConnsReady] = useState(false);

  // Close initial onboarding automatically if user already completed onboarding or owns a pony in Firestore
  useEffect(() => {
    if (!user) return;
    if (onboardingCompleted || ponies.some((p) => p.ownerId === user.uid)) {
      setIsOnboardingOpen(false);
      if (!onboardingCompleted) {
        markOnboardingCompleted();
      }
    }
  }, [user, onboardingCompleted, ponies, markOnboardingCompleted]);

  // Visibility-aware 10-Second Auto-Update Periodic Pulse — strictly locked behind Admin Control (default off / static)
  const [livePulseTick, setLivePulseTick] = useState(0);
  const lastPulseAtRef = useRef<number>(Date.now());
  const isLivePulseEnabled = isAdmin && adminSettings.allowLivePulseUpdates;

  useEffect(() => {
    if (!isLivePulseEnabled) {
      setLivePulseTick(0);
      return;
    }

    lastPulseAtRef.current = Date.now();

    const applyPulseTicks = (tickCount: number) => {
      if (tickCount <= 0) return;
      setLivePulseTick((prev) => prev + tickCount);
      setPonies((prevPonies) =>
        prevPonies.map((p) => {
          const dailyRate = calculatePonyDailyRate(p, statuses);
          const increment = (dailyRate / 8640) * tickCount;

          const currentOverall =
            p.totalOverallLove || calculatePonyAccumulatedLove(p, targetDate, statuses, 0);
          const currentSpendable =
            p.currentLoveTotal !== undefined
              ? p.currentLoveTotal
              : currentOverall - (p.totalLoveSpent || 0);

          return {
            ...p,
            totalOverallLove: currentOverall + increment,
            currentLoveTotal: currentSpendable + increment,
          };
        })
      );
    };

    const tickIfVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = Date.now();
      const elapsedTicks = Math.floor((now - lastPulseAtRef.current) / 10000);
      if (elapsedTicks >= 1) {
        lastPulseAtRef.current += elapsedTicks * 10000;
        applyPulseTicks(elapsedTicks);
      }
    };

    const timer = setInterval(tickIfVisible, 10000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        tickIfVisible();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLivePulseEnabled, statuses, targetDate]);

  // Debounced LocalStorage Sync for ponies (prevents blocking UI on rapid slider/drag/tick updates)
  const latestPoniesRef = useRef(ponies);
  latestPoniesRef.current = ponies;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_PONIES, JSON.stringify(ponies));
      } catch (e) {}
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [ponies]);

  useEffect(() => {
    const flushPoniesToStorage = () => {
      try {
        localStorage.setItem(STORAGE_KEY_PONIES, JSON.stringify(latestPoniesRef.current));
      } catch (e) {}
    };
    window.addEventListener('pagehide', flushPoniesToStorage);
    return () => {
      window.removeEventListener('pagehide', flushPoniesToStorage);
      flushPoniesToStorage();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections));
    } catch (e) {}
  }, [connections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STATUSES, JSON.stringify(statuses.map(stripBadgePageFields)));
    } catch (e) {}
  }, [statuses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HEADERS, JSON.stringify(headers));
    } catch (e) {}
  }, [headers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RATIO, String(loveToPowerRatio));
    } catch (e) {}
  }, [loveToPowerRatio]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TARGET_DATE, targetDate);
    } catch (e) {}
  }, [targetDate]);

  // Archived historical love yielded by deleted ponies
  const [archivedLove, setArchivedLove] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('PONY_APP_ARCHIVED_LOVE') || '0');
    } catch {
      return 0;
    }
  });

  // Global deductions from the general reservoir (e.g. treats given)
  const [reservoirDeductions, setReservoirDeductions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DEDUCTIONS);
      if (saved) return Number(saved);
    } catch (e) {}
    return 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SCOPE, destinationScope);
    } catch (e) {}
  }, [destinationScope]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DEDUCTIONS, String(reservoirDeductions));
    } catch (e) {}
  }, [reservoirDeductions]);

  // Auto-connect all ponies owned by the same user in Firebase (only when signed in & synced)
  const lastAutoConnectSigRef = useRef<string>('');
  useEffect(() => {
    if (!user || !db || !isFirestorePoniesReady || !isFirestoreConnsReady || ponies.length < 2) return;

    const ownedByUserCount = authIsAdmin ? 2 : ponies.reduce((cnt, p) => cnt + (p.ownerId === user.uid ? 1 : 0), 0);
    if (!authIsAdmin && ownedByUserCount < 2) return;

    const sig =
      `${user.uid}:${authIsAdmin ? '1' : '0'}:` +
      ponies.map((p) => `${p.id}:${p.ownerId || ''}`).join('|') +
      `||${connections.length}`;
    if (sig === lastAutoConnectSigRef.current) return;
    lastAutoConnectSigRef.current = sig;

    const ownerGroups = new Map<string, PonyNode[]>();
    ponies.forEach((p) => {
      if (p.ownerId && (authIsAdmin || p.ownerId === user.uid)) {
        const list = ownerGroups.get(p.ownerId) || [];
        list.push(p);
        ownerGroups.set(p.ownerId, list);
      }
    });

    const existingPairs = new Set(
      connections.map((c) => [c.source, c.target].sort().join('--'))
    );

    const newConnsToCreate: WebConnection[] = [];

    ownerGroups.forEach((ownerPonies) => {
      if (ownerPonies.length < 2) return;
      for (let i = 0; i < ownerPonies.length; i++) {
        for (let j = i + 1; j < ownerPonies.length; j++) {
          const p1 = ownerPonies[i];
          const p2 = ownerPonies[j];
          const pairKey = [p1.id, p2.id].sort().join('--');
          if (!existingPairs.has(pairKey)) {
            existingPairs.add(pairKey);
            newConnsToCreate.push({
              id: sanitizeFirestoreId(`auto-owner-conn-${p1.id}-${p2.id}`, 'conn'),
              source: p1.id,
              target: p2.id,
              connectionType: 'friendship',
              strength: 3,
              startDate: targetDate || new Date().toISOString().split('T')[0],
            });
          }
        }
      }
    });

    if (newConnsToCreate.length > 0) {
      setConnections((prev) => [...prev, ...newConnsToCreate]);
      const batch = writeBatch(db);
      newConnsToCreate.forEach((c) => {
        batch.set(doc(db, 'connections', c.id), stripUndefined(c), { merge: true });
      });
      batch.commit().catch((err) => {
        console.warn('Firestore auto-connect sync error:', err);
      });
    }
  }, [user, authIsAdmin, isFirestorePoniesReady, isFirestoreConnsReady, ponies, connections, targetDate]);

  // Stop disabled/hidden Harvester Ledger sorting & stats when not admin
  const sortedAndFilteredLedgerPonies = useMemo(() => {
    if (!isAdmin) return [];
    const filtered = filterPoniesBySearch(ponies, ledgerSearchQuery);
    return sortPonies(filtered, ledgerSortKey, connections, statuses, targetDate, livePulseTick, reservoirDeductions);
  }, [isAdmin, ponies, ledgerSearchQuery, ledgerSortKey, connections, statuses, targetDate, livePulseTick, reservoirDeductions]);

  const ledgerFlowStatsMap = useMemo(() => {
    if (!isAdmin) return new Map<string, PonyLoveFlowStats>();
    const stats = calculateLoveFlowStats(ponies, targetDate, statuses, connections, livePulseTick);
    return new Map<string, PonyLoveFlowStats>(stats.map((s) => [s.pony.id, s]));
  }, [isAdmin, ponies, targetDate, statuses, connections, livePulseTick]);

  const ledgerPonyMap = useMemo(() => {
    if (!isAdmin) return new Map<string, PonyNode>();
    return new Map<string, PonyNode>(ponies.map((p) => [p.id, p]));
  }, [isAdmin, ponies]);

  const autoDailyAccrualRef = useRef(adminSettings.allowAutoDailyAccrual);
  autoDailyAccrualRef.current = adminSettings.allowAutoDailyAccrual;

  // Debounced & deduplicated Firestore pony sync to minimize write operations under heavy traffic
  const pendingPonyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingPonyPayloadsRef = useRef<Map<string, PonyNode>>(new Map());
  const lastSyncedPonyHashRef = useRef<Map<string, string>>(new Map());

  const flushPonyToFirestore = useCallback((ponyId: string) => {
    const payload = pendingPonyPayloadsRef.current.get(ponyId);
    pendingPonyPayloadsRef.current.delete(ponyId);
    const existingTimer = pendingPonyTimersRef.current.get(ponyId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingPonyTimersRef.current.delete(ponyId);
    }
    if (!payload || !user || !db) return;

    const isOwnerOrAdmin = authIsAdmin || payload.ownerId === user.uid;
    const coreData = isOwnerOrAdmin
      ? stripUndefined({
          ...payload,
          lastAccruedDate: todayStr,
        })
      : stripUndefined({
          totalOverallLove: payload.totalOverallLove ?? 0,
          currentLoveTotal: payload.currentLoveTotal ?? 0,
        });

    try {
      const hash = JSON.stringify(coreData);
      if (lastSyncedPonyHashRef.current.get(ponyId) === hash) return;
      lastSyncedPonyHashRef.current.set(ponyId, hash);
      setDoc(
        doc(db, 'ponies', payload.id),
        { ...coreData, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch((err) => {
        console.warn('Firestore pony sync error:', err);
      });
    } catch {}
  }, [user, authIsAdmin, todayStr]);

  const queuePonySync = useCallback((ponyToSync: PonyNode, immediate = false) => {
    if (!user || !db) return;
    pendingPonyPayloadsRef.current.set(ponyToSync.id, ponyToSync);
    if (immediate) {
      flushPonyToFirestore(ponyToSync.id);
      return;
    }
    const prevTimer = pendingPonyTimersRef.current.get(ponyToSync.id);
    if (prevTimer) clearTimeout(prevTimer);
    const nextTimer = setTimeout(() => {
      flushPonyToFirestore(ponyToSync.id);
    }, 750);
    pendingPonyTimersRef.current.set(ponyToSync.id, nextTimer);
  }, [user, flushPonyToFirestore]);

  useEffect(() => {
    const flushAllPending = () => {
      const ids = Array.from(pendingPonyPayloadsRef.current.keys());
      ids.forEach((id) => flushPonyToFirestore(id));
    };
    window.addEventListener('pagehide', flushAllPending);
    return () => {
      window.removeEventListener('pagehide', flushAllPending);
      flushAllPending();
    };
  }, [flushPonyToFirestore]);

  const prevUserUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    const currUid = user?.uid || null;
    if (prevUserUidRef.current && !currUid) {
      pendingPonyTimersRef.current.forEach((timer) => clearTimeout(timer));
      pendingPonyTimersRef.current.clear();
      pendingPonyPayloadsRef.current.clear();
      lastSyncedPonyHashRef.current.clear();
      lastAutoConnectSigRef.current = '';
      setIsSimulatingNonAdmin(false);
      setSelectedPonyId(null);
      setFullDetailPonyId(null);
      setIsBulkEditorOpen(false);
      setIsAddModalOpen(false);
      setIsStatusManagerOpen(false);
      setIsAuthModalOpen(false);
      setIsAdminModalOpen(false);
      setIsStoreModalOpen(false);
      setStoreModalPonyId(null);
      setIsThemeSettingsOpen(false);
      setIsRankingsModalOpen(false);
      setBadgePagesMap({});
      setLegacyBadgePagesMap({});
      try {
        localStorage.removeItem('pony_network_onboarding_completed');
      } catch {}
      setIsOnboardingOpen(true);
    }
    prevUserUidRef.current = currUid;
  }, [user, authLoading]);

  // Debounced sync helper for /networkState/global (admin-only writes)
  const networkStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncNetworkStateToFirestore = useCallback((partial: Record<string, unknown>, immediate = false) => {
    if (!user || !authIsAdmin || !db) return;
    const writeNow = () => {
      setDoc(
        doc(db, 'networkState', 'global'),
        stripUndefined({
          ...partial,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        }),
        { merge: true }
      ).catch((err) => console.warn('Firestore networkState sync error:', err));
    };
    if (immediate) {
      if (networkStateTimerRef.current) clearTimeout(networkStateTimerRef.current);
      writeNow();
      return;
    }
    if (networkStateTimerRef.current) clearTimeout(networkStateTimerRef.current);
    networkStateTimerRef.current = setTimeout(writeNow, 600);
  }, [user, authIsAdmin]);

  // Attach Firestore listeners for shared network collections (real-time cross-user network)
  useEffect(() => {
    if (!db) return;

    const unsubPonies = onSnapshot(
      collection(db, 'ponies'),
      (snap) => {
        if (!snap.empty || !snap.metadata.fromCache) {
          setIsFirestorePoniesReady(true);
        }
        if (snap.empty) {
          if (authIsAdmin && !didMigrateLocalPoniesRef.current && latestPoniesRef.current.length > 0) {
            didMigrateLocalPoniesRef.current = true;
            const batch = writeBatch(db);
            latestPoniesRef.current.forEach((p) => {
              const safeId = sanitizeFirestoreId(p.id, 'pony');
              batch.set(
                doc(db, 'ponies', safeId),
                stripUndefined({ ...p, id: safeId, lastAccruedDate: todayStr, updatedAt: new Date().toISOString() })
              );
            });
            batch.commit().catch(() => {});
          } else if (!snap.metadata.fromCache) {
            setPonies([]);
          }
          return;
        }
        didMigrateLocalPoniesRef.current = true;
        const canReconcile = authIsAdmin && autoDailyAccrualRef.current;
        const accruedUpdates: PonyNode[] = [];
        const loaded = snap.docs.map((d) => {
          const raw = { id: d.id, ...d.data() } as PonyNode;
          const pending = pendingPonyPayloadsRef.current.get(raw.id);
          if (pending) return pending;
          if (!canReconcile) return raw;
          const reconciled = reconcilePonyForToday(raw, todayStr, latestStatusesRef.current);
          if (reconciled !== raw) {
            accruedUpdates.push(reconciled);
          }
          return reconciled;
        });
        setPonies(loaded);
        if (accruedUpdates.length > 0 && user && db) {
          const batch = writeBatch(db);
          const nowIso = new Date().toISOString();
          accruedUpdates.forEach((p) => {
            batch.set(
              doc(db, 'ponies', p.id),
              stripUndefined({
                totalOverallLove: p.totalOverallLove,
                currentLoveTotal: p.currentLoveTotal,
                lastAccruedDate: p.lastAccruedDate,
                updatedAt: nowIso,
              }),
              { merge: true }
            );
          });
          batch.commit().catch(() => {});
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'ponies');
      }
    );

    const unsubConnections = onSnapshot(
      collection(db, 'connections'),
      (snap) => {
        if (!snap.empty || !snap.metadata.fromCache) {
          setIsFirestoreConnsReady(true);
        }
        if (snap.empty) {
          if (authIsAdmin && !didMigrateLocalConnsRef.current && latestConnectionsRef.current.length > 0) {
            didMigrateLocalConnsRef.current = true;
            const batch = writeBatch(db);
            latestConnectionsRef.current.forEach((c) => {
              const safeId = sanitizeFirestoreId(c.id, 'conn');
              batch.set(doc(db, 'connections', safeId), stripUndefined({ ...c, id: safeId }));
            });
            batch.commit().catch(() => {});
          } else if (didMigrateLocalConnsRef.current || !snap.metadata.fromCache) {
            setConnections([]);
          }
          return;
        }
        didMigrateLocalConnsRef.current = true;
        const loaded = snap.docs.map((d) => {
          const data = d.data() as WebConnection;
          return {
            ...data,
            id: d.id,
            startDate: data.startDate || todayStr,
          };
        });
        setConnections(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'connections');
      }
    );

    const unsubStatuses = onSnapshot(
      collection(db, 'statuses'),
      (snap) => {
        if (snap.empty) {
          if (authIsAdmin && !didSeedStatusesRef.current) {
            didSeedStatusesRef.current = true;
            const seedList = latestStatusesRef.current.length > 0 ? latestStatusesRef.current : DEFAULT_STATUSES;
            const batch = writeBatch(db);
            seedList.forEach((s) => {
              const safeId = sanitizeFirestoreId(s.id, 'status');
              const matchingDefault = DEFAULT_STATUSES.find((d) => d.id === safeId || d.id === s.id);
              const badgeRows = s.badgeRows ?? matchingDefault?.badgeRows ?? [];
              const specialPageContent = s.specialPageContent ?? matchingDefault?.specialPageContent;
              batch.set(doc(db, 'statuses', safeId), stripUndefined({ ...stripBadgePageFields(s), id: safeId }));
              batch.set(
                doc(db, 'badgePages', safeId),
                stripUndefined({
                  id: safeId,
                  badgeRows,
                  ...(specialPageContent ? { specialPageContent } : {}),
                  updatedAt: new Date().toISOString(),
                })
              );
            });
            batch.commit().catch(() => {});
          }
          return;
        }
        didSeedStatusesRef.current = true;
        const legacyExtracted: Record<string, SecretBadgePageData> = {};
        const legacyToMigrate: CustomStatus[] = [];
        const loaded = snap.docs
          .map((d) => {
            const raw = { id: d.id, ...d.data() } as CustomStatus;
            const { badgeRows, specialPageContent } = raw;
            if ((badgeRows && badgeRows.length > 0) || specialPageContent) {
              legacyExtracted[d.id] = {
                ...(badgeRows ? { badgeRows } : {}),
                ...(specialPageContent ? { specialPageContent } : {}),
              };
              legacyToMigrate.push(raw);
            }
            return stripBadgePageFields(raw);
          })
          .sort((a, b) => (a.price || 0) - (b.price || 0) || (a.multiplier || 0) - (b.multiplier || 0));
        setStatuses(loaded);

        if (user) {
          setLegacyBadgePagesMap(legacyExtracted);
        } else {
          setLegacyBadgePagesMap({});
        }

        if (authIsAdmin && legacyToMigrate.length > 0 && !didMigrateLegacyBadgePagesRef.current) {
          didMigrateLegacyBadgePagesRef.current = true;
          const batch = writeBatch(db);
          const nowIso = new Date().toISOString();
          legacyToMigrate.forEach((raw) => {
            const safeId = sanitizeFirestoreId(raw.id, 'status');
            batch.set(
              doc(db, 'badgePages', safeId),
              stripUndefined({
                id: safeId,
                badgeRows: raw.badgeRows || [],
                ...(raw.specialPageContent ? { specialPageContent: raw.specialPageContent } : {}),
                updatedAt: nowIso,
              }),
              { merge: true }
            );
            batch.set(doc(db, 'statuses', safeId), stripUndefined({ ...stripBadgePageFields(raw), id: safeId }));
          });
          batch.commit().catch(() => {});
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'statuses');
      }
    );

    const unsubNetworkState = onSnapshot(
      doc(db, 'networkState', 'global'),
      (snap) => {
        if (!snap.exists()) {
          if (authIsAdmin && !didSeedNetworkStateRef.current) {
            didSeedNetworkStateRef.current = true;
            setDoc(
              doc(db, 'networkState', 'global'),
              stripUndefined({
                headers,
                loveToPowerRatio,
                targetDate,
                archivedLove,
                reservoirDeductions,
                isLayoutLocked,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || 'admin',
              }),
              { merge: true }
            ).catch(() => {});
          }
          return;
        }
        didSeedNetworkStateRef.current = true;
        const data = snap.data() as Record<string, any>;
        if (data.headers) {
          setHeaders((prev) => ({ ...prev, ...data.headers }));
        }
        if (typeof data.loveToPowerRatio === 'number') {
          setLoveToPowerRatio(data.loveToPowerRatio);
        }
        if (typeof data.targetDate === 'string' && data.targetDate) {
          setTargetDate(data.targetDate);
        }
        if (typeof data.archivedLove === 'number') {
          setArchivedLove(data.archivedLove);
          try { localStorage.setItem('PONY_APP_ARCHIVED_LOVE', String(data.archivedLove)); } catch {}
        }
        if (typeof data.reservoirDeductions === 'number') {
          setReservoirDeductions(data.reservoirDeductions);
        }
        if (typeof data.isLayoutLocked === 'boolean') {
          setIsLayoutLocked(data.isLayoutLocked);
          try { localStorage.setItem(STORAGE_KEY_LAYOUT_LOCK, String(data.isLayoutLocked)); } catch {}
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'networkState/global');
      }
    );

    return () => {
      unsubPonies();
      unsubConnections();
      unsubStatuses();
      unsubNetworkState();
    };
  }, [user, authIsAdmin, todayStr]);

  // Compute badge status IDs owned/unlocked by the signed-in user's personal ponies
  const ownedBadgeStatusIds = useMemo(() => {
    const owned = new Set<string>();
    if (!user) return owned;
    const sorted = getSortedStatuses(statuses);
    const userPonies = ponies.filter((p) => p.ownerId === user.uid);
    userPonies.forEach((p) => {
      const purchased = p.purchasedBadges || [];
      const acceptedSet = new Set(p.acceptedBadges || []);
      const firstUnacceptedIdx = sorted.findIndex((s) => !acceptedSet.has(s.id));
      const frontierIdx = firstUnacceptedIdx === -1 ? sorted.length - 1 : firstUnacceptedIdx;
      sorted.forEach((s, idx) => {
        const explicitlyOwned =
          purchased.includes(s.id) ||
          (s.badgeIcon ? purchased.includes(s.badgeIcon) : false) ||
          p.status === s.id ||
          p.status === s.name ||
          !s.price ||
          s.price === 0;
        const unlockedWithoutStore =
          !adminSettings.allowExchangeStore &&
          (idx <= frontierIdx || (idx > 0 && acceptedSet.has(sorted[idx - 1].id)));
        if (explicitlyOwned || unlockedWithoutStore) {
          owned.add(s.id);
        }
      });
    });
    return owned;
  }, [user, ponies, statuses, adminSettings.allowExchangeStore]);

  const ownedBadgeIdsKey = useMemo(
    () => Array.from(ownedBadgeStatusIds).sort().join('|'),
    [ownedBadgeStatusIds]
  );

  // Scoped Firestore subscription for private /badgePages documents:
  // - Signed-out: never reads badgePages and keeps map empty
  // - Admin: subscribes to badgePages for template management
  // - Signed-in owner: subscribes ONLY to badgePages documents for badges owned by their own ponies
  useEffect(() => {
    if (!user || !db) {
      setBadgePagesMap({});
      setLegacyBadgePagesMap({});
      return;
    }

    if (isAdmin) {
      const unsubAllPages = onSnapshot(
        collection(db, 'badgePages'),
        (snap) => {
          const nextMap: Record<string, SecretBadgePageData> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as SecretBadgePageData;
            nextMap[d.id] = {
              ...(data.badgeRows ? { badgeRows: data.badgeRows } : {}),
              ...(data.specialPageContent ? { specialPageContent: data.specialPageContent } : {}),
            };
          });
          setBadgePagesMap(nextMap);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'badgePages');
        }
      );
      return () => unsubAllPages();
    }

    const ids = ownedBadgeIdsKey ? ownedBadgeIdsKey.split('|') : [];
    if (ids.length === 0) {
      setBadgePagesMap({});
      return;
    }

    const unsubs = ids.map((statusId) => {
      const safeId = sanitizeFirestoreId(statusId, 'status');
      return onSnapshot(
        doc(db, 'badgePages', safeId),
        (snap) => {
          setBadgePagesMap((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              const data = snap.data() as SecretBadgePageData;
              next[statusId] = {
                ...(data.badgeRows ? { badgeRows: data.badgeRows } : {}),
                ...(data.specialPageContent ? { specialPageContent: data.specialPageContent } : {}),
              };
            } else {
              delete next[statusId];
            }
            return next;
          });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `badgePages/${safeId}`);
        }
      );
    });

    setBadgePagesMap((prev) => {
      const allowed = new Set(ids);
      const next: Record<string, SecretBadgePageData> = {};
      Object.keys(prev).forEach((k) => {
        if (allowed.has(k)) next[k] = prev[k];
      });
      return next;
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user, isAdmin, ownedBadgeIdsKey]);

  const statusesWithBadgePages = useMemo(() => {
    if (!user) {
      return statuses.map(stripBadgePageFields);
    }
    return statuses.map((s) => {
      const canMerge = isAdmin || ownedBadgeStatusIds.has(s.id);
      if (!canMerge) return stripBadgePageFields(s);
      const safeId = sanitizeFirestoreId(s.id, 'status');
      const secret = badgePagesMap[s.id] || badgePagesMap[safeId] || legacyBadgePagesMap[s.id] || legacyBadgePagesMap[safeId];
      if (!secret) return stripBadgePageFields(s);
      return {
        ...s,
        ...(secret.badgeRows ? { badgeRows: secret.badgeRows } : {}),
        ...(secret.specialPageContent ? { specialPageContent: secret.specialPageContent } : {}),
      };
    });
  }, [user, isAdmin, statuses, badgePagesMap, legacyBadgePagesMap, ownedBadgeStatusIds]);

  // Pony Handlers - moving one pony moves only that pony (Firebase Auth required)
  const handleUpdatePony = useCallback((updatedPony: PonyNode) => {
    if (!user || !db) {
      setIsAuthModalOpen(true);
      return;
    }
    const affectedOthers: PonyNode[] = [];
    setPonies((prev) =>
      prev.map((p) => {
        if (p.id === updatedPony.id) return updatedPony;
        if (updatedPony.isMainPony && updatedPony.ownerId && p.ownerId === updatedPony.ownerId && p.isMainPony) {
          const cleared = { ...p, isMainPony: false };
          affectedOthers.push(cleared);
          return cleared;
        }
        return p;
      })
    );

    queuePonySync(updatedPony);
    affectedOthers.forEach((other) => queuePonySync(other));
  }, [user, queuePonySync]);

  // Group update for multi-selected pony movements (Admin/Signed-in Firebase persistence)
  const handleUpdatePonies = useCallback((updatedPonies: PonyNode[]) => {
    if (!user || !db || !isAdmin) return;
    setPonies(updatedPonies);
    const prevById = new Map(latestPoniesRef.current.map((p) => [p.id, p]));
    updatedPonies.forEach((p) => {
      const old = prevById.get(p.id);
      if (!old || old.x !== p.x || old.y !== p.y) {
        queuePonySync(p);
      }
    });
  }, [user, isAdmin, queuePonySync]);

  const handleUpdateHeaders = useCallback((nextHeaders: EditableHeaders) => {
    if (!isAdmin) return;
    setHeaders(nextHeaders);
    syncNetworkStateToFirestore({ headers: nextHeaders });
  }, [isAdmin, syncNetworkStateToFirestore]);

  const handleToggleLayoutLock = useCallback(() => {
    if (!isAdmin) return;
    setIsLayoutLocked((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY_LAYOUT_LOCK, String(next)); } catch {}
      syncNetworkStateToFirestore({ isLayoutLocked: next }, true);
      return next;
    });
  }, [isAdmin, syncNetworkStateToFirestore]);

  const handleUpdateStatuses = useCallback((nextStatuses: CustomStatus[]) => {
    if (!user || !authIsAdmin || !db) return;
    const prevIds = new Set(latestStatusesRef.current.map((s) => s.id));
    setStatuses(nextStatuses.map(stripBadgePageFields));
    setBadgePagesMap((prev) => {
      const nextMap: Record<string, SecretBadgePageData> = {};
      nextStatuses.forEach((s) => {
        const safeId = sanitizeFirestoreId(s.id, 'status');
        const existing = prev[s.id] || prev[safeId];
        if (s.badgeRows !== undefined || s.specialPageContent !== undefined) {
          nextMap[safeId] = {
            ...(s.badgeRows !== undefined ? { badgeRows: s.badgeRows } : {}),
            ...(s.specialPageContent !== undefined ? { specialPageContent: s.specialPageContent } : {}),
          };
        } else if (existing) {
          nextMap[safeId] = existing;
        }
      });
      return nextMap;
    });

    const batch = writeBatch(db);
    const nextIds = new Set<string>();
    const nowIso = new Date().toISOString();
    nextStatuses.forEach((s) => {
      const safeId = sanitizeFirestoreId(s.id, 'status');
      nextIds.add(safeId);
      batch.set(doc(db, 'statuses', safeId), stripUndefined({ ...stripBadgePageFields(s), id: safeId }));
      if (s.badgeRows !== undefined || s.specialPageContent !== undefined) {
        batch.set(
          doc(db, 'badgePages', safeId),
          stripUndefined({
            id: safeId,
            badgeRows: s.badgeRows || [],
            ...(s.specialPageContent ? { specialPageContent: s.specialPageContent } : {}),
            updatedAt: nowIso,
          }),
          { merge: true }
        );
      }
    });
    prevIds.forEach((oldId) => {
      const safeOldId = sanitizeFirestoreId(oldId, 'status');
      if (!nextIds.has(safeOldId)) {
        batch.delete(doc(db, 'statuses', safeOldId));
        batch.delete(doc(db, 'badgePages', safeOldId));
      }
    });
    batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'statuses'));
  }, [user, authIsAdmin]);

  const handleUpdateArchivedLove = useCallback((val: number) => {
    if (!isAdmin) return;
    setArchivedLove(val);
    try { localStorage.setItem('PONY_APP_ARCHIVED_LOVE', String(val)); } catch {}
    syncNetworkStateToFirestore({ archivedLove: val }, true);
  }, [isAdmin, syncNetworkStateToFirestore]);

  const handleSyncDailyAccrual = useCallback(async (): Promise<number> => {
    if (!user || !authIsAdmin || !db) return 0;
    const updatedList: PonyNode[] = [];
    const nextPonies = latestPoniesRef.current.map((p) => {
      const reconciled = reconcilePonyForToday(p, todayStr, latestStatusesRef.current);
      if (reconciled !== p) {
        updatedList.push(reconciled);
      }
      return reconciled;
    });
    if (updatedList.length === 0) return 0;

    setPonies(nextPonies);
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    updatedList.forEach((p) => {
      batch.set(
        doc(db, 'ponies', p.id),
        stripUndefined({
          totalOverallLove: p.totalOverallLove,
          currentLoveTotal: p.currentLoveTotal,
          lastAccruedDate: p.lastAccruedDate,
          updatedAt: nowIso,
        }),
        { merge: true }
      );
    });
    await batch.commit();
    return updatedList.length;
  }, [user, authIsAdmin, todayStr]);

  const handleGiveTreat = useCallback((ponyId: string, amount: number) => {
    if (!isAdmin) return;
    
    // Validate treat against reservoir balance
    const totalInflowAccumulated = ponies.reduce((sum, p) => {
      const daily = calculatePonyDailyRate(p, statuses);
      const accum = calculatePonyAccumulatedLove(p, targetDate, statuses, livePulseTick);
      const splits = getNormalizedPonySplits(p, statuses, connections);
      const allocatedDaily = splits.reduce((sum, s) => sum + s.amount, 0);
      const unallocatedDaily = Math.max(0, daily - allocatedDaily);
      const ratio = daily > 0 ? unallocatedDaily / daily : 1;
      return sum + Math.round(accum * ratio);
    }, 0);

    const storePurchasesInflow = ponies.reduce((sum, p) => sum + (p.totalLoveSpent || 0), 0);
    const grossReservoir = totalInflowAccumulated + storePurchasesInflow + archivedLove;
    
    const totalPayoutsAccumulated = ponies.reduce((sum, p) => {
      const daily = calculatePonyDailyRate(p, statuses);
      const splits = getNormalizedPonySplits(p, statuses, connections);
      const unallocatedDaily = Math.max(0, daily - splits.reduce((sum, s) => sum + s.amount, 0));
      const ratio = daily > 0 ? unallocatedDaily / daily : 1;
      const totalInflowAccumulatedPony = Math.round(calculatePonyAccumulatedLove(p, targetDate, statuses, livePulseTick) * ratio);
      const payoutPct = (p.payoutPercentage || 0) / 100;
      return sum + (totalInflowAccumulatedPony * payoutPct);
    }, 0);
    
    const totalTreats = ponies.reduce((sum, p) => sum + (p.treatsReceived || 0), 0);
    const netAccumulated = grossReservoir - totalPayoutsAccumulated - totalTreats;
    
    if (amount > netAccumulated) {
      alert(`Cannot grant treat: insufficient reservoir balance. Available: ${Math.round(netAccumulated)}`);
      return;
    }

    const targetPony = ponies.find((p) => p.id === ponyId);
    if (targetPony) {
      const updated = { ...targetPony, treatsReceived: (targetPony.treatsReceived || 0) + amount };
      setPonies((prev) => prev.map((p) => (p.id === ponyId ? updated : p)));
      queuePonySync(updated, true);
    }
    const nextDeductions = reservoirDeductions + amount;
    setReservoirDeductions(nextDeductions);
    syncNetworkStateToFirestore({ reservoirDeductions: nextDeductions }, true);
  }, [isAdmin, ponies, statuses, targetDate, livePulseTick, connections, archivedLove, reservoirDeductions, queuePonySync, syncNetworkStateToFirestore]);

  const handleUpdatePayout = useCallback((ponyId: string, percentage: number) => {
    if (!isAdmin) return;
    
    const currentSum = ponies.reduce((sum, p) => sum + (p.id === ponyId ? 0 : (p.payoutPercentage || 0)), 0);
    if (currentSum + percentage > 100) {
      alert('Total payout percentage cannot exceed 100%.');
      return;
    }

    const targetPony = ponies.find((p) => p.id === ponyId);
    if (targetPony) {
      const updated = { ...targetPony, payoutPercentage: percentage };
      setPonies((prev) => prev.map((p) => (p.id === ponyId ? updated : p)));
      queuePonySync(updated);
    }
  }, [isAdmin, ponies, queuePonySync]);

  const handleTogglePonyAdmin = useCallback((ponyId: string, isPonyAdmin: boolean) => {
    if (!isAdmin) return;
    const targetPony = ponies.find((p) => p.id === ponyId);
    if (targetPony) {
      const updated = { ...targetPony, isAdmin: isPonyAdmin };
      setPonies((prev) => prev.map((p) => (p.id === ponyId ? updated : p)));
      queuePonySync(updated, true);
    }
  }, [isAdmin, ponies, queuePonySync]);

  const handleOpenAdminPopup = useCallback((
    type: AdminActionType, 
    title: string, 
    message: string, 
    confirmLabel: string, 
    onConfirm: (val?: any) => void,
    entityName?: string
  ) => {
    setAdminPopup({
      isOpen: true,
      type,
      title,
      message,
      confirmLabel,
      onConfirm,
      entityName
    });
  }, []);

  const handleDeletePony = useCallback((id: string) => {
    if (!isAdmin) {
      alert('Deletion is restricted to administrators.');
      return;
    }
    const targetPony = ponies.find(p => p.id === id);
    if (!targetPony) return;

    if (targetPony.isOriginalAdmin) {
      handleOpenAdminPopup(
        'delete',
        'Protected Admin Node',
        `The pony "${targetPony.name}" is designated as the original network administrator and cannot be deleted.`,
        'Understood',
        () => {}
      );
      return;
    }

    handleOpenAdminPopup(
      'delete',
      'Confirm Deletion',
      `Are you sure you want to delete pony "${targetPony.name}"? This will archive their accumulated love and remove all relationship links.`,
      'Permanently Delete',
      () => {
        const ponyAccum = calculatePonyAccumulatedLove(targetPony, targetDate, statuses, livePulseTick);
        setArchivedLove(prev => {
          const next = prev + ponyAccum;
          try { localStorage.setItem('PONY_APP_ARCHIVED_LOVE', String(next)); } catch {}
          syncNetworkStateToFirestore({ archivedLove: next }, true);
          return next;
        });

        const modifiedPonies: PonyNode[] = [];
        setPonies((prev) =>
          prev
            .filter((p) => p.id !== id)
            .map((p) => {
              const filteredSplits = (p.loveSplits || []).filter(s => s.recipientId !== id);
              const splitRemoved = (p.loveSplits || []).length !== filteredSplits.length || p.targetRecipientId === id;
              const updated = {
                ...p,
                loveSplits: filteredSplits,
                targetRecipientId: p.targetRecipientId === id ? null : p.targetRecipientId,
              };
              if (splitRemoved) modifiedPonies.push(updated);
              return updated;
            })
        );
        const removedConnIds = connections
          .filter((c) => c.source === id || c.target === id)
          .map((c) => c.id);
        setConnections((prev) =>
          prev.filter((c) => c.source !== id && c.target !== id)
        );
        if (user && db) {
          deleteDoc(doc(db, 'ponies', id)).catch((err) => handleFirestoreError(err, OperationType.DELETE, `ponies/${id}`));
          removedConnIds.forEach((cid) => {
            deleteDoc(doc(db, 'connections', cid)).catch(() => {});
          });
          modifiedPonies.forEach((mp) => queuePonySync(mp, true));
        }
        if (selectedPonyId === id) setSelectedPonyId(null);
        if (fullDetailPonyId === id) setFullDetailPonyId(null);
      },
      targetPony.name
    );
  }, [ponies, connections, targetDate, statuses, livePulseTick, selectedPonyId, fullDetailPonyId, isAdmin, handleOpenAdminPopup, user, syncNetworkStateToFirestore, queuePonySync]);

  const userOwnedPonies = useMemo(() => {
    if (!user) return [];
    return ponies.filter((p) => p.ownerId === user.uid);
  }, [ponies, user]);

  const currentUserPony = useMemo(() => {
    if (!user) return null;
    return userOwnedPonies.find((p) => p.isMainPony) || userOwnedPonies[0] || null;
  }, [user, userOwnedPonies]);

  const maxAllowedPonies = Math.max(1, adminSettings.maxPoniesPerUser || 1);
  const effectiveOwnedCount = isSimulatingNonAdmin
    ? Math.max(userOwnedPonies.length, currentUserPony ? 1 : 0)
    : userOwnedPonies.length;

  const canUserAddPony = useMemo(() => {
    if (isAdmin) return true;
    if (effectiveOwnedCount === 0) return true;
    return Boolean(adminSettings.allowUserAddPony && effectiveOwnedCount < maxAllowedPonies);
  }, [isAdmin, effectiveOwnedCount, adminSettings.allowUserAddPony, maxAllowedPonies]);

  const handleAddPony = useCallback(
    (newPony: PonyNode, connectToId?: string, connType: ConnectionType = 'friendship') => {
      if (!canUserAddPony) return;
      if (!user || !db) {
        setIsAuthModalOpen(true);
        return;
      }
      const safeId = sanitizeFirestoreId(newPony.id, 'pony');
      const effectiveOwnerId = newPony.ownerId || user.uid;
      const effectiveOwnerName = newPony.ownerName || user.displayName || user.email?.split('@')[0] || 'Community Member';
      const isFirst = latestPoniesRef.current.length === 0;
      const hasExistingOwnedPony = latestPoniesRef.current.some((p) => p.ownerId === effectiveOwnerId);
      const ponyWithRole: PonyNode = {
        ...newPony,
        id: safeId,
        isOriginalAdmin: isFirst,
        isMainPony: newPony.isMainPony !== undefined ? newPony.isMainPony : !hasExistingOwnedPony,
        ownerId: effectiveOwnerId,
        ownerName: effectiveOwnerName,
        startDate: newPony.startDate || targetDate || new Date().toISOString().split('T')[0],
        lastAccruedDate: todayStr,
      };

      setPonies((prev) => [...prev, ponyWithRole]);
      const firestoreDoc = authIsAdmin
        ? ponyWithRole
        : {
            ...ponyWithRole,
            isOriginalAdmin: false,
            isAdmin: false,
          };
      const ponyWritePromise = setDoc(
        doc(db, 'ponies', safeId),
        stripUndefined({ ...firestoreDoc, updatedAt: new Date().toISOString() })
      ).catch((err) => {
        console.error('Firestore add pony error:', err);
      });

      if (connectToId) {
        const connId = sanitizeFirestoreId(`conn-${safeId}-${connectToId}-${Date.now().toString().slice(-4)}`, 'conn');
        const newConn: WebConnection = {
          id: connId,
          source: safeId,
          target: connectToId,
          connectionType: connType,
          strength: 3,
          startDate: targetDate || new Date().toISOString().split('T')[0],
        };
        setConnections((prev) => [...prev, newConn]);
        void ponyWritePromise.then(() =>
          setDoc(doc(db, 'connections', connId), stripUndefined(newConn)).catch((err) => {
            console.error('Firestore initial connection error:', err);
          })
        );
      }
      setSelectedPonyId(safeId);
      setFullDetailPonyId(safeId);
    },
    [canUserAddPony, user, authIsAdmin, targetDate, todayStr]
  );

  // Connection Handlers (Firebase Auth required)
  const handleCreateConnection = useCallback(
    (sourceId: string, targetId: string, type: ConnectionType = 'friendship') => {
      if (!user || !db) {
        setIsAuthModalOpen(true);
        return;
      }
      if (sourceId === targetId) return;

      const userPonyIds = new Set(ponies.filter(p => p.ownerId === user.uid).map(p => p.id));
      const isMyPonyInvolved = userPonyIds.has(sourceId) || userPonyIds.has(targetId);

      if (!isAdmin && !isMyPonyInvolved) {
        console.warn("Connections can only be established with at least one owned pony.");
        return;
      }

      const exists = connections.some(
        (c) =>
          (c.source === sourceId && c.target === targetId) ||
          (c.source === targetId && c.target === sourceId)
      );
      if (exists) return;

      const connId = sanitizeFirestoreId(`conn-${sourceId}-${targetId}-${Date.now().toString().slice(-4)}`, 'conn');
      const newConn: WebConnection = {
        id: connId,
        source: sourceId,
        target: targetId,
        connectionType: type,
        strength: 3,
        startDate: new Date().toISOString().split('T')[0],
      };
      setConnections((prev) => [...prev, newConn]);
      setDoc(doc(db, 'connections', connId), stripUndefined(newConn)).catch((err) => {
        console.warn('Firestore create connection error:', err);
      });
    },
    [connections, user, ponies, isAdmin]
  );

  const handleDeleteConnection = useCallback((connId: string) => {
    if (!user || !db) {
      setIsAuthModalOpen(true);
      return;
    }
    const connToDelete = latestConnectionsRef.current.find((c) => c.id === connId);
    setConnections((prevConns) => prevConns.filter((c) => c.id !== connId));

    if (connToDelete) {
      const modifiedPonies: PonyNode[] = [];
      setPonies((prevPonies) =>
        prevPonies.map((p) => {
          if (p.id === connToDelete.source || p.id === connToDelete.target) {
            const otherId = p.id === connToDelete.source ? connToDelete.target : connToDelete.source;
            const updatedSplits = (p.loveSplits || []).filter((s) => s.recipientId !== otherId);
            const updated: PonyNode = {
              ...p,
              loveSplits: updatedSplits.length > 0 ? updatedSplits : undefined,
              targetRecipientId: p.targetRecipientId === otherId ? null : p.targetRecipientId,
            };
            modifiedPonies.push(updated);
            return updated;
          }
          return p;
        })
      );
      modifiedPonies.forEach((mp) => queuePonySync(mp, true));
    }

    deleteDoc(doc(db, 'connections', connId)).catch((err) => {
      console.warn('Firestore delete connection error:', err);
    });
  }, [user, queuePonySync]);

  const handleUpdateConnection = useCallback((updatedConn: WebConnection) => {
    if (!user || !db) {
      setIsAuthModalOpen(true);
      return;
    }
    setConnections((prev) =>
      prev.map((c) => (c.id === updatedConn.id ? updatedConn : c))
    );
    setDoc(doc(db, 'connections', updatedConn.id), stripUndefined(updatedConn), { merge: true }).catch((err) => {
      console.warn('Firestore update connection error:', err);
    });
  }, [user]);

  const handleResetNetwork = useCallback(async () => {
    if (!user || !authIsAdmin || !db) return;
    setPonies(INITIAL_PONIES);
    setConnections(INITIAL_CONNECTIONS);
    setStatuses(DEFAULT_STATUSES.map(stripBadgePageFields));
    setArchivedLove(0);
    setReservoirDeductions(0);
    try {
      localStorage.setItem('PONY_APP_ARCHIVED_LOVE', '0');
      localStorage.setItem(STORAGE_KEY_DEDUCTIONS, '0');
    } catch {}

    didMigrateLocalPoniesRef.current = true;
    didMigrateLocalConnsRef.current = true;
    didSeedStatusesRef.current = true;

    try {
      const [poniesSnap, connsSnap, statusesSnap, badgePagesSnap] = await Promise.all([
        getDocs(collection(db, 'ponies')),
        getDocs(collection(db, 'connections')),
        getDocs(collection(db, 'statuses')),
        getDocs(collection(db, 'badgePages')),
      ]);
      const batch = writeBatch(db);
      poniesSnap.docs.forEach((d) => batch.delete(d.ref));
      connsSnap.docs.forEach((d) => batch.delete(d.ref));
      statusesSnap.docs.forEach((d) => batch.delete(d.ref));
      badgePagesSnap.docs.forEach((d) => batch.delete(d.ref));
      DEFAULT_STATUSES.forEach((s) => {
        batch.set(doc(db, 'statuses', s.id), stripUndefined(stripBadgePageFields(s)));
        batch.set(
          doc(db, 'badgePages', s.id),
          stripUndefined({
            id: s.id,
            badgeRows: s.badgeRows || [],
            ...(s.specialPageContent ? { specialPageContent: s.specialPageContent } : {}),
            updatedAt: new Date().toISOString(),
          })
        );
      });
      batch.set(
        doc(db, 'networkState', 'global'),
        stripUndefined({
          archivedLove: 0,
          reservoirDeductions: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        }),
        { merge: true }
      );
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reset-network');
    }
  }, [user, authIsAdmin]);

  // Export / Import (Strictly locked behind Admin Controls)
  const handleExportData = () => {
    if (!isAdmin) return;
    const data = {
      version: 5,
      exportedAt: new Date().toISOString(),
      ponies,
      connections,
      statuses: statusesWithBadgePages,
      headers,
      loveToPowerRatio,
      targetDate,
      destinationScope,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pony-love-network-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.ponies && Array.isArray(json.ponies)) {
          setPonies(json.ponies);
          if (user && authIsAdmin && db) {
            const batch = writeBatch(db);
            (json.ponies as PonyNode[]).forEach((p) => {
              const safeId = sanitizeFirestoreId(p.id, 'pony');
              batch.set(doc(db, 'ponies', safeId), stripUndefined({ ...p, id: safeId, ownerId: p.ownerId || user.uid }), { merge: true });
            });
            batch.commit().catch(() => {});
          }
        }
        if (json.connections && Array.isArray(json.connections)) {
          setConnections(json.connections);
          if (user && authIsAdmin && db) {
            const batch = writeBatch(db);
            (json.connections as WebConnection[]).forEach((c) => {
              const safeId = sanitizeFirestoreId(c.id, 'conn');
              batch.set(doc(db, 'connections', safeId), stripUndefined({ ...c, id: safeId }), { merge: true });
            });
            batch.commit().catch(() => {});
          }
        }
        if (json.statuses && Array.isArray(json.statuses)) handleUpdateStatuses(json.statuses);
        if (json.headers) handleUpdateHeaders(json.headers);
        if (json.loveToPowerRatio) {
          setLoveToPowerRatio(json.loveToPowerRatio);
          syncNetworkStateToFirestore({ loveToPowerRatio: json.loveToPowerRatio }, true);
        }
        if (json.targetDate) {
          setTargetDate(json.targetDate);
          syncNetworkStateToFirestore({ targetDate: json.targetDate }, true);
        }
        if (json.destinationScope) setDestinationScope(json.destinationScope);
        alert('Network data imported successfully!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const fullDetailPony = useMemo(() => {
    return ponies.find((p) => p.id === fullDetailPonyId) || null;
  }, [ponies, fullDetailPonyId]);

  const handleOpenPersonalProfile = useCallback(() => {
    if (!user) {
      setIsOnboardingOpen(true);
      return;
    }
    const userPony = getUserMainPony(ponies, user.uid);
    if (!userPony) {
      setIsOnboardingOpen(true);
    } else {
      setSelectedPonyId(userPony.id);
      setFullDetailPonyId(userPony.id);
    }
  }, [user, ponies]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-pink-500 selection:text-white">
      {/* 1. App Bar with Live Search & Single Settings Button (Contains Add Pony, Numbers, Statuses, Import/Export) */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        ponies={ponies}
        onSelectPony={(id) => {
          setSelectedPonyId(id);
          setDestinationScope(id);
          setCenterTrigger(Date.now());
        }}
        onOpenProfile={(id) => setFullDetailPonyId(id)}
        onOpenRankings={() => setIsRankingsModalOpen(true)}
        onOpenBulkEditor={() => {
          if (isAdmin) setIsBulkEditorOpen(true);
        }}
        onOpenAddModal={() => {
          if (!user) {
            setIsOnboardingOpen(true);
            return;
          }
          if (!canUserAddPony) return;
          setAddPonyInitialPos(null);
          setIsAddModalOpen(true);
        }}
        onOpenStatusManager={() => {
          if (isAdmin) setIsStatusManagerOpen(true);
        }}
        onExportData={handleExportData}
        onImportData={handleImportData}
        statuses={statuses}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAdminModal={() => {
          if (isAdmin) setIsAdminModalOpen(true);
        }}
        onOpenPersonalProfile={handleOpenPersonalProfile}
        onOpenStore={handleOpenStore}
        onOpenThemeSettings={() => setIsThemeSettingsOpen(true)}
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">

        {/* 2. Interactive Network Web Canvas */}
        <section className="space-y-2">

          <NetworkWeb
            ponies={ponies}
            connections={connections}
            selectedPonyId={selectedPonyId}
            centerTrigger={centerTrigger}
            onSelectPony={(id) => {
              setSelectedPonyId(id);
              if (id) {
                setDestinationScope(id);
              }
            }}
            onUpdatePony={handleUpdatePony}
            onUpdatePonies={handleUpdatePonies}
            onDeletePony={handleDeletePony}
            onCreateConnection={handleCreateConnection}
            onDeleteConnection={handleDeleteConnection}
            onOpenAddModal={(pos) => {
              if (!user) {
                setIsOnboardingOpen(true);
                return;
              }
              if (!canUserAddPony) return;
              setAddPonyInitialPos(pos || null);
              setIsAddModalOpen(true);
            }}
            onOpenFullDetailModal={(id) => setFullDetailPonyId(id)}
            searchQuery={searchQuery}
            targetDate={targetDate}
            statuses={statuses}
            livePulseTick={livePulseTick}
            webTitle={headers.webTitle}
            onUpdateWebTitle={(t) => handleUpdateHeaders({ ...headers, webTitle: t })}
            isLayoutLocked={isLayoutLocked}
            currentUserPonyId={currentUserPony?.id}
            currentUserId={user?.uid}
            isAdmin={isAdmin}
            isSimulatingNonAdmin={isSimulatingNonAdmin}
            canAddPony={canUserAddPony && Boolean(user)}
          />
        </section>

        {/* Rankings Modal */}
        {isRankingsModalOpen && (
          <Suspense fallback={null}>
            <RankingsModal
              isOpen={isRankingsModalOpen}
              onClose={() => setIsRankingsModalOpen(false)}
              ponies={ponies}
              connections={connections}
              statuses={statuses}
              targetDate={targetDate}
              livePulseTick={livePulseTick}
              onNavigateToPony={(id) => {
                setSelectedPonyId(id);
                setFullDetailPonyId(id);
                setIsRankingsModalOpen(false);
              }}
            />
          </Suspense>
        )}

        {/* 4. Accounting: Admin or Unlocked Badge Overview of Network & Reservoir Totals */}
        {(isAdmin || hasMagicAndAccountingAccess(currentUserPony, statuses, isAdmin)) && (
          <section>
            <ReservoirAccounting
              ponies={ponies}
              connections={connections}
              statuses={statuses}
              targetDate={targetDate}
              reservoirDeductions={reservoirDeductions}
              livePulseTick={livePulseTick}
              onNavigateToPony={(id) => {
                setSelectedPonyId(id);
                setFullDetailPonyId(id);
              }}
              loveToPowerRatio={loveToPowerRatio}
              headers={headers}
              archivedLove={archivedLove}
            />
          </section>
        )}

        {/* 7. Clean Harvester Ledger (Admin Only) */}
        {isAdmin && (
          <section 
            className="bg-slate-900/70 border rounded-2xl p-5 shadow-xl backdrop-blur-md theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
          <div 
            className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            {headers.matrixTitle.trim() !== '' && (
              <div>
                <input
                  type="text"
                  value={headers.matrixTitle}
                  onChange={(e) => handleUpdateHeaders({ ...headers, matrixTitle: e.target.value })}
                  className="text-sm font-bold bg-transparent border-b border-transparent focus:outline-none"
                  style={{ color: theme.textColor }}
                  title="Click to rename"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* Search Bar for Harvester Ledger */}
              <div className="relative flex items-center min-w-[150px] max-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none" style={{ color: theme.textColor }} />
                <input
                  type="text"
                  value={ledgerSearchQuery}
                  onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  placeholder="Search ledger..."
                  className="w-full bg-slate-950 border rounded-xl pl-8 pr-7 py-1.5 text-xs placeholder-slate-400 focus:outline-none"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                />
                {ledgerSearchQuery && (
                  <button
                    onClick={() => setLedgerSearchQuery('')}
                    className="absolute right-2 opacity-70 hover:opacity-100"
                    style={{ color: theme.textColor }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown for Harvester Ledger */}
              <div 
                className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border text-xs"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
              >
                <span className="text-[11px] font-medium hidden md:inline opacity-70" style={{ color: theme.textColor }}>Sort:</span>
                <select
                  value={ledgerSortKey}
                  onChange={(e) => setLedgerSortKey(e.target.value as PonySortKey)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
                  style={{ color: theme.textColor }}
                >
                  {PONY_SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900" style={{ color: theme.textColor }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setAddPonyInitialPos(null);
                  setIsAddModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 border theme-border-hover cursor-pointer"
                style={{ 
                  backgroundColor: theme.buttonColor, 
                  color: theme.buttonTextColor, 
                  borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
                }}
              >
                <Plus className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
                Add Pony
              </button>
              <button
                onClick={() => setIsBulkEditorOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 border theme-border-hover cursor-pointer"
                style={{ 
                  backgroundColor: theme.buttonColor, 
                  color: theme.buttonTextColor, 
                  borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
                }}
              >
                <Sliders className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
                Full Table
              </button>
            </div>
          </div>

          {/* Quick Cards Grid */}
          {sortedAndFilteredLedgerPonies.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {ponies.length === 0 ? (
                <button
                  onClick={() => {
                    setAddPonyInitialPos(null);
                    setIsAddModalOpen(true);
                  }}
                  className="text-pink-400 hover:text-pink-300 font-bold underline"
                >
                  Add Pony
                </button>
              ) : (
                <span>No ponies matched your search or sort filter.</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4 max-h-[520px] overflow-y-auto pr-1">
              {sortedAndFilteredLedgerPonies.map((pony) => {
                const stat = ledgerFlowStatsMap.get(pony.id);
                const days = calculateDaysActive(pony.startDate, targetDate, pony.customDaysOverride);
                const dailyCapacity = stat ? stat.dailyProduced : calculatePonyDailyRate(pony, statuses);
                const splits: { recipientId: string; amount: number }[] = stat
                  ? stat.splits.map((s) => ({ recipientId: s.recipientId, amount: s.amount }))
                  : getNormalizedPonySplits(pony, statuses, connections);
                const allocated = stat ? stat.allocatedDaily : splits.reduce((sum, s) => sum + s.amount, 0);

                return (
                  <div
                    key={pony.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 hover:border-pink-500/40 transition-all text-xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="relative group/icon-ledger w-7 h-7 flex-shrink-0">
                          {pony.avatarIcon && pony.avatarIcon.startsWith('data:image') ? (
                            <img 
                              src={pony.avatarIcon} 
                              alt="Icon" 
                              className="w-full h-full rounded-lg object-cover border border-slate-700 shadow-sm"
                            />
                          ) : (
                            <input
                              type="text"
                              value={pony.avatarIcon || '💖'}
                              onChange={(e) => handleUpdatePony({ ...pony, avatarIcon: e.target.value })}
                              className="w-full h-full rounded-lg bg-slate-900 border border-slate-700 text-center text-sm focus:outline-none focus:border-pink-500"
                              title="Click to edit icon"
                            />
                          )}
                          {adminSettings.allowAvatarImageUpload && (
                            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover/icon-ledger:opacity-100 transition-opacity cursor-pointer">
                              <Upload className="w-3 h-3 text-white" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!file) return;
                                  try {
                                    const resized = await resizeImageToMax(file, 400, 400);
                                    handleUpdatePony({ ...pony, avatarIcon: resized });
                                  } catch (err: any) {
                                    console.error(err);
                                    alert(err?.message || 'Could not load selected image. Please try another image.');
                                  }
                                }} 
                              />
                            </label>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            value={pony.name}
                            onChange={(e) => handleUpdatePony({ ...pony, name: e.target.value })}
                            className="font-bold text-white block leading-tight bg-transparent border-b border-transparent hover:border-pink-500 focus:outline-none w-28"
                            title="Click to rename"
                          />
                          <span className="text-[10px] text-slate-400">{pony.species || 'Pony'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setFullDetailPonyId(pony.id)}
                        className="text-pink-400 hover:text-pink-300 text-[11px] underline flex items-center gap-1 font-semibold"
                        title="Open full profile modal"
                      >
                        <Eye className="w-3 h-3" />
                        Profile
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      {/* Status / Multiplier */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Status:</span>
                        <select
                          value={pony.status}
                          onChange={(e) => handleUpdatePony({ ...pony, status: e.target.value })}
                          className="bg-slate-900 border border-purple-500/30 rounded px-1.5 py-0.5 text-[11px] text-purple-200"
                        >
                          {statuses.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.multiplier}x)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Start Date */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Since Date:</span>
                        <input
                          type="date"
                          value={pony.startDate}
                          onChange={(e) =>
                            handleUpdatePony({
                              ...pony,
                              startDate: e.target.value,
                              customDaysOverride: null,
                            })
                          }
                          className="w-28 bg-slate-900 border border-purple-500/30 rounded px-1 py-0.5 text-[10px] text-purple-200"
                        />
                      </div>

                      {/* Total Days */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Total Days:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={pony.customDaysOverride !== null && pony.customDaysOverride !== undefined ? pony.customDaysOverride : days}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              handleUpdatePony({ ...pony, customDaysOverride: val });
                            }}
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right text-[11px] text-slate-200"
                          />
                          <span className="text-slate-500 text-[10px]">d</span>
                        </div>
                      </div>

                      {/* Total Spendable Love */}
                      <div className="flex justify-between items-center text-[11px] pt-0.5 text-slate-300">
                        <span>Current Love:</span>
                        <strong className="text-emerald-300">{(pony.currentLoveTotal !== undefined ? Math.round(pony.currentLoveTotal) : 0).toLocaleString()} Love</strong>
                      </div>

                      {/* Total Overall Love */}
                      <div className="flex justify-between items-center text-[11px] pt-0.5 text-slate-300">
                        <span>Overall Total:</span>
                        <strong className="text-pink-300">{Math.round(pony.totalOverallLove || 0).toLocaleString()} Love</strong>
                      </div>

                      {/* ADMIN EXCLUSIVE CONTROLS ON CARD */}
                      <div className="pt-2 mt-1 border-t border-slate-800/80 space-y-2 bg-slate-900/40 p-2 rounded-lg">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!!pony.isAdmin}
                              onChange={(e) => handleTogglePonyAdmin(pony.id, e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                            />
                            <span className={`text-[10px] font-bold uppercase tracking-tight ${pony.isAdmin ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                              Admin
                            </span>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Payout:</span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={pony.payoutPercentage || 0}
                                onChange={(e) => handleUpdatePayout(pony.id, Number(e.target.value) || 0)}
                                className="w-14 bg-slate-950 border border-purple-500/30 rounded px-1 py-0.5 text-right text-[10px] text-purple-300 font-bold"
                              />
                              <span className="text-purple-500 text-[10px] ml-0.5">%</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleOpenAdminPopup(
                              'treat',
                              'Grant Reservoir Treat',
                              `Allocate a specific amount of love from the general reservoir to ${pony.name}.`,
                              'Give Treat',
                              (amount: number) => handleGiveTreat(pony.id, amount),
                              pony.name
                            );
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1 rounded bg-gradient-to-r from-pink-600/30 to-purple-600/30 border border-pink-500/30 text-pink-200 text-[10px] font-bold hover:from-pink-500/40 hover:to-purple-500/40 transition-all"
                        >
                          <Sparkles className="w-3 h-3" />
                          Give Reservoir Treat
                        </button>

                        {pony.treatsReceived && pony.treatsReceived > 0 ? (
                          <div className="text-center text-[9px] text-pink-400/80 font-medium italic">
                            Total Treats: +{pony.treatsReceived.toLocaleString()}
                          </div>
                        ) : null}

                        {/* Admin Direct Badge Awarding */}
                        {(() => {
                          const ownedSet = new Set(pony.purchasedBadges || []);
                          const awardedStatuses = statuses.filter(
                            (s) => ownedSet.has(s.id) || (s.badgeIcon ? ownedSet.has(s.badgeIcon) : false)
                          );
                          const awardedIdSet = new Set(awardedStatuses.map((s) => s.id));
                          const unawardedStatuses = statuses.filter((s) => !awardedIdSet.has(s.id));
                          const acceptedSet = new Set(pony.acceptedBadges || []);

                          return (
                            <div className="pt-2 mt-1 border-t border-slate-800/80 space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                  Award Badges:
                                </span>
                                <select
                                  value=""
                                  disabled={unawardedStatuses.length === 0}
                                  onChange={(e) => {
                                    const badgeId = e.target.value;
                                    if (!badgeId) return;
                                    const nextBadges = Array.from(new Set([...(pony.purchasedBadges || []), badgeId]));
                                    handleUpdatePony({
                                      ...pony,
                                      purchasedBadges: nextBadges,
                                    });
                                  }}
                                  className="flex-1 min-w-0 bg-slate-950 border border-purple-500/30 rounded px-1.5 py-0.5 text-[10px] text-purple-200 focus:outline-none disabled:opacity-50"
                                  title="Award a badge directly (user must still click and accept it)"
                                >
                                  <option value="">
                                    {unawardedStatuses.length === 0 ? 'All badges awarded' : '+ Award Badge...'}
                                  </option>
                                  {unawardedStatuses.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.badgeIcon && !s.badgeIcon.startsWith('data:image') ? `${s.badgeIcon} ` : ''}{s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {awardedStatuses.length > 0 && (
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                  {awardedStatuses.map((s) => {
                                    const isAccepted = acceptedSet.has(s.id);
                                    return (
                                      <span
                                        key={s.id}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${
                                          isAccepted
                                            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                                            : 'bg-amber-950/50 border-amber-500/30 text-amber-200'
                                        }`}
                                        title={isAccepted ? `${s.name}: Accepted by user` : `${s.name}: Awarded (awaiting user click & accept)`}
                                      >
                                        <span>{s.badgeIcon && !s.badgeIcon.startsWith('data:image') ? s.badgeIcon : '⭐'}</span>
                                        <span className="truncate max-w-[75px]">{s.name}</span>
                                        <span className="opacity-75">{isAccepted ? '✓' : '⏳'}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const remainingStatuses = awardedStatuses.filter((other) => other.id !== s.id);
                                            const iconUsedElsewhere = s.badgeIcon
                                              ? remainingStatuses.some((other) => other.badgeIcon === s.badgeIcon)
                                              : false;
                                            const nextPurchased = (pony.purchasedBadges || []).filter(
                                              (entry) => entry !== s.id && (iconUsedElsewhere || entry !== s.badgeIcon)
                                            );
                                            const nextAccepted = (pony.acceptedBadges || []).filter((entry) => entry !== s.id);
                                            handleUpdatePony({
                                              ...pony,
                                              purchasedBadges: nextPurchased,
                                              acceptedBadges: nextAccepted,
                                            });
                                          }}
                                          className="ml-0.5 text-slate-400 hover:text-red-300 font-bold leading-none cursor-pointer"
                                          title={`Remove ${s.name} badge`}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* MULTI-SPLIT RECIPIENTS SECTION (Admin Only) */}
                      {isAdmin && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-pink-300 font-semibold flex items-center gap-1">
                              <PieChart className="w-3 h-3 text-pink-400" />
                              Love Splits ({splits.length}):
                            </span>
                            <button
                              onClick={() => setFullDetailPonyId(pony.id)}
                              className="text-[10px] text-pink-400 hover:underline"
                            >
                              + Manage Splits
                            </button>
                          </div>

                          {splits.length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic bg-slate-900/60 p-1.5 rounded">
                              General Reservoir
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1">
                              {splits.map((s) => {
                                  const targetP = ledgerPonyMap.get(s.recipientId);
                                  return (
                                    <div
                                      key={s.recipientId}
                                      className="flex items-center justify-between text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300"
                                    >
                                      <button
                                        onClick={() => setFullDetailPonyId(s.recipientId)}
                                        className="truncate max-w-[90px] hover:text-pink-300 hover:underline text-left"
                                      >
                                        ➔ {targetP?.name || 'Pony'}
                                      </button>
                                      <span className="text-pink-300 font-bold">{s.amount} Love/day</span>
                                    </div>
                                  );
                              })}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 text-right pr-1 pt-1 border-t border-slate-800/50">
                            {allocated} / {Math.round(dailyCapacity / 2)} Love/day allocated
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}
      </main>

      {/* 7. Modals */}
      {/* Full Pony Profile & Lore Editor Modal */}
      {fullDetailPony && (
        <PonyDetailModal
          pony={fullDetailPony}
          onClose={() => setFullDetailPonyId(null)}
          onUpdatePony={handleUpdatePony}
          connections={connections}
          allPonies={ponies}
          onCreateConnection={handleCreateConnection}
          onDeleteConnection={handleDeleteConnection}
          onUpdateConnection={handleUpdateConnection}
          targetDate={targetDate}
          statuses={statusesWithBadgePages}
          onUpdateStatuses={handleUpdateStatuses}
          isAdmin={isAdmin}
          isSimulatingNonAdmin={isSimulatingNonAdmin}
          currentUserPonyId={currentUserPony?.id}
          onGiveTreat={handleGiveTreat}
          onUpdatePayout={handleUpdatePayout}
          onTogglePonyAdmin={handleTogglePonyAdmin}
          reservoirDeductions={reservoirDeductions}
          livePulseTick={livePulseTick}
          onOpenAdminPopup={handleOpenAdminPopup}
          onNavigateToPony={(id) => {
            setSelectedPonyId(id);
            setFullDetailPonyId(id);
          }}
        />
      )}

      {/* Bulk Editable Numbers & Editable Column Headers Modal */}
      {isBulkEditorOpen && isAdmin && (
        <Suspense fallback={null}>
          <BulkEditorModal
            isOpen={isBulkEditorOpen && isAdmin}
            onClose={() => setIsBulkEditorOpen(false)}
            ponies={ponies}
            connections={connections}
            onUpdatePony={handleUpdatePony}
            onDeletePony={handleDeletePony}
            onAddPony={(newPony) => handleAddPony(newPony)}
            targetDate={targetDate}
            statuses={statuses}
            headers={headers}
            onUpdateHeaders={handleUpdateHeaders}
            onOpenStatusManager={() => {
              if (isAdmin) setIsStatusManagerOpen(true);
            }}
            isAdmin={isAdmin}
            onGiveTreat={handleGiveTreat}
            onUpdatePayout={handleUpdatePayout}
            onTogglePonyAdmin={handleTogglePonyAdmin}
            onOpenAdminPopup={handleOpenAdminPopup}
            onNavigateToPony={(id) => {
              setSelectedPonyId(id);
              setFullDetailPonyId(id);
            }}
          />
        </Suspense>
      )}

      {/* Generic Single "Add Pony" Modal */}
      <AddPonyModal
        isOpen={isAddModalOpen && canUserAddPony && Boolean(user)}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddPonyInitialPos(null);
        }}
        onAddPony={handleAddPony}
        existingPonies={ponies}
        targetDate={targetDate}
        statuses={statuses}
        initialPos={addPonyInitialPos}
        canAddPony={canUserAddPony}
      />

      {/* Status & Multipliers Manager Modal */}
      {isStatusManagerOpen && isAdmin && (
        <Suspense fallback={null}>
          <StatusManagerModal
            isOpen={isStatusManagerOpen && isAdmin}
            onClose={() => setIsStatusManagerOpen(false)}
            statuses={statusesWithBadgePages}
            onUpdateStatuses={handleUpdateStatuses}
            ponies={ponies}
          />
        </Suspense>
      )}

      {/* Auth / Account Registration & Sign-In Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Administration Modal */}
      {isAdminModalOpen && authIsAdmin && (
        <Suspense fallback={null}>
          <AdminControlModal
            isOpen={isAdminModalOpen && authIsAdmin}
            onClose={() => setIsAdminModalOpen(false)}
            isLayoutLocked={isLayoutLocked}
            onToggleLayoutLock={handleToggleLayoutLock}
            onResetNetwork={() => { void handleResetNetwork(); }}
            onUpdateArchivedLove={handleUpdateArchivedLove}
            onSyncDailyAccrual={handleSyncDailyAccrual}
            ponies={ponies}
            isSimulatingNonAdmin={isSimulatingNonAdmin}
            onToggleSimulateNonAdmin={() => setIsSimulatingNonAdmin(prev => !prev)}
          />
        </Suspense>
      )}

      {/* Floating Non-Admin Simulation Exit Banner */}
      {isSimulatingNonAdmin && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-purple-900/90 border-2 border-pink-500/60 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-white animate-in slide-in-from-bottom-4 duration-300 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400 animate-ping" />
            <span className="text-xs font-bold">Simulating Non-Admin User Experience</span>
          </div>
          <button
            onClick={() => {
              setIsSimulatingNonAdmin(false);
              setIsAdminModalOpen(true);
            }}
            className="px-4 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            Exit & Open Administration
          </button>
        </div>
      )}

      {/* New User Onboarding Splash Modal */}
      <OnboardingSplashModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onAddPony={handleAddPony}
        statuses={statuses}
        canAddPony={canUserAddPony}
      />

      {/* Global Admin Confirmation Modal */}
      <AdminConfirmModal
        isOpen={adminPopup.isOpen}
        onClose={() => setAdminPopup(prev => ({ ...prev, isOpen: false }))}
        type={adminPopup.type}
        title={adminPopup.title}
        message={adminPopup.message}
        confirmLabel={adminPopup.confirmLabel}
        onConfirm={adminPopup.onConfirm}
        entityName={adminPopup.entityName}
      />

      {/* Status Store Modal */}
      {isStoreModalOpen && storeModalPony && adminSettings.allowExchangeStore && (
        <Suspense fallback={null}>
          <StatusStoreModal
            isOpen={isStoreModalOpen && adminSettings.allowExchangeStore}
            onClose={() => setIsStoreModalOpen(false)}
            pony={storeModalPony}
            statuses={statusesWithBadgePages}
            onUpdatePony={handleUpdatePony}
            onUpdateStatus={
              isAdmin
                ? (updated) =>
                    handleUpdateStatuses(statusesWithBadgePages.map((s) => (s.id === updated.id ? updated : s)))
                : undefined
            }
            isPonyOwner={true}
            isAdmin={isAdmin}
            targetDate={targetDate}
          />
        </Suspense>
      )}

      {/* Theme & Appearance Settings Modal */}
      <ThemeSettingsModal
        isOpen={isThemeSettingsOpen}
        onClose={() => setIsThemeSettingsOpen(false)}
        ponies={ponies}
        activePony={currentUserPony}
        onUpdatePony={handleUpdatePony}
        isSimulatingNonAdmin={isSimulatingNonAdmin}
      />
    </div>
  );
}
