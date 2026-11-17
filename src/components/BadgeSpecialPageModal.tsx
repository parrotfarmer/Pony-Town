import React, { useState, useMemo } from 'react';
import { CustomStatus, PonyNode, BadgeSectionBlock } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { X, Edit3, Save, Check, Plus, Trash2, Image as ImageIcon, Type, Upload } from 'lucide-react';
import { resizeImageToMax } from '../utils/imageUtils';
import { getSortedStatuses } from '../utils/calculations';

interface BadgeSpecialPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CustomStatus | null;
  statuses?: CustomStatus[];
  pony?: PonyNode | null;
  isPonyOwner?: boolean;
  isAdmin: boolean;
  initialEditing?: boolean;
  onUpdateStatus?: (updated: CustomStatus) => void;
  onUpdatePony?: (updated: PonyNode) => void;
  onAccessDenied?: () => void;
}

export const BadgeSpecialPageModal: React.FC<BadgeSpecialPageModalProps> = ({
  isOpen,
  onClose,
  status,
  statuses = [],
  pony = null,
  isPonyOwner,
  isAdmin,
  initialEditing = false,
  onUpdateStatus,
  onUpdatePony,
  onAccessDenied,
}) => {
  const { theme, adminSettings } = useSettings();
  const effectiveBorderColor = theme.transparentAllBorders ? 'transparent' : theme.borderColor;
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(Boolean(initialEditing));
  const [editedRows, setEditedRows] = useState(status?.badgeRows || []);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // User "Accept" state
  const [hasCheckedAccept, setHasCheckedAccept] = useState(false);

  // Reset/sync state when modal opens, closes, or switches status
  React.useEffect(() => {
    if (!isOpen) {
      setHasCheckedAccept(false);
      setIsEditing(false);
      setSaveSuccess(false);
      return;
    }
    setIsEditing(Boolean(initialEditing));
    setEditedRows(status?.badgeRows || []);
  }, [isOpen, status?.id, initialEditing]);

  // Keep draft rows in sync with live status updates when not actively editing
  React.useEffect(() => {
    if (isOpen && status && !isEditing) {
      setEditedRows(status.badgeRows || []);
    }
  }, [isOpen, status, isEditing]);

  const isAlreadyAccepted = useMemo(() => {
    if (!status || !pony) return false;
    return (pony.acceptedBadges || []).includes(status.id);
  }, [pony, status]);

  const sortedStatuses = useMemo(
    () => getSortedStatuses(statuses && statuses.length > 0 ? statuses : status ? [status] : []),
    [statuses, status]
  );

  const currentRankStatus = useMemo(() => {
    if (!pony) return null;
    return sortedStatuses.find((s) => s.id === pony.status || s.name === pony.status) || null;
  }, [pony, sortedStatuses]);

  const hasAccess = useMemo(() => {
    if (!isOpen || !status || !user) return false;

    // Template editing (no pony) requires signed-in admin
    if (!pony) {
      return isAdmin;
    }

    // Badge information pages on a profile are strictly private to the signed-in owner of that personal profile
    const ownsProfile =
      Boolean(pony.ownerId && pony.ownerId === user.uid) &&
      (isPonyOwner !== undefined ? isPonyOwner : true);
    if (!ownsProfile) return false;

    const explicitlyOwned =
      (pony.purchasedBadges || []).includes(status.id) ||
      (status.badgeIcon ? (pony.purchasedBadges || []).includes(status.badgeIcon) : false) ||
      pony.status === status.id ||
      pony.status === status.name ||
      !status.price ||
      status.price === 0;

    let unlockedWithoutStore = false;
    if (!adminSettings.allowExchangeStore) {
      if (!statuses || statuses.length === 0) {
        unlockedWithoutStore = true;
      } else {
        const acceptedSet = new Set(pony.acceptedBadges || []);
        const firstUnacceptedIdx = sortedStatuses.findIndex((s) => !acceptedSet.has(s.id));
        const statusIdx = sortedStatuses.findIndex((s) => s.id === status.id || s.name === status.name);
        unlockedWithoutStore =
          statusIdx >= 0 &&
          (firstUnacceptedIdx === -1 ||
            statusIdx <= firstUnacceptedIdx ||
            (statusIdx > 0 && acceptedSet.has(sortedStatuses[statusIdx - 1].id)));
      }
    }

    return explicitlyOwned || unlockedWithoutStore;
  }, [isOpen, status, user, pony, isAdmin, isPonyOwner, adminSettings.allowExchangeStore, statuses, sortedStatuses]);

  React.useEffect(() => {
    if (isOpen && status && !hasAccess && onAccessDenied) {
      onAccessDenied();
    }
  }, [isOpen, status, hasAccess, onAccessDenied]);

  if (!isOpen || !status || !hasAccess) return null;

  const handleStartEdit = () => {
    setEditedRows(status.badgeRows || []);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onUpdateStatus) {
      onUpdateStatus({
        ...status,
        badgeRows: editedRows,
      });
    }
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleAddRow = () => {
    const newRow = {
      left: { id: `L-${Date.now()}`, type: 'text' as const, content: '' },
      right: { id: `R-${Date.now()}`, type: 'text' as const, content: '' }
    };
    setEditedRows([...editedRows, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    setEditedRows(editedRows.filter((_, i) => i !== index));
  };

  const handleUpdateBlock = (rowIndex: number, side: 'left' | 'right', fields: Partial<BadgeSectionBlock>) => {
    const newRows = [...editedRows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      [side]: { ...newRows[rowIndex][side], ...fields }
    };
    setEditedRows(newRows);
  };

  const handleAccept = () => {
    if (!pony || !onUpdatePony || !hasCheckedAccept) return;
    const accepted = Array.from(new Set([...(pony.acceptedBadges || []), status.id]));
    const purchased = Array.from(new Set([...(pony.purchasedBadges || []), status.id]));

    let nextStatusId = pony.status;

    if (sortedStatuses.length > 0) {
      const acceptedIdx = sortedStatuses.findIndex((s) => s.id === status.id || s.name === status.name);
      const currentIdx = sortedStatuses.findIndex((s) => s.id === pony.status || s.name === pony.status);
      const nextRank = acceptedIdx >= 0 && acceptedIdx + 1 < sortedStatuses.length ? sortedStatuses[acceptedIdx + 1] : null;

      if (nextRank) {
        const nextIsOwnedWhenStoreOn =
          purchased.includes(nextRank.id) ||
          (nextRank.badgeIcon ? purchased.includes(nextRank.badgeIcon) : false) ||
          !nextRank.price ||
          nextRank.price === 0;

        const canAdvanceToNext = !adminSettings.allowExchangeStore || nextIsOwnedWhenStoreOn;

        if (canAdvanceToNext && (currentIdx === -1 || acceptedIdx + 1 > currentIdx)) {
          nextStatusId = nextRank.id;
          if (!adminSettings.allowExchangeStore && !purchased.includes(nextRank.id)) {
            purchased.push(nextRank.id);
          }
        }
      } else if (acceptedIdx >= 0 && (currentIdx === -1 || acceptedIdx > currentIdx)) {
        const thisIsOwned =
          !adminSettings.allowExchangeStore ||
          purchased.includes(status.id) ||
          (status.badgeIcon ? purchased.includes(status.badgeIcon) : false) ||
          !status.price ||
          status.price === 0;
        if (thisIsOwned) {
          nextStatusId = status.id;
        }
      }
    }

    onUpdatePony({
      ...pony,
      status: nextStatusId,
      acceptedBadges: accepted,
      purchasedBadges: purchased,
    });
  };

  const isBadgeImage = Boolean(
    status.badgeIcon && (status.badgeIcon.startsWith('data:image') || status.badgeIcon.startsWith('http'))
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] border rounded-3xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b flex-wrap sm:flex-nowrap gap-3"
          style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div 
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-4xl shadow-xl border-2 overflow-hidden shrink-0"
              style={{ backgroundColor: `${status.color}25`, borderColor: `${status.color}88` }}
            >
              {isBadgeImage ? (
                <img src={status.badgeIcon} alt="" className="w-full h-full object-cover" />
              ) : (
                status.badgeIcon || '⭐'
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black leading-tight uppercase tracking-tighter truncate" style={{ color: theme.textColor }}>
                {status.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: `${theme.buttonColor}25`,
                    color: theme.textColor,
                    borderColor: effectiveBorderColor,
                  }}
                >
                  {status.multiplier}x Love
                </span>
                {pony && adminSettings.allowMainPonySelection && onUpdatePony && (
                  <label 
                    className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2 py-0.5 rounded-lg border transition-colors theme-border-hover"
                    title="Makes this your main pony shown on your profile and avatar across the app"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  >
                    <input
                      type="checkbox"
                      checked={!!pony.isMainPony}
                      onChange={(e) => onUpdatePony({ ...pony, isMainPony: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-pink-500 focus:ring-pink-500 cursor-pointer"
                      style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
                    />
                    <span>Main Pony</span>
                  </label>
                )}
                {pony ? (
                  <span className="text-xs font-medium opacity-75" style={{ color: theme.textColor }}>
                    Owned by <span className="font-bold" style={{ color: theme.textColor }}>{pony.name}</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium opacity-75" style={{ color: theme.textColor }}>
                    Badge Page Template
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border cursor-pointer"
                style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: effectiveBorderColor }}
              >
                <Edit3 className="w-4 h-4" />
                Customize Page
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border hover:opacity-80 transition-opacity cursor-pointer"
              style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: theme.bgColor }}>
          {saveSuccess && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
              <Check className="w-5 h-5 text-emerald-400" />
              Custom badge information has been saved successfully.
            </div>
          )}

          {isEditing ? (
            <div className="space-y-8">
              <div className="space-y-4">
                {(editedRows || []).map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="group relative border rounded-2xl p-6 transition-all theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
                  >
                    <button
                      onClick={() => handleRemoveRow(rowIndex)}
                      className="absolute -top-3 -right-3 p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                      title="Remove Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-2 gap-8">
                      {/* Left Column Block Edit */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-widest" style={{ color: theme.textColor }}>Left Column</span>
                          <div className="flex rounded-lg p-1 border" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'left', { type: 'text' })}
                              className={`p-1.5 rounded-md transition-all cursor-pointer ${row.left.type === 'text' ? 'shadow-md' : 'opacity-60 hover:opacity-100'}`}
                              style={row.left.type === 'text' ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor } : { color: theme.textColor }}
                            >
                              <Type className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'left', { type: 'image' })}
                              className={`p-1.5 rounded-md transition-all cursor-pointer ${row.left.type === 'image' ? 'shadow-md' : 'opacity-60 hover:opacity-100'}`}
                              style={row.left.type === 'image' ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor } : { color: theme.textColor }}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {row.left.type === 'text' ? (
                          <textarea
                            value={row.left.content}
                            onChange={(e) => handleUpdateBlock(rowIndex, 'left', { content: e.target.value })}
                            className="w-full border rounded-xl p-4 text-sm focus:outline-none resize-none min-h-[120px] theme-border-hover"
                            style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                            placeholder="Enter section text..."
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.left.content}
                                onChange={(e) => handleUpdateBlock(rowIndex, 'left', { content: e.target.value })}
                                className="flex-1 border rounded-xl px-4 py-2.5 text-xs focus:outline-none theme-border-hover"
                                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                                placeholder="Image URL (max 400x400) or upload"
                              />
                              <label
                                className="cursor-pointer px-3 py-2.5 rounded-xl text-xs border flex items-center gap-1 shrink-0 hover:opacity-80"
                                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const resized = await resizeImageToMax(file, 400, 400);
                                        handleUpdateBlock(rowIndex, 'left', { content: resized });
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            {row.left.content && (
                              <div className="h-24 rounded-lg overflow-hidden border flex items-center justify-center" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                                <img src={row.left.content} alt="Preview" className="max-h-full max-w-full object-contain" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column Block Edit */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-widest" style={{ color: theme.textColor }}>Right Column</span>
                          <div className="flex rounded-lg p-1 border" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'right', { type: 'text' })}
                              className={`p-1.5 rounded-md transition-all cursor-pointer ${row.right.type === 'text' ? 'shadow-md' : 'opacity-60 hover:opacity-100'}`}
                              style={row.right.type === 'text' ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor } : { color: theme.textColor }}
                            >
                              <Type className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'right', { type: 'image' })}
                              className={`p-1.5 rounded-md transition-all cursor-pointer ${row.right.type === 'image' ? 'shadow-md' : 'opacity-60 hover:opacity-100'}`}
                              style={row.right.type === 'image' ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor } : { color: theme.textColor }}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {row.right.type === 'text' ? (
                          <textarea
                            value={row.right.content}
                            onChange={(e) => handleUpdateBlock(rowIndex, 'right', { content: e.target.value })}
                            className="w-full border rounded-xl p-4 text-sm focus:outline-none resize-none min-h-[120px] theme-border-hover"
                            style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                            placeholder="Enter section text..."
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.right.content}
                                onChange={(e) => handleUpdateBlock(rowIndex, 'right', { content: e.target.value })}
                                className="flex-1 border rounded-xl px-4 py-2.5 text-xs focus:outline-none theme-border-hover"
                                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                                placeholder="Image URL (max 400x400) or upload"
                              />
                              <label
                                className="cursor-pointer px-3 py-2.5 rounded-xl text-xs border flex items-center gap-1 shrink-0 hover:opacity-80"
                                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const resized = await resizeImageToMax(file, 400, 400);
                                        handleUpdateBlock(rowIndex, 'right', { content: resized });
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            {row.right.content && (
                              <div className="h-24 rounded-lg overflow-hidden border flex items-center justify-center" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                                <img src={row.right.content} alt="Preview" className="max-h-full max-w-full object-contain" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-4 border-2 border-dashed rounded-2xl opacity-75 hover:opacity-100 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs cursor-pointer theme-border-hover"
                style={{ borderColor: effectiveBorderColor, color: theme.textColor }}
              >
                <Plus className="w-5 h-5" />
                Add New Block Row
              </button>

              <div className="flex justify-end gap-3 pt-6 border-t" style={{ borderColor: effectiveBorderColor }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 rounded-2xl border font-bold transition-all hover:opacity-80 cursor-pointer"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-8 py-3 rounded-2xl border font-black flex items-center gap-2 shadow-xl transform transition-all hover:scale-105 cursor-pointer"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: effectiveBorderColor }}
                >
                  <Save className="w-5 h-5" />
                  Save Badge Page
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="space-y-12">
                {(status.badgeRows && status.badgeRows.length > 0) ? (
                  status.badgeRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-12 items-center">
                      <div className="animate-in fade-in slide-in-from-left-4 duration-500 delay-75">
                        {row.left.type === 'text' ? (
                          <div className="text-lg leading-relaxed font-medium whitespace-pre-wrap" style={{ color: theme.textColor }}>
                            {row.left.content}
                          </div>
                        ) : (
                          <div className="rounded-3xl overflow-hidden shadow-2xl border group" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                            <img 
                              src={row.left.content} 
                              alt="Badge Section" 
                              className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-105"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}
                      </div>
                      <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-150">
                        {row.right.type === 'text' ? (
                          <div className="text-lg leading-relaxed font-medium whitespace-pre-wrap" style={{ color: theme.textColor }}>
                            {row.right.content}
                          </div>
                        ) : (
                          <div className="rounded-3xl overflow-hidden shadow-2xl border group" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                            <img 
                              src={row.right.content} 
                              alt="Badge Section" 
                              className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-105"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-24 text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border opacity-60" style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}>
                      <ImageIcon className="w-8 h-8" style={{ color: theme.textColor }} />
                    </div>
                    <p className="text-xl font-semibold italic opacity-60" style={{ color: theme.textColor }}>
                      This page is currently being enchanted. Check back soon for information.
                    </p>
                  </div>
                )}
              </div>

              {/* ACCEPTANCE SECTION */}
              {pony && (
                <div
                  className="mt-16 pt-12 border-t flex flex-col items-center justify-center gap-3"
                  style={{ borderColor: effectiveBorderColor }}
                >
                  {isAlreadyAccepted ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                          <Check className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">Information Accepted</span>
                      </div>
                      {currentRankStatus && (
                        <span className="text-xs font-semibold opacity-80" style={{ color: theme.textColor }}>
                          Current Status: <strong style={{ color: theme.textColor }}>{currentRankStatus.name}</strong> ({currentRankStatus.multiplier}x)
                        </span>
                      )}
                    </div>
                  ) : onUpdatePony ? (
                    <div className="flex items-center gap-4 flex-wrap justify-center">
                      <label className="group flex items-center gap-3 cursor-pointer select-none">
                        <div
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${hasCheckedAccept ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : ''}`}
                          style={!hasCheckedAccept ? { backgroundColor: theme.bgColor, borderColor: effectiveBorderColor } : undefined}
                        >
                          {hasCheckedAccept && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={hasCheckedAccept}
                          onChange={(e) => setHasCheckedAccept(e.target.checked)}
                        />
                        <span className="text-sm font-bold transition-colors" style={{ color: theme.textColor }}>
                          I accept these terms and information.
                        </span>
                      </label>

                      <button
                        onClick={handleAccept}
                        disabled={!hasCheckedAccept}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${hasCheckedAccept ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/30 scale-105 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                        style={!hasCheckedAccept ? { backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor } : undefined}
                      >
                        Accept Information
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold italic opacity-75" style={{ color: theme.textColor }}>
                      Pending Owner Acceptance
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-8 py-4 border-t flex justify-end"
          style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all border hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: effectiveBorderColor }}
          >
            Close Page
          </button>
        </div>
      </div>
    </div>
  );
};
