import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomStatus, PonyNode, DEFAULT_PONY_CAPACITY } from '../types/pony';
import {
  UserPlus,
  ArrowRight,
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
  Smile,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { ImageCropperModal } from './ImageCropperModal';
import { useSettings } from '../context/SettingsContext';
import { resizeImageToMax } from '../utils/imageUtils';
import { getSortedStatuses } from '../utils/calculations';
import { formatAuthError } from '../utils/authErrors';

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
  const { user, signInWithGoogle, registerWithEmail, signInWithEmail, resetPassword } = useAuth();
  const { theme, adminSettings, markOnboardingCompleted } = useSettings();

  const [step, setStep] = useState<'splash' | 'auth' | 'create_pony'>('splash');
  const [authMode, setAuthMode] = useState<'register' | 'signin' | 'forgot_password'>('register');

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Pony Creation Form State (mirrors AddPonyModal)
  const [ponyName, setPonyName] = useState('');
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
  const [cutieMark, setCutieMark] = useState('');
  const [cropperRawImage, setCropperRawImage] = useState<string | null>(null);
  const [isEditingEmoticon, setIsEditingEmoticon] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      setSpecies('');
      setElement('');
      setLocation('');
      setAvatarIcon('💖');
      setNotes('');
      setFavoriteTreat('');
      setHobby('');
      setPersonality('');
      setBackstory('');
      setMagicalAffinity('');
      setCutieMark('');
      setCropperRawImage(null);
      setIsEditingEmoticon(false);
      setUploadError(null);
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

    const defaultStatusId = getSortedStatuses(statuses)[0]?.id || 'active';

    const newPony: PonyNode = {
      id: `pony-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: ponyName.trim().slice(0, 128),
      species: species.trim() || '',
      element: element.trim() || '',
      location: location.trim() || '',
      color: '#ec4899',
      accentColor: '#f472b6',
      avatarIcon: avatarIcon.trim() || '💖',
      notes: notes.trim(),
      x: Math.round(450 + (Math.random() - 0.5) * 250),
      y: Math.round(300 + (Math.random() - 0.5) * 180),
      loveRatePerDay: DEFAULT_PONY_CAPACITY,
      startDate: new Date().toISOString().split('T')[0],
      customDaysOverride: null,
      status: defaultStatusId,
      ownerId: user.uid,
      ownerName: user.displayName || user.email?.split('@')[0] || 'Community Member',
      customData: {},
      favoriteTreat,
      hobby,
      personality,
      backstory,
      magicalAffinity,
      cutieMark,
      isOriginalAdmin: false,
      allowedViewerPonyIds: [],
      loveSplits: [],
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

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const resizedRaw = await resizeImageToMax(file, 400, 400);
      setCropperRawImage(resizedRaw);
    } catch (err: any) {
      console.error('Image load error:', err);
      setUploadError(err?.message || 'Could not load selected image. Please try another image.');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password);
        setStep('create_pony');
      } else if (authMode === 'register') {
        if (!email.trim() || !password) {
          setAuthError('Please provide email and password');
          setIsSubmittingAuth(false);
          return;
        }
        await registerWithEmail(email, password, displayName || 'Pony Steward');
        setStep('create_pony');
      } else if (authMode === 'forgot_password') {
        if (!email.trim()) {
          setAuthError('Please enter your email address to reset your password.');
          setIsSubmittingAuth(false);
          return;
        }
        await resetPassword(email.trim());
        setAuthSuccessMsg(`Password reset link sent to ${email.trim()}! Please check your email inbox and spam folder.`);
      }
    } catch (err: any) {
      setAuthError(formatAuthError(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        setStep('create_pony');
      }
    } catch (err: any) {
      const formatted = formatAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const effectiveBorderColor = theme.transparentAllBorders ? 'transparent' : theme.borderColor;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300"
      style={{
        backgroundColor: theme.bgColor,
        ...(adminSettings.websiteBgImage
          ? {
              backgroundImage: `url("${adminSettings.websiteBgImage.replace(/["\\\n\r]/g, '')}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : {}),
      }}
    >
      <div
        className={`relative w-full ${step === 'create_pony' ? 'max-w-lg max-h-[85vh] rounded-2xl' : 'max-w-xl max-h-[90vh] rounded-3xl'} border shadow-2xl overflow-hidden flex flex-col theme-border-hover`}
        style={{
          backgroundColor: theme.bgColor,
          borderColor: effectiveBorderColor,
          color: theme.textColor,
        }}
      >
        {/* Close Button for Splash & Auth */}
        {step !== 'create_pony' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl border hover:opacity-80 transition-all cursor-pointer"
            style={{
              backgroundColor: theme.bgColor,
              borderColor: effectiveBorderColor,
              color: theme.textColor,
            }}
            title="Close splash modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Step 1: Splash Page */}
        {step === 'splash' && (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-6 overflow-y-auto min-h-[320px]">
            <h1 className="text-3xl font-black" style={{ color: theme.textColor }}>
              Welcome Ponies!
            </h1>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm pt-4">
              {user ? (
                <button
                  onClick={() => setStep('create_pony')}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm shadow-xl border flex items-center justify-center gap-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                    borderColor: effectiveBorderColor,
                  }}
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
                    className="w-full py-3.5 rounded-2xl font-bold text-sm shadow-xl border flex items-center justify-center gap-2 transition-all cursor-pointer"
                    style={{
                      backgroundColor: theme.buttonColor,
                      color: theme.buttonTextColor,
                      borderColor: effectiveBorderColor,
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register Pony</span>
                  </button>

                  <button
                    onClick={() => {
                      setAuthMode('signin');
                      setStep('auth');
                    }}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-2xl hover:opacity-80 font-bold text-xs border whitespace-nowrap transition-all cursor-pointer"
                    style={{
                      backgroundColor: theme.bgColor,
                      color: theme.textColor,
                      borderColor: effectiveBorderColor,
                    }}
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
              <h2 className="text-lg font-bold" style={{ color: theme.textColor }}>
                {authMode === 'register'
                  ? 'Create Account'
                  : authMode === 'signin'
                    ? 'Sign In to Your Account'
                    : 'Reset Your Password'}
              </h2>
              {authMode === 'forgot_password' && (
                <p className="text-xs opacity-80" style={{ color: theme.textColor }}>
                  Firebase will send a password reset link to your email.
                </p>
              )}
            </div>

            {authMode !== 'forgot_password' && (
              <div
                className="grid grid-cols-2 p-1 rounded-xl border text-xs max-w-sm mx-auto"
                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
              >
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(null); setAuthSuccessMsg(null); }}
                  className={`py-2 font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'register' ? '' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={authMode === 'register' ? {
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                  } : { color: theme.textColor }}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthError(null); setAuthSuccessMsg(null); }}
                  className={`py-2 font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'signin' ? '' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={authMode === 'signin' ? {
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                  } : { color: theme.textColor }}
                >
                  Sign In
                </button>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 max-w-md mx-auto text-xs">
              {authMode === 'register' && (
                <div>
                  <label htmlFor="onboard-display-name" className="font-medium block mb-1" style={{ color: theme.textColor }}>Pony Name *</label>
                  <input
                    id="onboard-display-name"
                    name="displayName"
                    autoComplete="name"
                    type="text"
                    required
                    placeholder=""
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 focus:outline-none"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              )}

              <div>
                <label htmlFor="onboard-email" className="font-medium block mb-1" style={{ color: theme.textColor }}>Email Address *</label>
                <input
                  id="onboard-email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  required
                  placeholder=""
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 focus:outline-none"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                />
              </div>

              {authMode !== 'forgot_password' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="onboard-password" className="font-medium block" style={{ color: theme.textColor }}>Password *</label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot_password');
                          setAuthError(null);
                          setAuthSuccessMsg(null);
                        }}
                        className="text-[11px] hover:underline transition-colors cursor-pointer"
                        style={{ color: theme.buttonColor }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="onboard-password"
                    name="password"
                    autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                    type="password"
                    required
                    placeholder=""
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 focus:outline-none"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full py-2.5 rounded-xl font-bold shadow-lg border flex items-center justify-center gap-2 cursor-pointer transition-all"
                  style={{
                    backgroundColor: theme.buttonColor,
                    color: theme.buttonTextColor,
                    borderColor: effectiveBorderColor,
                  }}
                >
                  {isSubmittingAuth ? (
                    <span>Processing...</span>
                  ) : authMode === 'forgot_password' ? (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Password Reset Link</span>
                    </>
                  ) : (
                    <>
                      <span>{authMode === 'register' ? 'Continue' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {authMode === 'forgot_password' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthError(null);
                      setAuthSuccessMsg(null);
                    }}
                    className="w-full py-2 rounded-xl hover:opacity-80 font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmittingAuth}
                    className="w-full py-2 rounded-xl hover:opacity-80 font-medium border flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"/>
                      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"/>
                    </svg>
                    Google Account
                  </button>
                )}
              </div>

              <div className="flex justify-start items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('splash')}
                  className="text-xs hover:underline cursor-pointer"
                  style={{ color: theme.textColor }}
                >
                  ← Back to Welcome
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Create Pony Profile (mirrors AddPonyModal) */}
        {step === 'create_pony' && (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: effectiveBorderColor, backgroundColor: theme.bgColor }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: theme.textColor }}>Create Pony Profile</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
                style={{ borderColor: effectiveBorderColor, backgroundColor: theme.bgColor, color: theme.textColor }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFinishOnboarding} className="p-6 space-y-4 text-xs overflow-y-auto">
              {uploadError && (
                <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Name & Avatar Icon */}
              <div className="flex items-center gap-3">
                <div className="relative group/icon w-14 h-14 flex-shrink-0">
                  {avatarIcon.startsWith('data:image') || avatarIcon.startsWith('http') || isEditingEmoticon ? (
                    isEditingEmoticon ? (
                      <input
                        type="text"
                        autoFocus
                        maxLength={24}
                        value={avatarIcon.startsWith('data:image') || avatarIcon.startsWith('http') ? '' : avatarIcon}
                        onChange={(e) => setAvatarIcon(e.target.value)}
                        onBlur={() => setIsEditingEmoticon(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setIsEditingEmoticon(false);
                        }}
                        placeholder="🦄"
                        className="w-full h-full rounded-xl border-2 text-center text-sm font-bold focus:outline-none"
                        style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                      />
                    ) : (
                      <img
                        src={avatarIcon}
                        alt="Preview"
                        className="w-full h-full rounded-xl object-cover border"
                        style={{ borderColor: effectiveBorderColor }}
                      />
                    )
                  ) : (
                    <div
                      className="w-full h-full rounded-xl border flex items-center justify-center font-bold overflow-hidden px-1 text-center"
                      style={{
                        backgroundColor: theme.bgColor,
                        borderColor: effectiveBorderColor,
                        color: theme.textColor,
                        fontSize: [...avatarIcon].length >= 4 ? '11px' : [...avatarIcon].length >= 2 ? '15px' : '24px',
                      }}
                    >
                      {avatarIcon}
                    </div>
                  )}
                  {adminSettings.allowAvatarImageUpload && !avatarIcon.startsWith('data:image') && !avatarIcon.startsWith('http') && !isEditingEmoticon && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer" title="Upload custom avatar image">
                      <Upload className="w-4 h-4 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingEmoticon(!isEditingEmoticon);
                    }}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform z-20"
                    style={{
                      backgroundColor: theme.buttonColor,
                      color: theme.buttonTextColor,
                      borderColor: effectiveBorderColor,
                    }}
                    title="Edit emoji or emoticon"
                  >
                    <Smile className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex-1">
                  <label htmlFor="onboard-pony-name" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>Pony Name *</label>
                  <input
                    id="onboard-pony-name"
                    name="ponyName"
                    type="text"
                    required
                    placeholder=""
                    value={ponyName}
                    onChange={(e) => setPonyName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-bold focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              </div>

              {/* Species & Element */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="onboard-species" className="font-medium block mb-1" style={{ color: theme.textColor }}>
                    Species
                  </label>
                  <input
                    id="onboard-species"
                    name="species"
                    type="text"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-element" className="font-medium block mb-1" style={{ color: theme.textColor }}>
                    Element / Affinity
                  </label>
                  <input
                    id="onboard-element"
                    name="element"
                    type="text"
                    value={element}
                    onChange={(e) => setElement(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              </div>

              {/* Extended Profile Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="onboard-favoriteTreat" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Favorite Treat
                  </label>
                  <input
                    id="onboard-favoriteTreat"
                    name="favoriteTreat"
                    type="text"
                    value={favoriteTreat}
                    onChange={(e) => setFavoriteTreat(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-hobby" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Hobby
                  </label>
                  <input
                    id="onboard-hobby"
                    name="hobby"
                    type="text"
                    value={hobby}
                    onChange={(e) => setHobby(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-personality" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Personality
                  </label>
                  <input
                    id="onboard-personality"
                    name="personality"
                    type="text"
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-magicalAffinity" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Magical Affinity
                  </label>
                  <input
                    id="onboard-magicalAffinity"
                    name="magicalAffinity"
                    type="text"
                    value={magicalAffinity}
                    onChange={(e) => setMagicalAffinity(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              </div>

              {/* Cutie Mark & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="onboard-cutieMark" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Cutie Mark
                  </label>
                  <input
                    id="onboard-cutieMark"
                    name="cutieMark"
                    type="text"
                    value={cutieMark}
                    onChange={(e) => setCutieMark(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
                <div>
                  <label htmlFor="onboard-location" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                    Location
                  </label>
                  <input
                    id="onboard-location"
                    name="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder=""
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none theme-border-hover"
                    style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                  />
                </div>
              </div>

              {/* Backstory */}
              <div>
                <label htmlFor="onboard-backstory" className="text-[10px] font-bold uppercase mb-0.5 block opacity-70" style={{ color: theme.textColor }}>
                  Backstory
                </label>
                <textarea
                  id="onboard-backstory"
                  name="backstory"
                  rows={2}
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder=""
                  className="w-full border rounded-lg p-2.5 focus:outline-none resize-none theme-border-hover"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                />
              </div>

              {/* Information & Notes */}
              <div>
                <label htmlFor="onboard-notes" className="font-medium block mb-1 opacity-70" style={{ color: theme.textColor }}>Notes</label>
                <textarea
                  id="onboard-notes"
                  name="notes"
                  rows={3}
                  placeholder=""
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded-lg p-2.5 focus:outline-none resize-none theme-border-hover"
                  style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                />
              </div>

              {/* Actions */}
              <div
                className="flex justify-between items-center pt-2 border-t"
                style={{ borderColor: effectiveBorderColor }}
              >
                <button
                  type="button"
                  onClick={() => setStep('splash')}
                  className="px-4 py-2 rounded-xl border font-medium cursor-pointer hover:opacity-80 transition-all theme-border-hover"
                  style={{ backgroundColor: theme.bgColor, color: theme.textColor, borderColor: effectiveBorderColor }}
                >
                  ← Back
                </button>

                <button
                  type="submit"
                  disabled={!ponyName.trim()}
                  className="px-5 py-2 rounded-xl font-bold shadow-lg border transition-all cursor-pointer hover:opacity-90 disabled:opacity-50 theme-border-hover"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: effectiveBorderColor }}
                >
                  Complete registry
                </button>
              </div>
            </form>
          </>
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
        title="Crop & Zoom Avatar Image"
        outputWidth={400}
        outputHeight={400}
      />
    </div>
  );
};
