import React from 'react';
import { PonyNode } from '../types/pony';
import { ThemeSettings, useSettings } from '../context/SettingsContext';

interface PonyAvatarProps {
  pony: PonyNode;
  theme: ThemeSettings;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBorder?: boolean;
}

export const PonyAvatar: React.FC<PonyAvatarProps> = ({ 
  pony, 
  theme, 
  size = 'md', 
  className = '',
  showBorder = true 
}) => {
  const { adminSettings } = useSettings();
  const allowBorders = adminSettings.allowProfileBorders !== false;
  const liveAnimationsEnabled = Boolean(adminSettings.allowLiveFlowAnimations);
  const equippedBorder = allowBorders ? pony.customData?.equippedBorder : undefined;
  const borderEffectColor = theme.rainbowGlowColor || theme.borderEffectColor || pony.customData?.borderEffectColor || pony.profileBorderColor || theme.borderColor;
  
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px] rounded-md',
    sm: 'w-8 h-8 text-base rounded-lg',
    md: 'w-10 h-10 text-xl rounded-xl',
    lg: 'w-12 h-12 text-2xl rounded-xl',
    xl: 'w-14 h-14 text-3xl rounded-2xl',
    '2xl': 'w-20 h-20 text-5xl rounded-3xl',
  };

  const pulseCls = liveAnimationsEnabled ? 'animate-pulse' : '';
  const borderClasses: Record<string, string> = {
    pulsing: `ring-2 ${pulseCls}`.trim(),
    double: 'border-4 border-double',
    dashed: 'border-2 border-dashed',
    thick: 'border-4 border-solid',
    dotted: 'border-2 border-dotted',
    neon: 'ring-2 ring-offset-2',
    'rainbow-glow': `ring-4 ${pulseCls} shadow-lg`.trim(),
    'golden-sparkle': `ring-4 ring-amber-400 ${pulseCls}`.trim(),
    'neon-cyan': 'ring-4 ring-cyan-400 shadow-[0_0_15px_#06b6d4]',
    'crystal-violet': 'ring-4 ring-purple-400 shadow-[0_0_15px_#c084fc]',
  };

  const borderRingStyle = (showBorder && equippedBorder && borderClasses[equippedBorder])
    ? borderClasses[equippedBorder]
    : '';

  const baseBorder = showBorder ? (theme.transparentAllBorders ? 'border-transparent' : 'border') : 'border-0';
  const baseBorderColor = pony.profileBorderColor || theme.borderColor;

  const getCustomStyle = () => {
    if (!showBorder || !equippedBorder) {
      return {
        backgroundColor: theme.bgColor,
        borderColor: theme.transparentAllBorders ? 'transparent' : baseBorderColor,
      };
    }
    if (equippedBorder === 'rainbow-glow' || equippedBorder === 'pulsing' || equippedBorder === 'neon') {
      return {
        backgroundColor: theme.bgColor,
        borderColor: borderEffectColor,
        boxShadow: `0 0 20px ${borderEffectColor}`,
      };
    }
    return {
      backgroundColor: theme.bgColor,
      borderColor: theme.transparentAllBorders ? 'transparent' : baseBorderColor,
    };
  };

  const isImageAvatar = Boolean(
    pony.avatarIcon && (pony.avatarIcon.startsWith('data:image') || pony.avatarIcon.startsWith('http'))
  );
  const iconText = pony.avatarIcon || '🦄';
  const codePointCount = [...iconText].length;
  const isMultiChar = !isImageAvatar && codePointCount >= 2;

  const emoticonSizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', string> = {
    xs: codePointCount >= 4 ? 'text-[6px]' : 'text-[8px]',
    sm: codePointCount >= 4 ? 'text-[8px]' : 'text-[10px]',
    md: codePointCount >= 4 ? 'text-[10px]' : 'text-xs',
    lg: codePointCount >= 4 ? 'text-xs' : 'text-sm',
    xl: codePointCount >= 4 ? 'text-sm' : 'text-base',
    '2xl': codePointCount >= 4 ? 'text-lg' : 'text-2xl',
  };

  return (
    <div 
      className={`${sizeClasses[size]} ${baseBorder} flex items-center justify-center shrink-0 overflow-hidden shadow-sm relative ${borderRingStyle} ${className}`}
      style={getCustomStyle()}
    >
      {isImageAvatar ? (
        <img src={pony.avatarIcon} alt={pony.name} className="w-full h-full object-cover" />
      ) : (
        <span
          className={`leading-none select-none text-center whitespace-nowrap font-bold ${isMultiChar ? emoticonSizeMap[size] : ''}`}
          style={isMultiChar ? { color: theme.textColor } : undefined}
        >
          {iconText}
        </span>
      )}
    </div>
  );
};
