import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Sun,
  Moon,
  Mail,
  Lock,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
} from 'lucide-react';

interface TokenData {
  id: string;
  employee_name: string;
  company_id: string;
  company_name: string;
  employee_type: 'employee' | 'contractor';
}

type PageState = 'loading' | 'valid' | 'invalid' | 'registering' | 'success';

export default function EmployeeRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validate token on load
  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    const validateToken = async () => {
      try {
        // Look up the employee_rates record by token, join company name
        const { data, error } = await supabase
          .from('employee_rates')
          .select('id, employee_name, company_id, employee_type')
          .eq('registration_token', token)
          .is('user_id', null) // Only valid if not already linked
          .maybeSingle();

        if (error || !data) {
          setPageState('invalid');
          return;
        }

        // Get company name
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', data.company_id)
          .single();

        setTokenData({
          ...data,
          employee_type: data.employee_type as TokenData['employee_type'],
          company_name: company?.name || 'Ismeretlen cég',
        });
        setPageState('valid');
      } catch {
        setPageState('invalid');
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'A jelszavak nem egyeznek',
        description: 'Kérlek ellenőrizd a megadott jelszavakat.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Túl rövid jelszó',
        description: 'A jelszónak legalább 6 karakter hosszúnak kell lennie.',
      });
      return;
    }

    if (!tokenData) return;

    setPageState('registering');

    try {
      // 1. Create the auth user
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: tokenData.employee_name,
            },
          },
        });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error('Nem sikerült létrehozni a fiókot.');

      // 2. Link user to employee_rates
      const { error: linkError } = await supabase
        .from('employee_rates')
        .update({
          user_id: newUserId,
          email: email,
          registration_token: null, // Invalidate the token
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenData.id);

      if (linkError) {
        console.error('Link error:', linkError);
        // Don't throw — user is already created, they just need manual linking
      }

      // 3. Add as company member with 'employee' role
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: tokenData.company_id,
          user_id: newUserId,
          role: 'employee',
        });

      if (memberError) {
        console.error('Member insert error:', memberError);
        // Don't throw — important but not blocking
      }

      setPageState('success');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast({
        variant: 'destructive',
        title: 'Regisztráció sikertelen',
        description: err.message || 'Ismeretlen hiba történt.',
      });
      setPageState('valid');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute left-6 top-6 p-2 rounded-full hover:bg-secondary/80 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        ) : (
          <Moon className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>

      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <span className="text-4xl tracking-tight select-none">
            <span className="font-medium text-foreground/80">e</span>
            <span className="font-bold text-primary">ai</span>
            <span className="font-medium text-foreground/80">sy</span>
            <span className="font-medium text-primary">bill</span>
          </span>
        </div>

        {/* Loading */}
        {pageState === 'loading' && (
          <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Link ellenőrzése...</p>
            </CardContent>
          </Card>
        )}

        {/* Invalid token */}
        {pageState === 'invalid' && (
          <Card className="rounded-xl border-destructive/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold">Érvénytelen link</h2>
              <p className="text-muted-foreground max-w-xs">
                Ez a regisztrációs link érvénytelen vagy már felhasználták.
                Kérd az adminisztrátortól egy új linket.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate('/auth')}
              >
                Vissza a bejelentkezéshez
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Valid — Registration Form */}
        {(pageState === 'valid' || pageState === 'registering') &&
          tokenData && (
            <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8">
                {/* Welcome */}
                <div className="mb-6 space-y-2">
                  <h2 className="text-2xl font-bold">
                    Üdvözlünk, {tokenData.employee_name}!
                  </h2>
                  <p className="text-muted-foreground">
                    Hozd létre a fiókodat a munkaidő-nyilvántartóhoz.
                  </p>
                </div>

                {/* Company info */}
                <div className="mb-6 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {tokenData.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tokenData.employee_type === 'employee'
                        ? 'Bejelentett dolgozó'
                        : 'Alvállalkozó'}
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm font-medium">
                      Email cím
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="pelda@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={pageState === 'registering'}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="reg-password"
                      className="text-sm font-medium"
                    >
                      Jelszó
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="Legalább 6 karakter"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                        disabled={pageState === 'registering'}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="reg-confirm"
                      className="text-sm font-medium"
                    >
                      Jelszó megerősítése
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-confirm"
                        type="password"
                        placeholder="Jelszó ismét"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={cn(
                          'pl-10',
                          confirmPassword &&
                            password !== confirmPassword &&
                            'border-destructive focus:ring-destructive/20'
                        )}
                        required
                        disabled={pageState === 'registering'}
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-destructive">
                        A jelszavak nem egyeznek
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-medium"
                    disabled={
                      pageState === 'registering' ||
                      !email ||
                      !password ||
                      password !== confirmPassword
                    }
                  >
                    {pageState === 'registering' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fiók létrehozása...
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 mr-2" />
                        Regisztráció
                      </>
                    )}
                  </Button>
                </form>

                {/* Already have account */}
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Már van fiókod?{' '}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => navigate('/auth')}
                  >
                    Bejelentkezés
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

        {/* Success */}
        {pageState === 'success' && (
          <Card className="rounded-xl border-emerald-500/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold">Sikeres regisztráció!</h2>
              <p className="text-muted-foreground max-w-xs">
                A fiókodat sikeresen létrehoztuk. Ellenőrizd az email-ed a
                megerősítő linkért, majd jelentkezz be.
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Clock className="h-4 w-4" />
                A bejelentkezés után azonnal rögzítheted a munkaidődet.
              </div>
              <Button className="mt-2" onClick={() => navigate('/auth')}>
                Bejelentkezés
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
