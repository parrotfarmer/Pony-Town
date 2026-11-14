import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PonyNode } from '../types/pony';
import { useSettings } from '../context/SettingsContext';

interface PonySelectorProps {
  ponies: PonyNode[];
  onSelect: (pony: PonyNode) => void;
  currentUserId?: string;
}

export const PonySelector: React.FC<PonySelectorProps> = ({ ponies, onSelect, currentUserId }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPonies = useMemo(() => {
    if (!query.trim()) return [];
    const p = currentUserId ? ponies.filter(p => p.ownerId === currentUserId) : ponies;
    return p.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [ponies, currentUserId, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        placeholder="Select Pony"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs focus:outline-none theme-border-hover shadow-inner transition-all"
        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
      />
      {isOpen && query.trim().length > 0 && (
        <div 
          className="absolute z-50 w-full mt-1 bg-slate-950 border rounded-xl max-h-44 overflow-y-auto shadow-2xl backdrop-blur-md p-1 space-y-0.5 theme-border-hover"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
        >
          {filteredPonies.length > 0 ? (
            filteredPonies.map(pony => (
              <div
                key={pony.id}
                onClick={() => {
                  onSelect(pony);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-slate-800/80 rounded-lg text-xs font-semibold truncate transition-colors"
                style={{ color: theme.textColor }}
              >
                {pony.name}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs opacity-50 italic text-center" style={{ color: theme.textColor }}>
              No ponies match "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

