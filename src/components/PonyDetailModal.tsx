import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PonyNode, WebConnection, ConnectionType, CustomStatus, LoveSplitAllocation } from '../types/pony';
import { 
  calculateDaysActive, 
  calculatePonyDailyRate, 
  calculatePonyAccumulatedLove, 
  getNormalizedPonySplits, 
  calculateLoveFlowStats,
  generateHarvestTimeline,
  formatLoveNumber,
  hasMagicAndAccountingAccess,
  getUserMainPony,
  getSortedStatuses
} from '../utils/calculations';
import { 
  X, 
  Sparkles, 
  Calendar, 
  Link2, 
  Unlink, 
  Plus, 
  Trash2, 
  ArrowRight,
  PieChart,
  AlertCircle,
  Tag,
  Activity,
  FileText,
  Gift,
  Award,
  ShoppingBag,
  Coins,
  Check,
  Zap,
  Upload,
  User,
  Coffee,
  Palette,
  Smile,
  Book,
  Wand2,
  Users,
  Lock,
  RotateCcw,
  Clock
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { BadgeSpecialPageModal } from './BadgeSpecialPageModal';
import { StatusStoreModal } from './StatusStoreModal';
import { ConnectedPoniesModal } from './ConnectedPoniesModal';
import { OwnedPoniesModal } from './OwnedPoniesModal';
import { ImageCropperModal } from './ImageCropperModal';
import { PonyAvatar } from './PonyAvatar';
import { PonySelector } from './PonySelector';
import { resizeImageToMax } from '../utils/imageUtils';

interface PonyDetailModalProps {
  pony: PonyNode | null;
  onClose: () => void;
  onUpdatePony: (pony: PonyNode) => void;
  connections: WebConnection[];
  allPonies: PonyNode[];
  onCreateConnection: (sourceId: string, targetId: string, type?: ConnectionType) => void;
  onDeleteConnection: (connId: string) => void;
  onUpdateConnection?: (updatedConn: WebConnection) => void;
  targetDate: string;
  statuses: CustomStatus[];
  onUpdateStatuses?: (updated: CustomStatus[]) => void;
  isAdmin?: boolean;
  isSimulatingNonAdmin?: boolean;
  currentUserPonyId?: string;
  onGiveTreat?: (ponyId: string, amount: number) => void;
  onUpdatePayout?: (ponyId: string, percentage: number) => void;
  onTogglePonyAdmin?: (ponyId: string, isAppAdmin: boolean) => void;
  reservoirDeductions?: number;
  livePulseTick?: number;
  onOpenAdminPopup?: (type: any, title: string, message: string, confirmLabel: string, onConfirm: (val?: any) => void, entityName?: string) => void;
  onNavigateToPony: (id: string) => void;
}

export const PonyDetailModal: React.FC<PonyDetailModalProps> = ({
  pony,
  onClose,
  onUpdatePony,
  connections,
  allPonies,
  onCreateConnection,
  onDeleteConnection,
  onUpdateConnection,
  targetDate,
  statuses,
  onUpdateStatuses,
  isAdmin = false,
  isSimulatingNonAdmin = false,
  currentUserPonyId,
  onGiveTreat,
  onUpdatePayout,
  onTogglePonyAdmin,
  reservoirDeductions = 0,
  livePulseTick = 0,
  onOpenAdminPopup,
  onNavigateToPony,
}) => {
  if (!pony) return null;

  const { theme, adminSettings, dailyFreeGifts, recordDailyFreeGift } = useSettings();
  const { user } = useAuth();
  
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [targetPonyToConnect, setTargetPonyToConnect] = useState('');
  const [connTypeToCreate, setConnTypeToCreate] = useState<ConnectionType>('friendship');
  const [ponySearchQuery, setPonySearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [customGiftAmount, setCustomGiftAmount] = useState<number>(50);
  const [giftSuccessMsg, setGiftSuccessMsg] = useState<string | null>(null);

  // 2-Step Gift Popup Modal states
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftStep, setGiftStep] = useState<1 | 2>(1);
  const [giftInputAmount, setGiftInputAmount] = useState<number>(50);

  // Badge Special Page Modal & Status Store Modal states
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [selectedBadgeStatusId, setSelectedBadgeStatusId] = useState<string | null>(null);
  const selectedBadgeStatus = useMemo(
    () => statuses.find((s) => s.id === selectedBadgeStatusId) || null,
    [statuses, selectedBadgeStatusId]
  );
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [isConnectedPoniesModalOpen, setIsConnectedPoniesModalOpen] = useState(false);
  const [isOwnedPoniesModalOpen, setIsOwnedPoniesModalOpen] = useState(false);
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null);
  const [isEditingAvatarIcon, setIsEditingAvatarIcon] = useState(false);

  // Profile Draft State & Update Cooldown Tracking
  const buildDraftFromPony = (p: PonyNode) => ({
    name: p.name || '',
    avatarIcon: p.avatarIcon || '🦄',
    species: p.species || '',
    element: p.element || '',
    location: p.location || '',
    favoriteTreat: p.favoriteTreat || '',
    hobby: p.hobby || '',
    personality: p.personality || '',
    magicalAffinity: p.magicalAffinity || '',
    cutieMark: p.cutieMark || '',
    backstory: p.backstory || '',
    notes: p.notes || '',
    secretSpecies: p.secretSpecies || '',
    secretElement: p.secretElement || '',
    secretLocation: p.secretLocation || '',
    secretFavoriteTreat: p.secretFavoriteTreat || '',
    secretHobby: p.secretHobby || '',
    secretPersonality: p.secretPersonality || '',
    secretMagicalAffinity: p.secretMagicalAffinity || '',
    secretFriendshipLevel: p.secretFriendshipLevel || '',
    secretCutieMark: p.secretCutieMark || '',
    secretBackstory: p.secretBackstory || '',
    secretNotes: p.secretNotes || '',
  });

  const [profileDraft, setProfileDraft] = useState(() => buildDraftFromPony(pony));
  const syncedPonyIdRef = useRef<string>(pony.id);
  const lastSyncedBaseRef = useRef(buildDraftFromPony(pony));
  const profileDraftRef = useRef(profileDraft);
  profileDraftRef.current = profileDraft;
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const nextBase = buildDraftFromPony(pony);
    if (syncedPonyIdRef.current !== pony.id) {
      syncedPonyIdRef.current = pony.id;
      lastSyncedBaseRef.current = nextBase;
      setProfileDraft(nextBase);
      setProfileNotice(null);
      setIsEditingAvatarIcon(false);
      return;
    }

    const prevBase = lastSyncedBaseRef.current;
    const currentDraft = profileDraftRef.current;
    const hasLocalUnsavedEdits = (Object.keys(prevBase) as Array<keyof typeof prevBase>).some(
      (k) => (currentDraft[k] || '') !== (prevBase[k] || '')
    );
    lastSyncedBaseRef.current = nextBase;
    if (!hasLocalUnsavedEdits) {
      const hasMeaningfulDifference = (Object.keys(nextBase) as Array<keyof typeof nextBase>).some(
        (k) => (currentDraft[k] || '') !== (nextBase[k] || '')
      );
      if (hasMeaningfulDifference) {
        setProfileDraft(nextBase);
      }
    }
  }, [pony]);

  useEffect(() => {
    if (!adminSettings.allowAvatarImageUpload && cropperRawImage) {
      setCropperRawImage(null);
    }
  }, [adminSettings.allowAvatarImageUpload, cropperRawImage]);

  useEffect(() => {
    if (!adminSettings.allowExchangeStore && isStoreOpen) {
      setIsStoreOpen(false);
    }
  }, [adminSettings.allowExchangeStore, isStoreOpen]);

  // Split allocation inputs
  const [newSplitRecipientId, setNewSplitRecipientId] = useState('');
  const [newSplitAmount, setNewSplitAmount] = useState<number>(50);

  // Relationship Disconnect confirmation state
  const [disconnectingConnId, setDisconnectingConnId] = useState<string | null>(null);
  const [disconnectCheckboxChecked, setDisconnectCheckboxChecked] = useState<boolean>(false);

  const activeViewerPony = isSimulatingNonAdmin
    ? allPonies.find(p => p.id === currentUserPonyId)
    : (user ? getUserMainPony(allPonies, user.uid) : null);

  const canSeeMagicAndAccounting = useMemo(() => {
    return hasMagicAndAccountingAccess(activeViewerPony || pony, statuses, isAdmin && !isSimulatingNonAdmin);
  }, [activeViewerPony, pony, statuses, isAdmin, isSimulatingNonAdmin]);

  // 30-Day Historical Timeline data for this specific pony (only computed when chart is accessible)
  const individualTimeline = useMemo(() => {
    if (!pony || !canSeeMagicAndAccounting) return [];
    return generateHarvestTimeline(
      allPonies,
      connections,
      1.0,
      30,
      targetDate,
      statuses,
      pony.id
    );
  }, [allPonies, connections, targetDate, statuses, pony, canSeeMagicAndAccounting]);

  // Check for purchased perks (all unlocked automatically when Exchange is disabled)
  const hasPerk = (perkId: 'textColor' | 'borderColor' | 'bgImage') => {
    if (!adminSettings.allowExchangeStore) return true;
    try {
      const perks: string[] = JSON.parse(pony.customData?.purchasedPerks || '[]');
      return perks.includes(perkId);
    } catch {
      return false;
    }
  };

  const hasTextColorPerk = hasPerk('textColor');
  const hasBorderColorPerk = hasPerk('borderColor');
  const hasBgImagePerk = hasPerk('bgImage');

  const profileTheme = {
    textColor: pony.profileTextColor || theme.textColor,
    borderColor: pony.profileBorderColor || theme.borderColor,
    bgImage: pony.profileBgImage || '',
  };
  
  const currentPonyFlowStats = useMemo(() => {
    if (!pony) return null;
    const allStats = calculateLoveFlowStats(allPonies, targetDate, statuses, connections, livePulseTick);
    return allStats.find(s => s.pony.id === pony.id) || null;
  }, [allPonies, targetDate, statuses, connections, livePulseTick, pony]);

  const isPonyOwner = isSimulatingNonAdmin
    ? Boolean(currentUserPonyId && pony.id === currentUserPonyId)
    : Boolean(user && pony.ownerId === user.uid);

  const ownedPoniesList = useMemo(() => {
    if (isSimulatingNonAdmin && currentUserPonyId) {
      const simPony = allPonies.find(p => p.id === currentUserPonyId);
      if (simPony?.ownerId) {
        return allPonies.filter(p => p.ownerId === simPony.ownerId);
      }
      return simPony ? [simPony] : [];
    }
    if (pony.ownerId) {
      return allPonies.filter(p => p.ownerId === pony.ownerId);
    }
    return [pony];
  }, [allPonies, pony, isSimulatingNonAdmin, currentUserPonyId]);

  const cooldownHours = adminSettings.profileUpdateCooldownHours ?? 24;
  const remainingCooldownMs = useMemo(() => {
    if (isAdmin || !isPonyOwner || cooldownHours <= 0 || !pony.lastProfileUpdateAt) return 0;
    const lastMs = new Date(pony.lastProfileUpdateAt).getTime();
    if (isNaN(lastMs)) return 0;
    const unlockAt = lastMs + cooldownHours * 60 * 60 * 1000;
    return Math.max(0, unlockAt - nowMs);
  }, [isAdmin, isPonyOwner, cooldownHours, pony.lastProfileUpdateAt, nowMs]);

  const isProfileUpdateLocked = remainingCooldownMs > 0;
  const canEditProfileFields = (isAdmin || isPonyOwner) && !isProfileUpdateLocked;

  // Only run cooldown countdown interval when editing is actively locked and tab is visible
  useEffect(() => {
    if (!isProfileUpdateLocked) return;
    const updateIfVisible = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        setNowMs(Date.now());
      }
    };
    const timer = setInterval(updateIfVisible, 30000);
    document.addEventListener('visibilitychange', updateIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', updateIfVisible);
    };
  }, [isProfileUpdateLocked]);

  const formatRemainingTime = (ms: number) => {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const hasUnsavedProfileChanges = useMemo(() => {
    const base = buildDraftFromPony(pony);
    return (Object.keys(base) as Array<keyof typeof base>).some(
      (k) => (profileDraft[k] || '') !== (base[k] || '')
    );
  }, [pony, profileDraft]);

  const handleSaveProfileChanges = (closeAfter = false) => {
    if (!hasUnsavedProfileChanges) {
      if (closeAfter) onClose();
      return;
    }
    if (isProfileUpdateLocked) {
      setProfileNotice(`Profile editing is limited to once every ${cooldownHours}h. Next update available in ${formatRemainingTime(remainingCooldownMs)}.`);
      return;
    }
    const nextTimestamp = !isAdmin && isPonyOwner ? new Date().toISOString() : pony.lastProfileUpdateAt;
    const updatedPony: PonyNode = {
      ...pony,
      ...profileDraft,
      name: (profileDraft.name || '').trim() || pony.name,
      avatarIcon: (profileDraft.avatarIcon || '').trim() || pony.avatarIcon || '🦄',
      lastProfileUpdateAt: nextTimestamp,
    };
    lastSyncedBaseRef.current = buildDraftFromPony(updatedPony);
    onUpdatePony(updatedPony);
    setNowMs(Date.now());
    setProfileNotice('Profile saved!');
    if (closeAfter) {
      onClose();
    }
  };

  const maxPonyCumulative = useMemo(() => {
    if (individualTimeline.length === 0) return 100;
    return Math.max(10, ...individualTimeline.map((d) => d.cumulativeLove));
  }, [individualTimeline]);

  const maxPonyDaily = useMemo(() => {
    if (individualTimeline.length === 0) return 10;
    return Math.max(1, ...individualTimeline.map((d) => d.dailyLove));
  }, [individualTimeline]);

  const individualCumulativePoints = useMemo(() => {
    const width = 600;
    const height = 120;
    const pad = 15;
    if (individualTimeline.length === 0) return '';
    return individualTimeline.map((d, i) => {
      const x = pad + (i / Math.max(1, individualTimeline.length - 1)) * (width - 2 * pad);
      const y = height - pad - (d.cumulativeLove / maxPonyCumulative) * (height - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
  }, [individualTimeline, maxPonyCumulative]);

  const individualDailyPoints = useMemo(() => {
    const width = 600;
    const height = 120;
    const pad = 15;
    if (individualTimeline.length === 0) return '';
    return individualTimeline.map((d, i) => {
      const x = pad + (i / Math.max(1, individualTimeline.length - 1)) * (width - 2 * pad);
      const y = height - pad - (d.dailyLove / maxPonyDaily) * (height - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
  }, [individualTimeline, maxPonyDaily]);

  const isSecretPermissionGranted = Boolean(
    activeViewerPony && (pony.allowedViewerPonyIds || []).includes(activeViewerPony.id)
  );

  const canSeeIdentity = isAdmin || isPonyOwner;

  const daysActive = calculateDaysActive(pony.startDate, targetDate, pony.customDaysOverride);
  const dailyTotalProduced = currentPonyFlowStats?.dailyProduced ?? calculatePonyDailyRate(pony, statuses);
  const totalProduced = currentPonyFlowStats?.totalProduced ?? calculatePonyAccumulatedLove(pony, targetDate, statuses, livePulseTick);
  const dailyIncomeReceived = currentPonyFlowStats?.dailyReceived ?? 0;

  // 4 Main Requested Love Ledger Values
  const totalOverallLove = (pony.totalOverallLove ?? Math.round(totalProduced)) + (pony.treatsReceived || 0);
  const totalLoveSpent = pony.totalLoveSpent || 0;
  const totalLoveGiven = pony.totalLoveGiven || 0;
  const currentLoveTotal = pony.currentLoveTotal !== undefined ? pony.currentLoveTotal : Math.max(0, totalOverallLove - totalLoveSpent);

  // Viewer pony love values (for gifting)
  const viewerTotalOverallLove = activeViewerPony ? ((activeViewerPony.totalOverallLove ?? 0) + (activeViewerPony.treatsReceived || 0)) : 0;
  const viewerTotalLoveSpent = activeViewerPony ? (activeViewerPony.totalLoveSpent || 0) : 0;
  const viewerCurrentLove = activeViewerPony ? (activeViewerPony.currentLoveTotal !== undefined ? activeViewerPony.currentLoveTotal : Math.max(0, viewerTotalOverallLove - viewerTotalLoveSpent)) : 0;

  // 50% automatically goes to general fund, remaining 50% is available for pony allocations
  const allocatableCapacity = Math.round(dailyTotalProduced / 2);
  const currentSplits = getNormalizedPonySplits(pony, statuses, connections);
  const totalAllocated = currentSplits.reduce((sum, s) => sum + s.amount, 0);
  const remainingAllocation = Math.max(0, allocatableCapacity - totalAllocated);

  // Today's date string for daily gift tracking (resets at midnight)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const hasClaimedFreeGiftToday = useMemo(() => {
    if (!activeViewerPony) return false;
    const mapKey = `${activeViewerPony.id}__${pony.id}`;
    if (dailyFreeGifts[mapKey] === todayStr) return true;
    try {
      const legacyKey = `pony_free_gift_${activeViewerPony.id}_${pony.id}`;
      return localStorage.getItem(legacyKey) === todayStr;
    } catch {
      return false;
    }
  }, [activeViewerPony, pony.id, dailyFreeGifts, todayStr]);

  const handleSendFreeDailyGift = () => {
    if (!activeViewerPony || activeViewerPony.id === pony.id) return;
    if (hasClaimedFreeGiftToday) return;

    // Free 100 Love given to recipient without deducting from viewer balance
    const freeAmount = 100;
    const updatedRecipient: PonyNode = {
      ...pony,
      totalOverallLove: totalOverallLove + freeAmount,
      currentLoveTotal: currentLoveTotal + freeAmount,
    };

    onUpdatePony(updatedRecipient);
    recordDailyFreeGift(activeViewerPony.id, pony.id, todayStr);

    try {
      const key = `pony_free_gift_${activeViewerPony.id}_${pony.id}`;
      localStorage.setItem(key, todayStr);
    } catch (e) {}

    setGiftSuccessMsg(`🎁 Sent +100 Free Daily Love to ${pony.name}!`);
    setTimeout(() => setGiftSuccessMsg(null), 4000);
  };

  // Gift of Love handler
  const handleSendGift = (amount: number) => {
    if (!activeViewerPony || activeViewerPony.id === pony.id) return;
    if (amount <= 0) return;
    if (viewerCurrentLove < amount) {
      alert(`You need ${amount - viewerCurrentLove} more Love to send this gift.`);
      return;
    }

    // 1. Deduct from viewer pony (gifts do NOT increase totalLoveSpent, which only tracks purchases)
    const updatedViewer: PonyNode = {
      ...activeViewerPony,
      currentLoveTotal: viewerCurrentLove - amount,
      totalLoveGiven: (activeViewerPony.totalLoveGiven || 0) + amount,
    };

    // 2. Add to recipient pony
    const updatedRecipient: PonyNode = {
      ...pony,
      totalOverallLove: totalOverallLove + amount,
      currentLoveTotal: currentLoveTotal + amount,
    };

    onUpdatePony(updatedViewer);
    onUpdatePony(updatedRecipient);

    setGiftSuccessMsg(`🎁 Sent ${amount} Love to ${pony.name}!`);
    setTimeout(() => setGiftSuccessMsg(null), 4000);
  };

  const handleUpdateStatus = (updated: CustomStatus) => {
    if (onUpdateStatuses) {
      onUpdateStatuses(statuses.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  // Badges accessible on the profile:
  // - When Love Exchange is OFF: treat all ranks as owned & unlock sequentially 1-by-1 as each badge is accepted.
  // - When Love Exchange is ON: only purchased/awarded/active (or free when active) badges are shown.
  const purchasedBadgeStatuses = useMemo(() => {
    const sortedStatuses = getSortedStatuses(statuses);
    const list: CustomStatus[] = [];
    const seen = new Set<string>();
    const purchased = pony.purchasedBadges || [];
    const acceptedSet = new Set(pony.acceptedBadges || []);
    const firstUnacceptedIndex = sortedStatuses.findIndex((s) => !acceptedSet.has(s.id));
    const frontierIndex = firstUnacceptedIndex === -1 ? sortedStatuses.length - 1 : firstUnacceptedIndex;

    sortedStatuses.forEach((s, idx) => {
      const isPurchased =
        purchased.includes(s.id) ||
        (s.badgeIcon ? purchased.includes(s.badgeIcon) : false) ||
        pony.status === s.id ||
        pony.status === s.name;

      const isUnlockedWithoutStore =
        !adminSettings.allowExchangeStore &&
        (idx <= frontierIndex || (idx > 0 && acceptedSet.has(sortedStatuses[idx - 1].id)));

      if ((isPurchased || isUnlockedWithoutStore) && !seen.has(s.id)) {
        seen.add(s.id);
        list.push(s);
      }
    });

    // Fallback to active status if nothing matched
    if (list.length === 0) {
      const active = sortedStatuses.find((s) => s.id === pony.status || s.name === pony.status) || sortedStatuses[0];
      if (active) list.push(active);
    }
    return list;
  }, [statuses, pony.purchasedBadges, pony.acceptedBadges, pony.status, adminSettings.allowExchangeStore]);

  const mostRecentBadge = useMemo(
    () => (purchasedBadgeStatuses.length > 0 ? purchasedBadgeStatuses[purchasedBadgeStatuses.length - 1] : null),
    [purchasedBadgeStatuses]
  );

  const canPressBadge = (bStatus: CustomStatus) => {
    if (!user || !isPonyOwner) return false;
    if (!adminSettings.allowExchangeStore) return true;
    const purchased = pony.purchasedBadges || [];
    return Boolean(
      purchased.includes(bStatus.id) ||
      (bStatus.badgeIcon && purchased.includes(bStatus.badgeIcon)) ||
      pony.status === bStatus.id ||
      pony.status === bStatus.name ||
      !bStatus.price ||
      bStatus.price === 0
    );
  };

  const ponyIdSet = useMemo(() => new Set(allPonies.map((p) => p.id)), [allPonies]);

  const ponyConnections = useMemo(
    () =>
      connections.filter(
        (c) =>
          (c.source === pony.id && ponyIdSet.has(c.target)) ||
          (c.target === pony.id && ponyIdSet.has(c.source))
      ),
    [connections, pony.id, ponyIdSet]
  );

  const isConnectedToViewer = useMemo(() => {
    if (!activeViewerPony || !pony || activeViewerPony.id === pony.id) return false;
    return ponyConnections.some(
      (c) => (c.source === activeViewerPony.id && c.target === pony.id) || (c.target === activeViewerPony.id && c.source === pony.id)
    );
  }, [activeViewerPony, pony, ponyConnections]);

  const existingConnectedIds = useMemo(() => new Set(
    ponyConnections.map((c) => (c.source === pony.id ? c.target : c.source))
  ), [ponyConnections, pony.id]);

  const connectablePonies = useMemo(() => {
    if (!ponySearchQuery.trim()) return [];
    const q = ponySearchQuery.trim().toLowerCase();
    return allPonies.filter(
      (p) =>
        p.id !== pony.id &&
        !existingConnectedIds.has(p.id) &&
        ((p.name || '').toLowerCase().includes(q) ||
          (p.species || '').toLowerCase().includes(q) ||
          (p.ownerName || '').toLowerCase().includes(q))
    );
  }, [allPonies, pony.id, existingConnectedIds, ponySearchQuery]);

  // Available ponies to add to split (that are not self)
  const availableSplitRecipients = allPonies.filter((p) => p.id !== pony.id);

  // Handlers for Splits
  const handleAddSplit = () => {
    if (!newSplitRecipientId) return;
    const requested = Number(newSplitAmount) || 0;
    if (requested <= 0) return;

    // Enforce allocatable capacity limit
    const allowed = Math.min(requested, remainingAllocation);
    if (allowed <= 0) {
      alert(`Cannot exceed allocatable capacity of ${allocatableCapacity} Love/day. Free up allocations first.`);
      return;
    }

    const existingIndex = (pony.loveSplits || []).findIndex(s => s.recipientId === newSplitRecipientId);
    let updatedSplits: LoveSplitAllocation[];

    if (existingIndex >= 0) {
      updatedSplits = (pony.loveSplits || []).map((s, idx) =>
        idx === existingIndex ? { ...s, amount: Math.min(allocatableCapacity, s.amount + allowed) } : s
      );
    } else {
      updatedSplits = [...(pony.loveSplits || []), { recipientId: newSplitRecipientId, amount: allowed }];
    }

    // Auto-create connection link between them if not already connected
    onCreateConnection(pony.id, newSplitRecipientId, 'love-channel');

    onUpdatePony({
      ...pony,
      loveSplits: updatedSplits,
      isCustomSplits: true,
      targetRecipientId: updatedSplits[0]?.recipientId || null,
    });

    setNewSplitRecipientId('');
    setNewSplitAmount(Math.max(10, remainingAllocation - allowed));
  };

  const handleUpdateSplitAmount = (recipientId: string, newAmount: number) => {
    const otherAllocations = currentSplits
      .filter(s => s.recipientId !== recipientId)
      .reduce((sum, s) => sum + s.amount, 0);
    const maxAllowed = Math.max(0, allocatableCapacity - otherAllocations);
    const clampedAmount = Math.max(0, Math.min(maxAllowed, newAmount));

    const updated = (pony.loveSplits || []).map(s =>
      s.recipientId === recipientId ? { ...s, amount: clampedAmount } : s
    );

    // If new split was not in loveSplits yet (e.g. came from auto-split), add it
    if (!updated.some(s => s.recipientId === recipientId)) {
      updated.push({ recipientId, amount: clampedAmount });
    }

    onUpdatePony({
      ...pony,
      loveSplits: updated,
      isCustomSplits: true,
    });
  };

  const handleRemoveSplit = (recipientId: string) => {
    const updated = (pony.loveSplits || []).filter(s => s.recipientId !== recipientId);
    onUpdatePony({
      ...pony,
      loveSplits: updated,
      isCustomSplits: true,
      targetRecipientId: updated[0]?.recipientId || null,
    });
  };

  const handleSplitEvenly = () => {
    if (currentSplits.length === 0) return;
    
    let updated: LoveSplitAllocation[];
    if (currentSplits.length === 1) {
      // If only one, they receive the full allocation
      updated = [{ recipientId: currentSplits[0].recipientId, amount: allocatableCapacity }];
    } else {
      const share = Math.floor(allocatableCapacity / currentSplits.length);
      updated = currentSplits.map((s, i) => ({
        ...s,
        amount: i === currentSplits.length - 1 ? allocatableCapacity - share * (currentSplits.length - 1) : share,
      }));
    }

    onUpdatePony({
      ...pony,
      loveSplits: updated,
      isCustomSplits: true,
    });
  };

  const handleResetToAutoSplits = () => {
    onUpdatePony({
      ...pony,
      isCustomSplits: false,
      loveSplits: undefined,
      targetRecipientId: null,
    });
  };

  const handleConnect = () => {
    if (!targetPonyToConnect) return;
    onCreateConnection(pony.id, targetPonyToConnect, connTypeToCreate);
    setTargetPonyToConnect('');
    setPonySearchQuery('');
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Resize & compress image to max 400x400 before loading into cropper
      const resizedRaw = await resizeImageToMax(file, 400, 400);
      setCropperRawImage(resizedRaw);
    } catch (err: any) {
      console.error('Image load error:', err);
      setProfileNotice(err?.message || 'Could not load selected image. Please try another image.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover transition-colors"
        style={{ 
          borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor,
          backgroundColor: profileTheme.bgImage ? 'transparent' : '#0f172a',
        }}
      >
        {profileTheme.bgImage && (
          <div 
            className="absolute inset-0 z-0 opacity-40 pointer-events-none"
            style={{ 
              backgroundImage: `url(${profileTheme.bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        
        {/* Profile Header */}
        <div 
          className="relative z-10 flex items-center justify-between px-6 py-5 border-b bg-slate-950/60 backdrop-blur-md"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor }}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-3 shrink-0">
              <div
                className={`relative group/icon ${canEditProfileFields ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (canEditProfileFields && !adminSettings.allowAvatarImageUpload && !isEditingAvatarIcon) {
                    setIsEditingAvatarIcon(true);
                  }
                }}
                title={
                  canEditProfileFields
                    ? adminSettings.allowAvatarImageUpload
                      ? 'Click to upload custom avatar image'
                      : 'Click to edit emoticon'
                    : undefined
                }
              >
                {canEditProfileFields && isEditingAvatarIcon ? (
                  <input
                    type="text"
                    autoFocus
                    maxLength={24}
                    value={
                      profileDraft.avatarIcon.startsWith('data:image') || profileDraft.avatarIcon.startsWith('http')
                        ? ''
                        : profileDraft.avatarIcon
                    }
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, avatarIcon: e.target.value }))}
                    onBlur={() => {
                      setIsEditingAvatarIcon(false);
                      if (!profileDraft.avatarIcon.trim()) {
                        setProfileDraft((prev) => ({ ...prev, avatarIcon: pony.avatarIcon || '🦄' }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      } else if (e.key === 'Escape') {
                        setProfileDraft((prev) => ({ ...prev, avatarIcon: pony.avatarIcon || '🦄' }));
                        setIsEditingAvatarIcon(false);
                      }
                    }}
                    placeholder="🦄"
                    className="w-14 h-14 rounded-2xl bg-slate-900 border-2 text-center text-base font-bold focus:outline-none shadow-sm"
                    style={{ borderColor: theme.borderHoverColor || theme.borderColor, color: theme.textColor }}
                    aria-label="Edit profile emoticon"
                  />
                ) : (
                  <PonyAvatar
                    pony={{ ...pony, avatarIcon: profileDraft.avatarIcon || pony.avatarIcon }}
                    theme={theme}
                    size="xl"
                    showBorder={true}
                    className={`ring-4 ${canEditProfileFields ? 'transition-transform group-hover/icon:scale-105' : ''}`}
                  />
                )}

                {canEditProfileFields && adminSettings.allowAvatarImageUpload && !isEditingAvatarIcon && (
                  <label
                    className="absolute inset-0 flex items-center justify-center bg-black/55 rounded-2xl opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer"
                    title="Upload custom avatar image"
                  >
                    <Upload className="w-5 h-5 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                  </label>
                )}

                {canEditProfileFields && adminSettings.allowAvatarImageUpload && !isEditingAvatarIcon && (
                  <span
                    className="pointer-events-none absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-md"
                    style={{
                      backgroundColor: theme.buttonColor,
                      color: theme.buttonTextColor,
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                    }}
                  >
                    <Upload className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>

              {canEditProfileFields && adminSettings.allowAvatarImageUpload && (
                <div className="flex flex-col gap-1 shrink-0">
                  <label
                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer hover:opacity-90 transition-all shadow-sm"
                    style={{
                      backgroundColor: theme.buttonColor,
                      color: theme.buttonTextColor,
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                    }}
                    title="Upload custom image for your pony's profile icon"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingAvatarIcon((prev) => !prev)}
                    className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border text-[10px] font-semibold cursor-pointer hover:bg-slate-800 transition-colors"
                    style={{
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                      color: theme.textColor,
                    }}
                    title="Type an emoji or emoticon instead"
                  >
                    <Smile className="w-2.5 h-2.5" />
                    <span>Emoji</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.name}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="text-xl font-extrabold bg-transparent border-b border-transparent hover:border-pink-400 focus:border-pink-400 focus:outline-none flex-1 min-w-[120px]"
                    style={{ color: theme.textColor }}
                    placeholder="Pony Name"
                  />
                ) : (
                  <h2 className="text-xl font-extrabold flex-1 min-w-0 truncate" style={{ color: theme.textColor }}>{pony.name}</h2>
                )}
                {(isPonyOwner || !!mostRecentBadge || (canEditProfileFields && hasUnsavedProfileChanges)) && (
                  <div className="ml-auto flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {canEditProfileFields && hasUnsavedProfileChanges && (
                      <button
                        type="button"
                        onClick={() => handleSaveProfileChanges(false)}
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:opacity-90 shadow-sm"
                        style={{
                          backgroundColor: theme.buttonColor,
                          color: theme.buttonTextColor,
                          borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                        }}
                      >
                        Save Profile
                      </button>
                    )}
                    {isPonyOwner && (
                      <>
                        {adminSettings.allowMainPonySelection && (
                          <label 
                            className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2 py-1 rounded-lg bg-slate-900 border transition-colors theme-border-hover"
                            title="Makes this your main pony shown on your profile and avatar across the app"
                            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                          >
                            <input
                              type="checkbox"
                              checked={!!pony.isMainPony}
                              onChange={(e) => onUpdatePony({ ...pony, isMainPony: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer"
                            />
                            <span>Main Pony</span>
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsOwnedPoniesModalOpen(true)}
                          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer theme-border-hover hover:opacity-90 shadow-sm"
                          style={{
                            backgroundColor: theme.buttonColor,
                            color: theme.buttonTextColor,
                            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                          }}
                          title="Click to view all your owned ponies"
                        >
                          Owned
                        </button>
                      </>
                    )}
                    {mostRecentBadge && (() => {
                      const isAccepted = (pony.acceptedBadges || []).includes(mostRecentBadge.id);
                      const isInteractive = canPressBadge(mostRecentBadge);
                      const badgeVisual =
                        mostRecentBadge.badgeIcon &&
                        (mostRecentBadge.badgeIcon.startsWith('data:image') || mostRecentBadge.badgeIcon.startsWith('http')) ? (
                          <img src={mostRecentBadge.badgeIcon} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : (
                          mostRecentBadge.badgeIcon || '⭐'
                        );

                      if (!isInteractive) {
                        return (
                          <div
                            className="relative p-1.5 bg-purple-950/60 border rounded-xl text-lg flex items-center justify-center shrink-0 shadow cursor-default select-none"
                            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                          >
                            {badgeVisual}
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBadgeStatusId(mostRecentBadge.id);
                            setIsBadgeModalOpen(true);
                          }}
                          className={`relative p-1.5 bg-purple-950/60 border rounded-xl text-lg flex items-center justify-center shrink-0 shadow transition-all cursor-pointer ${!isAccepted ? 'ring-1 ring-amber-400/70' : ''}`}
                          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                        >
                          {badgeVisual}
                          {!isAccepted && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950" />
                          )}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {profileNotice && (
            <div
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-purple-500/50 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-150"
              style={{ color: theme.textColor }}
            >
              <span>{profileNotice}</span>
              <button
                type="button"
                onClick={() => setProfileNotice(null)}
                className="opacity-70 hover:opacity-100 text-xs p-1"
                aria-label="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div 
            className="w-full bg-slate-950/40 p-4 rounded-xl border space-y-4 theme-border-hover backdrop-blur-sm"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: profileTheme.textColor }}>
                Profile Details
              </h3>

              {(isAdmin || isPonyOwner) && (
                <div className="flex items-center gap-2">
                  {isProfileUpdateLocked && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[10px] font-semibold">
                      <Clock className="w-3 h-3" />
                      Updates locked ({formatRemainingTime(remainingCooldownMs)} left)
                    </span>
                  )}
                  {!isProfileUpdateLocked && hasUnsavedProfileChanges && (
                    <button
                      type="button"
                      onClick={() => handleSaveProfileChanges(false)}
                      className="px-3 py-1 rounded-lg font-bold text-[11px] border shadow-sm cursor-pointer hover:opacity-90 transition-all"
                      style={{
                        backgroundColor: theme.buttonColor,
                        color: theme.buttonTextColor,
                        borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                      }}
                    >
                      Save Profile
                    </button>
                  )}
                </div>
              )}
            </div>

            {profileNotice && (
              <div className="px-3 py-2 rounded-lg bg-slate-900 border border-purple-500/30 text-[11px] font-semibold" style={{ color: theme.textColor }}>
                {profileNotice}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Species */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Species
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.species}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, species: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.species || 'Unknown'}</div>
                )}
              </div>

              {/* Element */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Element
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.element}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, element: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.element || 'Unknown'}</div>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Location
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.location}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.location || 'Unknown'}</div>
                )}
              </div>

              {/* Favorite Treat */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Favorite Treat
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.favoriteTreat}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, favoriteTreat: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.favoriteTreat || 'Unknown'}</div>
                )}
              </div>

              {/* Hobby */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Hobby
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.hobby}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, hobby: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.hobby || 'Unknown'}</div>
                )}
              </div>

              {/* Personality */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Personality
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.personality}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, personality: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.personality || 'Unknown'}</div>
                )}
              </div>

              {/* Magical Affinity */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Magical Affinity
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.magicalAffinity}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, magicalAffinity: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.magicalAffinity || 'None'}</div>
                )}
              </div>

              {/* Cutie Mark */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Cutie Mark
                </label>
                {canEditProfileFields ? (
                  <input
                    type="text"
                    value={profileDraft.cutieMark}
                    onChange={(e) => setProfileDraft((prev) => ({ ...prev, cutieMark: e.target.value }))}
                    className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    placeholder=""
                  />
                ) : (
                  <div className="text-xs px-1" style={{ color: theme.textColor }}>{pony.cutieMark || 'None'}</div>
                )}
              </div>

            </div>

            {/* Backstory */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Backstory
              </label>
              {canEditProfileFields ? (
                <textarea
                  rows={2}
                  value={profileDraft.backstory}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, backstory: e.target.value }))}
                  className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none resize-none"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  placeholder=""
                />
              ) : (
                <div className="text-xs px-1 leading-relaxed" style={{ color: theme.textColor }}>{pony.backstory || 'A mysterious pony from parts unknown.'}</div>
              )}
            </div>

            {/* Notes - Inside Profile Details Container below Backstory */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Notes
              </label>
              {canEditProfileFields ? (
                <textarea
                  rows={2}
                  value={profileDraft.notes}
                  onChange={(e) => setProfileDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder=""
                  className="w-full max-h-28 overflow-y-auto bg-slate-900 border rounded-lg p-2.5 text-xs focus:outline-none resize-y"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor, color: profileTheme.textColor }}
                />
              ) : (
                <div 
                  className="max-h-28 overflow-y-auto bg-slate-900/80 rounded-lg p-2.5 border text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor, color: profileTheme.textColor }}
                >
                  {pony.notes && pony.notes.trim() ? pony.notes : null}
                </div>
              )}
            </div>
          </div>

          {/* Love Ledger Values - Moved below Notes */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div 
                className="bg-slate-950/80 p-3 rounded-xl border text-center flex flex-col justify-center items-center shadow-lg theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: theme.textColor }}>
                  Daily Income
                </span>
                <strong className="text-sm font-black" style={{ color: theme.textColor }}>
                  +{dailyIncomeReceived.toLocaleString()}
                </strong>
                <span className="text-[9px] opacity-60 mt-0.5" style={{ color: theme.textColor }}>Love/day</span>
              </div>
              <div 
                className="bg-slate-950/80 p-3 rounded-xl border text-center flex flex-col justify-center items-center shadow-lg theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: theme.textColor }}>
                  Total Overall Love
                </span>
                <strong className="text-sm font-black" style={{ color: theme.textColor }}>
                  {totalOverallLove.toLocaleString()}
                </strong>
                <span className="text-[9px] opacity-60 mt-0.5" style={{ color: theme.textColor }}>Overall</span>
              </div>

              <div 
                className="bg-slate-950/80 p-3 rounded-xl border text-center flex flex-col justify-center items-center shadow-lg theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: theme.textColor }}>
                  Current Love Total
                </span>
                <strong className="text-sm font-black" style={{ color: theme.textColor }}>
                  {currentLoveTotal.toLocaleString()}
                </strong>
                <span className="text-[9px] opacity-60 mt-0.5" style={{ color: theme.textColor }}>Spendable Balance</span>
              </div>

              <div 
                className="bg-slate-950/80 p-3 rounded-xl border text-center flex flex-col justify-center items-center shadow-lg theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: theme.textColor }}>
                  Total Love Spent
                </span>
                <strong className="text-sm font-black" style={{ color: theme.textColor }}>
                  {totalLoveSpent.toLocaleString()}
                </strong>
                <span className="text-[9px] opacity-60 mt-0.5" style={{ color: theme.textColor }}>Purchases</span>
              </div>

              <div 
                className="bg-slate-950/80 p-3 rounded-xl border text-center flex flex-col justify-center items-center shadow-lg theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: theme.textColor }}>
                  Total Love Given
                </span>
                <strong className="text-sm font-black" style={{ color: theme.textColor }}>
                  {totalLoveGiven.toLocaleString()}
                </strong>
                <span className="text-[9px] opacity-60 mt-0.5" style={{ color: theme.textColor }}>Gifts Sent</span>
              </div>
            </div>
          </div>

          {/* 1.1 Individual Pony Analytics Graph & Information */}
          <div 
            className="w-full bg-slate-950/70 p-4 rounded-xl border space-y-3 theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: theme.textColor }}>
                {pony.name.toUpperCase()}'S HARVEST HISTORY OVER TIME
              </h3>
              <span className="text-[10px] opacity-70 font-medium" style={{ color: theme.textColor }}>30-Day History</span>
            </div>

            <div 
              className="bg-slate-900/90 rounded-xl p-3 border space-y-2.5"
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            >
              <div className="flex flex-wrap items-center justify-between text-[11px] px-1 gap-2">
                <span className="font-bold" style={{ color: theme.textColor }}>
                  Daily Production Rate: +{dailyTotalProduced.toLocaleString()} Love/day
                </span>
                <span className="opacity-80" style={{ color: theme.textColor }}>
                  Cumulative Total: {totalOverallLove.toLocaleString()} Love
                </span>
                {canSeeMagicAndAccounting && (
                  <span className="font-semibold text-purple-300">
                    Magic Power: {totalOverallLove.toLocaleString()} Thaums
                  </span>
                )}
              </div>

              {/* Graph Indicators using user settings colors - NO ICONS, NO LEGEND TEXT */}
              <div className="text-[10px] opacity-90 px-1 flex flex-wrap items-center gap-2" style={{ color: theme.textColor }}>
                <span className="font-bold" style={{ color: theme.graphCumulativeColor || '#ec4899' }}>Cumulative Love</span>
                <span>•</span>
                <span className="font-bold" style={{ color: theme.graphDailyColor || '#06b6d4' }}>Daily Rate</span>
                {canSeeMagicAndAccounting && (
                  <>
                    <span>•</span>
                    <span className="font-bold" style={{ color: theme.graphMagicalColor || '#c084fc' }}>Magic Power</span>
                  </>
                )}
              </div>

              {/* Visual Curve */}
              <div 
                className="w-full h-32 bg-slate-950/80 rounded-lg p-2 overflow-hidden flex items-center justify-center border relative"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
              >
                <svg viewBox="0 0 600 120" className="w-full h-full">
                  <defs>
                    <linearGradient id={`grad-pony-cumul-${pony.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.graphCumulativeColor || '#ec4899'} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={theme.graphCumulativeColor || '#ec4899'} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {individualCumulativePoints && (
                    <>
                      <polygon
                        fill={`url(#grad-pony-cumul-${pony.id})`}
                        points={`15,105 ${individualCumulativePoints} 585,105`}
                      />
                      <polyline
                        fill="none"
                        stroke={theme.graphCumulativeColor || '#ec4899'}
                        strokeWidth="2.5"
                        points={individualCumulativePoints}
                      />
                    </>
                  )}
                  {individualDailyPoints && (
                    <polyline
                      fill="none"
                      stroke={theme.graphDailyColor || '#06b6d4'}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      points={individualDailyPoints}
                    />
                  )}
                  {canSeeMagicAndAccounting && individualCumulativePoints && (
                    <polyline
                      fill="none"
                      stroke={theme.graphMagicalColor || '#c084fc'}
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      points={individualCumulativePoints}
                    />
                  )}
                </svg>
                {individualTimeline.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs opacity-60 italic" style={{ color: theme.textColor }}>
                    Accumulating initial harvest data...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Connected Ponies Section (Grid with Pony Icon and Name) */}
          <div className="w-full bg-slate-950/70 p-4 rounded-xl border space-y-3 theme-border-hover" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}>
            <div className="flex items-center justify-between gap-3 border-b pb-2.5" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}>
              <button
                type="button"
                onClick={() => setIsConnectedPoniesModalOpen(true)}
                className="text-xs font-bold uppercase tracking-wider shrink-0 hover:underline transition-colors cursor-pointer text-left flex items-center gap-2"
                style={{ color: theme.textColor }}
                title="Click to manage allocations, disconnects, and view details"
              >
                <span>Connected Ponies ({ponyConnections.length})</span>
              </button>
            </div>

            {/* Scrollable Grid of Connected Ponies (Icon and Name) */}
            {ponyConnections.length === 0 ? (
              <div className="py-4 text-center text-xs opacity-60 italic bg-slate-900/50 rounded-xl" style={{ color: theme.textColor }}>
                No connected ponies linked yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {ponyConnections.map((conn) => {
                  const otherId = conn.source === pony.id ? conn.target : conn.source;
                  const otherPony = allPonies.find((p) => p.id === otherId);
                  if (!otherPony) return null;

                  return (
                    <div
                      key={conn.id}
                      onClick={() => onNavigateToPony(otherPony.id)}
                      className="flex items-center gap-2.5 p-2 bg-slate-900/80 rounded-xl border hover:border-pink-500/40 transition-all cursor-pointer group theme-border-hover"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                      title={`Open ${otherPony.name}'s profile`}
                    >
                      <PonyAvatar pony={otherPony} theme={theme} size="sm" className="shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <strong className="block text-xs truncate group-hover:underline" style={{ color: theme.textColor }}>
                          {otherPony.name}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search to connect new ponies (Owner of this profile or Admin Only) */}
            {(isAdmin || isPonyOwner) && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
                <div className="flex-1 min-w-[200px] relative">
                  <input
                    type="text"
                    value={ponySearchQuery}
                    onChange={(e) => {
                      setPonySearchQuery(e.target.value);
                      setTargetPonyToConnect('');
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    placeholder="Search ponies to connect..."
                    className="w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs focus:outline-none theme-border-hover transition-all"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  />
                  {isSearchFocused && ponySearchQuery.trim().length > 0 && (
                    <div 
                      className="absolute left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto bg-slate-900 border rounded-xl shadow-xl z-10 p-1 space-y-1 backdrop-blur-md theme-border-hover"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                    >
                      {connectablePonies.length === 0 ? (
                        <div className="p-2 text-[10px] italic text-center opacity-60" style={{ color: theme.textColor }}>No ponies match search</div>
                      ) : (
                        connectablePonies.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setTargetPonyToConnect(p.id);
                              setPonySearchQuery(p.name);
                              setIsSearchFocused(false);
                            }}
                            className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors text-left ${targetPonyToConnect === p.id ? 'bg-pink-600/40 border border-pink-500/50' : 'hover:bg-slate-800'}`}
                          >
                            <PonyAvatar pony={p} theme={theme} size="sm" />
                            <div>
                              <div className="font-bold text-[11px] leading-tight" style={{ color: theme.textColor }}>{p.name}</div>
                              <div className="text-[9px] opacity-70" style={{ color: theme.textColor }}>{p.species}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={!targetPonyToConnect}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md border transition-all cursor-pointer disabled:opacity-40 theme-border-hover"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  Connect
                </button>
              </div>
            )}

            {!isPonyOwner && !isAdmin && activeViewerPony && !isConnectedToViewer && (
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <span className="text-slate-400 text-xs">
                  Connect your pony ({activeViewerPony.name})
                </span>
                <button
                  type="button"
                  onClick={() => onCreateConnection(activeViewerPony.id, pony.id, 'friendship')}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md border transition-all cursor-pointer theme-border-hover"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  Connect
                </button>
              </div>
            )}
          </div>

          {/* Secret Profile Section matching Profile Details container */}
          {(() => {
            const canViewSecret = isAdmin || isPonyOwner || isSecretPermissionGranted;
            if (!canViewSecret) return null;

            if (isPonyOwner || isAdmin) {
              return (
                <div 
                  className="w-full bg-slate-950/40 p-4 rounded-xl border space-y-4 theme-border-hover backdrop-blur-sm"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: profileTheme.textColor }}>
                    Secret Profile
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Species</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretSpecies}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretSpecies: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Element</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretElement}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretElement: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Location</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretLocation}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretLocation: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Favorite Treat</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretFavoriteTreat}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretFavoriteTreat: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Hobby</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretHobby}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretHobby: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Personality</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretPersonality}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretPersonality: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Magical Affinity</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretMagicalAffinity}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretMagicalAffinity: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Friendship Level</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretFriendshipLevel}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretFriendshipLevel: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Cutie Mark</label>
                      <input
                        type="text"
                        disabled={!canEditProfileFields}
                        value={profileDraft.secretCutieMark}
                        onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretCutieMark: e.target.value }))}
                        className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Backstory</label>
                    <textarea
                      rows={2}
                      disabled={!canEditProfileFields}
                      value={profileDraft.secretBackstory}
                      onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretBackstory: e.target.value }))}
                      className="w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none resize-none disabled:opacity-60"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    />
                  </div>

                  <div className="space-y-1 pt-2 border-t" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Secret Notes</label>
                    <textarea
                      rows={2}
                      disabled={!canEditProfileFields}
                      value={profileDraft.secretNotes}
                      onChange={(e) => setProfileDraft((prev) => ({ ...prev, secretNotes: e.target.value }))}
                      className="w-full max-h-28 overflow-y-auto bg-slate-900 border rounded-lg p-2.5 text-xs focus:outline-none resize-y disabled:opacity-60"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor, color: profileTheme.textColor }}
                    />
                  </div>
                </div>
              );
            }

            if (isSecretPermissionGranted) {
              return (
                <div 
                  className="w-full bg-slate-950/40 p-4 rounded-xl border space-y-4 theme-border-hover backdrop-blur-sm"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: profileTheme.textColor }}>
                    Secret Profile
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pony.secretSpecies && (
                      <div className="bg-slate-900 p-2.5 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                        <span className="text-[10px] block font-semibold opacity-70" style={{ color: theme.textColor }}>Secret Species:</span>
                        <span className="text-xs font-bold" style={{ color: theme.textColor }}>{pony.secretSpecies}</span>
                      </div>
                    )}
                    {pony.secretElement && (
                      <div className="bg-slate-900 p-2.5 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                        <span className="text-[10px] block font-semibold opacity-70" style={{ color: theme.textColor }}>Secret Element:</span>
                        <span className="text-xs font-bold" style={{ color: theme.textColor }}>{pony.secretElement}</span>
                      </div>
                    )}
                    {pony.secretLocation && (
                      <div className="bg-slate-900 p-2.5 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                        <span className="text-[10px] block font-semibold opacity-70" style={{ color: theme.textColor }}>Secret Location:</span>
                        <span className="text-xs font-bold" style={{ color: theme.textColor }}>{pony.secretLocation}</span>
                      </div>
                    )}
                  </div>
                  {pony.secretNotes && (
                    <div className="bg-slate-900 p-2.5 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                      <span className="text-[10px] block font-semibold mb-0.5 opacity-70" style={{ color: theme.textColor }}>Secret Notes:</span>
                      <p className="text-xs leading-relaxed" style={{ color: theme.textColor }}>{pony.secretNotes}</p>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })()}

          {/* GIFT OF LOVE SECTION */}
          {activeViewerPony && activeViewerPony.id !== pony.id && (
            <div 
              className="p-4 rounded-xl border space-y-3 relative overflow-hidden"
              style={{
                borderColor: theme.transparentAllBorders ? 'transparent' : profileTheme.borderColor,
                backgroundColor: '#0f172a',
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: profileTheme.textColor }}>
                  Gift Love to {pony.name}
                </h3>
                <span className="text-[11px] font-semibold" style={{ color: profileTheme.textColor }}>
                  Your Balance: {viewerCurrentLove.toLocaleString()} Love
                </span>
              </div>

              {giftSuccessMsg && (
                <div className="bg-pink-600/30 border border-pink-400/50 text-pink-200 px-3 py-1.5 rounded-lg text-xs font-bold text-center animate-in fade-in">
                  {giftSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  disabled={hasClaimedFreeGiftToday}
                  onClick={handleSendFreeDailyGift}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-md transition-all ${
                    hasClaimedFreeGiftToday
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'cursor-pointer'
                  }`}
                  style={{
                    backgroundColor: hasClaimedFreeGiftToday ? undefined : theme.buttonColor,
                    color: hasClaimedFreeGiftToday ? undefined : theme.buttonTextColor,
                    borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor
                  }}
                  title={hasClaimedFreeGiftToday ? 'Daily free gift claimed today. Resets at midnight!' : 'Gift +100 free Love without deducting balance (Once per day)'}
                >
                  {hasClaimedFreeGiftToday ? 'Free 100 Gifted Today' : 'Free Daily Gift (+100)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGiftInputAmount(50);
                    setGiftStep(1);
                    setIsGiftModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-xl font-extrabold text-xs shadow-md transition-all border cursor-pointer hover:opacity-90"
                  style={{
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                    borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor
                  }}
                >
                  Send Gift
                </button>
              </div>
            </div>
          )}

          {/* 6. ADMIN EXCLUSIVE CONTROLS */}
          {isAdmin && (
            <div className="bg-slate-950/80 p-4 rounded-xl border space-y-4 theme-border-hover" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}>
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                Administrative Controls
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Admin Toggle */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <strong className="text-white block text-[11px]">Network Administrator</strong>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!pony.isAdmin}
                    onChange={(e) => onTogglePonyAdmin?.(pony.id, e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                </div>

                {/* Payout & Give Treat */}
                <div 
                  className="bg-slate-900/80 p-3 rounded-xl border space-y-2.5 theme-border-hover"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  <div className="flex justify-between items-center">
                    <strong className="block text-[11px]" style={{ color: theme.textColor }}>Payout %</strong>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pony.payoutPercentage || 0}
                      onChange={(e) => onUpdatePayout?.(pony.id, Number(e.target.value))}
                      className="w-16 bg-slate-950 border rounded px-1.5 py-0.5 text-right font-bold text-[11px] focus:outline-none"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.01"
                    value={pony.payoutPercentage || 0}
                    onChange={(e) => onUpdatePayout?.(pony.id, Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: theme.buttonColor }}
                  />
                  <div 
                    className="pt-2 border-t flex justify-end"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                  >
                    <button
                      onClick={() => {
                        if (onOpenAdminPopup && onGiveTreat) {
                          onOpenAdminPopup(
                            'treat',
                            'Grant Treat',
                            `Allocate a specific amount of love to ${pony.name}.`,
                            'Give Treat',
                            (amount: number) => onGiveTreat(pony.id, amount),
                            pony.name
                          );
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-1.5 rounded-lg font-bold text-[11px] shadow-lg flex items-center justify-center transition-all cursor-pointer border hover:opacity-90"
                      style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                    >
                      Give Treat
                    </button>
                  </div>
                </div>
              </div>

              {pony.treatsReceived && pony.treatsReceived > 0 ? (
                <div className="bg-pink-950/20 border border-pink-500/20 p-2 rounded-lg text-center">
                  <span className="text-[10px] text-pink-300 font-medium">
                    Total rewards received: <strong className="text-pink-400">+{pony.treatsReceived.toLocaleString()} Love</strong>
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 bg-slate-950 border-t flex items-center justify-end gap-2"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <button
            onClick={() => handleSaveProfileChanges(true)}
            className="px-6 py-2 rounded-xl font-bold text-xs shadow-md transition-all border cursor-pointer hover:opacity-90"
            style={{ 
              backgroundColor: theme.buttonColor, 
              color: theme.buttonTextColor, 
              borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
            }}
          >
            {canEditProfileFields && hasUnsavedProfileChanges ? 'Save & Close' : 'Close'}
          </button>
        </div>
      </div>

      {/* Separate Status Store Modal */}
      {adminSettings.allowExchangeStore && (
        <StatusStoreModal
          isOpen={isStoreOpen && adminSettings.allowExchangeStore}
          onClose={() => setIsStoreOpen(false)}
          pony={pony}
          statuses={statuses}
          onUpdatePony={onUpdatePony}
          onUpdateStatus={isAdmin && !isSimulatingNonAdmin ? handleUpdateStatus : undefined}
          isPonyOwner={isPonyOwner}
          isAdmin={isAdmin && !isSimulatingNonAdmin}
          targetDate={targetDate}
        />
      )}

      {/* Standalone Badge Special Page Modal */}
      <BadgeSpecialPageModal
        isOpen={isBadgeModalOpen}
        onClose={() => {
          setIsBadgeModalOpen(false);
          setSelectedBadgeStatusId(null);
        }}
        status={selectedBadgeStatus}
        statuses={statuses}
        pony={pony}
        isPonyOwner={isPonyOwner}
        isAdmin={isAdmin && !isSimulatingNonAdmin}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePony={isPonyOwner ? onUpdatePony : undefined}
        onAccessDenied={() => {
          setIsBadgeModalOpen(false);
          setSelectedBadgeStatusId(null);
        }}
      />

      {/* 2-Step Gift Confirmation Popup Modal */}
      {isGiftModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-sm bg-slate-900 border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div 
              className="flex items-center justify-between border-b pb-3" 
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            >
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5" style={{ color: theme.buttonColor }} />
                <h3 className="font-bold text-sm" style={{ color: theme.textColor }}>
                  {giftStep === 1 ? `Gift Love to ${pony.name}` : 'Confirm Love Gift'}
                </h3>
              </div>
              <button 
                onClick={() => setIsGiftModalOpen(false)} 
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {giftStep === 1 ? (
              <div className="space-y-4">
                <p className="text-xs opacity-80" style={{ color: theme.textColor }}>
                  Type the amount of Love to gift to <strong>{pony.name}</strong>:
                </p>
                <div>
                  <input
                    type="number"
                    min="1"
                    max={viewerCurrentLove}
                    autoFocus
                    value={giftInputAmount}
                    onChange={(e) => setGiftInputAmount(Math.max(1, Number(e.target.value) || 0))}
                    className="w-full bg-slate-950 border rounded-xl px-4 py-2.5 font-bold text-center text-lg focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  />
                  <span className="block mt-1.5 text-[11px] opacity-70 text-right" style={{ color: theme.textColor }}>
                    Your balance: {viewerCurrentLove.toLocaleString()} Love
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsGiftModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 border"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={giftInputAmount <= 0 || giftInputAmount > viewerCurrentLove}
                    onClick={() => setGiftStep(2)}
                    className="px-5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50"
                    style={{ 
                      backgroundColor: theme.buttonColor, 
                      color: theme.buttonTextColor, 
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  className="p-3.5 rounded-xl bg-slate-950/60 border text-center space-y-1.5" 
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  <p className="text-sm font-bold" style={{ color: theme.textColor }}>
                    Are you sure?
                  </p>
                  <p className="text-xs opacity-80 leading-relaxed" style={{ color: theme.textColor }}>
                    You are about to transfer <strong className="font-extrabold">{giftInputAmount.toLocaleString()} Love</strong> from your balance to <strong className="font-extrabold">{pony.name}</strong>.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGiftStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 border"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSendGift(giftInputAmount);
                      setIsGiftModalOpen(false);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:opacity-90 shadow-lg"
                    style={{ 
                      backgroundColor: theme.buttonColor, 
                      color: theme.buttonTextColor, 
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
                    }}
                  >
                    Yes, Confirm Gift
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Connected Ponies Modal */}
      <ConnectedPoniesModal
        isOpen={isConnectedPoniesModalOpen}
        onClose={() => setIsConnectedPoniesModalOpen(false)}
        pony={pony}
        connections={connections}
        allPonies={allPonies}
        targetDate={targetDate}
        statuses={statuses}
        livePulseTick={livePulseTick}
        onNavigateToPony={onNavigateToPony}
        onUpdatePony={onUpdatePony}
        onDeleteConnection={onDeleteConnection}
        isAdmin={isAdmin}
        isOwner={isPonyOwner}
      />
      {/* Owned Ponies Modal */}
      <OwnedPoniesModal
        isOpen={isOwnedPoniesModalOpen}
        onClose={() => setIsOwnedPoniesModalOpen(false)}
        ownedPonies={ownedPoniesList}
        onSelectPony={(id) => onNavigateToPony(id)}
      />

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={!!cropperRawImage && adminSettings.allowAvatarImageUpload}
        imageSrc={cropperRawImage}
        onClose={() => setCropperRawImage(null)}
        onCropComplete={(croppedDataUrl) => {
          const nextDraft = { ...profileDraft, avatarIcon: croppedDataUrl };
          setProfileDraft(nextDraft);
          setCropperRawImage(null);
          if (canEditProfileFields) {
            const nextTimestamp = !isAdmin && isPonyOwner ? new Date().toISOString() : pony.lastProfileUpdateAt;
            const updatedPony: PonyNode = {
              ...pony,
              ...nextDraft,
              name: (nextDraft.name || '').trim() || pony.name,
              avatarIcon: croppedDataUrl,
              lastProfileUpdateAt: nextTimestamp,
            };
            lastSyncedBaseRef.current = buildDraftFromPony(updatedPony);
            onUpdatePony(updatedPony);
            setNowMs(Date.now());
            setProfileNotice('Avatar image uploaded and saved successfully!');
          } else {
            setProfileNotice('Custom avatar ready — click Save Profile or Save & Close to save.');
          }
        }}
        title={`Crop & Zoom ${pony.name}'s Avatar`}
        outputWidth={400}
        outputHeight={400}
      />
    </div>
  );
};
