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
        {/* Grayscale Dashboard Background with sample data */}
        <div className="absolute inset-0 overflow-hidden grayscale opacity-30 blur-[2px] pointer-events-none select-none p-6 overflow-y-auto">
          {/* Welcome Section */}
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-bold text-foreground">Jó napot, János!</h2>
            <p className="text-sm text-muted-foreground">Itt van a vállalkozásod teljes áttekintése</p>
          </div>

          {/* Date selectors row */}
          <div className="flex gap-2 mb-6">
            <div className="px-3 py-1.5 bg-primary/20 rounded text-xs font-medium">Ez a hónap</div>
            <div className="px-3 py-1.5 bg-muted rounded text-xs">Előző hónap</div>
            <div className="px-3 py-1.5 bg-muted rounded text-xs">Ez az év</div>
            <div className="flex-1" />
            <div className="px-3 py-1.5 bg-muted rounded text-xs">2024.12.01</div>
            <div className="px-3 py-1.5 bg-muted rounded text-xs">2024.12.17</div>
          </div>

          {/* Metrics Cards Row - 2 rows of 3 */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { title: 'Feltöltött számlák', value: '127', sub: '12 feldolgozás alatt' },
              { title: 'Kimenő számlaösszeg', value: '4 250 000 Ft', sub: 'OUTBOUND' },
              { title: 'Bejövő számlaösszeg', value: '1 890 000 Ft', sub: 'INBOUND' },
              { title: 'ÁFA összeg', value: '637 500 Ft', sub: 'Becsült fizetendő' },
              { title: 'Fizetendő', value: '425 000 Ft', sub: '3 nyitott számla' },
              { title: 'Eredmény', value: '2 360 000 Ft', sub: '+15.3% előző hónaphoz' },
            ].map((card, i) => (
              <div key={i} className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground block mb-1">{card.title}</span>
                    <p className="text-lg font-bold">{card.value}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary/40 rounded" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ÁFA Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">ÁFA Összesítés</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* VAT Bar Chart */}
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-end gap-6 h-32 justify-center px-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium mb-1">1 147 500 Ft</span>
                    <div className="w-14 bg-primary/50 rounded-t" style={{ height: '85%' }} />
                    <span className="text-xs text-muted-foreground">Kimenő</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium mb-1">510 300 Ft</span>
                    <div className="w-14 bg-rose-500/50 rounded-t" style={{ height: '55%' }} />
                    <span className="text-xs text-muted-foreground">Bejövő</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium mb-1">637 200 Ft</span>
                    <div className="w-14 bg-emerald-500/50 rounded-t" style={{ height: '40%' }} />
                    <span className="text-xs text-muted-foreground">Becsült</span>
                  </div>
                </div>
              </div>
              {/* VAT Breakdown Table */}
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="space-y-2">
                  {[
                    { rate: '27%', outbound: '892 350 Ft', inbound: '398 250 Ft' },
                    { rate: '18%', outbound: '156 000 Ft', inbound: '72 000 Ft' },
                    { rate: '5%', outbound: '99 150 Ft', inbound: '40 050 Ft' },
                    { rate: 'ÁFA mentes', outbound: '0 Ft', inbound: '0 Ft' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-xs">
                      <span className="font-medium w-20">{row.rate}</span>
                      <span className="text-primary">{row.outbound}</span>
                      <span className="text-rose-500">{row.inbound}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Chart Section */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Kiadások és Bevételek</h3>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-primary/20 rounded text-xs">2024</span>
                <span className="px-2 py-1 bg-muted rounded text-xs">Bruttó</span>
              </div>
            </div>
            {/* Mock Area Chart with labels */}
            <div className="relative h-36">
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs text-muted-foreground">
                <span>5M</span>
                <span>2.5M</span>
                <span>0</span>
              </div>
              <div className="ml-8 h-full flex items-end gap-1.5 pb-6">
                {[
                  { h: 35, label: 'Jan' },
                  { h: 48, label: 'Feb' },
                  { h: 42, label: 'Már' },
                  { h: 65, label: 'Ápr' },
                  { h: 58, label: 'Máj' },
                  { h: 72, label: 'Jún' },
                  { h: 68, label: 'Júl' },
                  { h: 85, label: 'Aug' },
                  { h: 78, label: 'Szept' },
                  { h: 90, label: 'Okt' },
                  { h: 82, label: 'Nov' },
                  { h: 75, label: 'Dec' },
                ].map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col justify-end h-24">
                      <div className="bg-primary/40 rounded-t w-full" style={{ height: `${bar.h}%` }} />
                      <div className="bg-rose-500/30 rounded-b w-full" style={{ height: `${bar.h * 0.4}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary/40" />
                <span className="text-xs text-muted-foreground">Bevétel</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-rose-500/30" />
                <span className="text-xs text-muted-foreground">Kiadás</span>
              </div>
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
