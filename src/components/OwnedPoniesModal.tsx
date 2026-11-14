import React from 'react';
import { PonyNode } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { PonyAvatar } from './PonyAvatar';
import { X } from 'lucide-react';

interface OwnedPoniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownedPonies: PonyNode[];
  onSelectPony: (ponyId: string) => void;
}

export const OwnedPoniesModal: React.FC<OwnedPoniesModalProps> = ({
  isOpen,
  onClose,
  ownedPonies,
  onSelectPony,
}) => {
  const { theme } = useSettings();

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
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {ownedPonies.length === 0 ? (
            <div className="py-8 text-center text-xs opacity-60 italic" style={{ color: theme.textColor }}>
              No owned ponies found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ownedPonies.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPony(p.id);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-3 bg-slate-950/70 rounded-xl border transition-all cursor-pointer group text-left theme-border-hover hover:bg-slate-900"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  <PonyAvatar pony={p} theme={theme} size="md" showBorder={true} className="shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="font-bold text-sm truncate group-hover:underline" style={{ color: theme.textColor }}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
