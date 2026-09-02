/**
 * AccountyErrorBoundary — Section-level error boundary for Accounty pages.
 * 
 * Unlike the global ErrorBoundary (which shows a full-screen error), this one
 * renders an inline error state so the rest of the page (sidebar, header) remains
 * functional. Users can retry without losing their navigation context.
 */
import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/errorReporter';

interface Props {
  children: React.ReactNode;
  /** Optional fallback component. If not provided, a default error UI is rendered. */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export class AccountyErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorMessage = error?.message || '';
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /ChunkLoadError/i.test(errorMessage) ||
      /Failed to fetch dynamically imported module/i.test(errorMessage) ||
      /error loading dynamically imported module/i.test(errorMessage) ||
      /loading chunk/i.test(errorMessage);

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({
      type: 'render',
      component: 'AccountyErrorBoundary',
      action: 'component_crash',
      message: error.message,
      error,
      context: { componentStack: errorInfo.componentStack },
    });

    if (this.state.isChunkError) {
      this.handleChunkLoadError();
    }
  }

  handleChunkLoadError = () => {
    try {
      const now = Date.now();
      const lastReload = sessionStorage.getItem('visibill_chunk_reload_ts');

      // If we haven't reloaded due to a chunk error in the last 10 seconds, reload now
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('visibill_chunk_reload_ts', now.toString());
        console.warn('[AccountyErrorBoundary] Chunk load error detected. Attempting automatic page reload...');
        window.location.reload();
      }
    } catch (e) {
      reportError({
        type: 'render',
        component: 'AccountyErrorBoundary',
        action: 'auto_reload_failure',
        message: 'Failed to auto-reload on chunk error',
        error: e,
      });
    }
  };

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="w-full flex flex-col items-center justify-center py-20 px-6 animate-in fade-in duration-300">
          <div className="max-w-md w-full bg-card rounded-xl border border-border shadow-soft p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                Hiba történt az oldal megjelenítésekor
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Az oldal egy részének betöltése sikertelen volt. 
                Próbáld újra, vagy lépj vissza az előző oldalra.
              </p>
            </div>

            {this.state.error && import.meta.env.DEV && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-left">
                <p className="font-mono text-[10px] text-red-600 dark:text-red-400 break-all">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={this.handleGoBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Vissza
              </Button>
              <Button size="sm" onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Újrapróbálás
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
