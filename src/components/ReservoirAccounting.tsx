import React, { useMemo } from 'react';
import { PonyNode, CustomStatus, WebConnection, EditableHeaders } from '../types/pony';
import { 
  calculateLoveFlowStats,
  calculateScopedMetrics,
  formatThaumPower 
} from '../utils/calculations';
import { useSettings } from '../context/SettingsContext';
import { PonyAvatar } from './PonyAvatar';

interface ReservoirAccountingProps {
  ponies: PonyNode[];
  connections: WebConnection[];
  statuses: CustomStatus[];
  targetDate: string;
  reservoirDeductions: number;
  livePulseTick?: number;
  onNavigateToPony: (id: string) => void;
  loveToPowerRatio?: number;
  headers?: EditableHeaders;
  archivedLove?: number;
}

export const ReservoirAccounting: React.FC<ReservoirAccountingProps> = ({
  ponies,
  connections,
  statuses,
  targetDate,
  reservoirDeductions,
  livePulseTick = 0,
  onNavigateToPony,
  loveToPowerRatio = 3.5,
  headers,
  archivedLove = 0,
}) => {
  const { theme } = useSettings();

  const {
    networkMetrics,
    thaumInfo,
    inflowDetails,
    storePurchasesInflow,
    payoutDetails,
    totalInflowDaily,
    totalInflowAccumulated,
    totalPayoutsDaily,
    totalPayoutsAccumulated,
    totalTreats,
    netDaily,
    netAccumulated,
    totalNetworkDailyRate,
    surplusNonOwnedLove,
  } = useMemo(() => {
    // 1. Full Network Metrics
    const metrics = calculateScopedMetrics(
      ponies,
      connections,
      loveToPowerRatio,
      targetDate,
      statuses,
      'all',
      livePulseTick,
      archivedLove,
      reservoirDeductions
    );
    const thaum = formatThaumPower(metrics.magicalPower);

    // 2. Base Reservoir Inflow (single O(N + E) pass via cached flow stats)
    const flowStats = calculateLoveFlowStats(ponies, targetDate, statuses, connections, livePulseTick);
    let inflowDaily = 0;
    let inflowAccum = 0;
    let networkDailyRate = 0;
    let storePurchases = 0;
    let treatsSum = 0;

    const inflows = flowStats
      .map((stat) => {
        const p = stat.pony;
        const daily = stat.dailyProduced;
        networkDailyRate += daily;
        storePurchases += p.totalLoveSpent || 0;
        treatsSum += p.treatsReceived || 0;

        const accum = stat.totalProduced;
        const allocatedDaily = stat.allocatedDaily;
        const unallocatedDaily = Math.max(0, daily - allocatedDaily);
        const ratio = daily > 0 ? unallocatedDaily / daily : 1;
        const unallocatedAccum = Math.round(accum * ratio);

        inflowDaily += unallocatedDaily;
        inflowAccum += unallocatedAccum;

        return {
          pony: p,
          dailyContribution: unallocatedDaily,
          accumulatedContribution: unallocatedAccum,
          isAllocated: allocatedDaily > 0,
          allocationPct: daily > 0 ? (allocatedDaily / daily) * 100 : 0,
        };
      })
      .filter((d) => d.dailyContribution > 0 || d.accumulatedContribution > 0)
      .sort((a, b) => b.dailyContribution - a.dailyContribution);

    inflowAccum += storePurchases;

    // 3. Payouts to Ponies
    let payoutsDaily = 0;
    let payoutsAccum = 0;

    const payouts = ponies
      .map((p) => {
        const payoutPct = (p.payoutPercentage || 0) / 100;
        const dailyPayout = inflowDaily * payoutPct;
        const accumPayout = inflowAccum * payoutPct;

        payoutsDaily += dailyPayout;
        payoutsAccum += accumPayout;

        return {
          pony: p,
          pct: p.payoutPercentage || 0,
          dailyPayout,
          accumPayout,
        };
      })
      .filter((d) => d.pct > 0)
      .sort((a, b) => b.dailyPayout - a.dailyPayout);

    const nDaily = inflowDaily - payoutsDaily;
    const nAccum = inflowAccum - payoutsAccum - treatsSum;

    return {
      networkMetrics: metrics,
      thaumInfo: thaum,
      inflowDetails: inflows,
      storePurchasesInflow: storePurchases,
      payoutDetails: payouts,
      totalInflowDaily: inflowDaily,
      totalInflowAccumulated: inflowAccum,
      totalPayoutsDaily: payoutsDaily,
      totalPayoutsAccumulated: payoutsAccum,
      totalTreats: treatsSum,
      netDaily: nDaily,
      netAccumulated: nAccum,
      totalNetworkDailyRate: networkDailyRate,
      surplusNonOwnedLove: Math.max(0, Math.round(nAccum)),
    };
  }, [ponies, connections, loveToPowerRatio, targetDate, statuses, livePulseTick, archivedLove, reservoirDeductions]);

  return (
    <div 
      className="bg-slate-900/80 border rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-6 theme-border-hover"
      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
    >
      {/* Title & Surplus Badge */}
      <div 
        className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
      >
        <h2 className="text-xl font-black tracking-tight" style={{ color: theme.textColor }}>
          Accounting
        </h2>

        {/* Small Box: Surplus Non-Owned Love & Network Daily Rate */}
        <div 
          className="flex items-center gap-4 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border text-xs"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
        >
          <div>
            <span className="opacity-70 text-[10px] block uppercase font-bold">Surplus Non-Owned Love</span>
            <span className="font-extrabold text-sm">{surplusNonOwnedLove.toLocaleString()} Love</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div>
            <span className="opacity-70 text-[10px] block uppercase font-bold">Network Daily Rate</span>
            <span className="font-extrabold text-sm">+{Math.round(totalNetworkDailyRate).toLocaleString()} L/d</span>
          </div>
        </div>
      </div>

      {/* 4 Core Network Metrics Cards (Love Rate, Total Love, Total Overall Love, Magic Power) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Love Rate */}
        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {headers?.cardInflow || 'Love Rate'}
            </span>
          </div>
          <div className="text-2xl font-black tracking-tight" style={{ color: theme.textColor }}>
            +{networkMetrics.inflowDaily.toLocaleString()} <span className="text-xs font-normal opacity-60">units / day</span>
          </div>
          <div className="text-[11px] opacity-70 mt-1" style={{ color: theme.textColor }}>
            Total network daily production
          </div>
        </div>

        {/* 2. Total Love (Spendable) */}
        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {headers?.cardHarvested || 'Total Love'}
            </span>
          </div>
          <div className="text-2xl font-black tracking-tight" style={{ color: theme.textColor }}>
            {networkMetrics.totalSpendable.toLocaleString()} <span className="text-xs font-normal opacity-60">Love</span>
          </div>
          <div className="text-[11px] opacity-70 mt-1" style={{ color: theme.textColor }}>
            Current spendable love reserve
          </div>
        </div>

        {/* 3. Total Overall Love */}
        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {headers?.cardOverall || 'Total Overall Love'}
            </span>
          </div>
          <div className="text-2xl font-black tracking-tight" style={{ color: theme.textColor }}>
            {networkMetrics.totalOverall.toLocaleString()} <span className="text-xs font-normal opacity-60">Love</span>
          </div>
          <div className="text-[11px] opacity-70 mt-1" style={{ color: theme.textColor }}>
            Cumulative all-time love yielded
          </div>
        </div>

        {/* 4. Magic Power */}
        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center justify-between mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {headers?.cardMagicalPower || 'Magic Power'}
            </span>
          </div>
          <div className="text-2xl font-black tracking-tight" style={{ color: theme.textColor }}>
            {thaumInfo.value} <span className="text-xs font-normal opacity-60">{thaumInfo.unit}</span>
          </div>
          <div className="text-[11px] opacity-70 mt-1" style={{ color: theme.textColor }}>
            {networkMetrics.magicalPower.toLocaleString()} Thaums converted
          </div>
        </div>
      </div>

      {/* Reservoir Flow Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Gross Inflow</span>
          </div>
          <div className="text-xl font-black" style={{ color: theme.textColor }}>
            +{Math.round(totalInflowDaily).toLocaleString()} <span className="text-xs font-normal opacity-60">L/d</span>
          </div>
          <div className="text-xs opacity-80" style={{ color: theme.textColor }}>
            {Math.round(totalInflowAccumulated).toLocaleString()} total inflow
          </div>
        </div>

        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Payouts</span>
          </div>
          <div className="text-xl font-black" style={{ color: theme.textColor }}>
            -{Math.round(totalPayoutsDaily).toLocaleString()} <span className="text-xs font-normal opacity-60">L/d</span>
          </div>
          <div className="text-xs opacity-80" style={{ color: theme.textColor }}>
            {Math.round(totalPayoutsAccumulated + totalTreats).toLocaleString()} total outflows
          </div>
        </div>

        <div 
          className="bg-slate-950/70 p-4 rounded-xl border theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: theme.textColor }}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Net Balance</span>
          </div>
          <div className="text-xl font-black" style={{ color: theme.textColor }}>
            +{Math.round(netDaily).toLocaleString()} <span className="text-xs font-normal opacity-60">L/d</span>
          </div>
          <div className="text-xs opacity-80" style={{ color: theme.textColor }}>
            {Math.round(netAccumulated).toLocaleString()} current reservoir level
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inflow Sources */}
        <div className="space-y-3">
          <h3 
            className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
            style={{ color: theme.textColor }}
          >
            Inflow Contributions
          </h3>
          <div 
            className="bg-slate-950/60 rounded-xl overflow-hidden border theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead 
                  className="sticky top-0 bg-slate-900 font-bold uppercase tracking-tighter border-b"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                >
                  <tr>
                    <th className="px-4 py-2">Source Pony</th>
                    <th className="px-4 py-2 text-right">Contrib / Day</th>
                    <th className="px-4 py-2 text-right">Total Contrib</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {inflowDetails.map(d => (
                    <tr key={d.pony.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <PonyAvatar pony={d.pony} theme={theme} size="sm" />
                          <div>
                            <button
                              onClick={() => onNavigateToPony(d.pony.id)}
                              className="font-bold hover:underline text-left block"
                              style={{ color: theme.textColor }}
                            >
                              {d.pony.name}
                            </button>
                            <div className="text-[9px] opacity-60" style={{ color: theme.textColor }}>
                              {Math.round(100 - d.allocationPct)}% to Reservoir
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{ color: theme.textColor }}>
                        +{Math.round(d.dailyContribution).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right opacity-80" style={{ color: theme.textColor }}>
                        {d.accumulatedContribution.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {storePurchasesInflow > 0 && (
                    <tr className="bg-slate-900/60 font-bold">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center text-amber-500 text-[10px]">
                            🛒
                          </div>
                          <div style={{ color: theme.textColor }}>Exchange Purchases (All Ponies)</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: theme.textColor }}>-</td>
                      <td className="px-4 py-3 text-right" style={{ color: theme.textColor }}>
                        +{storePurchasesInflow.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Outflow / Payouts */}
        <div className="space-y-3">
          <h3 
            className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
            style={{ color: theme.textColor }}
          >
            Outflow Payouts & Treats
          </h3>
          <div 
            className="bg-slate-950/60 rounded-xl overflow-hidden border theme-border-hover"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead 
                  className="sticky top-0 bg-slate-900 font-bold uppercase tracking-tighter border-b"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                >
                  <tr>
                    <th className="px-4 py-2">Recipient Pony</th>
                    <th className="px-4 py-2 text-center">% Rate</th>
                    <th className="px-4 py-2 text-right">Payout / Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {payoutDetails.map(d => (
                    <tr key={d.pony.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <PonyAvatar pony={d.pony} theme={theme} size="sm" />
                          <button
                            onClick={() => onNavigateToPony(d.pony.id)}
                            className="font-bold hover:underline text-left"
                            style={{ color: theme.textColor }}
                          >
                            {d.pony.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold" style={{ color: theme.textColor }}>
                        {d.pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{ color: theme.textColor }}>
                        -{Math.round(d.dailyPayout).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {ponies.filter(p => (p.treatsReceived || 0) > 0).map(p => (
                    <tr key={`treat-${p.id}`} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <PonyAvatar pony={p} theme={theme} size="sm" />
                          <button
                            onClick={() => onNavigateToPony(p.id)}
                            className="font-bold hover:underline text-left"
                            style={{ color: theme.textColor }}
                          >
                            {p.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center italic opacity-80" style={{ color: theme.textColor }}>Treat Grant</td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{ color: theme.textColor }}>+{p.treatsReceived?.toLocaleString()} (One-time)</td>
                    </tr>
                  ))}
                  {payoutDetails.length === 0 && !ponies.some(p => (p.treatsReceived || 0) > 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center opacity-60 italic" style={{ color: theme.textColor }}>
                        No active payouts or treats recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
