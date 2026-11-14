import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Sparkles, Trash2, ShieldAlert, Heart } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export type AdminActionType = 'delete' | 'treat' | 'confirm_reset';

interface AdminConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: AdminActionType;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: (value?: any) => void;
  initialValue?: number;
  entityName?: string;
}

export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  initialValue = 0,
  entityName,
}) => {
  const { theme } = useSettings();
  const [inputValue, setInputValue] = useState<string>(String(initialValue));

  useEffect(() => {
    if (isOpen) {
      setInputValue(String(initialValue));
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'treat') {
      const num = Number(inputValue);
      if (!isNaN(num) && num > 0) {
        onConfirm(num);
        onClose();
      }
    } else {
      onConfirm();
      onClose();
    }
  };

  const isDestructive = type === 'delete' || type === 'confirm_reset';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border rounded-2xl shadow-2xl overflow-hidden theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        {/* Header */}
        <div 
          className={`px-6 py-4 border-b flex items-center gap-3 ${isDestructive ? 'border-red-500/20 bg-red-500/5' : 'bg-slate-950/60'}`}
          style={!isDestructive ? { borderColor: theme.borderColor } : undefined}
        >
          {isDestructive ? (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          ) : (
            <Sparkles className="w-5 h-5" style={{ color: theme.textColor }} />
          )}
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>{title}</h2>
          <button onClick={onClose} className="ml-auto p-1 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg flex-shrink-0 ${isDestructive ? 'bg-red-500/10 text-red-400' : 'bg-slate-800'}`} style={!isDestructive ? { color: theme.textColor } : undefined}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              {entityName && <p className="font-bold text-xs uppercase tracking-tight" style={{ color: theme.textColor }}>{entityName}</p>}
              <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
            </div>
          </div>

          {type === 'treat' && (
            <div className="pt-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Treat Amount (Love Units)</label>
              <div className="relative">
                <input
                  type="number"
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  className="w-full bg-slate-950 border rounded-xl px-4 py-3 font-bold focus:outline-none transition-all text-lg"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                  placeholder="0"
                />
                <Heart className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: theme.textColor }} />
              </div>
              <p className="mt-2 text-[10px] text-slate-500 italic">This amount will be deducted from the general reservoir and granted to the recipient.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div 
          className="px-6 py-4 bg-slate-950/50 flex justify-end gap-3 border-t"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all border"
            style={{ borderColor: theme.borderColor }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 border ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 border-red-500' 
                : 'hover:opacity-90'
            }`}
            style={!isDestructive ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor } : undefined}
          >
            {type === 'delete' && <Trash2 className="w-3.5 h-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
