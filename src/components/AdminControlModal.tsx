import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types/auth';
import { PonyNode } from '../types/pony';
import { X, ShieldCheck, Users, Lock, Unlock, RefreshCw, Edit3, RotateCcw, Eye } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { PonyAvatar } from './PonyAvatar';

const ADMIN_USERS_CACHE_TTL_MS = 10 * 60 * 1000;

interface AdminControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLayoutLocked: boolean;
  onToggleLayoutLock: () => void;
  onResetNetwork: () => void;
  onUpdateArchivedLove: (val: number) => void;
  onSyncDailyAccrual?: () => Promise<number>;
  ponies: PonyNode[];
  isSimulatingNonAdmin: boolean;
  onToggleSimulateNonAdmin: () => void;
}

export const AdminControlModal: React.FC<AdminControlModalProps> = ({
  isOpen,
  onClose,
  isLayoutLocked,
  onToggleLayoutLock,
  onResetNetwork,
  onUpdateArchivedLove,
  onSyncDailyAccrual,
  ponies,
  isSimulatingNonAdmin: _isSimulatingNonAdmin,
  onToggleSimulateNonAdmin,
}) => {
  const { user, isAdmin, setUserRole } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'reset' | 'edit' | 'network_reset' | null>(null);
  const [editLoveValue, setEditLoveValue] = useState<string>('');
  const lastFetchedUsersAtRef = useRef<number>(0);

  const loadUsers = async (force = false) => {
    if (!isAdmin) return;
    if (!force && usersList.length > 0 && Date.now() - lastFetchedUsersAtRef.current < ADMIN_USERS_CACHE_TTL_MS) {
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), limit(200)));
      const list: UserProfile[] = [];
      snap.forEach(d => {
        list.push(d.data() as UserProfile);
      });
      setUsersList(list);
      lastFetchedUsersAtRef.current = Date.now();
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadUsers(false);
    }
  }, [isOpen, isAdmin]);

  const { theme, adminSettings, updateAdminSettings } = useSettings();

  if (!isOpen || !isAdmin) return null;

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    setActionMsg(null);
    try {
      await setUserRole(targetUid, newRole);
      setActionMsg(`Updated user role to ${newRole.toUpperCase()}`);
      await loadUsers(true);
    } catch (err: any) {
      setActionMsg(`Error updating role: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-slate-950/60"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Administration</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {actionMsg && (
            <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 flex items-center justify-between">
              <span>{actionMsg}</span>
              <button onClick={() => setActionMsg(null)} className="text-amber-400 hover:text-white text-xs font-bold">
                Dismiss
              </button>
            </div>
          )}

          {/* 1. Global Admin Controls */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/20 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <strong className="text-white block">Network Node Layout</strong>
                </div>
                <button
                  onClick={() => {
                    onToggleLayoutLock();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                    isLayoutLocked
                      ? 'bg-amber-600 text-white hover:bg-amber-500'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isLayoutLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {isLayoutLocked ? 'Locked' : 'Unlocked'}
                </button>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <strong className="text-white block">Emergency Network Reset</strong>
                  <span className="text-[10px] text-slate-400">Reset pony network positions & allocations</span>
                </div>
                <button
                  onClick={() => {
                    setConfirmingAction('network_reset');
                  }}
                  className="px-3 py-1.5 rounded-lg font-bold bg-red-950 text-red-300 border border-red-800/50 hover:bg-red-900 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <strong className="text-white block">Simulate Non-Admin User Experience</strong>
                </div>
                <button
                  onClick={() => {
                    onToggleSimulateNonAdmin();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-md shadow-purple-600/30"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Test Non-Admin View
                </button>
              </div>

              {onSyncDailyAccrual && (
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <strong className="text-white block">Firebase Daily Love Accrual</strong>
                    <span className="text-[10px] text-slate-400">Calculate today&apos;s accrued Love and save to Firebase</span>
                  </div>
                  <button
                    onClick={async () => {
                      const updatedCount = await onSyncDailyAccrual();
                      setActionMsg(
                        updatedCount > 0
                          ? `Synced daily Love accrual to Firebase for ${updatedCount} ${updatedCount === 1 ? 'pony' : 'ponies'}.`
                          : 'All ponies are already up to date for today in Firebase.'
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg font-bold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 1.5 Feature Locks & User Limits */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-500/20 space-y-3">
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              Feature Locks & User Limits
            </h3>

            <div className="space-y-2.5">
              {/* Profile Icon Image Upload Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Profile Icon Image Upload</strong>
                  <span className="text-[10px] text-slate-400">Enable & show custom image upload for pony profile icons (when off, emoticons/emojis are used)</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowAvatarImageUpload}
                  onChange={(e) => updateAdminSettings({ allowAvatarImageUpload: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* My Ponies Sort Filter Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Network Map "My Ponies" Filter</strong>
                  <span className="text-[10px] text-slate-400">Show and enable the custom "My Ponies" filter option in the network map layout menu</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowMyPoniesSort}
                  onChange={(e) => updateAdminSettings({ allowMyPoniesSort: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* + Add Pony Visibility & Usability Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Allow Users "+ Add Pony" Button</strong>
                  <span className="text-[10px] text-slate-400">When unchecked, users can only create their initial pony and "+ Add Pony" is hidden & locked afterwards</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowUserAddPony}
                  onChange={(e) => updateAdminSettings({ allowUserAddPony: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Love Exchange Store Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Love Exchange Store</strong>
                  <span className="text-[10px] text-slate-400">Show and enable the Exchange store for purchasing badges, borders, and theme perks</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowExchangeStore}
                  onChange={(e) => updateAdminSettings({ allowExchangeStore: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Profile Borders Feature Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Profile Borders (Exchange & User Icons)</strong>
                  <span className="text-[10px] text-slate-400">Enable and show profile borders in the exchange and profile border styling on user icons in general</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowProfileBorders ?? true}
                  onChange={(e) => updateAdminSettings({ allowProfileBorders: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Main Pony Selection Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">"Main Pony" Profile Selection</strong>
                  <span className="text-[10px] text-slate-400">Show and enable the "Main Pony" toggle on profiles (when off, each user's single pony is their main pony)</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowMainPonySelection}
                  onChange={(e) => updateAdminSettings({ allowMainPonySelection: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Non-Static Live 10s Love Pulse Ticker Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Live 10s Love Pulse Ticker (Admin Only)</strong>
                  <span className="text-[10px] text-slate-400">Run live 10-second Love ticker calculations while in Admin view (when off, page stays static)</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowLivePulseUpdates}
                  onChange={(e) => updateAdminSettings({ allowLivePulseUpdates: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Auto Daily Love Accrual Lock */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Auto Daily Love Accrual (Admin Only)</strong>
                  <span className="text-[10px] text-slate-400">Automatically reconcile daily Love accruals to Firebase when an Admin loads the page</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowAutoDailyAccrual}
                  onChange={(e) => updateAdminSettings({ allowAutoDailyAccrual: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              {/* Client-Side Map Flow & Ring Animations Toggle */}
              <label className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-500/40 transition-colors">
                <div>
                  <strong className="text-white block">Local Map Flow &amp; Ring Animations</strong>
                  <span className="text-[10px] text-slate-400">Local client-side particle flow and pulsing/spinning ring animations (no backend/Firebase load)</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminSettings.allowLiveFlowAnimations}
                  onChange={(e) => updateAdminSettings({ allowLiveFlowAnimations: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-pink-500 focus:ring-pink-500 cursor-pointer shrink-0"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Profile Update Cooldown Hours */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-white block">Profile Update Cooldown (Hours)</strong>
                    <span className="text-[10px] text-slate-400">Time between profile updates (0 = no limit)</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={adminSettings.profileUpdateCooldownHours}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      updateAdminSettings({ profileUpdateCooldownHours: val });
                    }}
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Max Ponies Per User */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <strong className="text-white block">Max Ponies Per User</strong>
                    <span className="text-[10px] text-slate-400">Maximum ponies each user can own</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={adminSettings.maxPoniesPerUser}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 1);
                      updateAdminSettings({ maxPoniesPerUser: val });
                    }}
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Global Total Love Management */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-rose-500/20 space-y-3">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-300">Manually override total harvested love:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingAction('edit')}
                  className="px-3 py-1.5 rounded-lg font-bold bg-rose-900/40 text-rose-300 border border-rose-800/40 hover:bg-rose-800 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Love
                </button>
                <button
                  onClick={() => setConfirmingAction('reset')}
                  className="px-3 py-1.5 rounded-lg font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>
            
            {confirmingAction && (
              <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-amber-500/30 animate-in slide-in-from-top-2 duration-200">
                <h4 className="text-sm font-bold text-amber-400 mb-2">
                  {confirmingAction === 'reset' ? 'Confirm Love Reset' : 
                   confirmingAction === 'network_reset' ? 'Confirm Network-Wide Reset' : 'Enter New Love Value'}
                </h4>
                
                {confirmingAction === 'network_reset' && (
                  <p className="text-[10px] text-red-400 mb-3 bg-red-500/5 p-2 rounded border border-red-500/20">
                    WARNING: This will reset all ponies, connections, and statuses to their initial factory settings. This action cannot be undone.
                  </p>
                )}

                {confirmingAction === 'edit' && (
                  <input
                    type="number"
                    value={editLoveValue}
                    onChange={(e) => setEditLoveValue(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white mb-3"
                    placeholder="Enter love amount"
                  />
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setConfirmingAction(null);
                      setEditLoveValue('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmingAction === 'reset') {
                        onUpdateArchivedLove(0);
                        setActionMsg('Total love reset to 0.');
                      } else if (confirmingAction === 'network_reset') {
                        onResetNetwork();
                        setActionMsg('Network reset to default state.');
                      } else {
                        const val = Number(editLoveValue);
                        if (!isNaN(val)) {
                          onUpdateArchivedLove(val);
                          setActionMsg(`Total love updated to ${val.toLocaleString()}.`);
                        }
                      }
                      setConfirmingAction(null);
                      setEditLoveValue('');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-white ${confirmingAction === 'network_reset' ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`}
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. User Accounts Registry */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                User Accounts Registry ({usersList.length})
              </h3>
              <button
                onClick={() => loadUsers(true)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                title="Refresh users"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="py-6 text-center text-slate-500 italic">Syncing records...</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {usersList.map((usr) => {
                  const userPony = ponies.find(p => p.ownerId === usr.uid);
                  const ponyName = userPony ? userPony.name : 'Unregistered Pony';
                  const ponyAvatar = userPony ? userPony.avatarIcon : '🦄';

                  return (
                    <div key={usr.uid} className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <PonyAvatar pony={userPony || { avatarIcon: usr.photoURL || '🦄' } as any} theme={theme} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-white text-xs font-bold">{ponyName}</strong>
                            {usr.role === 'admin' && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-amber-950 text-amber-400 font-bold border border-amber-500/40 rounded">ADMIN</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRoleChange(usr.uid, usr.role === 'admin' ? 'user' : 'admin')}
                        disabled={usr.uid === user?.uid}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                          usr.role === 'admin' ? 'bg-slate-800 text-slate-400' : 'bg-amber-900/40 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {usr.role === 'admin' ? 'Revoke' : 'Promote'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Reservoir Accounting Ledger */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/20 space-y-3">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              Reservoir Accounting Ledger
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ponies.filter(p => (p.payoutPercentage || 0) > 0 || (p.treatsReceived || 0) > 0).length === 0 ? (
                <div className="py-4 text-center text-slate-500 italic">No reservoir outflows.</div>
              ) : (
                ponies
                  .filter(p => (p.payoutPercentage || 0) > 0 || (p.treatsReceived || 0) > 0)
                  .map(p => (
                    <div key={p.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PonyAvatar pony={p} theme={theme} size="sm" />
                        <div>
                          <strong className="text-white block">{p.name}</strong>
                          <div className="flex items-center gap-2 mt-0.5">
                            {(p.payoutPercentage || 0) > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/20">Payout: {p.payoutPercentage}%</span>}
                            {(p.treatsReceived || 0) > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-950/50 text-pink-400 border border-pink-500/20">Treats: +{p.treatsReceived?.toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 bg-slate-950 border-t flex justify-end items-center"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all border cursor-pointer theme-border-hover"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
