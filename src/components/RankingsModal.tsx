import React, { useState, useMemo } from 'react';
import { PonyNode, CustomStatus, WebConnection } from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { 
  calculateLoveFlowStats, 
  sortPonies,
  filterPoniesBySearch,
  PONY_SORT_OPTIONS,
  PonySortKey
} from '../utils/calculations';
import { X, Search } from 'lucide-react';
import { PonyAvatar } from './PonyAvatar';

interface RankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ponies: PonyNode[];
  connections: WebConnection[];
  statuses: CustomStatus[];
  targetDate: string;
  livePulseTick?: number;
  onNavigateToPony: (id: string) => void;
}

export const RankingsModal: React.FC<RankingsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <RankingsModalContent {...props} />;
};

const RankingsModalContent: React.FC<RankingsModalProps> = ({
  onClose,
  ponies,
  connections,
  statuses,
  targetDate,
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

  const sortedAndFilteredReceivers = useMemo(() => {
    const filtered = filterPoniesBySearch(ponies, flowsSearchQuery);
    const sorted = sortPonies(filtered, sortKey, connections, statuses, targetDate, livePulseTick);
    return sorted
      .map(p => flowStatsMap.get(p.id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
  }, [ponies, flowsSearchQuery, sortKey, connections, statuses, targetDate, livePulseTick, flowStatsMap]);

  const effectiveBorderColor = theme.transparentAllBorders ? 'transparent' : theme.borderColor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{
          backgroundColor: theme.bgColor,
          color: theme.textColor,
          borderColor: effectiveBorderColor,
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-3.5 border-b"
          style={{
            backgroundColor: theme.bgColor,
            borderColor: effectiveBorderColor,
          }}
        >
          <h2 className="text-base font-bold" style={{ color: theme.textColor }}>Rankings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border hover:opacity-80 transition-colors cursor-pointer"
            style={{
              backgroundColor: theme.bgColor,
              color: theme.textColor,
              borderColor: effectiveBorderColor,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-col overflow-y-auto max-h-[75vh] text-xs space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center flex-1 min-w-[150px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 pointer-events-none opacity-60" style={{ color: theme.textColor }} />
                  <input
                    type="text"
                    placeholder="Search ponies..."
                    value={flowsSearchQuery}
                    onChange={(e) => setFlowsSearchQuery(e.target.value)}
                    className="w-full border rounded-xl pl-8 pr-8 py-1.5 text-xs focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                  {flowsSearchQuery && (
                    <button
                      onClick={() => setFlowsSearchQuery('')}
                      className="absolute right-2.5 opacity-60 hover:opacity-100 cursor-pointer"
                      style={{ color: theme.textColor }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as PonySortKey)}
                  className="border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer theme-border-hover"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                >
                  {PONY_SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ backgroundColor: theme.bgColor, color: theme.textColor }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
            </div>

            {sortedAndFilteredReceivers.length === 0 ? (
                <div
                  className="py-8 text-center text-xs opacity-60 italic rounded-xl border"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                >
                    No ponies matched your filter.
                </div>
            ) : (
                <div className="space-y-2">
                {sortedAndFilteredReceivers.map((stat, idx) => (
                    <div
                    key={stat.pony.id}
                    onClick={() => {
                        onNavigateToPony(stat.pony.id);
                        onClose();
                    }}
                    className="p-3 rounded-xl border hover:opacity-90 transition-all text-xs flex items-center justify-between cursor-pointer theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold opacity-60 w-6" style={{ color: theme.textColor }}>#{idx + 1}</span>
                            <PonyAvatar pony={stat.pony} theme={theme} size="sm" />
                            <span className="font-bold truncate" style={{ color: theme.textColor }}>{stat.pony.name}</span>
                        </div>
                        <div className="text-right">
                            <span className="font-extrabold text-sm block" style={{ color: theme.textColor }}>
                              +{stat.dailyReceived.toLocaleString()} <span className="text-[11px] opacity-70" style={{ color: theme.textColor }}>Love/day</span>
                            </span>
                            <span className="text-[11px] opacity-80" style={{ color: theme.textColor }}>
                              {stat.totalReceived.toLocaleString()} total
                            </span>
                        </div>
                    </div>
                ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
