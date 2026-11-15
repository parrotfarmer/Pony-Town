import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { PonyNode, CustomStatus, ConnectionType, DEFAULT_PONY_CAPACITY } from '../types/pony';
import { X, Upload } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { ImageCropperModal } from './ImageCropperModal';
import { EmoticonIconPicker } from './EmoticonIconPicker';
import { resizeImageToMax } from '../utils/imageUtils';
import { getSortedStatuses } from '../utils/calculations';

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

    const id = `pony-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = initialPos?.x ?? Math.round(450 + (Math.random() - 0.5) * 250);
    const y = initialPos?.y ?? Math.round(300 + (Math.random() - 0.5) * 180);

    const newPony: PonyNode = {
      id,
      name: name.trim().slice(0, 128),
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
      status: getSortedStatuses(statuses)[0]?.id || 'active',
      ownerId: user.uid,
      ownerName: user.displayName || user.email?.split('@')[0] || 'Community Member',
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
    e.target.value = '';
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
              {avatarIcon.startsWith('data:image') || avatarIcon.startsWith('http') ? (
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
                <>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer" title="Upload custom avatar image">
                    <Upload className="w-4 h-4 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                  </label>
                  <span
                    className="pointer-events-none absolute -bottom-1 -right-1 w-4 h-4 rounded-full border flex items-center justify-center shadow"
                    style={{
                      backgroundColor: theme.buttonColor,
                      color: theme.buttonTextColor,
                      borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                    }}
                  >
                    <Upload className="w-2.5 h-2.5" />
                  </span>
                </>
              )}
            </div>
            <div className="flex-1">
              <label htmlFor="add-pony-name" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>Pony Name *</label>
              <input
                id="add-pony-name"
                name="name"
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
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-bold uppercase block opacity-70" style={{ color: theme.textColor }}>
                {adminSettings.allowAvatarImageUpload ? 'Profile Icon / Custom Avatar Image' : 'Profile Icon (Emoji / Emoticon)'}
              </label>
              {adminSettings.allowAvatarImageUpload && (
                <label
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer hover:opacity-90 transition-all shadow-sm"
                  style={{
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                    borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                  }}
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </label>
              )}
            </div>
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
              <label htmlFor="add-pony-species" className="font-medium block mb-1" style={{ color: theme.textColor }}>
                Species
              </label>
              <input
                id="add-pony-species"
                name="species"
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label htmlFor="add-pony-element" className="font-medium block mb-1" style={{ color: theme.textColor }}>
                Element / Affinity
              </label>
              <input
                id="add-pony-element"
                name="element"
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
              <label htmlFor="add-pony-favoriteTreat" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Favorite Treat
              </label>
              <input
                id="add-pony-favoriteTreat"
                name="favoriteTreat"
                type="text"
                value={favoriteTreat}
                onChange={(e) => setFavoriteTreat(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label htmlFor="add-pony-hobby" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Hobby
              </label>
              <input
                id="add-pony-hobby"
                name="hobby"
                type="text"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label htmlFor="add-pony-personality" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Personality
              </label>
              <input
                id="add-pony-personality"
                name="personality"
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder=""
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                style={{ borderColor: theme.borderColor, color: theme.textColor }}
              />
            </div>
            <div>
              <label htmlFor="add-pony-magicalAffinity" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                Magical Affinity
              </label>
              <input
                id="add-pony-magicalAffinity"
                name="magicalAffinity"
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
            <label htmlFor="add-pony-backstory" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Backstory
            </label>
            <textarea
              id="add-pony-backstory"
              name="backstory"
              rows={2}
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder=""
              className="w-full bg-slate-950 border rounded-lg p-2.5 focus:outline-none resize-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          <div>
            <label htmlFor="add-pony-cutieMark" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Cutie Mark
            </label>
            <input
              id="add-pony-cutieMark"
              name="cutieMark"
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
            <label htmlFor="add-pony-location" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
              Location
            </label>
            <input
              id="add-pony-location"
              name="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-950 border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            />
          </div>

          {/* Information & Notes */}
          <div>
            <label htmlFor="add-pony-notes" className="font-medium block mb-1 opacity-70" style={{ color: theme.textColor }}>Notes</label>
            <textarea
              id="add-pony-notes"
              name="notes"
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
