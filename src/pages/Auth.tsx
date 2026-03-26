import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sun, Moon, Mail, Lock, User, TrendingUp, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, Clock, AlertTriangle, Users, Wallet, Landmark, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/* Carousel fade animation */
const carouselStyle = document.createElement('style');
carouselStyle.textContent = `@keyframes fadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`;
if (!document.head.querySelector('[data-carousel-anim]')) { carouselStyle.setAttribute('data-carousel-anim',''); document.head.appendChild(carouselStyle); }

interface CarouselSlide { text: string; visual: ReactNode; }

const carouselSlides: CarouselSlide[] = [
  {
    text: 'Valós idejű pénzügyi dashboard és automatizált elemzések.',
    visual: (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="bg-background/90 backdrop-blur-md rounded-xl p-4 flex-1 shadow-xl border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Bevétel</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">2,4M Ft</p>
            <p className="text-xs text-emerald-500">+12.5%</p>
          </div>
          <div className="bg-background/90 backdrop-blur-md rounded-xl p-4 flex-1 shadow-xl border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Kiadás</span>
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">890K Ft</p>
            <p className="text-xs text-rose-500">-3.2%</p>
          </div>
        </div>
        <div className="bg-background/90 backdrop-blur-md rounded-xl p-6 shadow-2xl border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-foreground">Havi áttekintés</span>
            <div className="flex gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="flex items-end gap-2 h-24">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Jan</span><span>Márc</span><span>Máj</span><span>Júl</span><span>Szept</span><span>Nov</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Automata számlaletöltés a NAV-tól és intelligens státuszkezelés.',
    visual: (
      <div className="space-y-3">
        {[
          { name: 'INV-2026-0142', partner: 'TechCorp Kft.', amount: '1 250 000 Ft', status: 'Fizetve', color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
          { name: 'INV-2026-0143', partner: 'Design Studio Bt.', amount: '480 000 Ft', status: 'Függőben', color: 'text-amber-500', icon: Clock, bg: 'bg-amber-500/10' },
          { name: 'INV-2026-0144', partner: 'Global Trade Zrt.', amount: '2 100 000 Ft', status: 'Lejárt', color: 'text-rose-500', icon: AlertTriangle, bg: 'bg-rose-500/10' },
          { name: 'INV-2026-0145', partner: 'NetSolutions Kft.', amount: '720 000 Ft', status: 'Fizetve', color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
        ].map((inv) => (
          <div key={inv.name} className="bg-background/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-border/50 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${inv.bg}`}>
              <FileText className={`h-5 w-5 ${inv.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{inv.name}</span>
                <span className="text-xs text-muted-foreground truncate">{inv.partner}</span>
              </div>
              <span className="text-xs text-muted-foreground">{inv.amount}</span>
            </div>
            <div className={`flex items-center gap-1 ${inv.color}`}>
              <inv.icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{inv.status}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    text: 'Átlátható bérszámfejtési riportok és adókötelezettség figyelés.',
    visual: (
      <div className="space-y-3">
        <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Bérösszesítő — 2026. Március</span>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Kovács Anna', gross: '650 000', net: '432 000' },
              { name: 'Nagy Péter', gross: '520 000', net: '348 000' },
              { name: 'Szabó Éva', gross: '780 000', net: '512 000' },
              { name: 'Tóth Balázs', gross: '420 000', net: '285 000' },
            ].map((emp) => (
              <div key={emp.name} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground flex-1">{emp.name}</span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{emp.net} Ft</p>
                  <p className="text-xs text-muted-foreground">bruttó {emp.gross}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 flex justify-between">
            <span className="text-sm font-medium text-muted-foreground">Összesen (nettó)</span>
            <span className="text-sm font-bold text-primary">1 577 000 Ft</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Intelligens tranzakció-szinkron és automatikus kifizetés-azonosítás.',
    visual: (
      <div className="space-y-3">
        {[
          { bank: 'K&H 10200812-32145698', amount: '-480 000 Ft', invoice: 'INV-2026-0143', matched: true },
          { bank: 'OTP 11773312-01234567', amount: '-1 250 000 Ft', invoice: 'INV-2026-0142', matched: true },
          { bank: 'Wise EUR 2 800.00', amount: '+1 120 000 Ft', invoice: '—', matched: false },
        ].map((tx, i) => (
          <div key={i} className="bg-background/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tx.bank}</p>
                <p className={`text-sm font-bold ${tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{tx.amount}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 rounded-lg p-2 ${tx.matched ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              <ArrowLeftRight className={`h-4 w-4 ${tx.matched ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className={`text-xs font-medium ${tx.matched ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {tx.matched ? `Párosítva → ${tx.invoice}` : 'Párosítás szükséges'}
              </span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const { signIn, signUp, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Auto-advance carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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
      toast({ title: 'Google bejelentkezés sikertelen', variant: 'destructive' });
      console.error('Google sign in error:', error);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: 'Kérlek add meg az email címed', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Jelszó visszaállító email elküldve! Ellenőrizd a postaládádat.' });
      setShowForgotPassword(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({ title: error.message || 'Hiba történt', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const currentTheme = theme;

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form Area */}
      <div className="relative flex w-full flex-col items-center justify-start px-8 py-12 lg:w-[45%] lg:px-16 xl:px-24 bg-background min-h-screen pt-[15vh]">
        {/* Theme Toggle - Top Left */}
        <button
          onClick={toggleTheme}
          className="absolute left-6 top-6 p-2 rounded-full hover:bg-secondary/80 transition-colors"
          aria-label="Toggle theme"
        >
          {currentTheme === 'dark' ? (
            <Sun className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          ) : (
            <Moon className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>

        {/* Centered Content Wrapper */}
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-12">
            <span className="text-4xl font-black bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent tracking-tight">
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
            <div className="inline-flex rounded-lg bg-slate-100/80 dark:bg-secondary/50 border border-slate-200/60 dark:border-transparent p-1">
              <button
                onClick={() => setActiveTab('signin')}
                className={cn(
                  "px-6 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === 'signin'
                    ? "bg-white dark:bg-background text-foreground shadow-sm"
                    : "text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground"
                )}
              >
                Bejelentkezés
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={cn(
                  "px-6 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === 'signup'
                    ? "bg-white dark:bg-background text-foreground shadow-sm"
                    : "text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground"
                )}
              >
                Regisztráció
              </button>
            </div>
          </div>

          {/* Form */}
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
                    className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotPassword(true);
                    }}
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
                    className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
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

          {/* Forgot Password Overlay */}
          {showForgotPassword && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-sm bg-background border border-border rounded-xl p-6 shadow-lg mx-4">
                <h2 className="text-xl font-bold text-foreground mb-2">Elfelejtett jelszó</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Add meg az email címedet és küldünk egy jelszó visszaállító linket.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email cím</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="pelda@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10 bg-white dark:bg-secondary/30 border border-slate-200 dark:border-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Mégse
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? 'Küldés...' : 'Link küldése'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Visual Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-primary/5 via-background to-background relative overflow-hidden">
        {/* Edge Gradient - Smooth transition from left panel */}
        <div className="absolute left-0 top-0 bottom-0 w-64 bg-gradient-to-r from-background via-background/80 to-transparent z-20 pointer-events-none" />
        
        {/* Background Pattern - Subtle glowing orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        </div>

        {/* Isometric Dashboard Perspective - Single cohesive tilted dashboard */}
        <div 
          className="absolute -right-20 top-10 w-[150%] h-[150%] blur-[2px] opacity-30"
          style={{ transform: 'rotate(-12deg) skewY(12deg) scale(1.1)' }}
        >
          {/* Mock App Interface */}
          <div className="w-full h-full p-8">
            {/* Sidebar Strip */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-foreground/5 dark:bg-white/5 border-r border-foreground/5 dark:border-white/5">
              {/* Sidebar icons placeholder */}
              <div className="flex flex-col items-center gap-4 pt-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-lg bg-foreground/10 dark:bg-white/10" />
                ))}
              </div>
            </div>
            
            {/* Header Strip */}
            <div className="absolute left-16 top-0 right-0 h-14 bg-foreground/5 dark:bg-white/5 border-b border-foreground/5 dark:border-white/5 flex items-center px-6 gap-4">
              <div className="w-32 h-6 rounded bg-foreground/10 dark:bg-white/10" />
              <div className="flex-1" />
              <div className="w-24 h-6 rounded bg-foreground/10 dark:bg-white/10" />
              <div className="w-8 h-8 rounded-full bg-foreground/10 dark:bg-white/10" />
            </div>
            
            {/* Main Content Area */}
            <div className="absolute left-20 top-20 right-8 bottom-8 p-6">
              {/* Top Stats Row */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-foreground/5 dark:bg-white/5 border border-foreground/5 dark:border-white/5 p-4">
                    <div className="w-16 h-3 rounded bg-foreground/10 dark:bg-white/10 mb-3" />
                    <div className="w-24 h-6 rounded bg-foreground/10 dark:bg-white/10 mb-2" />
                    <div className="w-12 h-3 rounded bg-primary/20" />
                  </div>
                ))}
              </div>
              
              {/* Main Chart Card */}
              <div className="h-64 rounded-xl bg-foreground/5 dark:bg-white/5 border border-foreground/5 dark:border-white/5 p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="w-32 h-4 rounded bg-foreground/10 dark:bg-white/10" />
                  <div className="flex gap-2">
                    <div className="w-16 h-6 rounded bg-foreground/10 dark:bg-white/10" />
                    <div className="w-16 h-6 rounded bg-foreground/10 dark:bg-white/10" />
                  </div>
                </div>
                {/* Chart skeleton */}
                <div className="flex items-end gap-3 h-40 pt-4">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((h, i) => (
                    <div 
                      key={i} 
                      className="flex-1 rounded-t bg-primary/20" 
                      style={{ height: `${h}%` }} 
                    />
                  ))}
                </div>
              </div>
              
              {/* Bottom Cards Row */}
              <div className="grid grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-foreground/5 dark:bg-white/5 border border-foreground/5 dark:border-white/5 p-4">
                    <div className="w-24 h-4 rounded bg-foreground/10 dark:bg-white/10 mb-4" />
                    <div className="space-y-2">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-primary/30" />
                          <div className="flex-1 h-3 rounded bg-foreground/10 dark:bg-white/10" />
                          <div className="w-12 h-3 rounded bg-foreground/10 dark:bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content - Above all background layers */}
        <div className="relative z-30 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-foreground dark:text-white mb-4">
              Tartsd kézben a pénzügyeidet
            </h2>
          </div>

          {/* Feature Carousel — fixed-height frame so nothing shifts */}
          <div className="relative h-[520px] flex flex-col">
            {/* Subtitle - fades */}
            <p className="text-lg text-muted-foreground dark:text-slate-300 max-w-md mb-6 h-[3.5rem] overflow-hidden" key={`text-${carouselIndex}`} style={{ animation: 'fadeSlide 1200ms ease-in-out' }}>
              {carouselSlides[carouselIndex].text}
            </p>

            {/* Visual - fades, fixed height centered */}
            <div className="flex-1 flex items-start overflow-hidden" key={`visual-${carouselIndex}`} style={{ animation: 'fadeSlide 1200ms ease-in-out' }}>
              <div className="w-full">
                {carouselSlides[carouselIndex].visual}
              </div>
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {carouselSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    i === carouselIndex
                      ? "bg-primary w-6"
                      : "bg-foreground/20 dark:bg-white/20 hover:bg-foreground/40 dark:hover:bg-white/40"
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
