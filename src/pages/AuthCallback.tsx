import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { reportAuthError } from '@/lib/errorReporter';
import { CheckCircle2, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PENDING_KEY = 'visibill_pending_callback_hash';
const SESSION_KEY = 'visibill_email_change_confirmed';

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
        // Read the hash from sessionStorage first — the IIFE saves it synchronously
        // before Supabase's async init has a chance to clear it from the URL.
        const savedHash = sessionStorage.getItem(PENDING_KEY) || window.location.hash;
        sessionStorage.removeItem(PENDING_KEY);

        const hashParams = new URLSearchParams(savedHash.replace('#', ''));
        const hashType = hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const hashError = hashParams.get('error');
        const hashErrorCode = hashParams.get('error_code');

        // ── Email change: expired/already-used token ──────────────────────────
        if (hashError && (hashErrorCode === 'otp_expired' || savedHash.includes('expired'))) {
          if (sessionStorage.getItem(SESSION_KEY)) {
            sessionStorage.removeItem(SESSION_KEY);
            setEmailChanged(true);
          } else {
            setError('Ez a megerősítő link már lejárt vagy fel lett használva. Ha az email váltás még nem sikerült, kérj új linket.');
          }
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        // ── Email change: successful confirmation ─────────────────────────────
        if (hashType === 'email_change' && accessToken) {
          // Supabase auto-processes the hash and updates the email.
          // Sign out so the user logs in fresh with their new email address.
          await supabase.auth.signOut();
          // Persist the confirmation so a second (expired) click still shows the screen
          sessionStorage.setItem(SESSION_KEY, '1');
          setEmailChanged(true);
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        // ── Implicit flow access_token (non-email_change, e.g. magic link) ───
        if (accessToken) {
          await new Promise(r => setTimeout(r, 500));
          navigate('/', { replace: true });
          return;
        }

        // ── OAuth PKCE flow (code exchange) ───────────────────────────────────
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

  // ── Email change confirmation screen ───────────────────────────────────────
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

  // ── Error screen ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Hiba történt</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button
            variant="outline"
            onClick={() => navigate('/auth', { replace: true })}
            className="w-full"
          >
            Vissza a bejelentkezéshez
          </Button>
        </div>
      </div>
    );
  }

  return <LoadingSpinner message="Bejelentkezés..." />;
}
