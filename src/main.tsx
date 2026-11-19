import { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { cleanupCacheBustParam, isChunkOrLoadError, performHardRefresh } from './utils/cacheRefresh';
import './index.css';

declare global {
  interface Window {
    __cancelBootWatchdog?: () => void;
    __ponyHardRefresh?: () => void;
  }
}

function isFirebaseOrAuthError(reason: unknown): boolean {
  const code = (reason as { code?: string } | null)?.code || '';
  const msg =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === 'string'
        ? reason
        : String(reason || '');
  const lower = `${code} ${msg}`.toLowerCase();
  return (
    lower.includes('firebase') ||
    lower.includes('firestore') ||
    lower.includes('auth/') ||
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('operationtype')
  );
}

cleanupCacheBustParam();
if (typeof window !== 'undefined') {
  window.__cancelBootWatchdog?.();
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkOrLoadError(event.reason) || isFirebaseOrAuthError(event.reason)) {
      event.preventDefault();
      void performHardRefresh();
    }
  });
  window.addEventListener('error', (event) => {
    if (isFirebaseOrAuthError(event.error || event.message)) {
      event.preventDefault();
      void performHardRefresh();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (isChunkOrLoadError(error) || isFirebaseOrAuthError(error)) {
      void performHardRefresh();
      return;
    }
    void performHardRefresh();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AuthProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </AuthProvider>
  </ErrorBoundary>
);
