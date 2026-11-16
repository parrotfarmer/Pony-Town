import React, { useState } from 'react';
import { PonyNode } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { PonyAvatar } from './PonyAvatar';
import { X, Trash2 } from 'lucide-react';

interface OwnedPoniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownedPonies: PonyNode[];
  onSelectPony: (ponyId: string) => void;
  isOwner?: boolean;
  onDeletePony?: (ponyId: string) => void;
}

export const OwnedPoniesModal: React.FC<OwnedPoniesModalProps> = ({
  isOpen,
  onClose,
  ownedPonies,
  onSelectPony,
  isOwner = false,
  onDeletePony,
}) => {
  const { theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [deletingPony, setDeletingPony] = useState<PonyNode | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2 | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[82vh] bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{
          borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
          backgroundColor: theme.bgColor || '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b bg-slate-950/60"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: theme.textColor }}>
            Owned Ponies ({ownedPonies.length})
          </h2>
          <div className="flex items-center gap-2">
            {isOwner && onDeletePony && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: isEditing ? theme.buttonColor : 'rgba(30, 41, 59, 0.8)',
                  color: isEditing ? theme.buttonTextColor : theme.textColor,
                  borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                }}
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {ownedPonies.length === 0 ? (
            <div className="py-8 text-center text-xs opacity-60 italic" style={{ color: theme.textColor }}>
              No owned ponies found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownedPonies.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectPony(p.id);
                      onClose();
                    }
                  }}
                  className="relative flex items-center gap-3 p-3 bg-slate-950/70 rounded-xl border transition-all cursor-pointer group text-left theme-border-hover hover:bg-slate-900"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  <PonyAvatar pony={p} theme={theme} size="md" showBorder={true} className="shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="font-bold text-sm truncate group-hover:underline pr-8" style={{ color: theme.textColor }}>
                    {p.name}
                  </span>
                  {isEditing && onDeletePony && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPony(p);
                        setConfirmStep(1);
                      }}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 hover:bg-red-900 transition-colors shadow cursor-pointer"
                      title="Delete pony"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation Modal 1 */}
        {deletingPony && confirmStep === 1 && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-900 border rounded-2xl p-5 shadow-2xl space-y-4" style={{ borderColor: theme.borderColor }}>
              <h3 className="font-bold text-sm" style={{ color: theme.textColor }}>Confirm Deletion</h3>
              <p className="text-xs text-slate-300">Are you sure you want to delete {deletingPony.name}?</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeletingPony(null); setConfirmStep(null); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmStep(2)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal 2 */}
        {deletingPony && confirmStep === 2 && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-900 border rounded-2xl p-5 shadow-2xl space-y-4" style={{ borderColor: theme.borderColor }}>
              <h3 className="font-bold text-sm" style={{ color: theme.textColor }}>Final Confirmation</h3>
              <p className="text-xs text-slate-300">This action cannot be undone. Permanently delete {deletingPony.name}?</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeletingPony(null); setConfirmStep(null); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeletePony && deletingPony) {
                      onDeletePony(deletingPony.id);
                    }
                    setDeletingPony(null);
                    setConfirmStep(null);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
