import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { reportError } from '@/lib/errorReporter';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isChunkError: false
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorMessage = error.message || '';
    const isChunkError = 
      error.name === 'ChunkLoadError' ||
      /ChunkLoadError/i.test(error.message) ||
      /Failed to fetch dynamically imported module/i.test(errorMessage) ||
      /error loading dynamically imported module/i.test(errorMessage) ||
      /loading chunk/i.test(errorMessage);

    return {
      hasError: true,
      error,
      isChunkError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({ 
      type: 'frontend', 
      component: 'ErrorBoundary', 
      action: 'error', 
      message: 'ErrorBoundary caught an error:', 
      error: error, 
      context: { componentStack: errorInfo.componentStack } 
    });

    // Remove the HTML initial-loader so the error UI is visible
    try {
      const loader = document.getElementById('initial-loader');
      if (loader) {
        loader.remove();
      }
    } catch (e) {
      reportError({ type: 'db_query', component: 'ErrorBoundary', action: 'error', message: 'Failed to remove initial-loader in ErrorBoundary', error: e });
    }

    // If it's a chunk loading failure, attempt auto-recovery
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
        console.warn('Chunk load error detected. Attempting automatic page reload...');
        window.location.reload();
      }
    } catch (e) {
      reportError({ type: 'db_query', component: 'ErrorBoundary', action: 'error', message: 'Failed to auto-reload on chunk error', error: e });
    }
  };

  handleManualReload = () => {
    window.location.reload();
  };

  handleResetAndSignOut = async () => {
    try {
      // Clear security keys
      const keysToDelete = [
        'sb-vxxgvdlqvvchtlmqnrqf-auth-token',
        'visibill_last_active'
      ];
      
      keysToDelete.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      // Clear all other prefixed keys
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('visibill_') || key.startsWith('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch {}

      try { sessionStorage.clear(); } catch {}

      // Hard redirect to root which will send user to auth
      window.location.href = '/auth';
    } catch (e) {
      reportError({ type: 'db_query', component: 'ErrorBoundary', action: 'error', message: 'Failed to clear credentials', error: e });
      window.location.href = '/auth';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="h-10 w-10 rounded-full border-4 border-primary border-r-transparent animate-spin" />
              <h2 className="text-lg font-semibold text-foreground">Frissítések letöltése...</h2>
              <p className="text-sm text-muted-foreground">
                Az alkalmazás új verziója elérhető. Az oldal automatikusan újratöltődik a frissítések alkalmazásához.
              </p>
              <Button onClick={this.handleManualReload} variant="outline" size="sm" className="mt-2 gap-2">
                <RefreshCw className="h-4 w-4" /> Kézi újratöltés
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full border-destructive/30 shadow-lg bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg font-semibold">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Valami hiba történt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Az oldal betöltése vagy futtatása során váratlan hiba lépett fel. Ez okozhatja az oldalak kifehéredését vagy hibás viselkedését.
              </p>

              {this.state.error && (
                <div className="bg-muted/50 border border-border/50 rounded-md p-3 max-h-32 overflow-y-auto font-mono text-[10px] text-muted-foreground">
                  <div className="font-semibold text-foreground/80 mb-1">{this.state.error.name}: {this.state.error.message}</div>
                  {this.state.error.stack}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={this.handleManualReload} className="w-full gap-2 text-sm h-10 font-medium">
                  <RefreshCw className="h-4 w-4 animate-hover-spin" />
                  Oldal újratöltése
                </Button>
                <Button onClick={this.handleResetAndSignOut} variant="ghost" className="w-full gap-2 text-sm text-muted-foreground hover:text-destructive h-10 font-medium">
                  <LogOut className="h-4 w-4" />
                  Gyorsítótár törlése és kijelentkezés
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
