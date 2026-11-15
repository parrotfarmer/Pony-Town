import React, { useState, useMemo } from 'react';
import { PonyNode, WebConnection, CustomStatus, LoveSplitAllocation } from '../types/pony';
import { 
  calculateDaysActive, 
  calculateLoveFlowStats, 
  calculatePonyDailyRate,
  getNormalizedPonySplits 
} from '../utils/calculations';
import { useSettings } from '../context/SettingsContext';
import { X, Search, PieChart, Unlink } from 'lucide-react';
import { PonyAvatar } from './PonyAvatar';

interface ConnectedPoniesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pony: PonyNode;
  connections: WebConnection[];
  allPonies: PonyNode[];
  targetDate: string;
  statuses: CustomStatus[];
  livePulseTick?: number;
  onNavigateToPony: (id: string) => void;
  onUpdatePony?: (pony: PonyNode) => void;
  onDeleteConnection?: (connId: string) => void;
  isAdmin?: boolean;
  isOwner?: boolean;
}

export const ConnectedPoniesModal: React.FC<ConnectedPoniesModalProps> = ({
  isOpen,
  onClose,
  pony,
  connections,
  allPonies,
  targetDate,
  statuses,
  livePulseTick = 0,
  onNavigateToPony,
  onUpdatePony,
  onDeleteConnection,
  isAdmin = false,
  isOwner = false,
}) => {
  const { theme } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [disconnectingConnId, setDisconnectingConnId] = useState<string | null>(null);
  const [disconnectCheckboxChecked, setDisconnectCheckboxChecked] = useState(false);

  if (!isOpen || !pony) return null;

  // Filter all connections for this pony where the connected pony exists
  const ponyIdSet = new Set(allPonies.map((p) => p.id));
  const ponyConnections = connections.filter(
    (c) =>
      (c.source === pony.id && ponyIdSet.has(c.target)) ||
      (c.target === pony.id && ponyIdSet.has(c.source))
  );

  const filteredConnections = ponyConnections.filter((conn) => {
    if (!searchQuery.trim()) return true;
    const otherId = conn.source === pony.id ? conn.target : conn.source;
    const otherPony = allPonies.find((p) => p.id === otherId);
    if (!otherPony) return false;
    const q = searchQuery.trim().toLowerCase();
    return (
      (otherPony.name || '').toLowerCase().includes(q) ||
      (otherPony.species || '').toLowerCase().includes(q) ||
      (otherPony.element || '').toLowerCase().includes(q) ||
      (otherPony.ownerName || '').toLowerCase().includes(q)
    );
  });

  // Love flow stats for inflow/outflow calculations
  const flowStats = calculateLoveFlowStats(allPonies, targetDate, statuses, connections, livePulseTick);
  const currentPonyFlow = flowStats.find((s) => s.pony.id === pony.id);

  const dailyRate = calculatePonyDailyRate(pony, statuses);
  const allocatableCapacity = Math.round(dailyRate / 2);
  const currentSplits = getNormalizedPonySplits(pony, statuses, connections);
  const totalAllocated = currentSplits.reduce((sum, s) => sum + s.amount, 0);
  const remainingAllocation = Math.max(0, allocatableCapacity - totalAllocated);

  const handleUpdateSplitAmount = (recipientId: string, newAmount: number) => {
    if (!onUpdatePony) return;
    const otherAllocations = currentSplits
      .filter(s => s.recipientId !== recipientId)
      .reduce((sum, s) => sum + s.amount, 0);
    const maxAllowed = Math.max(0, allocatableCapacity - otherAllocations);
    const clampedAmount = Math.max(0, Math.min(maxAllowed, newAmount));

    const updated = (pony.loveSplits || []).map(s =>
      s.recipientId === recipientId ? { ...s, amount: clampedAmount } : s
    );

    if (!updated.some(s => s.recipientId === recipientId)) {
      updated.push({ recipientId, amount: clampedAmount });
    }

    onUpdatePony({
      ...pony,
      loveSplits: updated,
      isCustomSplits: true,
    });
  };

  const handleSplitEvenly = () => {
    if (!onUpdatePony || currentSplits.length === 0) return;
    let updated: LoveSplitAllocation[];
    if (currentSplits.length === 1) {
      updated = [{ recipientId: currentSplits[0].recipientId, amount: allocatableCapacity }];
    } else {
      const share = Math.floor(allocatableCapacity / currentSplits.length);
      updated = currentSplits.map((s, i) => ({
        ...s,
        amount: i === currentSplits.length - 1 ? allocatableCapacity - share * (currentSplits.length - 1) : share,
      }));
    }
    onUpdatePony({
      ...pony,
      loveSplits: updated,
      isCustomSplits: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 theme-border-hover"
        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3.5 border-b bg-slate-950/80"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <div className="flex items-center gap-3">
            <PonyAvatar pony={pony} theme={theme} size="md" />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Connected Ponies ({ponyConnections.length})</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Allocation Bar & Split Button Header Bar (Owner or Admin Only) */}
        {(isAdmin || isOwner) && (
          <div 
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-950/90 border-b"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: theme.textColor }}>
                Allocations Remaining: <strong className="font-extrabold" style={{ color: theme.textColor }}>{remainingAllocation}</strong> / {allocatableCapacity} L/d
              </span>
              <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden shrink-0 border" style={{ borderColor: theme.borderColor }}>
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${allocatableCapacity > 0 ? Math.min(100, (totalAllocated / allocatableCapacity) * 100) : 0}%` }}
                />
              </div>
            </div>

            {ponyConnections.length > 0 && (
              <button
                type="button"
                onClick={handleSplitEvenly}
                className="px-3 py-1 rounded-xl font-bold text-xs shadow-md border transition-all cursor-pointer flex items-center gap-1.5 theme-border-hover"
                style={{ 
                  backgroundColor: theme.buttonColor, 
                  color: theme.buttonTextColor, 
                  borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
                }}
                title="Split allocatable capacity evenly across connected ponies"
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
            )}
          </div>
        )}

        {/* Search Bar for Connected Ponies */}
        {ponyConnections.length > 0 && (
          <div 
            className="px-6 py-2 bg-slate-950/50 border-b flex items-center"
            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
          >
            <div className="relative w-full flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 pointer-events-none opacity-60" style={{ color: theme.textColor }} />
              <input
                type="text"
                placeholder="Search connected ponies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border rounded-xl pl-8 pr-8 py-1.5 text-xs focus:outline-none theme-border-hover"
                style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 opacity-60 hover:opacity-100"
                  style={{ color: theme.textColor }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body: List of Connected Ponies (Less tall cards) */}
        <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto max-h-[65vh] text-xs">
          {filteredConnections.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800">
              {searchQuery ? 'No connected ponies match search.' : 'No connected ponies linked yet.'}
            </div>
          ) : (
            filteredConnections.map((conn) => {
              const otherId = conn.source === pony.id ? conn.target : conn.source;
              const otherPony = allPonies.find((p) => p.id === otherId);
              if (!otherPony) return null;

              const relStartDate = conn.startDate || targetDate || new Date().toISOString().split('T')[0];
              const relDays = calculateDaysActive(relStartDate, targetDate, conn.customDaysOverride);

              const split = currentSplits.find((s) => s.recipientId === otherPony.id);
              const splitAmount = split?.amount || 0;
              const pct = allocatableCapacity > 0 ? Math.round((splitAmount / allocatableCapacity) * 100) : 0;
              const isSecretAllowed = (pony.allowedViewerPonyIds || []).includes(otherPony.id);
              const isDisconnecting = disconnectingConnId === conn.id;

              const donorInfo = currentPonyFlow?.donors.find((d) => d.donor.id === otherPony.id);
              const receivedDaily = donorInfo?.daily || 0;
              const receivedTotal = donorInfo?.total || 0;
              const givenDaily = splitAmount;
              const givenTotal = Math.round(splitAmount * relDays);
              const netTotal = receivedTotal - givenTotal;
              const netDaily = receivedDaily - givenDaily;

              return (
                <div
                  key={conn.id}
                  className="p-3 bg-slate-950/70 rounded-xl border hover:border-pink-500/40 transition-all theme-border-hover space-y-2"
                  style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Avatar + Identity (Icon and Name only) */}
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToPony(otherPony.id);
                        }}
                        className="cursor-pointer hover:scale-105 transition-transform shrink-0"
                        title={`View ${otherPony.name}'s profile`}
                      >
                        <PonyAvatar pony={otherPony} theme={theme} size="md" />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onNavigateToPony(otherPony.id);
                            }}
                            className="text-xs font-extrabold truncate hover:underline text-left cursor-pointer"
                            style={{ color: theme.textColor }}
                          >
                            {otherPony.name}
                          </button>
                        </div>
                        {(isAdmin || isOwner) && (
                          <div className="text-[10px] opacity-70 mt-0.5" style={{ color: theme.textColor }}>
                            Age: <strong>{relDays}d</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Center: Trade Deficit (Owner & Admin only, theme compliant, compact) */}
                    {(isAdmin || isOwner) && (
                      <div 
                        className="text-[10px] bg-slate-900/90 px-2.5 py-1 rounded-xl border space-y-0.5 w-48 shrink-0"
                        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-75" style={{ color: theme.textColor }}>Received:</span>
                          <span className="font-bold" style={{ color: theme.textColor }}>+{receivedDaily}/d</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-75" style={{ color: theme.textColor }}>Given:</span>
                          <span className="font-bold" style={{ color: theme.textColor }}>-{givenDaily}/d</span>
                        </div>
                        <div 
                          className="flex items-center justify-between gap-2 border-t pt-0.5"
                          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                        >
                          <span className="opacity-75" style={{ color: theme.textColor }}>Trade Deficit:</span>
                          <span className="font-bold" style={{ color: theme.textColor }}>
                            {netDaily >= 0 ? `+${netDaily}` : netDaily}/d
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Right: Allocation Rate Setting + Secret Permissions + Disconnect + Profile */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        {/* Allocation input */}
                        {(isAdmin || isOwner) && (
                          <div 
                            className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border text-xs"
                            style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
                          >
                            <span className="text-[10px] font-semibold" style={{ color: theme.textColor }}>{pct}%</span>
                            <input
                              type="number"
                              min="0"
                              max={allocatableCapacity}
                              value={splitAmount}
                              onChange={(e) => handleUpdateSplitAmount(otherPony.id, Number(e.target.value) || 0)}
                              className="w-14 bg-slate-950 border rounded px-1 py-0.5 font-bold text-center text-xs focus:outline-none"
                              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
                            />
                            <span className="text-[10px] opacity-70" style={{ color: theme.textColor }}>L/d</span>
                          </div>
                        )}

                        {/* Disconnect button */}
                        {(isAdmin || isOwner) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isDisconnecting) {
                                setDisconnectingConnId(null);
                                setDisconnectCheckboxChecked(false);
                              } else {
                                setDisconnectingConnId(conn.id);
                                setDisconnectCheckboxChecked(false);
                              }
                            }}
                            className={`p-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                              isDisconnecting
                                ? 'bg-red-800 text-white border-red-500'
                                : 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border-red-800/40'
                            }`}
                            title="Disconnect relationship"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Profile button */}
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateToPony(otherPony.id);
                          }}
                          className="px-2.5 py-1 rounded-lg font-bold text-xs border transition-all shadow theme-border-hover hover:scale-105 cursor-pointer"
                          style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                          title="Open profile"
                        >
                          <span>Profile</span>
                        </button>
                      </div>

                      {/* Secret Permissions Checkbox (Owner or Admin Only) - Positioned directly below the allocation rate */}
                      {(isAdmin || isOwner) && (
                        <label className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                          isSecretAllowed 
                            ? 'bg-pink-950/40 border-pink-500/50 text-white' 
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isSecretAllowed}
                            onChange={(e) => {
                              const currentAllowed = pony.allowedViewerPonyIds || [];
                              const updatedAllowed = e.target.checked
                                ? [...currentAllowed, otherPony.id]
                                : currentAllowed.filter((id) => id !== otherPony.id);
                              onUpdatePony?.({ ...pony, allowedViewerPonyIds: updatedAllowed });
                            }}
                            className="rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 w-3 h-3"
                          />
                          <span className="font-semibold whitespace-nowrap">Secret Permissions</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Disconnect Inline Confirmation Panel */}
                  {isDisconnecting && (
                    <div className="p-2.5 bg-red-950/70 border border-red-500/40 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-red-200 font-semibold">
                        <input
                          type="checkbox"
                          checked={disconnectCheckboxChecked}
                          onChange={(e) => setDisconnectCheckboxChecked(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-red-700 bg-slate-900 text-red-500 focus:ring-red-500"
                        />
                        <span>Confirm disconnecting {otherPony.name}?</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={!disconnectCheckboxChecked}
                          onClick={() => {
                            onDeleteConnection?.(conn.id);
                            setDisconnectingConnId(null);
                            setDisconnectCheckboxChecked(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            disconnectCheckboxChecked
                              ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/50 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDisconnectingConnId(null);
                            setDisconnectCheckboxChecked(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 bg-slate-950 border-t flex justify-end"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold text-xs border cursor-pointer theme-border-hover"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
