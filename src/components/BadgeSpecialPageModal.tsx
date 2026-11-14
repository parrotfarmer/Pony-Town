import React, { useState, useMemo } from 'react';
import { CustomStatus, PonyNode, BadgeSectionBlock } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { X, Edit3, Save, Check, Plus, Trash2, Image as ImageIcon, Type, ExternalLink, Upload } from 'lucide-react';
import { resizeImageToMax } from '../utils/imageUtils';

interface BadgeSpecialPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CustomStatus | null;
  pony: PonyNode;
  isAdmin: boolean;
  onUpdateStatus?: (updated: CustomStatus) => void;
  onUpdatePony?: (updated: PonyNode) => void;
  onAccessDenied?: () => void;
}

export const BadgeSpecialPageModal: React.FC<BadgeSpecialPageModalProps> = ({
  isOpen,
  onClose,
  status,
  pony,
  isAdmin,
  onUpdateStatus,
  onUpdatePony,
  onAccessDenied,
}) => {
  const { theme, adminSettings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRows, setEditedRows] = useState(status?.badgeRows || []);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // User "Accept" state
  const [hasCheckedAccept, setHasCheckedAccept] = useState(false);
  
  // Reset acceptance when modal closes
  React.useEffect(() => {
    if (!isOpen) setHasCheckedAccept(false);
  }, [isOpen]);

  const isAlreadyAccepted = useMemo(() => {
    if (!status) return false;
    return (pony.acceptedBadges || []).includes(status.id);
  }, [pony.acceptedBadges, status]);

  if (!isOpen || !status) return null;

  // Security check: Must own/be awarded the badge (or active status) to view the page (except for admins)
  const owned =
    (pony.purchasedBadges || []).includes(status.id) ||
    (status.badgeIcon && (pony.purchasedBadges || []).includes(status.badgeIcon)) ||
    pony.status === status.id ||
    pony.status === status.name;
  if (!owned && !isAdmin) {
    if (onAccessDenied) onAccessDenied();
    return null;
  }

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
    if (!onUpdatePony || !hasCheckedAccept) return;
    const accepted = [...(pony.acceptedBadges || [])];
    if (!accepted.includes(status.id)) {
      accepted.push(status.id);
    }
    onUpdatePony({
      ...pony,
      acceptedBadges: accepted
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] bg-slate-900 border rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b bg-slate-950/80 flex-wrap sm:flex-nowrap gap-3"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div 
              className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-4xl shadow-xl border-2 overflow-hidden shrink-0"
              style={{ backgroundColor: `${status.color}25`, borderColor: `${status.color}88` }}
            >
              {status.badgeIcon && status.badgeIcon.startsWith('data:image') ? (
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
                <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold uppercase tracking-wider border border-pink-500/30">
                  {status.multiplier}x Yield
                </span>
                {adminSettings.allowMainPonySelection && onUpdatePony && (
                  <label 
                    className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-900 border transition-colors theme-border-hover"
                    title="Makes this your main pony shown on your profile and avatar across the app"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
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
                <span className="text-xs font-medium text-slate-400">
                  Owned by <span className="font-bold" style={{ color: theme.textColor }}>{pony.name}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border"
                style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
              >
                <Edit3 className="w-4 h-4" />
                Customize Page
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border"
              style={{ borderColor: theme.borderColor }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.1),transparent_70%)]">
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
                  <div key={rowIndex} className="group relative bg-slate-950/40 border border-slate-800 rounded-2xl p-6 transition-all hover:border-purple-500/30">
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
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Left Column</span>
                          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'left', { type: 'text' })}
                              className={`p-1.5 rounded-md transition-all ${row.left.type === 'text' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <Type className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'left', { type: 'image' })}
                              className={`p-1.5 rounded-md transition-all ${row.left.type === 'image' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {row.left.type === 'text' ? (
                          <textarea
                            value={row.left.content}
                            onChange={(e) => handleUpdateBlock(rowIndex, 'left', { content: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-purple-500 resize-none min-h-[120px]"
                            placeholder="Enter section text..."
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.left.content}
                                onChange={(e) => handleUpdateBlock(rowIndex, 'left', { content: e.target.value })}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                                placeholder="Image URL (max 400x400) or upload"
                              />
                              <label className="cursor-pointer px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1 shrink-0">
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
                              <div className="h-24 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                                <img src={row.left.content} alt="Preview" className="max-h-full max-w-full object-contain" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column Block Edit */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Right Column</span>
                          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'right', { type: 'text' })}
                              className={`p-1.5 rounded-md transition-all ${row.right.type === 'text' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <Type className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateBlock(rowIndex, 'right', { type: 'image' })}
                              className={`p-1.5 rounded-md transition-all ${row.right.type === 'image' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {row.right.type === 'text' ? (
                          <textarea
                            value={row.right.content}
                            onChange={(e) => handleUpdateBlock(rowIndex, 'right', { content: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-purple-500 resize-none min-h-[120px]"
                            placeholder="Enter section text..."
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.right.content}
                                onChange={(e) => handleUpdateBlock(rowIndex, 'right', { content: e.target.value })}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                                placeholder="Image URL (max 400x400) or upload"
                              />
                              <label className="cursor-pointer px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1 shrink-0">
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
                              <div className="h-24 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
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
                className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs"
              >
                <Plus className="w-5 h-5" />
                Add New Block Row
              </button>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black flex items-center gap-2 shadow-xl shadow-purple-900/20 transform transition-all hover:scale-105"
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
                          <div className="text-lg text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                            {row.left.content}
                          </div>
                        ) : (
                          <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-slate-950/50 group">
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
                          <div className="text-lg text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                            {row.right.content}
                          </div>
                        ) : (
                          <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-slate-950/50 group">
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
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-xl text-slate-500 font-semibold italic">
                      This page is currently being enchanted. Check back soon for information.
                    </p>
                  </div>
                )}
              </div>

              {/* ACCEPTANCE SECTION */}
              <div className="mt-16 pt-12 border-t border-purple-500/20 flex items-center justify-center gap-6 flex-wrap">
                {isAlreadyAccepted ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">Information Accepted</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap justify-center">
                    <label className="group flex items-center gap-3 cursor-pointer select-none">
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${hasCheckedAccept ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-950 border-slate-700 group-hover:border-purple-500'}`}>
                        {hasCheckedAccept && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={hasCheckedAccept}
                        onChange={(e) => setHasCheckedAccept(e.target.checked)}
                      />
                      <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                        I accept these terms and information.
                      </span>
                    </label>

                    <button
                      onClick={handleAccept}
                      disabled={!hasCheckedAccept}
                      className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${hasCheckedAccept ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/30 scale-105 active:scale-95' : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'}`}
                    >
                      Accept Information
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-8 py-4 bg-slate-950 border-t flex justify-end"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all border hover:opacity-90"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
          >
            Close Page
          </button>
        </div>
      </div>
    </div>
  );
};
