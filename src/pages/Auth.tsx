import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sun, Moon, Mail, Lock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const { signIn, signUp, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (!error) {
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signUp(email, password, name);
    
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    
    if (error) {
      toast.error('Google bejelentkezés sikertelen');
      console.error('Google sign in error:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const currentTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form Area */}
      <div className="relative flex w-full min-h-screen flex-col justify-center px-8 py-12 lg:w-[45%] lg:px-16 xl:px-24 bg-background">
        {/* Theme Toggle - Top Right */}
        <button
          onClick={toggleTheme}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-secondary/80 transition-colors"
          aria-label="Toggle theme"
        >
          {currentTheme === 'dark' ? (
            <Sun className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          ) : (
            <Moon className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>

        {/* Logo */}
        <div className="mb-12">
          <span className="text-3xl font-black bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent tracking-tight">
            Visibill
          </span>
        </div>

        {/* Welcome Text */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {activeTab === 'signin' ? 'Üdv újra!' : 'Kezdjük el!'}
          </h1>
          <p className="text-muted-foreground">
            {activeTab === 'signin' 
              ? 'Jelentkezz be a fiókodba a folytatáshoz' 
              : 'Hozd létre a fiókodat néhány egyszerű lépésben'}
          </p>
        </div>

        {/* Segmented Control Tabs */}
        <div className="mb-8">
          <div className="inline-flex rounded-lg bg-secondary/50 p-1">
            <button
              onClick={() => setActiveTab('signin')}
              className={cn(
                "px-6 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'signin'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Bejelentkezés
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={cn(
                "px-6 py-2 text-sm font-medium rounded-md transition-all duration-200",
                activeTab === 'signup'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Regisztráció
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm">
          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                  Email cím
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="pelda@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                    Jelszó
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                    onClick={() => toast.info('Jelszó visszaállítás hamarosan elérhető')}
                  >
                    Elfelejtett jelszó?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 font-medium"
                disabled={loading}
              >
                {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-sm font-medium text-foreground">
                  Teljes név
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Kovács János"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">
                  Email cím
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="pelda@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                  Jelszó
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Legalább 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-secondary/30 border-0 focus:bg-secondary/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 font-medium"
                disabled={loading}
              >
                {loading ? 'Fiók létrehozása...' : 'Regisztráció'}
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">vagy</span>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-medium"
            onClick={handleGoogleSignIn}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Folytatás Google-lel
          </Button>

          {/* Privacy Policy Link */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            A folytatással elfogadod az{' '}
            <a href="#" className="text-primary hover:underline">Adatvédelmi irányelveket</a>
            {' '}és a{' '}
            <a href="#" className="text-primary hover:underline">Felhasználási feltételeket</a>.
          </p>
        </div>
      </div>

      {/* Right Side - Visual Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-background">
        {/* Grayscale Dashboard Background - matching EmptyStateDashboard style */}
        <div className="absolute inset-0 overflow-hidden grayscale opacity-30 blur-[2px] pointer-events-none select-none p-8">
          {/* Welcome Section */}
          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-bold text-foreground">Üdvözöljük!</h2>
            <p className="text-muted-foreground">Itt van a vállalkozásod teljes áttekintése</p>
          </div>

          {/* Metrics Cards Row - 5 cards like dashboard */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            {[
              { title: 'Összes számla', value: '---' },
              { title: 'Kimenő számlaösszeg (nettó)', value: '0 Ft' },
              { title: 'Kimenő számlaösszeg (bruttó)', value: '0 Ft' },
              { title: 'Összesített érték', value: '0 Ft' },
              { title: 'Fizetendő', value: '0 Ft' },
            ].map((card, i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{card.title}</span>
                  <div className="w-4 h-4 bg-muted rounded" />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">0 feldolgozva</p>
              </div>
            ))}
          </div>

          {/* ÁFA Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">ÁFA Összesítés</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* VAT Bar Chart Mock */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-end gap-8 h-40 justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 bg-primary/40 rounded-t" style={{ height: '60%' }} />
                    <span className="text-xs text-muted-foreground">Kimenő</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 bg-rose-500/40 rounded-t" style={{ height: '45%' }} />
                    <span className="text-xs text-muted-foreground">Bejövő</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 bg-emerald-500/40 rounded-t" style={{ height: '30%' }} />
                    <span className="text-xs text-muted-foreground">Becsült</span>
                  </div>
                </div>
              </div>
              {/* VAT Breakdown Table Mock */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="space-y-3">
                  {['27%', '18%', '5%', 'ÁFA mentes'].map((rate, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm">{rate}</span>
                      <span className="text-sm font-medium">0 Ft</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Chart Section */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Kiadások és Bevételek</h3>
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-muted rounded" />
                <div className="h-8 w-24 bg-muted rounded" />
              </div>
            </div>
            {/* Mock Area Chart */}
            <div className="h-48 flex items-end gap-2">
              {[30, 45, 35, 60, 50, 75, 55, 80, 65, 70, 85, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div className="bg-primary/30 rounded-t" style={{ height: `${h}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gradient Transition Overlay (fade from left edge only) */}
        <div className="absolute top-0 bottom-0 left-0 w-48 z-[1] bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none" />

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Tartsd kézben a pénzügyeidet
            </h2>
            <p className="text-lg text-muted-foreground max-w-md">
              Automatizált számlakezelés, NAV integráció és valós idejű pénzügyi áttekintés egy helyen.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3">
            {['NAV integráció', 'Automatikus feldolgozás', 'Valós idejű elemzés'].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 bg-primary/15 text-primary text-sm font-medium rounded-full border border-primary/20"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
