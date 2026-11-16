import React, { useState, useMemo } from 'react';
import { 
  PonyNode, 
  WebConnection, 
  CustomStatus, 
  EditableHeaders, 
  DEFAULT_PONY_CAPACITY 
} from '../types/pony';
import { useSettings } from '../context/SettingsContext';
import { 
  calculateDaysActive, 
  calculatePonyDailyRate, 
  calculatePonyAccumulatedLove,
  sortPonies,
  filterPoniesBySearch,
  PONY_SORT_OPTIONS,
  PonySortKey
} from '../utils/calculations';
import { resizeImageToMax } from '../utils/imageUtils';
import { 
  X, 
  Plus, 
  Trash2, 
  Copy, 
  Sliders, 
  Sparkles,
  Heart,
  ArrowRight,
  Search,
  Eye,
  Upload
} from 'lucide-react';

interface BulkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ponies: PonyNode[];
  connections?: WebConnection[];
  onUpdatePony: (pony: PonyNode) => void;
  onDeletePony: (id: string) => void;
  onAddPony: (pony: PonyNode) => void;
  targetDate: string;
  statuses: CustomStatus[];
  headers: EditableHeaders;
  onUpdateHeaders: (headers: EditableHeaders) => void;
  onOpenStatusManager: () => void;
  isAdmin: boolean;
  onGiveTreat: (ponyId: string, amount: number) => void;
  onUpdatePayout: (ponyId: string, percentage: number) => void;
  onTogglePonyAdmin: (ponyId: string, isAppAdmin: boolean) => void;
  onOpenAdminPopup?: (type: any, title: string, message: string, confirmLabel: string, onConfirm: (val?: any) => void, entityName?: string) => void;
  onNavigateToPony: (id: string) => void;
}

export const BulkEditorModal: React.FC<BulkEditorModalProps> = ({
  isOpen,
  onClose,
  ponies,
  connections = [],
  onUpdatePony,
  onDeletePony,
  onAddPony,
  targetDate,
  statuses,
  headers,
  onUpdateHeaders,
  onOpenStatusManager,
  isAdmin: _isAdmin,
  onGiveTreat,
  onUpdatePayout,
  onTogglePonyAdmin,
  onOpenAdminPopup,
  onNavigateToPony,
}) => {
  const { theme, adminSettings } = useSettings();
  const [sortKey, setSortKey] = useState<PonySortKey>('name_asc');
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const sortedAndFilteredPonies = useMemo(() => {
    const filtered = filterPoniesBySearch(ponies, modalSearchQuery);
    return sortPonies(filtered, sortKey, connections, statuses, targetDate);
  }, [ponies, modalSearchQuery, sortKey, connections, statuses, targetDate]);

  if (!isOpen) return null;

  const handleDuplicate = (pony: PonyNode) => {
    const newId = `pony-${Date.now().toString().slice(-4)}`;
    const cloned: PonyNode = {
      ...pony,
      id: newId,
      name: `${pony.name} (Copy)`,
      x: pony.x + 35,
      y: pony.y + 35,
    };
    onAddPony(cloned);
  };

  const handleQuickAdd = () => {
    const count = ponies.length + 1;
    const newPony: PonyNode = {
      id: `pony-${Date.now().toString().slice(-4)}`,
      name: `Pony ${count}`,
      species: 'Pegasus',
      element: 'Harmonic Love',
      location: 'Ponyville',
      color: '#ec4899',
      accentColor: '#f472b6',
      avatarIcon: '💖',
      notes: '',
      x: 450 + (Math.random() - 0.5) * 200,
      y: 300 + (Math.random() - 0.5) * 150,
      loveRatePerDay: DEFAULT_PONY_CAPACITY,
      startDate: new Date().toISOString().split('T')[0],
      status: statuses[0]?.id || 'active',
      targetRecipientId: null,
    };
    onAddPony(newPony);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-7xl max-h-[92vh] bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Modal Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-slate-950/60"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-3">
            <div>
              <input
                type="text"
                value={headers.matrixTitle}
                onChange={(e) => onUpdateHeaders({ ...headers, matrixTitle: e.target.value })}
                className="text-lg font-bold bg-transparent border-b border-transparent focus:outline-none"
                style={{ color: theme.textColor }}
                title="Click to rename"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenStatusManager}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
              Statuses
            </button>

            <button
              onClick={handleQuickAdd}
              className="px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md transition-all border cursor-pointer theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Pony
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md relative">
              <Search className="w-3.5 h-3.5 absolute left-3 pointer-events-none" style={{ color: theme.textColor }} />
              <input
                type="text"
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                placeholder="Search ponies in full table..."
                className="w-full bg-slate-950 border rounded-xl pl-9 pr-8 py-1.5 text-xs placeholder-slate-400 focus:outline-none shadow-inner theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
              {modalSearchQuery && (
                <button
                  onClick={() => setModalSearchQuery('')}
                  className="absolute right-2.5 hover:opacity-100 opacity-70"
                  style={{ color: theme.textColor }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium opacity-70" style={{ color: theme.textColor }}>Sort by:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as PonySortKey)}
                className="bg-slate-950 border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              >
                {PONY_SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div 
            className="border rounded-xl bg-slate-950/70 theme-border-hover"
            style={{ borderColor: theme.borderColor }}
          >
            <table className="min-w-max text-left text-xs" style={{ color: theme.textColor }}>
              <thead 
                className="bg-slate-900/90 uppercase tracking-wider text-[11px] border-b"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              >
                <tr>
                  <th className="py-3 px-3 font-semibold text-left whitespace-nowrap">
                    <span className="font-bold" style={{ color: theme.textColor }}>{headers.colName}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-left whitespace-nowrap">
                    <span className="font-bold" style={{ color: theme.textColor }}>{headers.colSpeciesElement}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colLoveDay}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-left whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colStatus}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-left whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colStartDate}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colDays}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colTotal}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-left whitespace-nowrap text-pink-300">
                    <span className="text-pink-300 font-bold">{headers.colRecipient}</span>
                  </th>
                  <th className="py-3 px-3 font-semibold text-center text-amber-400 whitespace-nowrap">Admin</th>
                  <th className="py-3 px-3 font-semibold text-center text-pink-400 whitespace-nowrap">Payout %</th>
                  <th className="py-3 px-3 font-semibold text-center text-purple-400 whitespace-nowrap">Treat</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                    <span className="text-slate-300 font-bold">{headers.colActions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedAndFilteredPonies.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No ponies found. Try adjusting your search query or sort order.
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredPonies.map((pony) => {
                    const days = calculateDaysActive(pony.startDate, targetDate, pony.customDaysOverride);
                    const dailyEffective = calculatePonyDailyRate(pony, statuses);
                    const totalYield = calculatePonyAccumulatedLove(pony, targetDate, statuses);

                    return (
                      <tr key={pony.id} className="hover:bg-purple-950/15 transition-colors">
                        {/* Name & Avatar */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="relative group/edit-avatar w-10 h-10 shrink-0">
                              <div className="w-full h-full rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-base overflow-hidden shadow-sm">
                                {pony.avatarIcon && pony.avatarIcon.startsWith('data:image') ? (
                                  <img src={pony.avatarIcon} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  pony.avatarIcon || '💖'
                                )}
                              </div>
                              {adminSettings.allowAvatarImageUpload && (
                                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover/edit-avatar:opacity-100 transition-opacity cursor-pointer">
                                  <Upload className="w-3 h-3 text-white" />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const resized = await resizeImageToMax(file, 400, 400);
                                          onUpdatePony({ ...pony, avatarIcon: resized });
                                        } catch (err: any) {
                                          console.error(err);
                                          alert(err?.message || 'Could not load selected image. Please try another image.');
                                        }
                                      }
                                    }} 
                                  />
                                </label>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={pony.name}
                                  onChange={(e) => onUpdatePony({ ...pony, name: e.target.value })}
                                  className="bg-transparent font-bold text-white hover:border-b hover:border-pink-500 focus:outline-none focus:border-b focus:border-pink-400 w-28"
                                  placeholder="Pony Name"
                                />
                                <button
                                  onClick={() => onNavigateToPony(pony.id)}
                                  className="p-1 rounded bg-slate-800 hover:bg-pink-600/30 text-slate-400 hover:text-pink-300 transition-colors"
                                  title="View Profile"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={pony.location}
                                onChange={(e) => onUpdatePony({ ...pony, location: e.target.value })}
                                className="bg-transparent text-[10px] text-slate-400 hover:border-b hover:border-slate-600 focus:outline-none w-24 block"
                                placeholder="Location"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Species & Element */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={pony.species}
                            onChange={(e) => onUpdatePony({ ...pony, species: e.target.value })}
                            className="bg-transparent text-xs text-pink-300 font-semibold border-b border-transparent hover:border-pink-500 focus:outline-none w-24 block mb-0.5"
                            placeholder="Species"
                          />
                          <input
                            type="text"
                            value={pony.element}
                            onChange={(e) => onUpdatePony({ ...pony, element: e.target.value })}
                            className="bg-transparent text-[11px] text-slate-400 border-b border-transparent hover:border-slate-600 focus:outline-none w-28 block"
                            placeholder="Element"
                          />
                        </td>

                        {/* Love / Day */}
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            value={pony.loveRatePerDay}
                            onChange={(e) => onUpdatePony({ ...pony, loveRatePerDay: Number(e.target.value) || 0 })}
                            className="w-16 bg-slate-900 border border-pink-500/40 rounded px-1.5 py-1 text-pink-300 font-bold text-center focus:outline-none"
                          />
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3">
                          <select
                            value={pony.status}
                            onChange={(e) => onUpdatePony({ ...pony, status: e.target.value })}
                            className="bg-slate-900 border border-purple-500/30 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none"
                          >
                            {statuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.multiplier}x)
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-purple-300/80 block mt-0.5">
                            Eff: +{dailyEffective} Love/day
                          </span>
                        </td>

                        {/* Set Start Date */}
                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            value={pony.startDate}
                            onChange={(e) => onUpdatePony({ ...pony, startDate: e.target.value, customDaysOverride: null })}
                            className="bg-slate-900 border border-purple-500/30 rounded px-1.5 py-1 text-slate-200 text-xs focus:outline-none"
                          />
                        </td>

                        {/* Days Active */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={pony.customDaysOverride !== null && pony.customDaysOverride !== undefined ? pony.customDaysOverride : days}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value);
                                onUpdatePony({ ...pony, customDaysOverride: val });
                              }}
                              className="w-12 bg-slate-900 border border-purple-500/30 rounded px-1 py-1 text-purple-200 font-semibold text-center focus:outline-none"
                            />
                            <span className="text-slate-400 text-[10px]">d</span>
                          </div>
                        </td>

                        {/* Total Harvested Accumulated */}
                        <td className="py-2.5 px-3">
                          <span className="font-extrabold text-pink-400 text-xs">
                            {totalYield.toLocaleString()}
                          </span>
                        </td>

                        {/* OPTION TO SET WHICH PONY THAT LOVE IS GOING TO */}
                         <td className="py-2.5 px-3">
                          <select
                            value={pony.targetRecipientId || ''}
                            onChange={(e) =>
                              onUpdatePony({
                                ...pony,
                                targetRecipientId: e.target.value || null,
                              })
                            }
                            className="w-36 bg-slate-900 border border-pink-500/40 rounded px-2 py-1 text-pink-200 text-xs focus:outline-none focus:border-pink-400"
                          >
                            <option value="">General Reservoir</option>
                            {ponies
                              .filter((other) => other.id !== pony.id)
                              .map((other) => (
                                <option key={other.id} value={other.id}>
                                  ➔ {other.avatarIcon && other.avatarIcon.startsWith('data:image') ? '🖼️' : (other.avatarIcon || '💖')} {other.name}
                                </option>
                              ))}
                          </select>
                        </td>

                        {/* Admin Status Checkbox */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!pony.isAdmin}
                            onChange={(e) => onTogglePonyAdmin(pony.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                          />
                        </td>

                        {/* Reservoir Payout % */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={pony.payoutPercentage || 0}
                              onChange={(e) => onUpdatePayout(pony.id, Number(e.target.value) || 0)}
                              className="w-16 bg-slate-900 border border-pink-500/30 rounded px-1 py-1 text-pink-300 font-bold text-center focus:outline-none"
                            />
                            <span className="text-pink-500">%</span>
                          </div>
                        </td>

                        {/* Give Treat Button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              if (onOpenAdminPopup && onGiveTreat) {
                                onOpenAdminPopup(
                                  'treat',
                                  'Grant Reservoir Treat',
                                  `Allocate a specific amount of love from the general reservoir to ${pony.name}.`,
                                  'Give Treat',
                                  (amount: number) => onGiveTreat(pony.id, amount),
                                  pony.name
                                );
                              }
                            }}
                            className="p-1.5 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-800/40"
                            title="Give reservoir treat"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          {pony.treatsReceived ? (
                            <div className="text-[9px] text-purple-400 mt-0.5">+{pony.treatsReceived}</div>
                          ) : null}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleDuplicate(pony)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeletePony(pony.id)}
                              className="p-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-400">Total Ponies:</span>{' '}
              <strong className="text-white text-sm">{ponies.length}</strong>
            </div>
            <div>
              <span className="text-slate-400">Total Daily Inflow:</span>{' '}
              <strong className="text-pink-400 text-sm">
                +{ponies.reduce((sum, p) => sum + calculatePonyDailyRate(p, statuses), 0).toLocaleString()} / day
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Total Harvested:</span>{' '}
              <strong className="text-purple-300 text-sm">
                {ponies.reduce((sum, p) => sum + calculatePonyAccumulatedLove(p, targetDate, statuses), 0).toLocaleString()} Love
              </strong>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
