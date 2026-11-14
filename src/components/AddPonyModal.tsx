import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { PonyNode, CustomStatus, ConnectionType, DEFAULT_PONY_CAPACITY } from '../types/pony';
import { X, Upload } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { ImageCropperModal } from './ImageCropperModal';
import { EmoticonIconPicker } from './EmoticonIconPicker';
import { resizeImageToMax } from '../utils/imageUtils';

interface AddPonyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPony: (newPony: PonyNode, connectToId?: string, connType?: ConnectionType) => void;
  existingPonies: PonyNode[];
  targetDate: string;
  statuses: CustomStatus[];
  initialPos?: { x: number; y: number } | null;
  canAddPony?: boolean;
}

export const AddPonyModal: React.FC<AddPonyModalProps> = ({
  isOpen,
  onClose,
  onAddPony,
  existingPonies: _existingPonies,
  targetDate,
  statuses,
  initialPos,
  canAddPony = true,
}) => {
  const { speciesOptions, elementOptions, locationOptions, loading: settingsLoading, theme, adminSettings } = useSettings();
  const { isAdmin, user } = useAuth();

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      backgroundColor: '#030711',
      borderColor: '#a855f7',
      borderRadius: '0.5rem',
      padding: '2px',
      color: '#fff',
    }),
    singleValue: (base: any) => ({ ...base, color: '#fff' }),
    menu: (base: any) => ({ ...base, backgroundColor: '#0f172a', border: '1px solid #7e22ce' }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? '#334155' : '#0f172a',
      color: '#fff',
    }),
  };

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [element, setElement] = useState('');
  const [location, setLocation] = useState('');
  const [avatarIcon, setAvatarIcon] = useState('💖');
  const [notes, setNotes] = useState('');
  const [favoriteTreat, setFavoriteTreat] = useState('');
  const [hobby, setHobby] = useState('');
  const [personality, setPersonality] = useState('');
  const [backstory, setBackstory] = useState('');
  const [magicalAffinity, setMagicalAffinity] = useState('');
  const [friendshipLevel, setFriendshipLevel] = useState('');
  const [cutieMark, setCutieMark] = useState('');
  const [cutieMarkMeaning, setCutieMarkMeaning] = useState('');
  const [residence, setResidence] = useState('');
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null);

  // Removed default options setting logic

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddPony || !user) return;
    if (!name.trim()) return;

    const id = `pony-${Date.now().toString().slice(-4)}`;
    const x = initialPos?.x ?? Math.round(450 + (Math.random() - 0.5) * 250);
    const y = initialPos?.y ?? Math.round(300 + (Math.random() - 0.5) * 180);

    const newPony: PonyNode = {
      id,
      name: name.trim(),
      species: species.trim() || '',
      element: element.trim() || '',
      location: location.trim() || '',
      color: '#ec4899',
      accentColor: '#f472b6',
      avatarIcon: avatarIcon.trim() || '💖',
      notes: notes.trim(),
      x,
      y,
      loveRatePerDay: DEFAULT_PONY_CAPACITY,
      startDate: targetDate || new Date().toISOString().split('T')[0],
      customDaysOverride: null,
      status: statuses[0]?.id || 'active',
      ownerId: user.uid,
      customData: {},
      favoriteTreat,
      hobby,
      personality,
      backstory,
      magicalAffinity,
      friendshipLevel,
      cutieMark,
      cutieMarkMeaning,
      residence,
    };

    onAddPony(newPony);
    onClose();
    setName('');
    setNotes('');
    setFavoriteTreat('');
    setHobby('');
    setPersonality('');
    setBackstory('');
    setMagicalAffinity('');
    setFriendshipLevel('');
    setCutieMark('');
    setCutieMarkMeaning('');
    setResidence('');
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedRaw = await resizeImageToMax(file, 400, 400);
      setCropperRawImage(resizedRaw);
    } catch (err) {
      console.error('Image load error:', err);
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 border rounded-2xl shadow-2xl flex flex-col my-auto overflow-hidden theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-slate-950/60 shrink-0"
          style={{ borderColor: theme.borderColor }}
        >
          <div>
            <h2 className="text-base font-bold text-white">Add Pony</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Name & Avatar Icon */}
          <div className="flex items-center gap-3">
            <div className="relative group/icon w-14 h-14 flex-shrink-0">
              {avatarIcon.startsWith('data:image') ? (
                <img 
                  src={avatarIcon} 
                  alt="Preview" 
                  className="w-full h-full rounded-xl object-cover border" 
                  style={{ borderColor: theme.borderColor }}
                />
              ) : (
                <div 
                  className="w-full h-full rounded-xl bg-slate-950 border flex items-center justify-center font-bold overflow-hidden px-1 text-center"
                  style={{
                    borderColor: theme.borderColor,
                    color: theme.textColor,
                    fontSize: [...avatarIcon].length >= 4 ? '11px' : [...avatarIcon].length >= 2 ? '15px' : '24px',
                  }}
                >
                  {avatarIcon}
                </div>
              )}
              {adminSettings.allowAvatarImageUpload && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="w-4 h-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </label>
              )}
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>Pony Name *</label>
              <input
                type="text"
                required
                placeholder=""
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 font-bold focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
          </div>

          {/* Emoticon / Emoji Profile Icon Picker */}
          <div className="bg-slate-950/60 p-3 rounded-xl border space-y-1.5" style={{ borderColor: theme.borderColor }}>
            <label className="text-[10px] font-bold uppercase block opacity-70" style={{ color: theme.textColor }}>
              Profile Icon (Emoji / Emoticon)
            </label>
            <EmoticonIconPicker
              value={avatarIcon}
              onChange={setAvatarIcon}
              theme={theme}
              compact={true}
            />
          </div>

          {/* Species & Element */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium block mb-1" style={{ color: theme.textColor }}>
                Species
              </label>
              <input
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label className="font-medium block mb-1" style={{ color: theme.textColor }}>
                Element / Affinity
              </label>
              <input
                type="text"
                value={element}
                onChange={(e) => setElement(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
          </div>

          {/* Extended Profile Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Favorite Treat
              </label>
              <input
                type="text"
                value={favoriteTreat}
                onChange={(e) => setFavoriteTreat(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Hobby
              </label>
              <input
                type="text"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Personality
              </label>
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Magical Affinity
              </label>
              <input
                type="text"
                value={magicalAffinity}
                onChange={(e) => setMagicalAffinity(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Backstory
            </label>
            <textarea
              rows={2}
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder=""
              className="w-full bg-slate-950 border rounded-lg p-2.5 focus:outline-none resize-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Cutie Mark
            </label>
            <input
              type="text"
              value={cutieMark}
              onChange={(e) => setCutieMark(e.target.value)}
              placeholder=""
              className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          {/* Information & Notes */}
          <div>
            <label className="font-medium block mb-1 opacity-70" style={{ color: theme.textColor }}>Notes</label>
            <textarea
              rows={3}
              placeholder=""
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border rounded-lg p-2.5 focus:outline-none resize-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          {/* Actions */}
          <div 
            className="flex justify-end gap-2 pt-2 border-t"
            style={{ borderColor: theme.borderColor }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium"
              style={{ color: theme.textColor }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl font-bold shadow-lg border transition-all cursor-pointer theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            >
              Add Pony
            </button>
          </div>
        </form>
      </div>

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={!!cropperRawImage && adminSettings.allowAvatarImageUpload}
        imageSrc={cropperRawImage}
        onClose={() => setCropperRawImage(null)}
        onCropComplete={(croppedDataUrl) => {
          setAvatarIcon(croppedDataUrl);
          setCropperRawImage(null);
        }}
        title="Crop & Zoom Avatar Image"
        outputWidth={400}
        outputHeight={400}
      />
    </div>
  );
};
