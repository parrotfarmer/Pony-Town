import React from 'react';
import { ThemeSettings } from '../context/SettingsContext';

export const PRESET_EMOTICONS = [
  '🦄',
  '💖',
  '✨',
  '🌟',
  '🦋',
  '🌸',
  '🌈',
  '👑',
  '🌙',
  '⚡',
  '🎵',
  '🔥',
  ':3',
  '^w^',
  'UwU',
  '^_^',
  '(◕‿◕)',
  '★',
];

interface EmoticonIconPickerProps {
  value: string;
  onChange: (nextIcon: string) => void;
  disabled?: boolean;
  theme?: ThemeSettings;
  compact?: boolean;
}

export const EmoticonIconPicker: React.FC<EmoticonIconPickerProps> = ({
  value,
  onChange,
  disabled = false,
  theme,
  compact = false,
}) => {
  const isImageUrl = Boolean(value && (value.startsWith('data:image') || value.startsWith('http')));
  const borderColor = theme?.transparentAllBorders ? 'transparent' : (theme?.borderColor || '#a855f7');
  const textColor = theme?.textColor || '#f1f5f9';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          maxLength={12}
          disabled={disabled}
          value={isImageUrl ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type emoji or emoticon (e.g. :3, ^w^, 🦄)"
          className="flex-1 bg-slate-950 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:opacity-50"
          style={{ borderColor, color: textColor }}
        />
        {isImageUrl && !disabled && (
          <button
            type="button"
            onClick={() => onChange('🦄')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 shrink-0 cursor-pointer"
          >
            Use Emoticon
          </button>
        )}
      </div>
      <div className={`flex flex-wrap gap-1 ${compact ? 'max-h-16 overflow-y-auto' : ''}`}>
        {PRESET_EMOTICONS.map((icon) => {
          const isSelected = value === icon;
          return (
            <button
              key={icon}
              type="button"
              disabled={disabled}
              onClick={() => onChange(icon)}
              className={`px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected ? 'ring-1 ring-pink-400 bg-slate-800' : 'bg-slate-950/70 hover:bg-slate-800/80'
              }`}
              style={{
                borderColor: isSelected ? (theme?.borderHoverColor || '#ec4899') : borderColor,
                color: textColor,
              }}
              title={`Select "${icon}"`}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
};
