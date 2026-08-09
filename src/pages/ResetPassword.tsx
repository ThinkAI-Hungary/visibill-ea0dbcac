import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, ArrowLeft, X, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { reportAuthError } from '@/lib/errorReporter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

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

    // If recovery state is invalid and we are done checking (e.g. on page reload or link expired),
    // immediately sign out of Supabase to invalidate any residual recovery session locally.
    if (!isValidRecovery && !checking) {
      console.log('[ResetPassword] Invalid recovery state on load. Invalidate local session.');
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return;
    }

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

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[._?@>!#$~%^&*()\-+=]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      toast({
        title: 'Gyenge jelszó',
        description: 'A jelszónak tartalmaznia kell kisbetűt, nagybetűt, számot és speciális karaktert (._?@>!#$~%^&*()+-=).',
        variant: 'destructive'
      });
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

  const handleBackToLogin = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}
    navigate('/auth');
  };

  const { theme } = useTheme();

  const renderContent = () => {
    if (isExpired) {
      return (
        <div className="w-full max-w-md bg-white/80 dark:bg-[#07100e]/90 border border-slate-200/50 dark:border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 mx-4 text-center space-y-5 animate-fade-in">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors z-20"
            onClick={handleBackToLogin}
            title="Vissza a bejelentkezéshez"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          <h1 className="text-2xl font-bold text-foreground">Jelszó visszaállítás</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A link érvénytelen vagy lejárt. Kérjük, próbálj meg egy újat kérni.
          </p>
          <Button
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 dark:bg-[#0d2321] dark:text-primary dark:border dark:border-primary/30 dark:hover:bg-[#112d2a] dark:shadow-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            onClick={handleNewLinkRequest}
          >
            Jelszóemlékeztető újraküldése
          </Button>
        </div>
      );
    }

    if (checking && !isValidRecovery) {
      return (
        <div className="w-full max-w-md bg-white/80 dark:bg-[#07100e]/90 border border-slate-200/50 dark:border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 mx-4 text-center space-y-4 animate-fade-in py-12">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors z-20"
            onClick={handleBackToLogin}
            title="Vissza a bejelentkezéshez"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Biztonsági kapcsolat ellenőrzése...</p>
        </div>
      );
    }

    if (!isValidRecovery) {
      return (
        <div className="w-full max-w-md bg-white/80 dark:bg-[#07100e]/90 border border-slate-200/50 dark:border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 mx-4 text-center space-y-5 animate-fade-in">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors z-20"
            onClick={handleBackToLogin}
            title="Vissza a bejelentkezéshez"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          <h1 className="text-2xl font-bold text-foreground">Jelszó visszaállítás</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A link érvénytelen vagy lejárt. Kérjük, próbálj meg egy újat kérni.
          </p>
          <Button
            onClick={handleNewLinkRequest}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 dark:bg-[#0d2321] dark:text-primary dark:border dark:border-primary/30 dark:hover:bg-[#112d2a] dark:shadow-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          >
            Jelszóemlékeztető újraküldése
          </Button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="w-full max-w-md bg-white/80 dark:bg-[#07100e]/90 border border-slate-200/50 dark:border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 mx-4 text-center space-y-4 animate-fade-in py-12">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">Jelszó mentése...</p>
        </div>
      );
    }

    return (
      <div className="w-full max-w-md bg-white/80 dark:bg-[#07100e]/90 border border-slate-200/50 dark:border-primary/20 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 mx-4 space-y-6 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors z-20"
          onClick={handleBackToLogin}
          title="Vissza a bejelentkezéshez"
        >
          <LogOut className="h-4 w-4" />
        </Button>

        <div>
          <span className="text-3xl tracking-tight select-none">
            <span className="font-medium text-foreground/80">e</span>
            <span className="font-bold text-primary">ai</span>
            <span className="font-medium text-foreground/80">sy</span>
            <span className="font-medium text-primary">bill</span>
          </span>
          <h1 className="text-2xl font-bold text-foreground mt-4">Új jelszó beállítása</h1>
          <p className="text-muted-foreground text-sm mt-1">Add meg az új jelszavadat</p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-5">
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
                className={cn(
                  "pl-10 h-11 bg-white/80 dark:bg-[#0a1512] border focus:ring-2 focus:ring-primary/20 rounded-xl transition-colors",
                  password.length > 0 && !(/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[._?@>!#$~%^&*()\-+=]/.test(password))
                    ? "border-amber-400 dark:border-amber-500"
                    : "border-slate-200 dark:border-border focus:border-primary"
                )}
                required
                minLength={6}
              />
            </div>
            
            {/* Password strength indicators */}
            {password.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 animate-fade-in">
                {[
                  { label: 'Nagybetű (A-Z)', valid: /[A-Z]/.test(password) },
                  { label: 'Kisbetű (a-z)', valid: /[a-z]/.test(password) },
                  { label: 'Szám (0-9)', valid: /\d/.test(password) },
                  { label: 'Speciális (._?@>!#$~%^&*()+-=)', valid: /[._?@>!#$~%^&*()\-+=]/.test(password) },
                ].map((rule) => (
                  <div key={rule.label} className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                      rule.valid ? "bg-primary" : "bg-muted-foreground/30"
                    )} />
                    <span className={cn(
                      "text-[10px] transition-colors duration-300",
                      rule.valid ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                className="pl-10 h-11 bg-white/80 dark:bg-[#0a1512] border border-slate-200 dark:border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 dark:bg-[#0d2321] dark:text-primary dark:border dark:border-primary/30 dark:hover:bg-[#112d2a] dark:shadow-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            disabled={loading}
          >
            Jelszó mentése
          </Button>
        </form>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Full-screen wave background */}
      <img
        src={theme === 'dark' ? '/eaisybill_wave_dark.webp' : '/eaisybill_wave_bright.webp'}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0 transition-all duration-500"
      />
      {renderContent()}
    </div>
  );
};

export default ResetPassword;