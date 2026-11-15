import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatAuthError } from '../utils/authErrors';
import { X, LogIn, UserPlus, Sparkles, CheckCircle2, AlertCircle, KeyRound, Mail, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, registerWithEmail, signInWithEmail, resetPassword } = useAuth();
  const { theme } = useSettings();

  const [mode, setMode] = useState<'signin' | 'register' | 'forgot_password'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        onClose();
      }
    } catch (err: any) {
      const formatted = formatAuthError(err);
      if (formatted) {
        setErrorMsg(formatted);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === 'register') {
        if (!email.trim() || !password || !displayName.trim()) {
          setErrorMsg('Please complete all required fields.');
          setIsSubmitting(false);
          return;
        }

        await registerWithEmail(email, password, displayName);
        setSuccessMsg('Account created successfully!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else if (mode === 'forgot_password') {
        if (!email.trim()) {
          setErrorMsg('Please enter your email address to receive a password reset link.');
          setIsSubmitting(false);
          return;
        }

        await resetPassword(email.trim());
        setSuccessMsg(`A password reset link has been sent to ${email.trim()}. Please check your email inbox and spam folder.`);
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{ borderColor: theme.borderColor }}
      >
        
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-slate-950/60"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 border" style={{ borderColor: theme.borderColor, color: theme.textColor }}>
              {mode === 'forgot_password' ? (
                <KeyRound className="w-5 h-5 text-pink-400" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: theme.textColor }}>
                {mode === 'signin' 
                  ? 'Sign In' 
                  : mode === 'register' 
                    ? 'Create Account' 
                    : 'Reset Password'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'signin' 
                  ? 'Access your saved pony network state' 
                  : mode === 'register' 
                    ? 'Register a new account' 
                    : 'Firebase will send a secure reset link to your email'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (only for signin / register) */}
        {mode !== 'forgot_password' && (
          <div 
            className="grid grid-cols-2 bg-slate-950 p-1 border-b text-xs"
            style={{ borderColor: theme.borderColor }}
          >
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
              className="py-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border"
              style={mode === 'signin' ? {
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
                borderColor: theme.borderColor
              } : {
                borderColor: 'transparent',
                color: theme.textColor,
                opacity: 0.6
              }}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
              className="py-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 border"
              style={mode === 'register' ? {
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
                borderColor: theme.borderColor
              } : {
                borderColor: 'transparent',
                color: theme.textColor,
                opacity: 0.6
              }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-display-name" className="font-medium block mb-1" style={{ color: theme.textColor }}>Display Name *</label>
              <input
                id="auth-display-name"
                name="displayName"
                autoComplete="name"
                type="text"
                required
                placeholder="e.g. Celestia Steward"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none"
                style={{ borderColor: theme.borderColor }}
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="font-medium block mb-1" style={{ color: theme.textColor }}>Email Address *</label>
            <input
              id="auth-email"
              name="email"
              autoComplete="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none"
              style={{ borderColor: theme.borderColor }}
            />
          </div>

          {mode !== 'forgot_password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-password" className="font-medium block" style={{ color: theme.textColor }}>Password *</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                name="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none"
                style={{ borderColor: theme.borderColor }}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 border transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.buttonColor,
                color: theme.buttonTextColor,
                borderColor: theme.borderColor
              }}
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Password Reset Link
                </>
              )}
            </button>

            {mode === 'forgot_password' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border flex items-center justify-center gap-1.5 transition-all"
                style={{ borderColor: theme.borderColor }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            ) : (
              <>
                <div className="relative my-3 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" style={{ borderColor: theme.borderColor }} />
                  </div>
                  <span className="relative bg-slate-900 px-2 text-[10px] uppercase tracking-wider" style={{ color: theme.textColor, opacity: 0.7 }}>
                    Or Continue With
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  style={{ borderColor: theme.borderColor }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"
                    />
                  </svg>
                  Google Account (Popup)
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
