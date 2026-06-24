import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { reportAuthError } from '@/lib/errorReporter';
import { CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AuthCallback — handles the OAuth redirect from Google (and other providers),
 * and also handles Supabase email_change confirmation links.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for hash-based tokens first (implicit flow / email change)
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const hashType = hashParams.get('type');
        const accessToken = hashParams.get('access_token');

        // Email change confirmation
        if (hashType === 'email_change' && accessToken) {
          // Supabase auto-processes the hash — sign out so user logs in fresh with new email
          await supabase.auth.signOut();
          setEmailChanged(true);
          // Clean the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        // Handle implicit flow access_token (non-email_change)
        if (accessToken) {
          await new Promise(r => setTimeout(r, 500));
          navigate('/', { replace: true });
          return;
        }

        // Get the URL params — Supabase OAuth returns `code` for PKCE flow
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorParam) {
          reportAuthError('AuthCallback', 'oauth_error', errorDescription || errorParam, undefined, { errorParam, errorDescription });
          setError(errorDescription || errorParam);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            reportAuthError('AuthCallback', 'session_exchange', exchangeError.message, exchangeError);
            setError(exchangeError.message);
            return;
          }
        }

        navigate('/', { replace: true });
      } catch (err: any) {
        reportAuthError('AuthCallback', 'callback', err.message || 'Auth callback error', err);
        setError(err.message || 'Ismeretlen hiba történt');
      }
    };

    handleCallback();
  }, [navigate]);

  if (emailChanged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Email cím sikeresen megváltoztatva
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Az új email cím megerősítve. Kérjük, jelentkezz be az új email címeddel a folytatáshoz.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <Mail className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Új email cím aktív</span>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate('/auth', { replace: true })}
          >
            Bejelentkezés
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Bejelentkezés sikertelen</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Vissza a bejelentkezéshez
          </button>
        </div>
      </div>
    );
  }

  return <LoadingSpinner message="Bejelentkezés..." />;
}
