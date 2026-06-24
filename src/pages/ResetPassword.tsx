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

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Give the SDK a moment to process the hash before deciding it's invalid
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { isPasswordRecovery } = useAuth();

  useEffect(() => {
    // URL hash check (instant) — covers the case where the component mounts
    // before onAuthStateChange fires in AuthContext
    const hash = window.location.hash;
    const hasRecoveryHash = hash.includes('type=recovery');

    if (hasRecoveryHash || isPasswordRecovery) {
      setChecking(false);
      return;
    }

    // Wait briefly for AuthContext to process the PASSWORD_RECOVERY event
    // (Supabase SDK fires it async after parsing the hash)
    const timer = setTimeout(() => setChecking(false), 800);
    return () => clearTimeout(timer);
  }, [isPasswordRecovery]);

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

      toast({ title: 'Jelszó sikeresen megváltoztatva!' });
      navigate('/');
    } catch (error: any) {
      reportAuthError('ResetPassword', 'update_password', error.message || 'Password reset error', error);
      toast({ title: error.message || 'Hiba történt a jelszó visszaállítása során', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isRecovery = isPasswordRecovery || window.location.hash.includes('type=recovery');

  // Check for Supabase error in the hash (e.g. expired link)
  const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
  const isExpired = hashParams.get('error_code') === 'otp_expired'
    || (hashParams.get('error') === 'access_denied' && window.location.hash.includes('expired'));

  // Expired link — show specific message with shortcut to forgot-password flow
  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">A link lejárt</h1>
          <p className="text-muted-foreground">
            Ez a jelszó-visszaállító link már nem érvényes (lejárt vagy már felhasználták).
            Kérj egy új linket az email címedre.
          </p>
          <Button
            className="w-full"
            onClick={() => navigate('/auth?forgot=1')}
          >
            Új link kérése
          </Button>
        </div>
      </div>
    );
  }

  // Still waiting for the SDK to process the hash
  if (checking && !isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Ellenőrzés...</p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Jelszó visszaállítás</h1>
          <p className="text-muted-foreground">
            Érvénytelen visszaállítási link. Kérj új linket az email címedre.
          </p>
          <Button onClick={() => navigate('/auth?forgot=1')} className="w-full">
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
