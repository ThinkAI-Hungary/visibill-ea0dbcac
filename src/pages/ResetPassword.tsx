import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { reportAuthError } from '@/lib/errorReporter';
import { useAuth } from '@/contexts/AuthContext';

// Read + clear the synchronously-captured hash state set by the App.tsx IIFE.
// The IIFE runs before Supabase SDK init wipes window.location.hash via replaceState,
// so this is the only reliable source of the original hash type.
const RESET_PW_STATE_KEY = 'visibill_reset_pw_state';
function consumeResetPwState(): 'recovery' | 'expired' | null {
  try {
    const val = sessionStorage.getItem(RESET_PW_STATE_KEY);
    if (val === 'recovery' || val === 'expired') {
      sessionStorage.removeItem(RESET_PW_STATE_KEY);
      return val;
    }
  } catch {}
  return null;
}

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isPasswordRecovery, completeRecovery } = useAuth();

  // consumeResetPwState() MUST run only once (on mount), via lazy useState initializer.
  // If called on every render, it returns null after the first render (sessionStorage
  // already cleared), causing the component to switch to the "invalid link" screen
  // the moment the user starts typing.
  const [storedState] = useState<'recovery' | 'expired' | null>(() => consumeResetPwState());

  // isExpired is derived once from storedState (stable) + hash fallback (also stable at mount)
  const [isExpired] = useState(() => {
    if (storedState === 'expired') return true;
    const p = new URLSearchParams(window.location.hash.replace('#', ''));
    return p.get('error_code') === 'otp_expired'
      || (p.get('error') === 'access_denied' && !!p.get('error_code'));
  });

  // isValidRecovery latches to true and stays true for the lifetime of this component.
  // isPasswordRecovery from context gets cleared by PasswordRecoveryRedirect as soon as
  // we're on /reset-password — so we must not rely on it staying true across re-renders.
  const [isValidRecovery, setIsValidRecovery] = useState(
    () => storedState === 'recovery' || isPasswordRecovery || window.location.hash.includes('type=recovery')
  );

  // Wait for the SDK to fire PASSWORD_RECOVERY if we don't have storage confirmation yet.
  const [checking, setChecking] = useState(!isValidRecovery && !isExpired);

  useEffect(() => {
    if (isValidRecovery) return; // already confirmed, nothing to do
    if (isPasswordRecovery) {
      setIsValidRecovery(true);
      setChecking(false);
      return;
    }
    if (!checking) return;
    const timer = setTimeout(() => setChecking(false), 800);
    return () => clearTimeout(timer);
  }, [isPasswordRecovery, isValidRecovery, checking]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'A jelszavak nem egyeznek', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'A jelszónak legalább 6 karakter hosszúnak kell lennie', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      completeRecovery();

      toast({ title: 'Jelszó sikeresen megváltoztatva!' });
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error: any) {
      reportAuthError('ResetPassword', 'update_password', error.message || 'Password reset error', error);
      toast({ title: error.message || 'Hiba történt a jelszó visszaállítása során', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Navigate to forgot-password form, signing out first so an active session
  // cannot auto-redirect the user to the dashboard instead of showing the form.
  const handleNewLinkRequest = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    navigate('/auth?forgot=1');
  };

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">A link lejárt</h1>
          <p className="text-muted-foreground">
            Ez a jelszó-visszaállító link már nem érvényes (lejárt vagy már felhasználták).
            Kérj egy új linket az email címedre.
          </p>
          <Button className="w-full" onClick={handleNewLinkRequest}>
            Új link kérése
          </Button>
        </div>
      </div>
    );
  }

  if (checking && !isValidRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Ellenőrzés...</p>
        </div>
      </div>
    );
  }

  if (!isValidRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Jelszó visszaállítás</h1>
          <p className="text-muted-foreground">
            Érvénytelen visszaállítási link. Kérj új linket az email címedre.
          </p>
          <Button onClick={handleNewLinkRequest} className="w-full">
            Új link kérése
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <span className="text-4xl tracking-tight select-none">
            <span className="font-medium text-foreground/80">e</span>
            <span className="font-bold text-primary">ai</span>
            <span className="font-medium text-foreground/80">sy</span>
            <span className="font-medium text-primary">bill</span>
          </span>
          <h1 className="text-2xl font-bold text-foreground mt-4">Új jelszó beállítása</h1>
          <p className="text-muted-foreground mt-1">Add meg az új jelszavadat</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Új jelszó</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Legalább 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Jelszó megerősítése</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="Jelszó ismétlése"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? 'Mentés...' : 'Jelszó mentése'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;