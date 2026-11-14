import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PonyNode, CustomStatus } from '../types/pony';
import { calculatePonyDailyRate, getUserMainPony } from '../utils/calculations';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  Search, 
  Settings, 
  X,
  LogOut,
  LogIn
} from 'lucide-react';
import { PonyAvatar } from './PonyAvatar';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  ponies: PonyNode[];
  onSelectPony: (id: string) => void;
  onOpenProfile?: (id: string) => void;
  onOpenRankings?: () => void;
  onOpenBulkEditor: () => void;
  onOpenAddModal: () => void;
  onOpenStatusManager: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  statuses: CustomStatus[];
  onOpenAuthModal: () => void;
  onOpenAdminModal: () => void;
  onOpenPersonalProfile: () => void;
  onOpenStore: () => void;
  onOpenThemeSettings: () => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  ponies,
  onSelectPony,
  onOpenProfile,
  onOpenRankings,
  onOpenBulkEditor,
  onOpenAddModal,
  onOpenStatusManager,
  onExportData,
  onImportData,
  statuses,
  onOpenAuthModal,
  onOpenAdminModal,
  onOpenPersonalProfile,
  onOpenStore,
  onOpenThemeSettings,
  isAdmin,
}) => {
  const { user, profile, logout } = useAuth();
  const { theme, adminSettings } = useSettings();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return ponies.filter((p) => {
      const customMatches = Object.entries(p.customData || {}).some(
        ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
      );

      return (
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        p.element.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        customMatches
      );
    });
  }, [ponies, searchQuery]);

  return (
    <header 
      className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-xl border-b py-2 sm:py-2.5 shadow-xl"
      style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
    >
      <div className="max-w-7xl w-full mx-auto px-4 lg:px-6 flex items-center justify-between gap-1.5 sm:gap-3 flex-wrap sm:flex-nowrap">
        {/* Top Left: Global Instant Search Bar */}
        <div className="flex-1 min-w-[140px] max-w-xs sm:max-w-sm flex items-center justify-start">
          <div ref={searchContainerRef} className="relative w-full">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 sm:left-3 w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" style={{ color: theme.textColor }} />
              <input
                type="text"
                placeholder="Search ponies..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setIsSearchFocused(true);
                }}
                className="w-full bg-slate-900 border rounded-xl pl-8 sm:pl-9 pr-7 sm:pr-8 py-1 sm:py-1.5 text-xs placeholder-slate-400 focus:outline-none transition-all shadow-inner theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 hover:opacity-100 opacity-70"
                  style={{ color: theme.textColor }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchFocused && searchQuery.trim() && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-md max-h-80 overflow-y-auto theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <div 
                  className="px-3 py-2 bg-slate-950/70 text-[10px] uppercase font-bold tracking-wider border-b"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                >
                  Matching Ponies ({searchResults.length})
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs opacity-60" style={{ color: theme.textColor }}>
                    No ponies matched "{searchQuery}"
                  </div>
                ) : (
                  <div className="divide-y divide-purple-500/10">
                    {searchResults.map((pony) => (
                      <div
                        key={pony.id}
                        onClick={() => {
                          onSelectPony(pony.id);
                          setIsSearchFocused(false);
                        }}
                        className="p-2.5 hover:bg-purple-950/40 cursor-pointer transition-colors flex items-center gap-2.5 text-xs group"
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenProfile?.(pony.id);
                            setIsSearchFocused(false);
                          }}
                          className="shrink-0 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <PonyAvatar pony={pony} theme={theme} size="md" />
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenProfile?.(pony.id);
                            setIsSearchFocused(false);
                          }}
                          className="flex-1 min-w-0 group-hover:underline cursor-pointer font-bold truncate"
                          style={{ color: theme.textColor }}
                        >
                          {pony.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Far Right: User Account & Admin Control Buttons */}
        <div className="shrink-0 sm:w-1/3 flex justify-end items-center gap-1 sm:gap-2">
          {isAdmin && (
            <button
              onClick={onOpenAdminModal}
              className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md border transition-all cursor-pointer theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
              title="Open Administration"
            >
              <span>Administration</span>
            </button>
          )}

          <button
            onClick={onOpenRankings}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow transition-all cursor-pointer border theme-border-hover"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            title="View Rankings"
          >
            <span>Rankings</span>
          </button>

          {adminSettings.allowExchangeStore && (
            <button
              onClick={onOpenStore}
              className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow transition-all cursor-pointer border theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
              title="Open Status Exchange"
            >
              <span>Exchange</span>
            </button>
          )}

          {/* Settings Button (Available to All Users) */}
          <div ref={settingsRef} className="relative">
            <button
              onClick={() => {
                if (!isAdmin && user) {
                  onOpenThemeSettings();
                } else {
                  setIsSettingsOpen(!isSettingsOpen);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer border theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
              title="Settings"
            >
              <Settings className="w-4 h-4" style={{ color: theme.buttonTextColor }} />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Settings Popover Dropdown */}
            {isSettingsOpen && (
              <div 
                className="absolute right-0 mt-2 w-52 bg-slate-900/95 border rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100 theme-border-hover"
                style={{ borderColor: theme.borderColor }}
              >
                <div 
                  className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider border-b mb-1 opacity-70"
                  style={{ borderColor: theme.borderColor, color: theme.textColor }}
                >
                  Settings
                </div>

                {/* Theme & Appearance Option */}
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    onOpenThemeSettings();
                  }}
                  className="w-full flex items-center px-3 py-2 rounded-lg font-semibold transition-colors text-left hover:bg-slate-800/80"
                  style={{ color: theme.textColor }}
                >
                  <span>Settings</span>
                </button>

                {/* Account Option - ONLY shown if NOT signed in */}
                {!user && (
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      onOpenAuthModal();
                    }}
                    className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left hover:bg-slate-800/80"
                    style={{ color: theme.textColor }}
                  >
                    <span>Create Account / Admin</span>
                  </button>
                )}

                {/* Admin Only Network Controls & Import/Export */}
                {isAdmin && (
                  <>
                    <div className="h-[1px] my-1 opacity-20" style={{ backgroundColor: theme.textColor }} />

                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenAddModal();
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left hover:bg-slate-800/80"
                      style={{ color: theme.textColor }}
                    >
                      <span>Add Pony</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenBulkEditor();
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left hover:bg-slate-800/80"
                      style={{ color: theme.textColor }}
                    >
                      <span>Ponies</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenStatusManager();
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left hover:bg-slate-800/80"
                      style={{ color: theme.textColor }}
                    >
                      <span>Statuses</span>
                    </button>

                    <div className="h-[1px] my-1 opacity-20" style={{ backgroundColor: theme.textColor }} />

                    {/* Export JSON */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onExportData();
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                      style={{ color: theme.textColor }}
                    >
                      <span>Export JSON</span>
                    </button>

                    {/* Import JSON */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                      style={{ color: theme.textColor }}
                    >
                      <span>Import JSON</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Hidden File Input for Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportData}
              accept=".json"
              className="hidden"
            />
          </div>

          {/* Far Right Profile / Logout Button */}
          {user ? (
            (() => {
              const userPony = getUserMainPony(ponies, user.uid);
              const displayName = userPony?.name || profile?.displayName || user.email?.split('@')[0] || 'Pony Steward';

              return (
                <div
                  onClick={onOpenPersonalProfile}
                  className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all group theme-border-hover"
                  style={{ borderColor: theme.borderColor }}
                  title="Click to view your personal pony profile"
                >
                  {userPony ? (
                    <PonyAvatar pony={userPony} theme={theme} size="xs" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-pink-500/30 border border-pink-400 text-pink-300 flex items-center justify-center font-bold text-[10px]">
                      {displayName[0]?.toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className="hidden md:block text-left leading-tight">
                    <span className="font-bold block max-w-[110px] truncate group-hover:underline" style={{ color: theme.textColor }}>
                      {displayName}
                    </span>
                    {isAdmin && (
                      <span className="text-[9px] text-amber-400 font-semibold uppercase block">
                        Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      logout();
                    }}
                    className="ml-1 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md border flex items-center gap-1.5 transition-all theme-border-hover cursor-pointer"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
