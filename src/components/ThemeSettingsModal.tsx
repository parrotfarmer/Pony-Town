import React, { useState } from 'react';
import { useSettings, DEFAULT_THEME, ThemeSettings } from '../context/SettingsContext';
import { X, Palette, Image as ImageIcon, RotateCcw, Upload, Check, Sparkles, Bookmark, Trash2, Save, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PonyNode } from '../types/pony';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ponies?: PonyNode[];
  activePony?: PonyNode | null;
  onUpdatePony?: (updated: PonyNode) => void;
  isSimulatingNonAdmin?: boolean;
}

export const LockIndicator: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`text-amber-400 hover:text-amber-300 transition-colors cursor-help inline-flex items-center justify-center p-0.5 rounded hover:bg-amber-400/10 shrink-0 ${className}`}
    title="Unlock in the Exchange"
    aria-label="Unlock in the Exchange"
  >
    <Lock className="w-3.5 h-3.5" />
  </span>
);

interface SavedThemesSectionProps {
  isUnlocked: boolean;
}

const SavedThemesSection: React.FC<SavedThemesSectionProps> = ({ isUnlocked }) => {
  const { savedThemes, saveCurrentTheme, deleteSavedTheme, applySavedTheme, theme } = useSettings();
  const [newThemeName, setNewThemeName] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim() || !isUnlocked) return;
    saveCurrentTheme(newThemeName.trim());
    setNewThemeName('');
  };

  return (
    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Saved Custom Themes
        </h3>
        {!isUnlocked && <LockIndicator />}
      </div>

      <div className={!isUnlocked ? 'opacity-50 pointer-events-none' : ''}>
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input
            type="text"
            disabled={!isUnlocked}
            placeholder="Name your theme..."
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!isUnlocked}
            className="px-3.5 py-2 rounded-xl text-white font-bold text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: theme.buttonColor || '#db2777' }}
          >
            <Save className="w-3.5 h-3.5" />
            Save Current Theme
          </button>
        </form>

        {savedThemes.length > 0 ? (
          <div className="space-y-2 pt-2">
            {savedThemes.map((st) => (
              <div
                key={st.id}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: st.theme.bgColor }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: st.theme.borderColor }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: st.theme.buttonColor }} />
                  </div>
                  <span className="font-bold text-xs text-slate-200 truncate">{st.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => applySavedTheme(st.theme)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedTheme(st.id)}
                    className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40"
                    title="Delete saved theme"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic pt-1">No custom themes saved yet.</p>
        )}
      </div>
    </div>
  );
};

const PRESET_THEMES: { name: string; theme: Required<Omit<ThemeSettings, 'networkBgImage'>> }[] = [
  {
    name: 'Default Pony Magic',
    theme: {
      bgColor: '#0c0a1d',
      textColor: '#f1f5f9',
      borderColor: '#a855f7',
      borderHoverColor: '#ec4899',
      buttonColor: '#db2777',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#ec4899',
      rainbowGlowColor: '#ec4899',
      graphCumulativeColor: '#ec4899',
      graphDailyColor: '#a855f7',
      graphMagicalColor: '#c084fc',
      graphGridColor: 'rgba(255,255,255,0.08)',
      connectionLineColor: '#06b6d4',
      friendshipColor: '#06b6d4',
      loveChannelColor: '#f43f5e',
      sisterhoodColor: '#eab308',
      magicalResonanceColor: '#c084fc',
      hiveNexusColor: '#10b981',
      brotherhoodColor: '#525252',
      customConnectionColor: '#3b82f6',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Midnight Neon',
    theme: {
      bgColor: '#030712',
      textColor: '#f9fafb',
      borderColor: '#06b6d4',
      borderHoverColor: '#38bdf8',
      buttonColor: '#3b82f6',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#06b6d4',
      rainbowGlowColor: '#06b6d4',
      graphCumulativeColor: '#06b6d4',
      graphDailyColor: '#3b82f6',
      graphMagicalColor: '#818cf8',
      graphGridColor: 'rgba(6,182,212,0.12)',
      connectionLineColor: '#06b6d4',
      friendshipColor: '#06b6d4',
      loveChannelColor: '#ec4899',
      sisterhoodColor: '#facc15',
      magicalResonanceColor: '#818cf8',
      hiveNexusColor: '#10b981',
      brotherhoodColor: '#475569',
      customConnectionColor: '#3b82f6',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Pastel Dream',
    theme: {
      bgColor: '#1e1b2e',
      textColor: '#f3e8ff',
      borderColor: '#f472b6',
      borderHoverColor: '#fb7185',
      buttonColor: '#c084fc',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#f472b6',
      rainbowGlowColor: '#f472b6',
      graphCumulativeColor: '#f472b6',
      graphDailyColor: '#c084fc',
      graphMagicalColor: '#e879f9',
      graphGridColor: 'rgba(244,114,182,0.12)',
      connectionLineColor: '#f472b6',
      friendshipColor: '#38bdf8',
      loveChannelColor: '#fb7185',
      sisterhoodColor: '#fde047',
      magicalResonanceColor: '#c084fc',
      hiveNexusColor: '#6ee7b7',
      brotherhoodColor: '#94a3b8',
      customConnectionColor: '#c084fc',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Golden Dawn',
    theme: {
      bgColor: '#1c1917',
      textColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderHoverColor: '#fbbf24',
      buttonColor: '#ea580c',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#fbbf24',
      rainbowGlowColor: '#fbbf24',
      graphCumulativeColor: '#f59e0b',
      graphDailyColor: '#f97316',
      graphMagicalColor: '#fbbf24',
      graphGridColor: 'rgba(245,158,11,0.12)',
      connectionLineColor: '#f59e0b',
      friendshipColor: '#38bdf8',
      loveChannelColor: '#f43f5e',
      sisterhoodColor: '#fbbf24',
      magicalResonanceColor: '#e879f9',
      hiveNexusColor: '#10b981',
      brotherhoodColor: '#78716c',
      customConnectionColor: '#ea580c',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Emerald Grove',
    theme: {
      bgColor: '#062c1b',
      textColor: '#ecfdf5',
      borderColor: '#10b981',
      borderHoverColor: '#34d399',
      buttonColor: '#059669',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#10b981',
      rainbowGlowColor: '#10b981',
      graphCumulativeColor: '#10b981',
      graphDailyColor: '#059669',
      graphMagicalColor: '#34d399',
      graphGridColor: 'rgba(16,185,129,0.12)',
      connectionLineColor: '#10b981',
      friendshipColor: '#38bdf8',
      loveChannelColor: '#f43f5e',
      sisterhoodColor: '#facc15',
      magicalResonanceColor: '#a78bfa',
      hiveNexusColor: '#10b981',
      brotherhoodColor: '#4b5563',
      customConnectionColor: '#059669',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Twilight Sparkle',
    theme: {
      bgColor: '#0f0c29',
      textColor: '#fae8ff',
      borderColor: '#d946ef',
      borderHoverColor: '#f43f5e',
      buttonColor: '#9333ea',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#d946ef',
      rainbowGlowColor: '#d946ef',
      graphCumulativeColor: '#d946ef',
      graphDailyColor: '#a855f7',
      graphMagicalColor: '#c084fc',
      graphGridColor: 'rgba(217,70,239,0.12)',
      connectionLineColor: '#d946ef',
      friendshipColor: '#38bdf8',
      loveChannelColor: '#f43f5e',
      sisterhoodColor: '#fbbf24',
      magicalResonanceColor: '#e879f9',
      hiveNexusColor: '#34d399',
      brotherhoodColor: '#64748b',
      customConnectionColor: '#9333ea',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
  {
    name: 'Cyber Sunset',
    theme: {
      bgColor: '#180b24',
      textColor: '#fff1f2',
      borderColor: '#ff007f',
      borderHoverColor: '#ff7700',
      buttonColor: '#ff007f',
      buttonTextColor: '#ffffff',
      borderEffectColor: '#ff7700',
      rainbowGlowColor: '#ff007f',
      graphCumulativeColor: '#ff007f',
      graphDailyColor: '#ff7700',
      graphMagicalColor: '#ffbb00',
      graphGridColor: 'rgba(255,0,127,0.12)',
      connectionLineColor: '#ff007f',
      friendshipColor: '#00f0ff',
      loveChannelColor: '#ff007f',
      sisterhoodColor: '#ffbb00',
      magicalResonanceColor: '#b026ff',
      hiveNexusColor: '#00ff88',
      brotherhoodColor: '#4a3b5c',
      customConnectionColor: '#ff7700',
      transparentMapBorder: false,
      transparentAllBorders: false,
    },
  },
];

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  isUnlocked: boolean;
  theme: ThemeSettings;
  showLock?: boolean;
}

const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  value,
  onChange,
  isUnlocked,
  theme,
  showLock = true,
}) => {
  const hexPickerValue = (() => {
    if (!value) return '#ec4899';
    if (value.startsWith('#')) {
      if (value.length === 7) return value;
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      }
      return value.slice(0, 7);
    }
    return '#ec4899';
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label 
          className="text-[11px] font-bold block truncate"
          style={{ color: theme.textColor ? `${theme.textColor}cc` : '#94a3b8' }}
        >
          {label}
        </label>
        {!isUnlocked && showLock && <LockIndicator />}
      </div>

      <div 
        className={`flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800/90 p-2 rounded-xl border transition-all ${
          !isUnlocked ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{
          borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#334155'),
        }}
        title={!isUnlocked ? "Unlock in the Exchange" : undefined}
      >
        {/* Visible Swatch button that user can select for Color Wheel selection */}
        <label 
          className="relative flex items-center justify-center shrink-0 cursor-pointer select-none group/swatch" 
          title={isUnlocked ? `Click swatch to open color wheel for ${label}` : "Unlock in the Exchange"}
        >
          <span 
            className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-sm transition-transform group-hover/swatch:scale-105 block"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            disabled={!isUnlocked}
            value={hexPickerValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>

        {/* Text Input for direct Hex / Color string editing */}
        <input
          type="text"
          disabled={!isUnlocked}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-slate-200 font-mono text-xs focus:outline-none uppercase tracking-wide"
          placeholder="#HEX"
        />
      </div>
    </div>
  );
};

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <ThemeSettingsModalContent {...props} />;
};

const ThemeSettingsModalContent: React.FC<ThemeSettingsModalProps> = ({ 
  isOpen, 
  onClose,
  ponies: propPonies = [],
  activePony = null,
  onUpdatePony,
  isSimulatingNonAdmin = false,
}) => {
  const {
    theme,
    updateTheme,
    resetTheme,
    adminSettings,
    storeBorders,
    unlockedBorders: settingsUnlockedBorders,
    unlockedPerks: settingsUnlockedPerks,
  } = useSettings();
  const [bgInputUrl, setBgInputUrl] = useState(theme.networkBgImage || '');
  
  // Need to find user's pony to check for perks
  const { user, isAdmin: authIsAdmin } = useAuth();
  const effectiveIsAdmin = authIsAdmin && !isSimulatingNonAdmin;
  const exchangeDisabled = !adminSettings.allowExchangeStore;

  const effectivePonies: PonyNode[] = React.useMemo(() => {
    if (propPonies.length > 0) return propPonies;
    try {
      const saved = localStorage.getItem('pony_network_nodes_clean_v5');
      return saved ? (JSON.parse(saved) as PonyNode[]) : [];
    } catch {
      return [];
    }
  }, [propPonies]);

  const targetActivePony = React.useMemo(() => {
    if (activePony) {
      return effectivePonies.find((p) => p.id === activePony.id) || activePony;
    }
    if (user) {
      const owned = effectivePonies.filter((p) => p.ownerId === user.uid);
      return owned.find((p) => p.isMainPony) || owned[0] || null;
    }
    return null;
  }, [activePony, effectivePonies, user]);

  const {
    unlockedBorderIds,
    hasRainbowGlowBorder,
    hasBgColorPerk,
    hasTextColorPerk,
    hasBorderColorPerk,
    hasBorderHoverColorPerk,
    hasButtonColorPerk,
    hasBgImagePerk,
    hasGraphColorsPerk,
    hasConnectionLineColorsPerk,
    hasSavedThemesPerk,
  } = React.useMemo(() => {
    const allUnlocked = effectiveIsAdmin || exchangeDisabled;
    if (allUnlocked) {
      return {
        unlockedBorderIds: new Set<string>(storeBorders.map((b) => b.id)),
        hasRainbowGlowBorder: true,
        hasBgColorPerk: true,
        hasTextColorPerk: true,
        hasBorderColorPerk: true,
        hasBorderHoverColorPerk: true,
        hasButtonColorPerk: true,
        hasBgImagePerk: true,
        hasGraphColorsPerk: true,
        hasConnectionLineColorsPerk: true,
        hasSavedThemesPerk: true,
      };
    }

    const empty = {
      unlockedBorderIds: new Set<string>(),
      hasRainbowGlowBorder: false,
      hasBgColorPerk: false,
      hasTextColorPerk: false,
      hasBorderColorPerk: false,
      hasBorderHoverColorPerk: false,
      hasButtonColorPerk: false,
      hasBgImagePerk: false,
      hasGraphColorsPerk: false,
      hasConnectionLineColorsPerk: false,
      hasSavedThemesPerk: false,
    };
    if (!isOpen) return empty;

    const unlockedPerks = new Set<string>(settingsUnlockedPerks);
    const unlockedBorders = new Set<string>(settingsUnlockedBorders);

    const collectFromPony = (p: PonyNode | null | undefined) => {
      if (!p?.customData) return;
      if (p.customData.equippedBorder) unlockedBorders.add(p.customData.equippedBorder);
      if (p.customData.purchasedPerks) {
        try {
          (JSON.parse(p.customData.purchasedPerks) as string[]).forEach((id) => unlockedPerks.add(id));
        } catch {}
      }
      if (p.customData.purchasedBorders) {
        try {
          (JSON.parse(p.customData.purchasedBorders) as string[]).forEach((id) => unlockedBorders.add(id));
        } catch {}
      }
    };

    collectFromPony(targetActivePony);
    if (user) {
      effectivePonies.filter((p) => p.ownerId === user.uid).forEach(collectFromPony);
    }

    return {
      unlockedBorderIds: unlockedBorders,
      hasRainbowGlowBorder: unlockedBorders.has('rainbow-glow'),
      hasBgColorPerk: unlockedPerks.has('bgColor'),
      hasTextColorPerk: unlockedPerks.has('textColor'),
      hasBorderColorPerk: unlockedPerks.has('borderColor'),
      hasBorderHoverColorPerk: unlockedPerks.has('borderHoverColor'),
      hasButtonColorPerk: unlockedPerks.has('buttonColor'),
      hasBgImagePerk: unlockedPerks.has('bgImage'),
      hasGraphColorsPerk: unlockedPerks.has('graphColors'),
      hasConnectionLineColorsPerk: unlockedPerks.has('connectionLineColors'),
      hasSavedThemesPerk: unlockedPerks.has('savedThemes'),
    };
  }, [isOpen, effectiveIsAdmin, exchangeDisabled, storeBorders, effectivePonies, targetActivePony, user, settingsUnlockedPerks, settingsUnlockedBorders]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Image file is too large. Please select an image under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgInputUrl(dataUrl);
      updateTheme({ networkBgImage: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    updateTheme({ networkBgImage: bgInputUrl.trim() });
  };

  const handleClearImage = () => {
    setBgInputUrl('');
    updateTheme({ networkBgImage: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        style={{ borderColor: theme.borderColor || '#a855f7' }}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div>
              <h2 className="text-base font-bold text-white">Settings</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh] text-xs">

          {/* Section 1: Pony Network Custom Background Image */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Pony Network Background Image
              </h3>
              {!hasBgImagePerk && <LockIndicator />}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 block">
                Upload or paste a custom background image for the network web view:
              </label>

              <div className={`flex items-center gap-2 ${!hasBgImagePerk ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="text"
                  placeholder="https://example.com/background.jpg"
                  value={bgInputUrl}
                  onChange={(e) => setBgInputUrl(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-2 rounded-xl text-white font-bold text-xs shadow transition-all cursor-pointer"
                  style={{ backgroundColor: theme.buttonColor || '#db2777' }}
                >
                  Apply
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all ${!hasBgImagePerk ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                  <span>Upload Image File</span>
                  <input type="file" disabled={!hasBgImagePerk} accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                {theme.networkBgImage && (
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 font-semibold border border-red-800/40"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {theme.networkBgImage && (
                <div className="mt-2 relative rounded-xl overflow-hidden h-24 border border-slate-800">
                  <img src={theme.networkBgImage} alt="Background preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[11px] text-white font-bold">
                    Network Background Active
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Global Color Pickers */}
          {/* Section 2: Global Color Pickers */}
          <div 
            className="p-4 rounded-xl border space-y-4"
            style={{ 
              backgroundColor: 'rgba(2, 6, 23, 0.6)',
              borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#1e293b') 
            }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
              Theme Colors
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorPickerField
                label="Background Color"
                value={theme.bgColor}
                onChange={(val) => updateTheme({ bgColor: val })}
                isUnlocked={hasBgColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Text Color"
                value={theme.textColor}
                onChange={(val) => updateTheme({ textColor: val })}
                isUnlocked={hasTextColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Border Color (All Borders)"
                value={theme.borderColor}
                onChange={(val) => updateTheme({ borderColor: val })}
                isUnlocked={hasBorderColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Border Hover Color"
                value={theme.borderHoverColor || '#ec4899'}
                onChange={(val) => updateTheme({ borderHoverColor: val })}
                isUnlocked={hasBorderHoverColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Button Color (All Buttons)"
                value={theme.buttonColor}
                onChange={(val) => updateTheme({ buttonColor: val })}
                isUnlocked={hasButtonColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Button Text Color"
                value={theme.buttonTextColor || '#ffffff'}
                onChange={(val) => updateTheme({ buttonTextColor: val })}
                isUnlocked={hasButtonColorPerk}
                theme={theme}
              />
              <ColorPickerField
                label="Rainbow Glow Color"
                value={theme.rainbowGlowColor || theme.borderEffectColor || '#ec4899'}
                onChange={(val) => updateTheme({ 
                  rainbowGlowColor: val,
                  borderEffectColor: val 
                })}
                isUnlocked={hasRainbowGlowBorder}
                theme={theme}
              />
            </div>

            {/* Border Transparency Options */}
            <div 
              className="pt-2 border-t grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}30` : '#334155') }}
            >
              <label 
                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border cursor-pointer hover:border-slate-700 select-none"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}30` : '#334155') }}
              >
                <input
                  type="checkbox"
                  checked={!!theme.transparentMapBorder}
                  onChange={(e) => updateTheme({ transparentMapBorder: e.target.checked })}
                  className="w-4 h-4 rounded text-pink-500 accent-pink-500"
                />
                <span className="font-semibold" style={{ color: theme.textColor }}>Transparent map border</span>
              </label>

              <label 
                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border cursor-pointer hover:border-slate-700 select-none"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}30` : '#334155') }}
              >
                <input
                  type="checkbox"
                  checked={!!theme.transparentAllBorders}
                  onChange={(e) => updateTheme({ transparentAllBorders: e.target.checked })}
                  className="w-4 h-4 rounded text-pink-500 accent-pink-500"
                />
                <span className="font-semibold" style={{ color: theme.textColor }}>Transparent all borders</span>
              </label>
            </div>
          </div>

          {/* Section 2.2: Profile Avatar Borders */}
          {targetActivePony && onUpdatePony && (
            <div 
              className="p-4 rounded-xl border space-y-3"
              style={{ 
                backgroundColor: 'rgba(2, 6, 23, 0.6)',
                borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#1e293b') 
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
                  Profile Border ({targetActivePony.name})
                </h3>
                {targetActivePony.customData?.equippedBorder && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePony({
                        ...targetActivePony,
                        customData: { ...(targetActivePony.customData || {}), equippedBorder: '' },
                      })
                    }
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    Unequip
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {storeBorders.map((b) => {
                  const isUnlocked = unlockedBorderIds.has(b.id);
                  const isEquipped = targetActivePony.customData?.equippedBorder === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => {
                        if (!isUnlocked) return;
                        onUpdatePony({
                          ...targetActivePony,
                          customData: {
                            ...(targetActivePony.customData || {}),
                            equippedBorder: isEquipped ? '' : b.id,
                          },
                        });
                      }}
                      title={!isUnlocked ? 'Unlock in the Exchange' : b.description || b.name}
                      className={`relative flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isUnlocked ? 'cursor-pointer hover:bg-slate-800/80' : 'opacity-50 cursor-not-allowed'
                      } ${isEquipped ? 'bg-slate-800 shadow-md' : 'bg-slate-900/90'}`}
                      style={{
                        borderColor: isEquipped
                          ? (theme.borderHoverColor || theme.buttonColor || '#ec4899')
                          : (theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#334155')),
                        boxShadow: isEquipped ? `0 0 0 1px ${theme.borderHoverColor || theme.buttonColor || '#ec4899'}` : undefined,
                      }}
                    >
                      <span className="text-base shrink-0">{b.icon}</span>
                      <span className="text-[11px] font-bold truncate flex-1" style={{ color: theme.textColor }}>
                        {b.name}
                      </span>
                      {!isUnlocked ? (
                        <LockIndicator />
                      ) : isEquipped ? (
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2.5: Graph Element Colors */}
          <div 
            className="p-4 rounded-xl border space-y-4"
            style={{ 
              backgroundColor: 'rgba(2, 6, 23, 0.6)',
              borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#1e293b') 
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
                Graph Element Colors
              </h3>
              {!hasGraphColorsPerk && <LockIndicator />}
            </div>

            <div 
              className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!hasGraphColorsPerk ? 'opacity-50 pointer-events-none' : ''}`}
              title={!hasGraphColorsPerk ? "Unlock in the Exchange" : undefined}
            >
              <ColorPickerField
                label="Cumulative Love Line"
                value={theme.graphCumulativeColor || '#ec4899'}
                onChange={(val) => updateTheme({ graphCumulativeColor: val })}
                isUnlocked={hasGraphColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Daily Love Line"
                value={theme.graphDailyColor || '#a855f7'}
                onChange={(val) => updateTheme({ graphDailyColor: val })}
                isUnlocked={hasGraphColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Magical Power Line"
                value={theme.graphMagicalColor || '#c084fc'}
                onChange={(val) => updateTheme({ graphMagicalColor: val })}
                isUnlocked={hasGraphColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Graph Grid Lines"
                value={theme.graphGridColor || 'rgba(255,255,255,0.08)'}
                onChange={(val) => updateTheme({ graphGridColor: val })}
                isUnlocked={hasGraphColorsPerk}
                theme={theme}
                showLock={false}
              />
            </div>
          </div>

          {/* Section 2.8: Connection Line Colors */}
          <div 
            className="p-4 rounded-xl border space-y-4"
            style={{ 
              backgroundColor: 'rgba(2, 6, 23, 0.6)',
              borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#1e293b') 
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
                Connection Line Colors
              </h3>
              {!hasConnectionLineColorsPerk && <LockIndicator />}
            </div>

            <div 
              className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!hasConnectionLineColorsPerk ? 'opacity-50 pointer-events-none' : ''}`}
              title={!hasConnectionLineColorsPerk ? "Unlock in the Exchange" : undefined}
            >
              <ColorPickerField
                label="Friendship Lines"
                value={theme.friendshipColor || '#06b6d4'}
                onChange={(val) => updateTheme({ friendshipColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Love Channel Lines"
                value={theme.loveChannelColor || '#f43f5e'}
                onChange={(val) => updateTheme({ loveChannelColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Sisterhood Lines"
                value={theme.sisterhoodColor || '#eab308'}
                onChange={(val) => updateTheme({ sisterhoodColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Magical Resonance Lines"
                value={theme.magicalResonanceColor || '#c084fc'}
                onChange={(val) => updateTheme({ magicalResonanceColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Hive Nexus Lines"
                value={theme.hiveNexusColor || '#10b981'}
                onChange={(val) => updateTheme({ hiveNexusColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Brotherhood Lines"
                value={theme.brotherhoodColor || '#525252'}
                onChange={(val) => updateTheme({ brotherhoodColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Custom Connection Lines"
                value={theme.customConnectionColor || '#3b82f6'}
                onChange={(val) => updateTheme({ customConnectionColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
              <ColorPickerField
                label="Default Connection Lines"
                value={theme.connectionLineColor || '#06b6d4'}
                onChange={(val) => updateTheme({ connectionLineColor: val })}
                isUnlocked={hasConnectionLineColorsPerk}
                theme={theme}
                showLock={false}
              />
            </div>
          </div>

          {/* Section 3: Preset Theme Selector */}
          <div 
            className="p-4 rounded-xl border space-y-3"
            style={{ 
              backgroundColor: 'rgba(2, 6, 23, 0.6)',
              borderColor: theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}40` : '#1e293b') 
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
                Preset Themes
              </h3>
              <span className="text-[10px] opacity-75 font-medium" style={{ color: theme.textColor }}>
                All theme color options included
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRESET_THEMES.map((preset) => {
                const isActive = theme.bgColor === preset.theme.bgColor && 
                  theme.buttonColor === preset.theme.buttonColor && 
                  theme.borderColor === preset.theme.borderColor;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => updateTheme(preset.theme)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer group shadow-sm hover:scale-[1.01] ${
                      isActive ? 'shadow-lg' : 'hover:opacity-95'
                    }`}
                    style={{ 
                      backgroundColor: preset.theme.bgColor,
                      borderColor: isActive 
                        ? (theme.borderHoverColor || theme.buttonColor || '#ec4899') 
                        : (theme.transparentAllBorders ? 'transparent' : (theme.borderColor ? `${theme.borderColor}60` : '#334155')),
                      boxShadow: isActive 
                        ? `0 0 0 2px ${theme.borderHoverColor || theme.buttonColor || '#ec4899'}, 0 8px 16px rgba(0,0,0,0.5)` 
                        : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-extrabold text-xs block truncate" style={{ color: preset.theme.textColor }}>
                        {preset.name}
                      </span>
                      {isActive && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 shrink-0 shadow-sm"
                          style={{ 
                            backgroundColor: theme.buttonColor || '#db2777', 
                            color: theme.buttonTextColor || '#ffffff' 
                          }}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" /> Active
                        </span>
                      )}
                    </div>

                    {/* Complete palette preview swatches covering all theme color options */}
                    <div className="mt-2.5 pt-2 border-t border-white/10 w-full space-y-1">
                      <div className="flex items-center justify-between text-[9px] opacity-70" style={{ color: preset.theme.textColor }}>
                        <span>Colors</span>
                        <span className="font-mono text-[8px]">All options</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Background: ${preset.theme.bgColor}`} style={{ backgroundColor: preset.theme.bgColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Text: ${preset.theme.textColor}`} style={{ backgroundColor: preset.theme.textColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Border: ${preset.theme.borderColor}`} style={{ backgroundColor: preset.theme.borderColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Border Hover: ${preset.theme.borderHoverColor}`} style={{ backgroundColor: preset.theme.borderHoverColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Button: ${preset.theme.buttonColor}`} style={{ backgroundColor: preset.theme.buttonColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Rainbow Glow: ${preset.theme.rainbowGlowColor}`} style={{ backgroundColor: preset.theme.rainbowGlowColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Cumulative Love: ${preset.theme.graphCumulativeColor}`} style={{ backgroundColor: preset.theme.graphCumulativeColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Daily Love: ${preset.theme.graphDailyColor}`} style={{ backgroundColor: preset.theme.graphDailyColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Magical Power: ${preset.theme.graphMagicalColor}`} style={{ backgroundColor: preset.theme.graphMagicalColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Friendship: ${preset.theme.friendshipColor}`} style={{ backgroundColor: preset.theme.friendshipColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Love Channel: ${preset.theme.loveChannelColor}`} style={{ backgroundColor: preset.theme.loveChannelColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Sisterhood: ${preset.theme.sisterhoodColor}`} style={{ backgroundColor: preset.theme.sisterhoodColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Magical Resonance: ${preset.theme.magicalResonanceColor}`} style={{ backgroundColor: preset.theme.magicalResonanceColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Hive Nexus: ${preset.theme.hiveNexusColor}`} style={{ backgroundColor: preset.theme.hiveNexusColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Brotherhood: ${preset.theme.brotherhoodColor}`} style={{ backgroundColor: preset.theme.brotherhoodColor }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-sm" title={`Custom Line: ${preset.theme.customConnectionColor}`} style={{ backgroundColor: preset.theme.customConnectionColor }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Saved Custom Themes */}
          <SavedThemesSection isUnlocked={hasSavedThemesPerk} />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={resetTheme}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            style={{ backgroundColor: theme.buttonColor || '#db2777' }}
          >
            Save & Close
          </button>
        </div>

      </div>
    </div>
  );
};
