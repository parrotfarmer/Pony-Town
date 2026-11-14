import React from 'react';
import { NetworkMetrics, EditableHeaders, PonyNode, CustomStatus, DestinationFilterScope } from '../types/pony';
import { calculateScopedMetrics, formatThaumPower } from '../utils/calculations';
import { useSettings } from '../context/SettingsContext';

interface MagicalPowerPanelProps {
  metrics: NetworkMetrics;
  ponies: PonyNode[];
  connections: any[];
  statuses: CustomStatus[];
  loveToPowerRatio: number;
  onUpdateRatio: (ratio: number) => void;
  targetDate: string;
  onUpdateTargetDate: (date: string) => void;
  headers: EditableHeaders;
  onUpdateHeaders: (headers: EditableHeaders) => void;
  destinationScope: DestinationFilterScope;
  onUpdateDestinationScope: (scope: DestinationFilterScope) => void;
  livePulseTick?: number;
  archivedLove?: number;
  onUpdateArchivedLove?: (val: number) => void;
  isAdmin?: boolean;
  reservoirDeductions?: number;
  onOpenProfile?: (ponyId: string) => void;
}

export const MagicalPowerPanel: React.FC<MagicalPowerPanelProps> = ({
  metrics: _metrics,
  ponies,
  connections,
  statuses,
  loveToPowerRatio,
  onUpdateRatio: _onUpdateRatio,
  targetDate,
  onUpdateTargetDate: _onUpdateTargetDate,
  headers,
  onUpdateHeaders: _onUpdateHeaders,
  destinationScope,
  onUpdateDestinationScope,
  livePulseTick = 0,
  archivedLove = 0,
  onUpdateArchivedLove: _onUpdateArchivedLove,
  isAdmin = false,
  reservoirDeductions = 0,
  onOpenProfile,
}) => {
  const { theme } = useSettings();

  // Scoped metrics based on selected destination scope
  const scoped = calculateScopedMetrics(
    ponies,
    connections,
    loveToPowerRatio,
    targetDate,
    statuses,
    destinationScope,
    livePulseTick,
    archivedLove,
    reservoirDeductions
  );

  const thaumInfo = formatThaumPower(scoped.magicalPower);

  // Check if a specific pony is currently selected in the sort menu
  const selectedPony = ponies.find(p => p.id === destinationScope);

  return (
    <div className="space-y-3">
      {/* GLOBAL SCOPE SELECTOR BAR */}
      <div 
        className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border text-xs shadow-md"
        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={destinationScope}
            onChange={(e) => onUpdateDestinationScope(e.target.value)}
            className="bg-slate-950 border rounded-lg px-2.5 py-1 font-semibold focus:outline-none cursor-pointer"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
          >
            {isAdmin && (
              <>
                <option value="all">Total Network</option>
                <option value="general">General Reservoir</option>
              </>
            )}
            <option value="transfers">Pony Network</option>
            <optgroup label="Pony Network (Ponies)">
              {ponies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Button visible when a pony's name is selected leading to their profile */}
          {selectedPony && (
            <button
              type="button"
              onClick={() => onOpenProfile?.(selectedPony.id)}
              className="px-3 py-1 rounded-lg font-bold text-xs shadow-md border transition-all cursor-pointer flex items-center gap-1.5 theme-border-hover animate-in fade-in duration-150"
              style={{
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
                borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor
              }}
              title={`View ${selectedPony.name}'s profile`}
            >
              {selectedPony.avatarIcon && (selectedPony.avatarIcon.startsWith('data:image') || selectedPony.avatarIcon.startsWith('http')) ? (
                <img src={selectedPony.avatarIcon} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
              ) : (
                <span className="text-[11px] leading-none shrink-0">{selectedPony.avatarIcon || '🦄'}</span>
              )}
              <span>{selectedPony.name}'s Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* METRICS CARDS GRID */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
        {/* 1. LOVE RATE */}
        <div 
          className="relative bg-slate-900/90 border rounded-2xl p-4 shadow-xl backdrop-blur-md"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider w-full" style={{ color: theme.textColor }}>
                {headers.cardInflow}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight flex items-baseline gap-1.5" style={{ color: theme.textColor }}>
              +{scoped.inflowDaily.toLocaleString()}
              <span className="text-xs font-normal opacity-80" style={{ color: theme.textColor }}>units / day</span>
            </div>
          </div>
        </div>

        {/* 2. CURRENT LOVE (Spendable) */}
        <div 
          className="relative bg-slate-900/90 border rounded-2xl p-4 shadow-xl backdrop-blur-md"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider w-full" style={{ color: theme.textColor }}>
                {headers.cardHarvested}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight flex items-baseline gap-1.5" style={{ color: theme.textColor }}>
              {scoped.totalSpendable.toLocaleString()}
              <span className="text-xs font-normal opacity-80" style={{ color: theme.textColor }}>Love</span>
            </div>
          </div>
        </div>

        {/* 3. TOTAL OVER ALL */}
        <div 
          className="relative bg-slate-900/90 border rounded-2xl p-4 shadow-xl backdrop-blur-md"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider w-full" style={{ color: theme.textColor }}>
                {headers.cardOverall}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight flex items-baseline gap-1.5" style={{ color: theme.textColor }}>
              {scoped.totalOverall.toLocaleString()}
              <span className="text-xs font-normal opacity-80" style={{ color: theme.textColor }}>Love</span>
            </div>
          </div>
        </div>

        {/* 4. TOTAL EARNINGS IN MAGICAL POWER (Admin Only) */}
        {isAdmin && (
          <div 
            className="relative bg-slate-900/90 border rounded-2xl p-4 shadow-xl backdrop-blur-md theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider w-full" style={{ color: theme.textColor }}>
                  {headers.cardMagicalPower}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-2xl font-extrabold tracking-tight flex items-baseline gap-1.5" style={{ color: theme.textColor }}>
                {thaumInfo.value}
                <span className="text-xs font-normal opacity-80" style={{ color: theme.textColor }}>{thaumInfo.unit}</span>
              </div>
              <p className="text-xs opacity-70 mt-1" style={{ color: theme.textColor }}>
                {scoped.magicalPower.toLocaleString()} Thaums
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
