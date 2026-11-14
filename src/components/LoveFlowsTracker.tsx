import React, { useState, useMemo } from 'react';
import { PonyNode, CustomStatus, EditableHeaders, WebConnection } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { 
  calculateLoveFlowStats, 
  getInBetweenFlows, 
  formatLoveNumber,
  sortPonies,
  filterPoniesBySearch,
  PONY_SORT_OPTIONS,
  PonySortKey
} from '../utils/calculations';
import { Heart, ArrowRight, Sparkles, TrendingUp, Users, ArrowUpRight, Search, X } from 'lucide-react';
import { PonyAvatar } from './PonyAvatar';

interface LoveFlowsTrackerProps {
  ponies: PonyNode[];
  connections?: WebConnection[];
  statuses: CustomStatus[];
  targetDate: string;
  onUpdatePony: (pony: PonyNode) => void;
  flowsTitle: string;
  onUpdateFlowsTitle: (title: string) => void;
  livePulseTick?: number;
  onNavigateToPony: (id: string) => void;
}

export const LoveFlowsTracker: React.FC<LoveFlowsTrackerProps> = ({
  ponies,
  connections = [],
  statuses,
  targetDate,
  onUpdatePony: _onUpdatePony,
  flowsTitle,
  onUpdateFlowsTitle,
  livePulseTick,
  onNavigateToPony,
}) => {
  const { theme } = useSettings();
  const [sortKey, setSortKey] = useState<PonySortKey>('dailyReceived_desc');
  const [flowsSearchQuery, setFlowsSearchQuery] = useState('');

  const flowStatsMap = useMemo(() => {
    const stats = calculateLoveFlowStats(ponies, targetDate, statuses, connections, livePulseTick);
    return new Map(stats.map(s => [s.pony.id, s]));
  }, [ponies, targetDate, statuses, connections, livePulseTick]);

  const inBetweenFlows = useMemo(() => {
    return getInBetweenFlows(ponies, targetDate, statuses, connections);
  }, [ponies, targetDate, statuses, connections]);

  const sortedAndFilteredReceivers = useMemo(() => {
    const filtered = filterPoniesBySearch(ponies, flowsSearchQuery);
    const sorted = sortPonies(filtered, sortKey, connections, statuses, targetDate, livePulseTick);
    return sorted
      .map(p => flowStatsMap.get(p.id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
  }, [ponies, flowsSearchQuery, sortKey, connections, statuses, targetDate, livePulseTick, flowStatsMap]);

  return (
    <div 
      className="bg-slate-900/80 border rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-5 theme-border-hover"
      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
    >
      {/* Header */}
      {flowsTitle.trim() !== '' && (
        <div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div>
            <input
              type="text"
              value={flowsTitle}
              onChange={(e) => onUpdateFlowsTitle(e.target.value)}
              className="text-base font-bold bg-transparent border-b border-transparent focus:outline-none w-72 sm:w-96"
              style={{ color: theme.textColor }}
              title="Click to rename"
            />
          </div>
        </div>
      )}

      {/* Grid: Top Receivers (Left) & Transfers (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* 1. RANKED RECEIVERS */}
        <div 
          className="bg-slate-950/70 rounded-xl p-4 border flex flex-col justify-between theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div>
            <div 
              className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2"
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            >
              <span className="text-xs font-bold" style={{ color: theme.textColor }}>Rankings:</span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex items-center min-w-[120px]">
                  <Search className="w-3 h-3 absolute left-2 pointer-events-none" style={{ color: theme.textColor }} />
                  <input
                    type="text"
                    value={flowsSearchQuery}
                    onChange={(e) => setFlowsSearchQuery(e.target.value)}
                    placeholder="Search flows..."
                    className="w-full bg-slate-900 border rounded-lg pl-7 pr-6 py-1 text-[11px] placeholder-slate-400 focus:outline-none"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                  />
                  {flowsSearchQuery && (
                    <button
                      onClick={() => setFlowsSearchQuery('')}
                      className="absolute right-1.5 opacity-70 hover:opacity-100"
                      style={{ color: theme.textColor }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as PonySortKey)}
                  className="bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                >
                  {PONY_SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900" style={{ color: theme.textColor }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sortedAndFilteredReceivers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No ponies matched your filter.
              </div>
            ) : (
              <div className="space-y-3 mt-3 max-h-[340px] overflow-y-auto pr-1">
                {sortedAndFilteredReceivers.map((stat, idx) => (
                  <div
                    key={stat.pony.id}
                    className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-pink-500/40 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold opacity-60" style={{ color: theme.textColor }}>#{idx + 1}</span>
                        <div className="flex items-center gap-2.5 text-left">
                          <button
                            type="button"
                            onClick={() => onNavigateToPony(stat.pony.id)}
                            className="cursor-pointer hover:scale-105 transition-transform shrink-0"
                            title={`Open ${stat.pony.name}'s profile`}
                          >
                            <PonyAvatar pony={stat.pony} theme={theme} size="sm" />
                          </button>
                          <div>
                            <button
                              type="button"
                              onClick={() => onNavigateToPony(stat.pony.id)}
                              className="text-sm block leading-tight font-bold hover:underline text-left cursor-pointer"
                              style={{ color: theme.textColor }}
                              title={`Open ${stat.pony.name}'s profile`}
                            >
                              {stat.pony.name}
                            </button>
                            <span className="text-[10px] opacity-70 block" style={{ color: theme.textColor }}>Loved by: {stat.donors.length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-pink-400 text-sm block">
                          +{stat.dailyReceived.toLocaleString()} <span className="text-[10px] text-slate-400">Love/day</span>
                        </span>
                        <span className="text-[11px] text-purple-300">
                          {stat.totalReceived.toLocaleString()} total received
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. LOVE TRANSFERS */}
        <div 
          className="bg-slate-950/70 rounded-xl p-4 border flex flex-col justify-between theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div>
            <div 
              className="flex items-center justify-between pb-2.5 border-b"
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textColor }}>
                Love Transfers
              </h4>
            </div>

            {inBetweenFlows.length === 0 ? (
              <div className="py-8 text-center text-xs opacity-60 italic" style={{ color: theme.textColor }}>
                No active pony transfers.
              </div>
            ) : (
              <div className="space-y-2 mt-3 max-h-[360px] overflow-y-auto pr-1">
                {inBetweenFlows.map((flow, index) => (
                  <div
                    key={`${flow.fromPony.id}-${flow.toPony.id}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border text-xs transition-colors"
                    style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                  >
                    {/* From Pony */}
                    <button
                      onClick={() => onNavigateToPony(flow.fromPony.id)}
                      className="flex items-center gap-1.5 min-w-[120px] text-left hover:opacity-80 transition-opacity group cursor-pointer"
                    >
                      <PonyAvatar pony={flow.fromPony} theme={theme} size="xs" />
                      <strong className="truncate max-w-[90px] group-hover:underline" style={{ color: theme.textColor }}>{flow.fromPony.name}</strong>
                    </button>

                    {/* Flow Arrow & Daily Rate */}
                    <div 
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950 border"
                      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                    >
                      <span className="font-bold text-[11px]" style={{ color: theme.textColor }}>+{flow.dailyRate}/d</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-80" style={{ color: theme.textColor }} />
                    </div>

                    {/* To Pony */}
                    <button
                      onClick={() => onNavigateToPony(flow.toPony.id)}
                      className="flex items-center gap-1.5 min-w-[120px] text-left hover:opacity-80 transition-opacity group cursor-pointer"
                    >
                      <PonyAvatar pony={flow.toPony} theme={theme} size="xs" />
                      <strong className="truncate max-w-[90px] group-hover:underline" style={{ color: theme.textColor }}>{flow.toPony.name}</strong>
                    </button>

                    {/* Total Transferred */}
                    <div className="text-right ml-auto">
                      <span className="font-mono text-purple-300 font-bold text-xs">
                        {flow.totalHarvested.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
