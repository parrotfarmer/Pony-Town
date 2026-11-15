import React, { Component, ReactNode } from 'react';
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

cleanupCacheBustParam();
if (typeof window !== 'undefined') {
  window.__cancelBootWatchdog?.();
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkOrLoadError(event.reason)) {
      void performHardRefresh();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Startup Error:', error, errorInfo);
    if (isChunkOrLoadError(error)) {
      void performHardRefresh();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#020617', color: '#f1f5f9', padding: '40px', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f43f5e', marginBottom: '12px' }}>⚠️ Application Startup Error</h2>
          <pre style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid rgba(244,63,94,0.3)', maxWidth: '600px', width: '100%', overflowX: 'auto', fontSize: '13px', textAlign: 'left', color: '#fda4af' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => {
              void performHardRefresh(true);
            }}
            style={{ marginTop: '16px', padding: '10px 18px', borderRadius: '10px', background: '#db2777', color: '#ffffff', fontWeight: 'bold', fontSize: '13px', border: 'none', cursor: 'pointer' }}
          >
            Hard Reload Latest Version
          </button>
          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '16px', maxWidth: '500px' }}>
            Please check your browser console (F12) and ensure your Firebase authorized domains include your GitHub Pages URL.
          </p>
        </div>
      );
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
