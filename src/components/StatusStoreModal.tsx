import React, { useState } from 'react';
import { CustomStatus, PonyNode } from '../types/pony';
import { X, Check, Lock, AlertCircle, Sparkles, Shield, Palette, Plus, Eye } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { BadgeSpecialPageModal } from './BadgeSpecialPageModal';
import { resizeImageToMax } from '../utils/imageUtils';
import { calculatePonyAccumulatedLove } from '../utils/calculations';

export type StoreBorderItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  borderColor?: string;
  glowColor?: string;
  description?: string;
};

export interface StorePerkItem {
  id: 'textColor' | 'borderColor' | 'bgColor' | 'buttonColor' | 'borderHoverColor' | 'bgImage' | 'graphColors' | 'connectionLineColors' | 'savedThemes';
  name: string;
  price: number;
  icon: string;
  description: string;
}

export const INITIAL_STORE_BORDERS: StoreBorderItem[] = [
  { id: 'pulsing', name: 'Pulsing', price: 500, icon: '✨' },
  { id: 'double', name: 'Double', price: 750, icon: '🔳' },
  { id: 'dashed', name: 'Dashed', price: 1000, icon: '⚡' },
  { id: 'thick', name: 'Thick', price: 1250, icon: '🖼️' },
  { id: 'dotted', name: 'Dotted', price: 1500, icon: '📍' },
  { id: 'neon', name: 'Neon', price: 2000, icon: '🌈' },
  { id: 'rainbow-glow', name: 'Rainbow Glow', price: 2500, icon: '🌟' },
  { id: 'golden-sparkle', name: 'Golden Sparkle', price: 2500, icon: '💫' },
  { id: 'neon-cyan', name: 'Neon Cyan', price: 2500, icon: '🌀' },
  { id: 'crystal-violet', name: 'Crystal Violet', price: 2500, icon: '🔮' },
];

export const INITIAL_STORE_PERKS: StorePerkItem[] = [
  { id: 'bgColor', name: 'Custom Background Color Setting', price: 500, icon: '🎨', description: 'Unlock setting to pick a custom background color for your theme' },
  { id: 'textColor', name: 'Custom Text Color Setting', price: 500, icon: '🎨', description: 'Unlock setting to pick a custom text color for your theme' },
  { id: 'borderColor', name: 'Custom Border Color Setting', price: 500, icon: '🖼️', description: 'Unlock setting to pick a custom border color for your theme' },
  { id: 'borderHoverColor', name: 'Custom Border Hover Color Setting', price: 500, icon: '✨', description: 'Unlock setting to pick a custom border hover color for your theme' },
  { id: 'buttonColor', name: 'Custom Button Color Setting', price: 500, icon: '🔘', description: 'Unlock setting to pick custom button colors for your theme' },
  { id: 'bgImage', name: 'Custom Background Image Setting', price: 1000, icon: '🌌', description: 'Unlock setting to upload a custom background image for your theme' },
  { id: 'graphColors', name: 'Graph Element Colors Setting', price: 750, icon: '📊', description: 'Unlock setting to pick custom colors for graph elements' },
  { id: 'connectionLineColors', name: 'Connection Line Colors Setting', price: 750, icon: '🔗', description: 'Unlock setting to customize colors for network connection lines' },
  { id: 'savedThemes', name: 'Saved Custom Themes Setting', price: 1000, icon: '💾', description: 'Unlock ability to save and manage custom theme presets' },
];

interface StatusStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  pony: PonyNode;
  statuses: CustomStatus[];
  onUpdatePony: (updated: PonyNode) => void;
  isPonyOwner: boolean;
  isAdmin: boolean;
  targetDate?: string;
  onAddToReservoir?: (amount: number) => void;
}

export const StatusStoreModal: React.FC<StatusStoreModalProps> = ({
  isOpen,
  onClose,
  pony,
  statuses,
  onUpdatePony,
  isPonyOwner,
  isAdmin,
  targetDate,
  onAddToReservoir,
}) => {
  const { theme, storeBorders, addStoreBorder, unlockStoreItems } = useSettings();
  const [activeTab, setActiveTab] = useState<'ranks' | 'borders' | 'perks'>('ranks');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Admin custom border creation form state
  const [showAddBorderForm, setShowAddBorderForm] = useState(false);
  const [newBorderName, setNewBorderName] = useState('');
  const [newBorderPrice, setNewBorderPrice] = useState<number>(500);
  const [newBorderIcon, setNewBorderIcon] = useState('🌟');
  const [newBorderColor, setNewBorderColor] = useState('#ec4899');

  const [selectedBorderForPreview, setSelectedBorderForPreview] = useState<StoreBorderItem | null>(null);
  const [selectedBadgeForPage, setSelectedBadgeForPage] = useState<CustomStatus | null>(null);
  const [confirmingPurchase, setConfirmingPurchase] = useState<{ type: 'status' | 'border' | 'perk', item: any } | null>(null);

  if (!isOpen) return null;

  // Spendable balance
  const fallbackOverall = pony.totalOverallLove !== undefined && pony.totalOverallLove !== null
    ? pony.totalOverallLove
    : calculatePonyAccumulatedLove(pony, targetDate || new Date().toISOString().split('T')[0], statuses, 0);
  const totalOverall = fallbackOverall + (pony.treatsReceived || 0);
  const spent = pony.totalLoveSpent || 0;
  const currentLove = pony.currentLoveTotal !== undefined ? pony.currentLoveTotal : Math.max(0, totalOverall - spent);

  // Sort statuses
  const sortedStatuses = [...statuses].sort((a, b) => {
    const priceDiff = (a.price || 0) - (b.price || 0);
    if (priceDiff !== 0) return priceDiff;
    return (a.multiplier || 0) - (b.multiplier || 0);
  });

  const isOwnedStatus = (s: CustomStatus) => {
    const badges = pony.purchasedBadges || [];
    return (
      badges.includes(s.id) ||
      (s.badgeIcon ? badges.includes(s.badgeIcon) : false) ||
      pony.status === s.id ||
      pony.status === s.name ||
      !s.price || s.price === 0
    );
  };

  const isAcceptedStatus = (s: CustomStatus) => {
    return (pony.acceptedBadges || []).includes(s.id);
  };

  const nextUnpurchasedIndex = sortedStatuses.findIndex((s) => !isOwnedStatus(s));

  // Helper parsing pony's purchased borders & perks from customData
  const purchasedBorders: string[] = (() => {
    try {
      if (pony.customData?.purchasedBorders) {
        return JSON.parse(pony.customData.purchasedBorders);
      }
    } catch (e) {}
    return [];
  })();

  const equippedBorder: string | null = pony.customData?.equippedBorder || null;

  const purchasedPerks: string[] = (() => {
    try {
      if (pony.customData?.purchasedPerks) {
        return JSON.parse(pony.customData.purchasedPerks);
      }
    } catch (e) {}
    return [];
  })();

  // Purchase Status Rank Handler
  const handlePurchaseStatus = (s: CustomStatus) => {
    const sIndex = sortedStatuses.findIndex(status => status.id === s.id);
    
    for (let i = 0; i < sIndex; i++) {
      const prevStatus = sortedStatuses[i];
      if (!isOwnedStatus(prevStatus) || !isAcceptedStatus(prevStatus)) {
        setPurchaseError(`You must own and accept the ${prevStatus.name} badge first.`);
        setTimeout(() => setPurchaseError(null), 6000);
        return;
      }
    }

    const cost = s.price || 0;
    if (cost > 0 && currentLove < cost) {
      setPurchaseError(`You need ${cost - currentLove} more Love to purchase ${s.name}.`);
      setTimeout(() => setPurchaseError(null), 6000);
      return;
    }

    const badges = [...(pony.purchasedBadges || [])];
    if (!badges.includes(s.id)) badges.push(s.id);
    if (s.badgeIcon && !badges.includes(s.badgeIcon)) badges.push(s.badgeIcon);

    unlockStoreItems({
      badges: [s.id, ...(s.badgeIcon ? [s.badgeIcon] : [])],
    });

    const updatedPony: PonyNode = {
      ...pony,
      status: s.id,
      currentLoveTotal: cost > 0 ? Math.max(0, currentLove - cost) : currentLove,
      totalLoveSpent: cost > 0 ? (pony.totalLoveSpent || 0) + cost : (pony.totalLoveSpent || 0),
      purchasedBadges: badges,
    };

    onUpdatePony(updatedPony);
    if (cost > 0 && onAddToReservoir) {
      onAddToReservoir(cost);
    }
    setConfirmingPurchase(null);
  };

  const handleSwitchActiveStatus = (s: CustomStatus) => {
    onUpdatePony({
      ...pony,
      status: s.id,
    });
  };

  // Purchase Profile Border Handler
  const handlePurchaseBorder = (border: StoreBorderItem) => {
    const cost = border.price;
    if (cost > 0 && currentLove < cost) {
      setPurchaseError(`You need ${cost - currentLove} more Love to purchase ${border.name}.`);
      setTimeout(() => setPurchaseError(null), 6000);
      return;
    }

    const updatedList = Array.from(new Set([...purchasedBorders, border.id]));
    unlockStoreItems({ borders: [border.id] });

    const updatedCustomData = {
      ...(pony.customData || {}),
      purchasedBorders: JSON.stringify(updatedList),
      equippedBorder: border.id,
    };

    onUpdatePony({
      ...pony,
      currentLoveTotal: Math.max(0, currentLove - cost),
      totalLoveSpent: (pony.totalLoveSpent || 0) + cost,
      customData: updatedCustomData,
    });
    if (cost > 0 && onAddToReservoir) {
      onAddToReservoir(cost);
    }
    setConfirmingPurchase(null);
  };

  const handleEquipBorder = (borderId: string | null) => {
    const updatedCustomData = {
      ...(pony.customData || {}),
      equippedBorder: borderId || '',
    };
    onUpdatePony({
      ...pony,
      customData: updatedCustomData,
    });
  };

  // Purchase Theme Setting Perk Handler
  const handlePurchasePerk = (perk: StorePerkItem) => {
    const cost = perk.price;
    if (cost > 0 && currentLove < cost) {
      setPurchaseError(`You need ${cost - currentLove} more Love to purchase ${perk.name}.`);
      setTimeout(() => setPurchaseError(null), 6000);
      return;
    }

    const updatedList = Array.from(new Set([...purchasedPerks, perk.id]));
    unlockStoreItems({ perks: [perk.id] });

    const updatedCustomData = {
      ...(pony.customData || {}),
      purchasedPerks: JSON.stringify(updatedList),
    };

    onUpdatePony({
      ...pony,
      currentLoveTotal: Math.max(0, currentLove - cost),
      totalLoveSpent: (pony.totalLoveSpent || 0) + cost,
      customData: updatedCustomData,
    });
    if (cost > 0 && onAddToReservoir) {
      onAddToReservoir(cost);
    }
    setConfirmingPurchase(null);
  };

  // Admin: Add New Profile Border to Store
  const handleAdminAddBorder = () => {
    if (!newBorderName.trim()) return;
    const newBorder: StoreBorderItem = {
      id: `custom-border-${Date.now()}`,
      name: newBorderName.trim(),
      price: Math.max(0, Number(newBorderPrice) || 0),
      icon: newBorderIcon || '🌟',
      borderColor: newBorderColor || '#ec4899',
      glowColor: newBorderColor || '#ec4899',
    };

    void addStoreBorder(newBorder);

    setNewBorderName('');
    setShowAddBorderForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b bg-slate-950/80 gap-2 flex-wrap sm:flex-nowrap"
          style={{ borderColor: theme.borderColor }}
        >
          <div>
            <h2 className="text-base font-bold text-white">Love Exchange</h2>
            <span className="text-xs font-semibold" style={{ color: theme.textColor }}>
              Spendable Balance: {currentLove.toLocaleString()} Love
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Border Preview Box */}
            {selectedBorderForPreview && (
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] animate-pulse shrink-0 bg-slate-900"
                style={{ borderColor: theme.borderColor }}
                title={`Preview: ${selectedBorderForPreview.name}`}
              >
                {pony.avatarIcon && (pony.avatarIcon.startsWith('data:image') || pony.avatarIcon.startsWith('http')) ? (
                  <img src={pony.avatarIcon} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span>{pony.avatarIcon || '🦄'}</span>
                )}
              </div>
            )}
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div 
          className="flex border-b bg-slate-950/40 px-6 pt-3 gap-2"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('ranks')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'ranks'
                ? 'border-white opacity-100'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: theme.textColor, borderColor: activeTab === 'ranks' ? theme.textColor : 'transparent' }}
          >
            Status Badges
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('borders')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'borders'
                ? 'border-white opacity-100'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: theme.textColor, borderColor: activeTab === 'borders' ? theme.textColor : 'transparent' }}
          >
            Profile Borders
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('perks')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'perks'
                ? 'border-white opacity-100'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: theme.textColor, borderColor: activeTab === 'perks' ? theme.textColor : 'transparent' }}
          >
            Theme Perks
          </button>
        </div>

        {/* Error Notification */}
        {purchaseError && (
          <div className="mx-5 mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-200 leading-relaxed font-medium">
              {purchaseError}
            </p>
          </div>
        )}

        {/* TAB 1: Status Ranks */}
        {activeTab === 'ranks' && (
          <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh] text-xs">
            {sortedStatuses.map((s, idx) => {
              const owned = isOwnedStatus(s);
              const isCurrent = pony.status === s.id || pony.status === s.name;
              const isNextToBuy = idx === nextUnpurchasedIndex;
              const isHiddenFuture = nextUnpurchasedIndex !== -1 && idx > nextUnpurchasedIndex;

              if (isHiddenFuture) {
                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-3 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-slate-400 text-xs block">Locked Rank</strong>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-600 font-semibold px-2 py-1">
                      Locked
                    </span>
                  </div>
                );
              }

              const cost = s.price || 0;
              const canAfford = currentLove >= cost;

              return (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all bg-slate-950/60 theme-border-hover"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border font-bold overflow-hidden"
                      style={{ backgroundColor: `${s.color}25`, borderColor: `${s.color}60` }}
                    >
                      {s.badgeIcon && s.badgeIcon.startsWith('data:image') ? (
                        <img src={s.badgeIcon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        s.badgeIcon || '⭐'
                      )}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs block truncate leading-tight" style={{ color: theme.textColor }}>{s.name}</strong>
                      <span className="text-[11px] font-bold" style={{ color: theme.textColor }}>
                        {s.multiplier}x Multiplier
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">

                    {isCurrent ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : owned ? (
                      (isPonyOwner || isAdmin) ? (
                        <button
                          type="button"
                          onClick={() => handleSwitchActiveStatus(s)}
                          className="px-3 py-1.5 rounded-lg font-bold text-xs border cursor-pointer theme-border-hover min-w-[80px] text-center"
                          style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                        >
                          Switch
                        </button>
                      ) : (
                        <span className="opacity-70 font-semibold text-xs" style={{ color: theme.textColor }}>Owned</span>
                      )
                    ) : (isPonyOwner || isAdmin) ? (
                      <button
                        type="button"
                        onClick={() => handlePurchaseStatus(s)}
                        disabled={!canAfford}
                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow border cursor-pointer theme-border-hover disabled:opacity-50 min-w-[80px] text-center"
                        style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                      >
                        {cost > 0 ? `${cost} Love` : 'Free'}
                      </button>
                    ) : (
                      <span className="opacity-70 font-semibold text-xs" style={{ color: theme.textColor }}>
                        {cost > 0 ? `${cost} Love` : 'Free'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Custom Profile Borders */}
        {activeTab === 'borders' && (
          <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh] text-xs">
            {isAdmin && (
              <div className="mb-3">
                {!showAddBorderForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddBorderForm(true)}
                    className="w-full py-2 rounded-xl border border-dashed flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer theme-border-hover"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
                  >
                    <Plus className="w-4 h-4" />
                    Admin: Add Custom Profile Border to Exchange
                  </button>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-xl border space-y-2" style={{ borderColor: theme.borderColor }}>
                    <div className="text-xs font-bold" style={{ color: theme.textColor }}>Create New Profile Border</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Border Name"
                        value={newBorderName}
                        onChange={(e) => setNewBorderName(e.target.value)}
                        className="bg-slate-900 border rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                        style={{ borderColor: theme.borderColor, color: theme.textColor }}
                      />
                      <input
                        type="number"
                        placeholder="Price (Love)"
                        value={newBorderPrice}
                        onChange={(e) => setNewBorderPrice(Number(e.target.value))}
                        className="bg-slate-900 border rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                        style={{ borderColor: theme.borderColor, color: theme.textColor }}
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Icon (Emoji)"
                          value={newBorderIcon && newBorderIcon.startsWith('data:image') ? '🖼️' : newBorderIcon}
                          onChange={(e) => setNewBorderIcon(e.target.value)}
                          className="flex-1 bg-slate-900 border rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                          style={{ borderColor: theme.borderColor, color: theme.textColor }}
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const resized = await resizeImageToMax(file, 400, 400);
                                  setNewBorderIcon(resized);
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                          />
                          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 border border-slate-700">Img</span>
                        </label>
                      </div>
                      <input
                        type="color"
                        value={newBorderColor}
                        onChange={(e) => setNewBorderColor(e.target.value)}
                        className="w-full h-8 bg-transparent cursor-pointer rounded"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddBorderForm(false)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAdminAddBorder}
                        className="px-3 py-1 rounded-lg font-bold text-xs"
                        style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor }}
                      >
                        Save Border
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {storeBorders.map((b) => {
              const owned = purchasedBorders.includes(b.id);
              const isEquipped = equippedBorder === b.id;
              const canAfford = currentLove >= b.price;

              return (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 bg-slate-950/60 theme-border-hover"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div 
                    className="flex items-center gap-3 min-w-0 cursor-pointer group"
                    onClick={() => setSelectedBorderForPreview(b)}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border-2 font-bold shadow-lg transition-transform ${selectedBorderForPreview?.id === b.id ? 'scale-110 ring-2 ring-white/20' : 'group-hover:scale-105'}`}
                      style={{ borderColor: theme.borderColor, backgroundColor: `${theme.borderColor}20` }}
                    >
                      {b.icon}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs block truncate leading-tight" style={{ color: theme.textColor }}>{b.name}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEquipped ? (
                      <button
                        type="button"
                        onClick={() => handleEquipBorder(null)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold"
                      >
                        Equipped
                      </button>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => handleEquipBorder(b.id)}
                        className="px-3 py-1.5 rounded-lg font-bold text-xs border cursor-pointer theme-border-hover min-w-[80px] text-center"
                        style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                      >
                        Equip
                      </button>
                    ) : (isPonyOwner || isAdmin) ? (
                      <button
                        type="button"
                        onClick={() => setConfirmingPurchase({ type: 'border', item: b })}
                        disabled={!canAfford}
                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all border cursor-pointer theme-border-hover disabled:opacity-50 min-w-[80px] text-center"
                        style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                      >
                        {b.price} Love
                      </button>
                    ) : (
                      <span className="opacity-70 font-semibold text-xs" style={{ color: theme.textColor }}>
                        {b.price} Love
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Theme Settings Perks */}
        {activeTab === 'perks' && (
          <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh] text-xs">
            {INITIAL_STORE_PERKS.map((perk) => {
              const owned = purchasedPerks.includes(perk.id);
              const canAfford = currentLove >= perk.price;

              return (
                <div
                  key={perk.id}
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 bg-slate-950/60 theme-border-hover"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border flex items-center justify-center text-xl flex-shrink-0" style={{ borderColor: theme.borderColor }}>
                      {perk.icon}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs block truncate leading-tight" style={{ color: theme.textColor }}>{perk.name}</strong>
                      <span className="text-[11px] opacity-70 block">{perk.description}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {owned ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Unlocked
                      </span>
                    ) : (isPonyOwner || isAdmin) ? (
                      <button
                        type="button"
                        onClick={() => setConfirmingPurchase({ type: 'perk', item: perk })}
                        disabled={!canAfford}
                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all border cursor-pointer theme-border-hover disabled:opacity-50 min-w-[80px] text-center"
                        style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                      >
                        {perk.price} Love
                      </button>
                    ) : (
                      <span className="opacity-70 font-semibold text-xs" style={{ color: theme.textColor }}>
                        {perk.price} Love
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div 
          className="px-6 py-3 bg-slate-950 border-t flex justify-end"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold text-xs border cursor-pointer theme-border-hover"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Purchase Confirmation Overlay */}
      {confirmingPurchase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Confirm Purchase</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to purchase <strong>{confirmingPurchase.item.name}</strong> for <strong>{confirmingPurchase.item.price} Love</strong>?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmingPurchase(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmingPurchase.type === 'status') handlePurchaseStatus(confirmingPurchase.item);
                  else if (confirmingPurchase.type === 'border') handlePurchaseBorder(confirmingPurchase.item);
                  else if (confirmingPurchase.type === 'perk') handlePurchasePerk(confirmingPurchase.item);
                }}
                className="flex-1 py-2 rounded-xl text-white font-bold text-sm shadow-lg transition-all"
                style={{ backgroundColor: theme.buttonColor }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Standalone Badge Special Page Modal */}
      <BadgeSpecialPageModal
        isOpen={!!selectedBadgeForPage}
        onClose={() => setSelectedBadgeForPage(null)}
        status={selectedBadgeForPage}
        pony={pony}
        isAdmin={isAdmin}
        onUpdatePony={onUpdatePony}
        onAccessDenied={() => {
          setSelectedBadgeForPage(null);
          setPurchaseError('Access Denied: You do not have permission to view this badge.');
          setTimeout(() => setPurchaseError(null), 6000);
        }}
      />
    </div>
  );
};
