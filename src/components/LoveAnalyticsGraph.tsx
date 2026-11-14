import React, { useState, useMemo } from 'react';
import { PonyNode, WebConnection, HarvestTimePoint, CustomStatus, DestinationFilterScope } from '../types/pony';
import { 
  generateHarvestTimeline, 
  formatLoveNumber, 
  calculateLoveFlowStats,
  sortPonies,
  filterPoniesBySearch,
  PONY_SORT_OPTIONS,
  PonySortKey
} from '../utils/calculations';
import { Filter, Search, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { PonyAvatar } from './PonyAvatar';

interface LoveAnalyticsGraphProps {
  ponies: PonyNode[];
  connections: WebConnection[];
  loveToPowerRatio: number;
  targetDate: string;
  statuses: CustomStatus[];
  analyticsTitle: string;
  onUpdateAnalyticsTitle: (title: string) => void;
  destinationScope: DestinationFilterScope;
  onUpdateDestinationScope: (scope: DestinationFilterScope) => void;
  isAdmin?: boolean;
  onNavigateToPony: (id: string) => void;
}

interface ActiveFilters {
  cumulative: boolean;
  daily_income: boolean;
  magical_power: boolean;
}

export const LoveAnalyticsGraph: React.FC<LoveAnalyticsGraphProps> = ({
  ponies,
  connections,
  loveToPowerRatio,
  targetDate,
  statuses,
  analyticsTitle,
  onUpdateAnalyticsTitle,
  destinationScope,
  onUpdateDestinationScope,
  isAdmin = false,
  onNavigateToPony,
}) => {
  // Overlapping filters - user can compare all curves simultaneously or toggle any combination
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    cumulative: true,
    daily_income: true,
    magical_power: isAdmin,
  });

  const [daysSpan, setDaysSpan] = useState<number>(30);
  const [hoveredPoint, setHoveredPoint] = useState<HarvestTimePoint | null>(null);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');

  const filteredGraphPonies = useMemo(() => {
    if (!graphSearchQuery.trim()) return ponies;
    return ponies.filter(p => p.name.toLowerCase().includes(graphSearchQuery.toLowerCase()));
  }, [ponies, graphSearchQuery]);

  // Time series generated based on selected destination scope!
  const timelineData = useMemo(() => {
    return generateHarvestTimeline(
      ponies,
      connections,
      loveToPowerRatio,
      daysSpan,
      targetDate,
      statuses,
      destinationScope
    );
  }, [ponies, connections, loveToPowerRatio, daysSpan, targetDate, statuses, destinationScope]);

  const [topSortKey, setTopSortKey] = useState<PonySortKey>('dailyReceived_desc');
  const [topSearchQuery, setTopSearchQuery] = useState('');

  const topEarners = useMemo(() => {
    const flowStats = calculateLoveFlowStats(ponies, targetDate, statuses, connections);
    const statsMap = new Map(flowStats.map((s) => [s.pony.id, s]));
    const filtered = filterPoniesBySearch(ponies, topSearchQuery);
    const sorted = sortPonies(filtered, topSortKey, connections, statuses, targetDate);
    return sorted.map((p) => {
      const stat = statsMap.get(p.id);
      return {
        pony: p,
        dailyRate: stat ? stat.dailyProduced : 0,
        dailyReceived: stat ? stat.dailyReceived : 0,
        totalReceived: Math.round(p.totalOverallLove || 0),
      };
    });
  }, [ponies, topSearchQuery, topSortKey, connections, statuses, targetDate]);

  const svgWidth = 800;
  const svgHeight = 250;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Max value across all currently visible overlapping curves
  const maxValue = useMemo(() => {
    if (timelineData.length === 0) return 100;
    let max = 10;
    if (activeFilters.cumulative) {
      max = Math.max(max, ...timelineData.map(d => d.cumulativeLove));
    }
    if (activeFilters.daily_income) {
      max = Math.max(max, ...timelineData.map(d => d.dailyLove));
    }
    if (isAdmin && activeFilters.magical_power) {
      max = Math.max(max, ...timelineData.map(d => d.magicalPower));
    }
    return Math.max(max, 100);
  }, [timelineData, activeFilters, isAdmin]);

  // Points for each metric curve
  const cumulativePoints = useMemo(() => {
    if (timelineData.length === 0 || !activeFilters.cumulative) return [];
    return timelineData.map((d, index) => {
      const x = padding.left + (index / (timelineData.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - (d.cumulativeLove / maxValue) * graphHeight;
      return { x, y, data: d, val: d.cumulativeLove };
    });
  }, [timelineData, activeFilters.cumulative, maxValue, graphWidth, graphHeight, padding]);

  const dailyPoints = useMemo(() => {
    if (timelineData.length === 0 || !activeFilters.daily_income) return [];
    return timelineData.map((d, index) => {
      const x = padding.left + (index / (timelineData.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - (d.dailyLove / maxValue) * graphHeight;
      return { x, y, data: d, val: d.dailyLove };
    });
  }, [timelineData, activeFilters.daily_income, maxValue, graphWidth, graphHeight, padding]);

  const magicalPoints = useMemo(() => {
    if (!isAdmin || timelineData.length === 0 || !activeFilters.magical_power) return [];
    return timelineData.map((d, index) => {
      const x = padding.left + (index / (timelineData.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - (d.magicalPower / maxValue) * graphHeight;
      return { x, y, data: d, val: d.magicalPower };
    });
  }, [timelineData, activeFilters.magical_power, maxValue, graphWidth, graphHeight, padding, isAdmin]);

  // SVG Paths
  const buildLinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    return pts.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  };

  const cumulativeLinePath = useMemo(() => buildLinePath(cumulativePoints), [cumulativePoints]);
  const dailyLinePath = useMemo(() => buildLinePath(dailyPoints), [dailyPoints]);
  const magicalLinePath = useMemo(() => buildLinePath(magicalPoints), [magicalPoints]);

  const { theme } = useSettings();

  const toggleFilter = (filterKey: keyof ActiveFilters) => {
    if (filterKey === 'magical_power' && !isAdmin) return;
    setActiveFilters(prev => {
      const next = { ...prev, [filterKey]: !prev[filterKey] };
      if (!next.cumulative && !next.daily_income && (!isAdmin || !next.magical_power)) {
        return prev;
      }
      return next;
    });
  };

  return (
    <div 
      className="bg-slate-900/80 border rounded-2xl p-5 shadow-2xl backdrop-blur-md theme-border-hover"
      style={{ borderColor: theme.borderColor }}
    >
      {/* Header and Controls */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: theme.borderColor }}
      >
        {analyticsTitle.trim() !== '' && (
          <div>
            <input
              type="text"
              value={analyticsTitle}
              onChange={(e) => onUpdateAnalyticsTitle(e.target.value)}
              className="text-base font-bold bg-transparent border-b border-transparent focus:outline-none w-72"
              style={{ color: theme.textColor }}
              title="Click to rename"
            />
          </div>
        )}

        {/* View Mode Filters & Date Span */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {/* Graph Pony Search Bar */}
          <div className="relative flex items-center min-w-[140px] max-w-[190px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none" style={{ color: theme.textColor }} />
            <input
              type="text"
              value={graphSearchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setGraphSearchQuery(val);
                const exactMatch = ponies.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                if (exactMatch) {
                  onUpdateDestinationScope(exactMatch.id);
                }
              }}
              placeholder="Search..."
              className="w-full bg-slate-950 border rounded-xl pl-8 pr-7 py-1 text-xs placeholder-slate-400 focus:outline-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
            {graphSearchQuery && (
              <button
                onClick={() => setGraphSearchQuery('')}
                className="absolute right-2 hover:opacity-100 opacity-70"
                style={{ color: theme.textColor }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Destination Selector right on the graph */}
          <div 
            className="flex items-center gap-1.5 bg-slate-950/90 px-2.5 py-1 rounded-xl border text-xs theme-border-hover"
            style={{ borderColor: theme.borderColor }}
          >
            <Filter className="w-3.5 h-3.5" style={{ color: theme.textColor }} />
            <select
              value={destinationScope}
              onChange={(e) => onUpdateDestinationScope(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
              style={{ color: theme.textColor }}
            >
              {isAdmin && (
                <>
                  <option value="all" className="bg-slate-900 text-white">Total Network</option>
                  <option value="general" className="bg-slate-900 text-white">General Reservoir</option>
                </>
              )}
              <option value="transfers" className="bg-slate-900 text-white">Pony Network</option>
              {filteredGraphPonies.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Overlapping Filters */}
          <div 
            className="flex bg-slate-950/90 p-1 rounded-xl border text-xs gap-1 theme-border-hover"
            style={{ borderColor: theme.borderColor }}
          >
            <button
              type="button"
              onClick={() => toggleFilter('cumulative')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all border ${
                activeFilters.cumulative
                  ? 'shadow-md ring-1 ring-white/20'
                  : 'hover:opacity-100 opacity-60'
              }`}
              style={
                activeFilters.cumulative
                  ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }
                  : { backgroundColor: 'transparent', color: theme.textColor, borderColor: 'transparent' }
              }
              title="Toggle Total Love Harvest curve"
            >
              <span>Total Love</span>
            </button>

            <button
              type="button"
              onClick={() => toggleFilter('daily_income')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all border ${
                activeFilters.daily_income
                  ? 'shadow-md ring-1 ring-white/20'
                  : 'hover:opacity-100 opacity-60'
              }`}
              style={
                activeFilters.daily_income
                  ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }
                  : { backgroundColor: 'transparent', color: theme.textColor, borderColor: 'transparent' }
              }
              title="Toggle Daily Love curve"
            >
              <span>Daily Love</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => toggleFilter('magical_power')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all border ${
                  activeFilters.magical_power
                    ? 'shadow-md ring-1 ring-white/20'
                    : 'hover:opacity-100 opacity-60'
                }`}
                style={
                  activeFilters.magical_power
                    ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }
                    : { backgroundColor: 'transparent', color: theme.textColor, borderColor: 'transparent' }
                }
                title="Toggle Magical Power Yield curve"
              >
                <span>Magical Power</span>
              </button>
            )}
          </div>

          {/* Day Span Selector */}
          <div 
            className="flex bg-slate-950/80 p-1 rounded-xl border text-xs theme-border-hover"
            style={{ borderColor: theme.borderColor }}
          >
            {[7, 14, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDaysSpan(days)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all border ${
                  daysSpan === days
                    ? 'font-bold shadow-md'
                    : 'hover:opacity-100 opacity-60'
                }`}
                style={
                  daysSpan === days
                    ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }
                    : { backgroundColor: 'transparent', color: theme.textColor, borderColor: 'transparent' }
                }
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-4">
        <div 
          className="lg:col-span-3 relative bg-slate-950/60 rounded-xl p-4 border overflow-hidden theme-border-hover"
          style={{ borderColor: theme.borderColor }}
        >
          {/* Legend & Active Value Tooltip */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-2 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium" style={{ color: theme.textColor }}>
              {activeFilters.cumulative && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.graphCumulativeColor || '#ec4899' }} />
                  <span className="font-semibold">Total Love (Units)</span>
                </div>
              )}
              {activeFilters.daily_income && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.graphDailyColor || '#a855f7' }} />
                  <span className="font-semibold">Daily (Love/day)</span>
                </div>
              )}
              {isAdmin && activeFilters.magical_power && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.graphMagicalColor || '#c084fc' }} />
                  <span className="font-semibold">Magical Power (MP)</span>
                </div>
              )}
            </div>

            {hoveredPoint ? (
              <div 
                className="bg-slate-900 border px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-3 shadow-lg"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
              >
                <span className="font-bold opacity-80">📅 {hoveredPoint.date}:</span>
                {activeFilters.cumulative && (
                  <span className="font-semibold" style={{ color: theme.graphCumulativeColor || '#ec4899' }}>
                    ♥ {formatLoveNumber(hoveredPoint.cumulativeLove)}
                  </span>
                )}
                {activeFilters.daily_income && (
                  <span className="font-semibold" style={{ color: theme.graphDailyColor || '#a855f7' }}>
                    ⚡ +{formatLoveNumber(hoveredPoint.dailyLove)}/d
                  </span>
                )}
                {isAdmin && activeFilters.magical_power && (
                  <span className="font-semibold" style={{ color: theme.graphMagicalColor || '#c084fc' }}>
                    ✨ {formatLoveNumber(hoveredPoint.magicalPower)} MP
                  </span>
                )}
              </div>
            ) : (
              <div className="text-[11px] opacity-60 italic" style={{ color: theme.textColor }}>Hover chart to inspect</div>
            )}
          </div>

          {/* SVG Graph View */}
          <div 
            className="relative w-full aspect-[16/6] bg-slate-900/40 rounded-lg overflow-hidden border theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padding.top + graphHeight * ratio;
                const val = Math.round(maxValue * (1 - ratio));
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="rgba(148, 163, 184, 0.7)"
                      fontSize="9"
                      textAnchor="end"
                    >
                      {formatLoveNumber(val)}
                    </text>
                  </g>
                );
              })}

              {/* CURVE 1: Cumulative Total Love */}
              {activeFilters.cumulative && cumulativeLinePath && (
                <g>
                  <path 
                    d={cumulativeLinePath} 
                    fill="none" 
                    stroke={theme.graphCumulativeColor || '#ec4899'} 
                    strokeWidth="2.5" 
                  />
                </g>
              )}

              {/* CURVE 2: Daily Income */}
              {activeFilters.daily_income && dailyLinePath && (
                <g>
                  <path 
                    d={dailyLinePath} 
                    fill="none" 
                    stroke={theme.graphDailyColor || '#a855f7'} 
                    strokeWidth="2" 
                    strokeDasharray="4 2" 
                  />
                </g>
              )}

              {/* CURVE 3: Magical Power - Admin Only */}
              {isAdmin && activeFilters.magical_power && magicalLinePath && (
                <g>
                  <path 
                    d={magicalLinePath} 
                    fill="none" 
                    stroke={theme.graphMagicalColor || '#c084fc'} 
                    strokeWidth="2" 
                  />
                </g>
              )}

              {/* Invisible Hover Rect over graph area */}
              <rect
                x={padding.left}
                y={padding.top}
                width={graphWidth}
                height={graphHeight}
                fill="transparent"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left) / rect.width;
                  const idx = Math.min(
                    timelineData.length - 1,
                    Math.max(0, Math.floor(relX * timelineData.length))
                  );
                  setHoveredPoint(timelineData[idx] || null);
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </svg>
          </div>
        </div>

        {/* Right Side: Top Love Rankings */}
        <div 
          className="bg-slate-950/60 rounded-xl p-4 border flex flex-col justify-between theme-border-hover"
          style={{ borderColor: theme.borderColor }}
        >
          <div>
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between">
                <h4 
                  className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: theme.textColor }}
                >
                  Top Love Rankings
                </h4>
              </div>

              {/* Sort & Search Controls */}
              <div className="flex flex-col gap-1.5">
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 absolute left-2 pointer-events-none" style={{ color: theme.textColor }} />
                  <input
                    type="text"
                    value={topSearchQuery}
                    onChange={(e) => setTopSearchQuery(e.target.value)}
                    placeholder="Search rankings..."
                    className="w-full bg-slate-950 border rounded-lg pl-7 pr-6 py-1 text-[11px] placeholder-slate-400 focus:outline-none theme-border-hover"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
                  />
                  {topSearchQuery && (
                    <button
                      onClick={() => setTopSearchQuery('')}
                      className="absolute right-2 hover:opacity-100 opacity-70"
                      style={{ color: theme.textColor }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={topSortKey}
                  onChange={(e) => setTopSortKey(e.target.value as PonySortKey)}
                  className="w-full bg-slate-950 border rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none cursor-pointer theme-border-hover"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                >
                  {PONY_SORT_OPTIONS.filter(opt => isAdmin || (!opt.value.includes('Produced') && !opt.value.includes('dailyProduced') && !opt.value.includes('totalLoved'))).map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {topEarners.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-60" style={{ color: theme.textColor }}>
                No ponies matched your filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {topEarners.map(({ pony, dailyRate, dailyReceived }, idx) => (
                  <div
                    key={pony.id}
                    className="flex items-center justify-between bg-slate-900/80 px-2.5 py-2 rounded-lg border text-xs transition-all theme-border-hover"
                    style={{ borderColor: theme.borderColor }}
                  >
                    <button
                      onClick={() => onNavigateToPony(pony.id)}
                      className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <span className="opacity-60 font-bold text-[10px]" style={{ color: theme.textColor }}>#{idx + 1}</span>
                      <PonyAvatar pony={pony} theme={theme} size="sm" />
                      <strong className="truncate max-w-[80px] hover:underline" style={{ color: theme.textColor }}>{pony.name}</strong>
                    </button>
                    <div className="text-right">
                      <span className="font-bold block text-[11px]" style={{ color: theme.textColor }}>+{dailyReceived}/d rec</span>
                      {isAdmin && (
                        <span className="opacity-60 text-[9px] block" style={{ color: theme.textColor }}>+{dailyRate}/d cap</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div 
            className="pt-3 border-t text-[10px] text-center opacity-70"
            style={{ borderColor: theme.borderColor, color: theme.textColor }}
          >
            {daysSpan}-day projection history
          </div>
        </div>
      </div>
    </div>
  );
};
