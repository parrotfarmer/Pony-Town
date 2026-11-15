import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomStatus, PonyNode } from '../types/pony';
import { 
  Sparkles, 
  UserPlus, 
  LogIn, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { ImageCropperModal } from './ImageCropperModal';
import { EmoticonIconPicker } from './EmoticonIconPicker';
import { useSettings } from '../context/SettingsContext';
import { resizeImageToMax } from '../utils/imageUtils';
import { getSortedStatuses } from '../utils/calculations';

interface OnboardingSplashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPony: (pony: PonyNode) => void;
  statuses: CustomStatus[];
  onUpdateProfileDisplayName?: (name: string) => Promise<void>;
  canAddPony?: boolean;
}

export const OnboardingSplashModal: React.FC<OnboardingSplashModalProps> = ({
  isOpen,
  onClose,
  onAddPony,
  statuses,
  onUpdateProfileDisplayName,
  canAddPony = true,
}) => {
  const { user, signInWithGoogle, registerWithEmail, signInWithEmail } = useAuth();
  const { theme, adminSettings, markOnboardingCompleted } = useSettings();

  const [step, setStep] = useState<'splash' | 'auth' | 'create_pony'>('splash');
  const [authMode, setAuthMode] = useState<'register' | 'signin'>('register');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Pony Creation Form State
  const [ponyName, setPonyName] = useState('');
  const [avatarIcon, setAvatarIcon] = useState('🦄');
  const [species, setSpecies] = useState('Alicorn');
  const [element, setElement] = useState('Magic');
  const [location, setLocation] = useState('Equestria');
  const [notes, setNotes] = useState('');
  const [secretSpecies, setSecretSpecies] = useState('');
  const [secretElement, setSecretElement] = useState('');
  const [secretNotes, setSecretNotes] = useState('');
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null);

  const prevUserUidRef = useRef<string | null>(user?.uid || null);
  useEffect(() => {
    const currUid = user?.uid || null;
    if (!isOpen || (prevUserUidRef.current && !currUid)) {
      setStep('splash');
      setAuthMode('register');
      setEmail('');
      setPassword('');
      setDisplayName('');
      setAuthError(null);
      setPonyName('');
      setAvatarIcon('🦄');
      setSpecies('Alicorn');
      setElement('Magic');
      setLocation('Equestria');
      setNotes('');
      setSecretSpecies('');
      setSecretElement('');
      setSecretNotes('');
      setCropperRawImage(null);
    }
    prevUserUidRef.current = currUid;
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddPony) return;
    if (!user) {
      setStep('auth');
      return;
    }
    if (!ponyName.trim()) return;

    // Default to initial ranked status
    const defaultStatusId = getSortedStatuses(statuses)[0]?.id || 'active';

    const newPony: PonyNode = {
      id: `pony-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: ponyName.trim().slice(0, 128),
      species: species.trim() || 'Pony',
      element: element.trim() || 'Love',
      location: location.trim() || 'Equestria',
      color: '#ec4899',
      x: Math.floor(Math.random() * 400) + 200,
      y: Math.floor(Math.random() * 400) + 200,
      loveRatePerDay: 1000,
      status: defaultStatusId,
      startDate: new Date().toISOString().split('T')[0],
      customDaysOverride: null,
      notes: notes.trim(),
      avatarIcon: avatarIcon.trim() || '🦄',
      ownerId: user.uid,
      isOriginalAdmin: false,
      secretSpecies: secretSpecies.trim() || undefined,
      secretElement: secretElement.trim() || undefined,
      secretNotes: secretNotes.trim() || undefined,
      allowedViewerPonyIds: [],
      loveSplits: []
    };

    if (onUpdateProfileDisplayName && user && ponyName.trim()) {
      try {
        await onUpdateProfileDisplayName(ponyName.trim());
      } catch (err) {
        console.warn('Profile name sync:', err);
      }
    }

    onAddPony(newPony);
    markOnboardingCompleted();
    onClose();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        if (!email.trim() || !password) {
          setAuthError('Please provide email and password');
          setIsSubmittingAuth(false);
          return;
        }
        await registerWithEmail(email, password, displayName || 'Pony Steward');
      }
      setStep('create_pony');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      await signInWithGoogle();
      setStep('create_pony');
    } catch (err: any) {
      setAuthError(err.message || 'Google sign in failed');
    } finally {
      setIsSubmittingAuth(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          title="Close splash modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Splash Page */}
        {step === 'splash' && (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-6 overflow-y-auto min-h-[320px]">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300">
              Welcome Ponies!
            </h1>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm pt-4">
              {user ? (
                <button
                  onClick={() => setStep('create_pony')}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Register Pony</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setStep('auth');
                    }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register Pony</span>
                  </button>

                  <button
                    onClick={() => {
                      setAuthMode('signin');
                      setStep('auth');
                    }}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 whitespace-nowrap transition-all"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Auth Form (Sign In optional step) */}
        {step === 'auth' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">
                {authMode === 'register' ? 'Create Account' : 'Sign In to Your Account'}
              </h2>
            </div>

            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`py-2 font-bold rounded-lg transition-all ${
                  authMode === 'register' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`py-2 font-bold rounded-lg transition-all ${
                  authMode === 'signin' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 max-w-md mx-auto text-xs">
              {authMode === 'register' && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Your Name / Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Celestia Steward"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-300 font-medium block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="steward@equestria.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2"
                >
                  {isSubmittingAuth ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>{authMode === 'register' ? 'Continue' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmittingAuth}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"/>
                    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"/>
                  </svg>
                  Google Account
                </button>
              </div>

              <div className="flex justify-start items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('splash')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← Back
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Create Pony Profile */}
        {step === 'create_pony' && (
          <form onSubmit={handleFinishOnboarding} className="p-6 space-y-4 overflow-y-auto text-xs">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">
                Create Pony Profile
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Pony Name */}
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-bold block mb-1">
                  Pony Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Twilight Sparkle, Rainbow Dash, Starfall..."
                  value={ponyName}
                  onChange={(e) => setPonyName(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-pink-500 shadow-inner"
                />
              </div>

              {/* Profile Icon (Emoticon / Emoji or Custom Image if Enabled) */}
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-bold block mb-1">
                  {adminSettings.allowAvatarImageUpload ? 'Profile Icon / Custom Avatar Image' : 'Profile Icon (Emoji / Emoticon)'}
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-950 p-3 rounded-2xl border border-purple-500/20">
                  <div className="relative group/onboard-avatar w-16 h-16 shrink-0">
                    <div
                      className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold overflow-hidden shadow-inner px-1 text-center"
                      style={{
                        color: theme.textColor,
                        fontSize: [...(avatarIcon || '🦄')].length >= 4 ? '12px' : [...(avatarIcon || '🦄')].length >= 2 ? '16px' : '28px',
                      }}
                    >
                      {avatarIcon && (avatarIcon.startsWith('data:image') || avatarIcon.startsWith('http')) ? (
                        <img src={avatarIcon} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        avatarIcon || '🦄'
                      )}
                    </div>
                    {adminSettings.allowAvatarImageUpload && (
                      <>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover/onboard-avatar:opacity-100 transition-opacity cursor-pointer" title="Upload custom avatar image">
                          <Upload className="w-5 h-5 text-white" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) {
                                try {
                                  const resized = await resizeImageToMax(file, 400, 400);
                                  setCropperRawImage(resized);
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }} 
                          />
                        </label>
                        <span
                          className="pointer-events-none absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow"
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
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <EmoticonIconPicker
                          value={avatarIcon}
                          onChange={setAvatarIcon}
                          theme={theme}
                          compact={true}
                        />
                      </div>
                      {adminSettings.allowAvatarImageUpload && (
                        <label
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer hover:opacity-90 transition-all shadow-sm shrink-0"
                          style={{
                            backgroundColor: theme.buttonColor,
                            color: theme.buttonTextColor,
                            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor,
                          }}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) {
                                try {
                                  const resized = await resizeImageToMax(file, 400, 400);
                                  setCropperRawImage(resized);
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {adminSettings.allowAvatarImageUpload
                        ? 'Choose an emoji/emoticon or click Upload Image for a custom picture.'
                        : 'Pick or type an emoji/emoticon for your pony profile across the network.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Species */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Species</label>
                <input
                  type="text"
                  placeholder="e.g. Alicorn, Pegasus, Unicorn, Earth Pony..."
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Element / Affinity */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Element / Affinity</label>
                <input
                  type="text"
                  placeholder="e.g. Magic, Friendship, Loyalty, Laughter..."
                  value={element}
                  onChange={(e) => setElement(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Location / Country */}
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-medium block mb-1">Location / Country</label>
                <input
                  type="text"
                  placeholder="e.g. Equestria, Canterlot, Cloudsdale, USA..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Notes */}
              <div className="sm:col-span-2">
                <label className="text-slate-300 font-medium block mb-1">Notes / Bio</label>
                <textarea
                  rows={2}
                  placeholder="Add a bio or notes about your pony..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Secret Attributes Section */}
              <div className="sm:col-span-2 bg-slate-950/60 p-3 border border-purple-500/20 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-pink-300 font-bold">
                  <span>Secret Profile Section (Owner Only)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Secret Species"
                    value={secretSpecies}
                    onChange={(e) => setSecretSpecies(e.target.value)}
                    className="bg-slate-900 border border-purple-500/20 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500"
                  />
                  <input
                    type="text"
                    placeholder="Secret Element"
                    value={secretElement}
                    onChange={(e) => setSecretElement(e.target.value)}
                    className="bg-slate-900 border border-purple-500/20 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Secret Notes"
                  value={secretNotes}
                  onChange={(e) => setSecretNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-purple-500/20 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('splash')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
              
              <button
                type="submit"
                disabled={!ponyName.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-xl shadow-pink-600/30 flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete registry</span>
              </button>
            </div>
          </form>
        )}

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
        title="Crop & Zoom Your Profile Picture"
        outputWidth={400}
        outputHeight={400}
      />
    </div>
  );
};
