import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CustomStatus, PonyNode } from '../types/pony';
import { X, Plus, Trash2, Edit3 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { resizeImageToMax } from '../utils/imageUtils';
import { BadgeSpecialPageModal } from './BadgeSpecialPageModal';

const isImageIcon = (val?: string) =>
  Boolean(val && (val.startsWith('data:image') || val.startsWith('http')));

interface StatusManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: CustomStatus[];
  onUpdateStatuses: (statuses: CustomStatus[]) => void;
  ponies: PonyNode[];
}

const COLOR_OPTIONS = [
  '#10b981', // Emerald
  '#94a3b8', // Slate
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export const StatusManagerModal: React.FC<StatusManagerModalProps> = ({
  isOpen,
  onClose,
  statuses,
  onUpdateStatuses,
  ponies,
}) => {
  const [activeTab, setActiveTab] = useState<'statuses' | 'store'>('statuses');
  const [newName, setNewName] = useState('');
  const [newMultiplier, setNewMultiplier] = useState<number>(1.5);
  const [newPrice, setNewPrice] = useState<number>(250);
  const [newBadgeIcon, setNewBadgeIcon] = useState('⚡');
  const [newColor, setNewColor] = useState('#ec4899');
  const [newAllowMagicAndAccounting, setNewAllowMagicAndAccounting] = useState<boolean>(false);

  const { theme, storeBorders, addStoreBorder, updateStoreBorder, deleteStoreBorder } = useSettings();

  const [newBorderName, setNewBorderName] = useState('');
  const [newBorderPrice, setNewBorderPrice] = useState<number>(500);
  const [newBorderIcon, setNewBorderIcon] = useState('🌟');
  const [newBorderColor, setNewBorderColor] = useState('#ec4899');
  const [editingBadgeStatusId, setEditingBadgeStatusId] = useState<string | null>(null);

  // Buffered status edits prevent Firestore onSnapshot re-sorting from stealing input focus while typing
  const [draftStatuses, setDraftStatuses] = useState<CustomStatus[]>(statuses);
  const draftStatusesRef = useRef<CustomStatus[]>(statuses);
  const statusCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!statusCommitTimerRef.current) {
      draftStatusesRef.current = statuses;
      setDraftStatuses(statuses);
    }
  }, [statuses]);

  const [borderPriceDrafts, setBorderPriceDrafts] = useState<Record<string, number>>({});
  useEffect(() => {
    setBorderPriceDrafts((prev) => {
      const next: Record<string, number> = {};
      storeBorders.forEach((b) => {
        next[b.id] = prev[b.id] !== undefined && prev[b.id] !== b.price ? b.price : b.price;
      });
      return next;
    });
  }, [storeBorders]);

  const flushPendingCommits = () => {
    if (statusCommitTimerRef.current) {
      clearTimeout(statusCommitTimerRef.current);
      statusCommitTimerRef.current = null;
      onUpdateStatuses(draftStatusesRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (statusCommitTimerRef.current) {
        clearTimeout(statusCommitTimerRef.current);
        statusCommitTimerRef.current = null;
      }
    };
  }, []);

  const editingBadgeStatus = useMemo(
    () => draftStatuses.find((s) => s.id === editingBadgeStatusId) || null,
    [draftStatuses, editingBadgeStatusId]
  );

  if (!isOpen) return null;

  const handleClose = () => {
    flushPendingCommits();
    onClose();
  };

  const handleUpdateBorderPrice = (id: string, price: number, commit = false) => {
    const cleanPrice = Math.max(0, Number(price) || 0);
    setBorderPriceDrafts((prev) => ({ ...prev, [id]: cleanPrice }));
    if (commit) {
      void updateStoreBorder(id, { price: cleanPrice });
    }
  };

  const handleDeleteBorder = (id: string) => {
    void deleteStoreBorder(id);
  };

  const handleAddBorder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBorderName.trim()) return;
    const newBorder = {
      id: `custom-border-${Date.now()}`,
      name: newBorderName.trim(),
      price: Math.max(0, Number(newBorderPrice) || 0),
      icon: newBorderIcon.trim() || '🌟',
      borderColor: newBorderColor || '#ec4899',
      glowColor: newBorderColor || '#ec4899',
      description: 'Custom admin store profile border',
    };
    void addStoreBorder(newBorder);
    setNewBorderName('');
    setNewBorderIcon('🌟');
  };

  const commitStatusesImmediate = (nextList: CustomStatus[]) => {
    if (statusCommitTimerRef.current) {
      clearTimeout(statusCommitTimerRef.current);
      statusCommitTimerRef.current = null;
    }
    draftStatusesRef.current = nextList;
    setDraftStatuses(nextList);
    onUpdateStatuses(nextList);
  };

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const id = `status-${Date.now().toString().slice(-4)}`;
    const newStatus: CustomStatus = {
      id,
      name: newName.trim(),
      multiplier: Number(newMultiplier) || 1.0,
      color: newColor,
      price: Math.max(0, Number(newPrice) || 0),
      badgeIcon: newBadgeIcon.trim() || '⭐',
      allowMagicAndAccounting: newAllowMagicAndAccounting,
    };

    commitStatusesImmediate([...draftStatusesRef.current, newStatus]);
    setNewName('');
    setNewMultiplier(1.5);
    setNewPrice(250);
    setNewAllowMagicAndAccounting(false);
  };

  const handleUpdate = (id: string, updatedFields: Partial<CustomStatus>, immediate = false) => {
    const nextList = draftStatusesRef.current.map((s) =>
      s.id === id ? { ...s, ...updatedFields } : s
    );
    if (immediate) {
      commitStatusesImmediate(nextList);
      return;
    }
    draftStatusesRef.current = nextList;
    setDraftStatuses(nextList);
    if (statusCommitTimerRef.current) {
      clearTimeout(statusCommitTimerRef.current);
    }
    statusCommitTimerRef.current = setTimeout(() => {
      statusCommitTimerRef.current = null;
      onUpdateStatuses(draftStatusesRef.current);
    }, 450);
  };

  const handleDelete = (id: string) => {
    if (draftStatusesRef.current.length <= 1) {
      alert('You must have at least one status in the network.');
      return;
    }
    commitStatusesImmediate(draftStatusesRef.current.filter((s) => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-slate-950/60"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2.5">
            <div>
              <h2 className="text-base font-bold text-white">Manager</h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Admin Tabs */}
        <div 
          className="flex border-b bg-slate-950/40 px-6 pt-3 gap-3"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('statuses')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'statuses' ? 'border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: theme.textColor, borderColor: activeTab === 'statuses' ? theme.textColor : 'transparent' }}
          >
            Statuses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'store' ? 'border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: theme.textColor, borderColor: activeTab === 'store' ? theme.textColor : 'transparent' }}
          >
            Borders
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto max-h-[70vh]">
          {activeTab === 'statuses' ? (
            <>
          
          {/* Add New Status Form */}
          <form 
            onSubmit={handleAddStatus} 
            className="bg-slate-950/70 p-4 rounded-xl border space-y-3 theme-border-hover"
            style={{ borderColor: theme.borderColor }}
          >
            <span className="font-bold block text-xs uppercase tracking-wider" style={{ color: theme.textColor }}>
              Create New Status Rank
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Status Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Super Love Bloom"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border rounded-lg px-3 py-1.5 focus:outline-none theme-border-hover"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                />
              </div>

              <div>
                <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Multiplier (x)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  required
                  value={newMultiplier}
                  onChange={(e) => setNewMultiplier(Number(e.target.value))}
                  className="w-full bg-slate-900 border rounded-lg px-3 py-1.5 font-bold focus:outline-none theme-border-hover"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                />
              </div>

              <div>
                <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Price (Love)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border rounded-lg px-3 py-1.5 font-bold focus:outline-none theme-border-hover"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Badge Color & Icon</label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        newColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="text"
                    maxLength={3}
                    value={isImageIcon(newBadgeIcon) ? '🖼️' : newBadgeIcon}
                    onChange={(e) => setNewBadgeIcon(e.target.value)}
                    placeholder="Icon"
                    className="w-12 bg-slate-900 border rounded-lg px-1.5 py-1 text-center text-sm font-bold focus:outline-none theme-border-hover"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
                    title="Badge Icon Emoji"
                    disabled={isImageIcon(newBadgeIcon)}
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) {
                          try {
                            const resized = await resizeImageToMax(file, 400, 400);
                            setNewBadgeIcon(resized);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                    />
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 border border-slate-700">Upload Img</span>
                  </label>
                  {isImageIcon(newBadgeIcon) && (
                    <button
                      type="button"
                      onClick={() => setNewBadgeIcon('⚡')}
                      className="text-[9px] text-red-400 hover:text-red-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] pt-1" style={{ color: theme.textColor }}>
                <input
                  type="checkbox"
                  checked={newAllowMagicAndAccounting}
                  onChange={(e) => setNewAllowMagicAndAccounting(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-pink-500 focus:ring-pink-500 w-3.5 h-3.5"
                />
                <span>Allow Magic Power & Accounting View</span>
              </label>

              <button
                type="submit"
                className="ml-auto px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-md transition-all border cursor-pointer theme-border-hover"
                style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Status
              </button>
            </div>
          </form>

          {/* Existing Statuses List */}
          <div className="space-y-2">
            <span className="font-bold block text-xs uppercase tracking-wider opacity-70" style={{ color: theme.textColor }}>
              Configured Status Multipliers & Prices ({draftStatuses.length})
            </span>

            <div className="space-y-2">
              {draftStatuses.map((status) => {
                const count = ponies.filter(
                  (p) => p.status === status.id || p.status === status.name
                ).length;

                return (
                  <div
                    key={status.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border text-xs theme-border-hover"
                    style={{ borderColor: theme.borderColor }}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-[150px]">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <div className="w-8 h-8 rounded bg-slate-900 border flex items-center justify-center shrink-0 overflow-hidden" style={{ borderColor: theme.borderColor }}>
                        {isImageIcon(status.badgeIcon) ? (
                          <img src={status.badgeIcon} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">{status.badgeIcon || '⭐'}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={isImageIcon(status.badgeIcon) ? '🖼️' : status.badgeIcon || '⭐'}
                        onChange={(e) =>
                          handleUpdate(status.id, { badgeIcon: e.target.value })
                        }
                        onBlur={flushPendingCommits}
                        className="w-10 bg-slate-900 border rounded text-center text-xs p-1"
                        style={{ borderColor: theme.borderColor, color: theme.textColor }}
                        title="Badge Icon (Emoji or Image URL)"
                        disabled={isImageIcon(status.badgeIcon)}
                      />
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) {
                              try {
                                const resized = await resizeImageToMax(file, 400, 400);
                                handleUpdate(status.id, { badgeIcon: resized }, true);
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                        />
                        <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-700 border border-slate-700">Img</span>
                      </label>
                      {isImageIcon(status.badgeIcon) && (
                        <button
                          type="button"
                          onClick={() => handleUpdate(status.id, { badgeIcon: '⚡' }, true)}
                          className="text-[9px] text-red-400 hover:text-red-300"
                        >
                          ✕
                        </button>
                      )}
                      <input
                        type="text"
                        value={status.name}
                        onChange={(e) =>
                          handleUpdate(status.id, { name: e.target.value })
                        }
                        onBlur={flushPendingCommits}
                        className="bg-transparent font-bold border-b border-transparent hover:border-slate-600 focus:outline-none flex-1"
                        style={{ color: theme.textColor }}
                      />
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px]" style={{ color: theme.textColor }}>
                        <input
                          type="checkbox"
                          checked={!!status.allowMagicAndAccounting}
                          onChange={(e) => handleUpdate(status.id, { allowMagicAndAccounting: e.target.checked }, true)}
                          className="rounded border-slate-700 bg-slate-900 text-pink-500 focus:ring-pink-500 w-3 h-3"
                        />
                        <span>Magic & Accounting View</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <span className="opacity-70" style={{ color: theme.textColor }}>Mult:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="10"
                          value={status.multiplier}
                          onChange={(e) =>
                            handleUpdate(status.id, {
                              multiplier: Number(e.target.value) || 0,
                            })
                          }
                          onBlur={flushPendingCommits}
                          className="w-14 bg-slate-900 border rounded px-1 py-0.5 text-center font-bold focus:outline-none"
                          style={{ borderColor: theme.borderColor, color: theme.textColor }}
                        />
                        <span className="opacity-60" style={{ color: theme.textColor }}>x</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="opacity-70" style={{ color: theme.textColor }}>Price:</span>
                        <input
                          type="number"
                          step="25"
                          min="0"
                          value={status.price ?? 0}
                          onChange={(e) =>
                            handleUpdate(status.id, {
                              price: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          onBlur={flushPendingCommits}
                          className="w-16 bg-slate-900 border rounded px-1 py-0.5 text-center font-bold focus:outline-none"
                          style={{ borderColor: theme.borderColor, color: theme.textColor }}
                        />
                        <span className="opacity-60 text-[10px]" style={{ color: theme.textColor }}>Love</span>
                      </div>

                      <span 
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border"
                        style={{ borderColor: theme.borderColor, color: theme.textColor }}
                      >
                        {count} {count === 1 ? 'pony' : 'ponies'}
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => {
                          flushPendingCommits();
                          setEditingBadgeStatusId(status.id);
                        }}
                        className="p-1 rounded bg-purple-950/30 hover:bg-purple-900/50 border cursor-pointer"
                        style={{ borderColor: theme.borderColor, color: theme.textColor }}
                        title="Edit Badge Page"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(status.id)}
                        className="p-1 rounded bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40"
                        title="Delete status"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Add Store Border Form */}
              <form 
                onSubmit={handleAddBorder}
                className="bg-slate-950/70 p-4 rounded-xl border space-y-3 theme-border-hover"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
              >
                <span className="font-bold block text-xs uppercase tracking-wider" style={{ color: theme.textColor }}>
                  Create Border
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Border Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Celestial Starlight"
                      value={newBorderName}
                      onChange={(e) => setNewBorderName(e.target.value)}
                      className="w-full bg-slate-900 border rounded-lg px-3 py-1.5 focus:outline-none"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    />
                  </div>

                  <div>
                    <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Price (Love)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={newBorderPrice}
                      onChange={(e) => setNewBorderPrice(Number(e.target.value))}
                      className="w-full bg-slate-900 border rounded-lg px-3 py-1.5 font-bold focus:outline-none"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                    />
                  </div>

                  <div>
                    <label className="block mb-1 opacity-70" style={{ color: theme.textColor }}>Icon (Emoji / Img)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={isImageIcon(newBorderIcon) ? '🖼️' : newBorderIcon}
                        disabled={isImageIcon(newBorderIcon)}
                        onChange={(e) => setNewBorderIcon(e.target.value)}
                        className="w-full bg-slate-900 border rounded-lg px-2 py-1.5 text-center font-bold focus:outline-none"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                      />
                      <label className="cursor-pointer shrink-0">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
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
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <label className="opacity-70" style={{ color: theme.textColor }}>Glow Color:</label>
                    <input
                      type="color"
                      value={newBorderColor}
                      onChange={(e) => setNewBorderColor(e.target.value)}
                      className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-md border cursor-pointer"
                    style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                  >
                    <Plus className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
                    Add Border to Exchange
                  </button>
                </div>
              </form>

              {/* Manage Existing Store Borders */}
              <div className="space-y-2">
                <span className="font-bold block text-xs uppercase tracking-wider opacity-70" style={{ color: theme.textColor }}>
                  Borders ({storeBorders.length})
                </span>

                <div className="space-y-2">
                  {storeBorders.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border text-xs theme-border-hover"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base border-2 font-bold shrink-0 overflow-hidden"
                          style={{ borderColor: b.borderColor, backgroundColor: `${b.borderColor}20` }}
                        >
                          {isImageIcon(b.icon) ? (
                            <img src={b.icon} alt={b.name} className="w-full h-full object-cover" />
                          ) : (
                            b.icon
                          )}
                        </span>
                        <div className="min-w-0">
                          <strong className="block text-xs truncate" style={{ color: theme.textColor }}>{b.name}</strong>
                          <span className="text-[10px] opacity-60 block truncate">{b.description}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="opacity-70 text-[11px]" style={{ color: theme.textColor }}>Price:</span>
                          <input
                            type="number"
                            step="50"
                            min="0"
                            value={borderPriceDrafts[b.id] ?? b.price}
                            onChange={(e) => handleUpdateBorderPrice(b.id, Number(e.target.value), false)}
                            onBlur={(e) => handleUpdateBorderPrice(b.id, Number(e.target.value), true)}
                            className="w-20 bg-slate-900 border rounded px-1.5 py-0.5 text-center font-bold focus:outline-none text-xs"
                            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                          />
                          <span className="opacity-60 text-[10px]" style={{ color: theme.textColor }}>Love</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteBorder(b.id)}
                          className="p-1 rounded bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40"
                          title="Remove border from store"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 bg-slate-950 border-t flex justify-end"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl font-bold text-xs border cursor-pointer theme-border-hover"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Template Badge Special Page Editor Modal */}
      <BadgeSpecialPageModal
        isOpen={!!editingBadgeStatus}
        onClose={() => setEditingBadgeStatusId(null)}
        status={editingBadgeStatus}
        pony={null}
        isAdmin={true}
        initialEditing={true}
        onUpdateStatus={(updated) => {
          commitStatusesImmediate(
            draftStatusesRef.current.map((s) => (s.id === updated.id ? updated : s))
          );
        }}
      />
    </div>
  );
};
