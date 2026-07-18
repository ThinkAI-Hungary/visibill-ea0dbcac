import { useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sun, Moon, Mail, Lock, User, TrendingUp, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, Clock, AlertTriangle, Users, Wallet, Landmark, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { reportAuthError } from '@/lib/errorReporter';
import { useHasEaisybillAccess } from '@/hooks/useHasEaisybillAccess';

/* Tape showcase animations */
const carouselStyle = document.createElement('style');
carouselStyle.textContent = `@keyframes fadeSlide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`;
if (!document.head.querySelector('[data-carousel-anim]')) { carouselStyle.setAttribute('data-carousel-anim', ''); document.head.appendChild(carouselStyle); }
// Uses the current domain (e.g. app.visibill.hu or localhost:3000) for the redirect link.
// If you want to force it to always be 'https://app.visibill.hu/reset-password',
// you can replace `${window.location.origin}` with that explicitly.
const PASSWORD_RESET_REDIRECT_URL = `${window.location.origin}/reset-password`;
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
  {
    text: 'Kintlévőség-kezelés és automatikus fizetési felszólítások.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-rose-500/30">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-foreground">Lejárt kintlévőségek</span>
          <span className="text-xs text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">Figyelmeztetés</span>
        </div>
        <div className="space-y-3">
          <div className="bg-secondary/40 rounded-lg p-3 border border-border/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">INV-2026-0034</p>
              <p className="text-[10px] text-muted-foreground">Vevő Partner • 14 napja lejárt</p>
            </div>
            <p className="text-xs font-bold text-rose-500">450 000 Ft</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">1. Fizetési felszólító email elküldve</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Automatikus partneradat-lekérdezés adószám alapján.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-border/50">
        <span className="text-sm font-semibold text-foreground block mb-3">Gyors számlázás partnereknek</span>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Adószám</label>
            <div className="bg-secondary/40 rounded-lg px-3 py-1.5 border border-border/30 text-xs font-semibold text-foreground">
              12345678-2-41
            </div>
          </div>
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-1">
            <p className="text-xs font-bold text-primary">Alfa Kereskedelmi Kft.</p>
            <p className="text-[10px] text-muted-foreground">1051 Budapest, Fő utca 12.</p>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Partner adatai lekérve a hivatalos cégadatbázisból
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

const booksCarouselSlides: CarouselSlide[] = [
  {
    text: 'AI-alapú anomália-detekció és intelligens számladuplikáció-szűrés.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-rose-500/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-rose-500/10">
            <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground block">AI Anomália Észlelés</span>
            <span className="text-xs text-rose-500 font-medium">98% egyezési valószínűség</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Gyanús számladuplikáció azonosítva a NAV Online Számla adatai alapján.</p>
        <div className="space-y-2">
          <div className="bg-secondary/40 rounded-lg p-3 border border-border/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">D-2026-0042</p>
              <p className="text-[10px] text-muted-foreground">Logisztikai Szolgáltató • 2026.06.10</p>
            </div>
            <p className="text-xs font-bold text-foreground">142 500 Ft</p>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3 border border-border/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">D-2026-0045</p>
              <p className="text-[10px] text-muted-foreground">Logisztikai Szolgáltató • 2026.06.10</p>
            </div>
            <p className="text-xs font-bold text-foreground">142 500 Ft</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Valós idejű főkönyvi kivonat és automatikus mérlegegyensúly ellenőrzés.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-teal-500" />
            <span className="text-sm font-semibold text-foreground">Főkönyv & Mérleg</span>
          </div>
          <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[10px] font-bold">Egyensúlyban</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/30">
            <span className="text-muted-foreground">Eszközök összesen (Assets)</span>
            <span className="font-semibold text-foreground">42 850 000 Ft</span>
          </div>
          <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/30">
            <span className="text-muted-foreground">Források összesen (Equity & Liab.)</span>
            <span className="font-semibold text-foreground">42 850 000 Ft</span>
          </div>
          <div className="flex justify-between items-center text-xs py-1.5">
            <span className="text-muted-foreground">Aktuális tárgyévi eredmény</span>
            <span className="font-semibold text-emerald-500">+6 420 000 Ft</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Intelligens adónaptár, járulékbevallások és áfa-tervezés nyomon követése.',
    visual: (
      <div className="space-y-3">
        {[
          { filing: '2608 Járulékbevallás', deadline: 'Esedékes: 12 nap múlva', status: 'Beküldve', color: 'text-emerald-500', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
          { filing: '2665 ÁFA bevallás', deadline: 'Esedékes: 8 nap múlva', status: 'Egyeztetés alatt', color: 'text-amber-500', icon: Clock, bg: 'bg-amber-500/10' },
          { filing: 'KIVA / KATA elszámolás', deadline: 'Esedékes: 15 nap múlva', status: 'Elkészítve', color: 'text-teal-500', icon: FileText, bg: 'bg-teal-500/10' },
        ].map((f, i) => (
          <div key={i} className="bg-background/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-border/50 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${f.bg}`}>
              <f.icon className={`h-5 w-5 ${f.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-foreground block truncate">{f.filing}</span>
              <span className="text-xs text-muted-foreground">{f.deadline}</span>
            </div>
            <span className={`text-xs font-medium ${f.color}`}>{f.status}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    text: 'Hivatalos levelek letöltése és automatikus archiválása a Cégkapuból.',
    visual: (
      <div className="space-y-3">
        {[
          { sender: 'NAV_KAVIG', doc: 'Folyószámla kivonat', time: '1 órája', status: 'Letöltve', color: 'text-emerald-500', icon: FileText, bg: 'bg-emerald-500/10' },
          { sender: 'ÖNKORMÁNYZAT', doc: 'Helyi iparűzési adó értesítő', time: 'Tegnap', status: 'Letöltve', color: 'text-emerald-500', icon: FileText, bg: 'bg-emerald-500/10' },
        ].map((d, i) => (
          <div key={i} className="bg-background/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-border/50 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${d.bg}`}>
              <d.icon className={`h-5 w-5 ${d.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-foreground block truncate">{d.sender}</span>
              <span className="text-xs text-muted-foreground">{d.doc} • {d.time}</span>
            </div>
            <span className="text-xs font-medium text-emerald-500">{d.status}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    text: 'Átlátható bérszámfejtési összesítők és kifizetési jegyzékek.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-teal-500" />
          <span className="text-sm font-semibold text-foreground">Bérszámfejtési jelentés</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground">Aktív munkavállalók száma</span>
            <span className="font-semibold text-foreground">12 fő</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/30">
            <span className="text-muted-foreground">Bruttó bérköltség összesen</span>
            <span className="font-semibold text-foreground">6 890 000 Ft</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Nettó utalandó munkabérek</span>
            <span className="font-semibold text-teal-500">4 580 000 Ft</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    text: 'Könyvelőirodai munkafolyamatok és cég-hozzárendelések nyomon követése.',
    visual: (
      <div className="bg-background/90 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-teal-500" />
          <span className="text-sm font-semibold text-foreground">Hozzárendelt cégek</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-teal-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-teal-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Könyvelő Partner</p>
              <p className="text-[10px] text-muted-foreground">Felelős: Minta János (Irodavezető)</p>
            </div>
            <span className="text-[10px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full font-medium">Elsődleges</span>
          </div>
        </div>
      </div>
    ),
  },
];


const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState('');
  const { signIn, signUp, user, isRecoverySession } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [authSearchParams, setAuthSearchParams] = useSearchParams();
  const [appMode, setAppMode] = useState<'eaisybill' | 'eaisybooks'>(() => {
    return (authSearchParams.get('app') === 'eaisybooks') ? 'eaisybooks' : 'eaisybill';
  });
  const isEaisybooks = appMode === 'eaisybooks';
  const activeSlides = isEaisybooks ? booksCarouselSlides : carouselSlides;

  const queryClient = useQueryClient();

  // Check if redirected here because email is not verified
  const isUnverified = authSearchParams.get('unverified') === 'true';
  const isJustVerified = authSearchParams.get('verified') === 'true';
  const verifyTokenParam = authSearchParams.get('verify_token');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Auto-open forgot password panel when redirected from expired reset link (?forgot=1)
  useEffect(() => {
    if (authSearchParams.get('forgot') === '1') {
      setShowForgotPassword(true);
      setAuthSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('forgot');
        return next;
      }, { replace: true });
    }
  }, []);


  // Handle ?verify_token=XXX — user clicked verification link in email
  // The frontend calls the verify-email edge function so the email URL stays clean (app.visibill.hu)
  useEffect(() => {
    if (!verifyTokenParam) return;


    const doVerify = async () => {
      setIsVerifying(true);
      try {
        // Raw fetch since verify-email reads token from URL query params (no JWT needed)
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co'}/functions/v1/verify-email?token=${verifyTokenParam}`
        );
        const data = await res.json();

        if (res.ok && data.success) {
          queryClient.invalidateQueries({ queryKey: ['profile-check'] });
          setVerificationSuccess(true);
        } else {
          reportAuthError('Auth', 'email_verification', 'Verification failed', undefined, { response: data });
          toast({ title: 'Megerősítés sikertelen', description: 'Érvénytelen vagy lejárt link.', variant: 'destructive' });
        }
      } catch (err: any) {
        reportAuthError('Auth', 'email_verification', err.message || 'Verification error', err);
        toast({ title: 'Hiba a megerősítéskor', description: err.message, variant: 'destructive' });
      } finally {
        setIsVerifying(false);
        setAuthSearchParams(prev => {
          const next = new URLSearchParams();
          const app = prev.get('app');
          if (app) next.set('app', app);
          return next;
        }, { replace: true });
      }
    };

    doVerify();
  }, [verifyTokenParam]);

  // Handle ?verified=true — legacy redirect from edge function
  useEffect(() => {
    if (isJustVerified) {
      queryClient.invalidateQueries({ queryKey: ['profile-check'] });
      setAuthSearchParams({}, { replace: true });
      setVerificationSuccess(true);
    }
  }, [isJustVerified]);

  // Resend verification email
  const [resending, setResending] = useState(false);
  const handleResendVerification = useCallback(async () => {
    if (!user) return;
    setResending(true);
    try {
      const SUPABASE_URL = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
          source: isEaisybooks ? 'eaisybooks' : 'eaisybill'
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody);
      }
      toast({ title: 'Megerősítő email újraküldve!', description: 'Ellenőrizd a postaládádat.' });
    } catch (err: any) {
      reportAuthError('Auth', 'resend_verification', err.message || 'Resend verification error', err);
      toast({ title: 'Hiba az email küldésekor', description: err.message, variant: 'destructive' });
    } finally {
      setResending(false);
    }
  }, [user]);
  const returnTo = authSearchParams.get('returnTo') || '/';

  // Show "signed out" toast queued by AuthContext.signOut() — only fires
  // once the Auth page is actually mounted, so the toast never flashes
  // on top of the still-mounted protected layout.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('visibill_pending_signout_toast') === '1') {
        sessionStorage.removeItem('visibill_pending_signout_toast');
        toast({ title: 'Kijelentkezve', description: 'Sikeresen kijelentkeztél.' });
      }
    } catch {}
  }, []);

  // Handle expired/invalid recovery links that redirect to root with error hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (errorCode === 'otp_expired' || errorDescription?.includes('expired')) {
        toast({
          title: 'A jelszó-visszaállító link lejárt',
          description: 'Kérj új linket az email címedre.',
          variant: 'destructive',
        });
        setShowForgotPassword(true);
        // Clean the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
      } else if (errorDescription) {
        toast({
          title: decodeURIComponent(errorDescription.replace(/\+/g, ' ')),
          variant: 'destructive',
        });
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    const COOKIE = 'vb_visited';
    const hasVisited = document.cookie.split(';').some(c => c.trim().startsWith(COOKIE + '='));
    if (!hasVisited) {
      setIsFirstVisit(true);
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${COOKIE}=1; expires=${expires}; path=/; SameSite=Lax`;
    }
  }, []);
  // Waterfall tape refs
  const tapeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>();
  const isHoverRef = useRef(false);
  const scrollVelRef = useRef(0); // smooth scroll momentum

  // Click-to-inspect state
  const [selectedAbsIdx, setSelectedAbsIdx] = useState<number | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedDims, setSelectedDims] = useState<{ w: number; h: number } | null>(null);
  const pausedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const svgPath1Ref = useRef<SVGPathElement>(null); // CW top half (mid-left → mid-right)
  const svgPath2Ref = useRef<SVGPathElement>(null); // CCW bottom half (mid-left → mid-right)
  const svgConnRef = useRef<SVGSVGElement>(null);
  const svgConnPathRef = useRef<SVGPathElement>(null); // L connector path
  const svgConnTopRef = useRef<SVGPathElement>(null); // popup top border trace
  const svgConnLeftRef = useRef<SVGPathElement>(null); // popup left border trace
  const popupRef = useRef<HTMLDivElement>(null); // measured for dynamic dims
  const wrapperRef = useRef<HTMLDivElement>(null);
  const borderAnimRef = useRef<number>();
  const targetPosRef = useRef<number | null>(null);
  const onScrollDone = useRef<(() => void) | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const dismissingRef = useRef(false);
  const dismissTimerRef = useRef<number>();
  const fadingDimsRef = useRef<{ w: number; h: number } | null>(null);
  const selectedDimsRef = useRef<{ w: number; h: number } | null>(null);
  const selectedOffsetTopRef = useRef(0);

  selectedDimsRef.current = selectedDims; // keep in sync on every render

  const { hasAccess: hasEaisybillAccess } = useHasEaisybillAccess();

  useEffect(() => {
    // Don't auto-navigate after signup — user should see the email confirmation screen
    if (signUpSuccess) return;
    // Don't auto-navigate when email is not verified — user is locked
    if (isUnverified) return;
    // Don't auto-navigate when user explicitly came to request a password reset link.
    // ?forgot=1 is set by ResetPassword.tsx when the link is expired/invalid.
    if (authSearchParams.get('forgot') === '1') return;
    if (user && !isRecoverySession && hasEaisybillAccess !== undefined) {
      // Respect the eaisybooks toggle for routing
      const target = returnTo && returnTo !== '/'
        ? returnTo
        : isEaisybooks ? '/accounty' : '/';
      navigate(target);
    }
  }, [user, navigate, signUpSuccess, isUnverified, isEaisybooks, returnTo, hasEaisybillAccess, authSearchParams, isRecoverySession]);

  // Non-passive wheel listener — adds to scroll velocity for smooth momentum
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // If tape is paused (slide selected), fade-dismiss on scroll
      if (pausedRef.current && !dismissingRef.current) {
        fadingDimsRef.current = selectedDimsRef.current;
        dismissingRef.current = true;
        pausedRef.current = false;
        targetPosRef.current = null;
        onScrollDone.current = null;
        // Fade out connector imperatively (avoids React style-prop conflicts)
        const conn = svgConnRef.current;
        if (conn) { conn.style.transition = 'opacity 0.5s ease'; conn.style.opacity = '0'; }
        setDismissing(true);
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          dismissingRef.current = false;
          fadingDimsRef.current = null;
          if (conn) { conn.style.transition = 'none'; conn.style.opacity = '0'; }
          setDismissing(false);
          setSelectedAbsIdx(null);
          setSelectedDims(null);
          setShowPopup(false);
        }, 500);
      }
      scrollVelRef.current += -e.deltaY * 0.06;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Continuous downward waterfall animation
  useEffect(() => {
    const SPEED = 0.45;
    const tick = () => {
      const strip = tapeRef.current;
      if (strip) {
        const base = pausedRef.current ? 0 : (isHoverRef.current ? SPEED * 0.1 : SPEED);
        const vel = scrollVelRef.current;
        scrollVelRef.current = Math.abs(vel) < 0.01 ? 0 : vel * 0.90;
        const half = strip.scrollHeight / 2;
        let step: number;
        if (targetPosRef.current !== null) {
          // Smooth scroll to center: lerp 12% per frame, take shortest circular path
          let diff = targetPosRef.current - posRef.current;
          // Wrap diff into [-half/2, half/2] to always take the short way round
          if (diff > half / 2) diff -= half;
          if (diff < -half / 2) diff += half;
          step = diff * 0.12;
          if (Math.abs(diff) < 0.6) {
            posRef.current = targetPosRef.current;
            targetPosRef.current = null;
            step = 0; // already at target
            if (onScrollDone.current) { onScrollDone.current(); onScrollDone.current = null; }
          }
        } else {
          step = base + vel;
        }
        posRef.current = ((posRef.current + step) % half + half) % half;
        strip.style.transform = `translate3d(0, ${posRef.current - half}px, 0)`;
        // Keep SVG border stuck to the selected slide every frame
        if (svgRef.current && svgRef.current.style.display !== 'none') {
          svgRef.current.style.top = `${selectedOffsetTopRef.current + (posRef.current - half)}px`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  // Border sweep + L connector animation
  useLayoutEffect(() => {
    if (selectedAbsIdx === null || !selectedDims) return;
    const p1 = svgPath1Ref.current;
    const p2 = svgPath2Ref.current;
    const svg = svgRef.current;
    const cp = svgConnPathRef.current;
    const cs = svgConnRef.current;
    if (!p1 || !p2 || !svg) return;
    const rx = 12;
    const { w, h } = selectedDims;
    // halfPerim: left-side half + top/bottom edge + right-side half + two quarter-arcs
    const halfPerim = (h / 2 - rx) + (w - 2 * rx) + (h / 2 - rx) + Math.PI * rx;

    // ── Phase 1: border sweep via RAF (0.6 s, linear) — immune to CSS reflow timing ──
    const SWEEP_MS = 600;
    const sweepStart = performance.now();
    [p1, p2].forEach(path => {
      path.style.transition = 'none';
      path.style.strokeDasharray = String(halfPerim);
      path.style.strokeDashoffset = String(halfPerim);
    });
    svg.style.filter = 'drop-shadow(0 0 4px rgba(20,220,170,.95)) drop-shadow(0 0 12px rgba(20,220,170,.6))';
    if (cs) cs.style.opacity = '0';

    const sweepTick = (now: number) => {
      if (dismissingRef.current) return;
      const progress = Math.min((now - sweepStart) / SWEEP_MS, 1);
      const offset = halfPerim * (1 - progress);
      p1.style.strokeDashoffset = String(offset);
      p2.style.strokeDashoffset = String(offset);
      if (progress < 1) {
        borderAnimRef.current = requestAnimationFrame(sweepTick);
      }
    };
    cancelAnimationFrame(borderAnimRef.current!);
    borderAnimRef.current = requestAnimationFrame(sweepTick);


    // ── Phase 2: L connector + popup full border (TL→BR via CW and CCW) ──
    const t1 = window.setTimeout(() => {
      // Bail if dismiss started while border was sweeping
      if (dismissingRef.current) return;
      const cp = svgConnPathRef.current;
      const cs = svgConnRef.current;
      const cwP = svgConnTopRef.current;
      const ccwP = svgConnLeftRef.current;
      const popup = popupRef.current;
      if (!cp || !cs || !containerRef.current || !wrapperRef.current || !popup) { setShowPopup(true); return; }
      const wRect = wrapperRef.current.getBoundingClientRect();
      const cRect = containerRef.current.getBoundingClientRect();
      const pRect = popup.getBoundingClientRect();
      const cardMidY = cRect.top - wRect.top + 330;
      const pl = pRect.left - wRect.left;
      const pt = pRect.top - wRect.top;
      const pw = pRect.width;
      const ph = pRect.height;
      const rp = 12;
      const lr = 16;
      const lHoriz = pl - lr - w;
      const lVert = cardMidY - lr - (pt + rp);
      const lArc = Math.PI * lr / 2;
      const connLen = lHoriz + lArc + lVert;
      cp.setAttribute('d', `M ${w},${cardMidY} H ${pl - lr} A ${lr},${lr} 0 0,0 ${pl},${cardMidY - lr} V ${pt + rp}`);
      cp.style.transition = 'none';
      cp.style.strokeDasharray = String(connLen);
      cp.style.strokeDashoffset = String(connLen);
      const cwLen = (Math.PI * rp / 2) * 3 + (pw - 2 * rp) + (ph - 2 * rp);
      if (cwP) {
        cwP.setAttribute('d',
          `M ${pl},${pt + rp} A ${rp},${rp} 0 0,1 ${pl + rp},${pt}` +
          ` H ${pl + pw - rp} A ${rp},${rp} 0 0,1 ${pl + pw},${pt + rp}` +
          ` V ${pt + ph - rp} A ${rp},${rp} 0 0,1 ${pl + pw - rp},${pt + ph}`);
        cwP.style.transition = 'none';
        cwP.style.strokeDasharray = String(cwLen);
        cwP.style.strokeDashoffset = String(cwLen);
      }
      const ccwLen = (Math.PI * rp / 2) + (ph - 2 * rp) + (pw - 2 * rp);
      if (ccwP) {
        ccwP.setAttribute('d',
          `M ${pl},${pt + rp} V ${pt + ph - rp} A ${rp},${rp} 0 0,0 ${pl + rp},${pt + ph}` +
          ` H ${pl + pw - rp}`);
        ccwP.style.transition = 'none';
        ccwP.style.strokeDasharray = String(ccwLen);
        ccwP.style.strokeDashoffset = String(ccwLen);
      }
      cs.style.opacity = '1';
      void cp.getBoundingClientRect();
      cp.style.transition = 'stroke-dashoffset 0.4s linear';
      cp.style.strokeDashoffset = '0';
      const traceDur = 0.45;
      const ccwDur = traceDur * (ccwLen / cwLen);
      window.setTimeout(() => {
        if (dismissingRef.current) return; // bail if dismiss started during L animation
        if (cwP) { cwP.style.transition = `stroke-dashoffset ${traceDur}s linear`; cwP.style.strokeDashoffset = '0'; }
        if (ccwP) { ccwP.style.transition = `stroke-dashoffset ${ccwDur.toFixed(3)}s linear`; ccwP.style.strokeDashoffset = '0'; }
      }, 420);
    }, 620);

    // ── Phase 3: reveal popup after traces complete ──
    const t2 = window.setTimeout(() => {
      if (dismissingRef.current) return;
      setShowPopup(true);
    }, 620 + 420 + 470);

    return () => { clearTimeout(t1); clearTimeout(t2); cancelAnimationFrame(borderAnimRef.current!); };
  }, [selectedAbsIdx, selectedDims]);

  const handleSlideClick = (absIdx: number, el: HTMLElement) => {
    // Locked while a slide is active — must scroll or click Bezárás to close
    if (pausedRef.current || dismissingRef.current) return;
    cancelAnimationFrame(borderAnimRef.current!);
    setShowPopup(false);
    setSelectedDims(null);
    setSelectedAbsIdx(absIdx);
    pausedRef.current = true;
    const strip = tapeRef.current;
    if (!strip) return;
    const CONTAINER_H = 660;
    const slideH = el.offsetHeight - 32;
    const dims = { w: el.offsetWidth, h: slideH };
    const half = strip.scrollHeight / 2;
    selectedOffsetTopRef.current = el.offsetTop;
    const rawTarget = (CONTAINER_H - slideH) / 2 - el.offsetTop + half;
    targetPosRef.current = ((rawTarget % half) + half) % half;
    onScrollDone.current = () => {
      // Recompute selectedOffsetTopRef from the final posRef so the SVG sticky-tracking formula
      // always places the border at the right screen position, even when the tape wrapped around
      // (e.g. element was near the top — the lerp wrap makes the second tape copy show instead).
      // Formula derivation: selectedOffsetTopRef + (posRef - half) = (CONTAINER_H - dims.h) / 2
      selectedOffsetTopRef.current = (CONTAINER_H - dims.h) / 2 + half - posRef.current;
      setSelectedDims(dims);
    };
  };

  const handleDismiss = () => handleFadeDismiss();

  // Fade-dismiss when clicking outside the tape area
  const handleFadeDismiss = () => {
    if (!pausedRef.current && !dismissingRef.current) return;
    clearTimeout(dismissTimerRef.current);
    fadingDimsRef.current = selectedDimsRef.current;
    dismissingRef.current = true;
    pausedRef.current = false;
    targetPosRef.current = null;
    onScrollDone.current = null;
    setDismissing(true);
    // Fade out connector imperatively
    const conn = svgConnRef.current;
    if (conn) { conn.style.transition = 'opacity 0.5s ease'; conn.style.opacity = '0'; }
    dismissTimerRef.current = window.setTimeout(() => {
      dismissingRef.current = false;
      fadingDimsRef.current = null;
      if (conn) { conn.style.transition = 'none'; conn.style.opacity = '0'; }
      setDismissing(false);
      setSelectedAbsIdx(null);
      setSelectedDims(null);
      setShowPopup(false);
    }, 500);
  };

  const handleAppModeChange = (mode: 'eaisybill' | 'eaisybooks') => {
    handleFadeDismiss();
    setAppMode(mode);
    setAuthSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (mode === 'eaisybooks') {
        next.set('app', 'eaisybooks');
      } else {
        next.delete('app');
      }
      return next;
    }, { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast({ title: 'Kérlek add meg az email címed', variant: 'destructive' });
      return;
    }
    if (!password) {
      toast({ title: 'Kérlek add meg a jelszavad', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const { error } = await signIn(email, password);

    if (!error) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      // If user logged in with the eaisybooks toggle, send them to /accounty.
      // Otherwise navigate to '/' (or returnTo) — RootRedirect handles the rest.
      const target = returnTo && returnTo !== '/'
        ? returnTo
        : isEaisybooks ? '/accounty' : '/';
      navigate(target);
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'A jelszavak nem egyeznek', description: 'Kérlek ellenőrizd a megadott jelszavakat.', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const { error } = await signUp(email, password, name, appMode);

    if (!error) {
      setSignedUpEmail(email);
      setSignUpSuccess(true);
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast({ title: 'Google bejelentkezés sikertelen', variant: 'destructive' });
      reportAuthError('Auth', 'google_signin', 'Google sign in error', error);
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
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
      });
      if (error) throw error;
      toast({ title: 'Jelszó visszaállító email elküldve! Ellenőrizd a postaládádat.' });
      setShowForgotPassword(false);
    } catch (error: any) {
      reportAuthError('Auth', 'password_reset', error.message || 'Password reset error', error);
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
    <div className="flex h-screen overflow-hidden auth-root relative bg-background">
      {/* Full-screen wave — theme-dependent SVG */}
      <img
        src={currentTheme === 'dark' ? '/eaisybill_wave_dark.webp' : '/eaisybill_wave_bright.webp'}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0 transition-all duration-500"
      />

      {/* Left Side - Form Area */}
      <div className="relative flex w-full flex-col items-center lg:w-[45%] h-screen overflow-y-auto z-10" style={{ scrollbarWidth: 'none' }}>
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

        {/* Centered Content Wrapper — glassmorphic card frame */}
        <div className="w-full max-w-sm px-8 lg:px-0 py-4 my-auto">
        <div className="bg-background/90 dark:bg-background/85 backdrop-blur-xl border border-border/50 rounded-xl p-8 shadow-xl shadow-black/5 dark:shadow-black/20 relative overflow-hidden">


          {/* ── Email Confirmation Screen (after successful signup OR unverified redirect) ── */}
          {/* ── Verification In Progress (loading) ── */}
          {(isVerifying || verifyTokenParam) ? (
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <svg className="h-10 w-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Email megerősítése...
              </h1>
              <p className="text-sm text-muted-foreground">
                Kérjük várj, amíg ellenőrizzük a linket.
              </p>
            </div>
          ) : verificationSuccess ? (
            <div className="flex flex-col items-center text-center">
              {/* Green check icon */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                {/* Subtle pulse ring */}
                <div className="absolute inset-0 rounded-2xl bg-green-500/5 animate-ping" style={{ animationDuration: '2s' }} />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                Email sikeresen megerősítve! 🎉
              </h1>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Köszönjük, hogy megerősítetted az email címedet. Mostantól beléphetsz az eaisybill/eaisybooks fiókodba.
              </p>

              <Button
                variant="default"
                className="w-full h-10 font-medium"
                onClick={() => {
                  setVerificationSuccess(false);
                  setActiveTab('signin');
                }}
              >
                Bejelentkezés
              </Button>
            </div>
          ) : (signUpSuccess || isUnverified) ? (
            <div className="flex flex-col items-center text-center">
              {/* Animated envelope icon */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Mail className="h-10 w-10 text-primary" />
                </div>
                {/* Subtle pulse ring */}
                <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {isUnverified ? 'Email megerősítés szükséges' : 'Ellenőrizd az email-ed!'}
              </h1>
              <p className="text-sm text-muted-foreground mb-2">
                {isUnverified
                  ? 'A fiókod még nincs megerősítve. Kattints az emailben kapott linkre.'
                  : 'Küldtünk egy megerősítő linket a következő címre:'}
              </p>
              {signedUpEmail && (
                <p className="text-sm font-semibold text-foreground mb-4 bg-primary/5 px-4 py-2 rounded-lg">
                  {signedUpEmail}
                </p>
              )}
              {isUnverified && user?.email && (
                <p className="text-sm font-semibold text-foreground mb-4 bg-primary/5 px-4 py-2 rounded-lg">
                  {user.email}
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-6 max-w-xs">
                Kattints az emailben kapott linkre a fiókod aktiválásához. Ha nem találod, nézd meg a spam mappát is.
              </p>

              {/* Resend verification email */}
              <Button
                variant="default"
                className="w-full h-10 font-medium mb-3"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? 'Küldés...' : 'Megerősítő email újraküldése'}
              </Button>

              <Button
                variant="outline"
                className="w-full h-10 font-medium"
                onClick={async () => {
                  // Always sign out locally to prevent redirect loop
                  // (unverified user stays logged in → useAppReady redirects back here)
                  await supabase.auth.signOut({ scope: 'local' });
                  setSignUpSuccess(false);
                  setSignedUpEmail('');
                  setActiveTab('signin');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setName('');
                  setAuthSearchParams({}, { replace: true });
                }}
              >
                Vissza a bejelentkezéshez
              </Button>
            </div>
          ) : (
          <>
          {/* Logo */}
          <div className="mb-4">
            {isEaisybooks ? (
              <span className="text-4xl tracking-tight select-none">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-teal-500">ai</span>
                <span className="font-medium text-foreground/80">sy</span>
                <span className="font-medium text-teal-500">books</span>
              </span>
            ) : (
              <span className="text-4xl tracking-tight select-none">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-primary">ai</span>
                <span className="font-medium text-foreground/80">sy</span>
                <span className="font-medium text-primary">bill</span>
              </span>
            )}
          </div>

          {/* App Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/60 dark:bg-zinc-800/40 rounded-full border border-slate-200/50 dark:border-zinc-700/30 w-fit mb-6 shadow-sm">
            <button
              type="button"
              onClick={() => handleAppModeChange('eaisybill')}
              className={cn(
                "px-5 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                appMode === 'eaisybill'
                  ? "bg-white dark:bg-zinc-800 text-primary shadow-sm font-bold border border-slate-200/40 dark:border-zinc-700/50"
                  : "text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground"
              )}
            >
              eaisybill
            </button>
            <button
              type="button"
              onClick={() => handleAppModeChange('eaisybooks')}
              className={cn(
                "px-5 py-1.5 text-xs font-semibold rounded-full transition-all duration-300",
                appMode === 'eaisybooks'
                  ? "bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 shadow-sm font-bold border border-slate-200/40 dark:border-zinc-700/50"
                  : "text-slate-500 dark:text-muted-foreground hover:text-slate-800 dark:hover:text-foreground"
              )}
            >
              eaisybooks
            </button>
          </div>

          {/* Welcome Text – min-h reserves space for 2-line subtitle, preventing layout shifts */}
          <div className="mb-4 min-h-[4.5rem]">
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {activeTab === 'signin' ? (isFirstVisit ? 'Üdv!' : 'Üdv újra!') : 'Kezdjük el!'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'signin'
                ? (isEaisybooks ? 'Lépj be a könyvelő fiókodba a folytatáshoz.' : 'Jelentkezz be a fiókodba a folytatáshoz.')
                : 'Hozd létre a fiókodat néhány egyszerű lépésben'}
            </p>
          </div>

          {/* Segmented Control Tabs */}
          <div className="mb-6">
            <div className="inline-flex rounded-lg bg-slate-100/80 dark:bg-secondary/50 border border-slate-200/60 dark:border-transparent p-1">
              <button
                onClick={() => { setActiveTab('signin'); setEmail(''); setPassword(''); setConfirmPassword(''); setName(''); }}
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
                onClick={() => { setActiveTab('signup'); setEmail(''); setPassword(''); setConfirmPassword(''); setName(''); }}
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

          {/* Form — animated tab switch */}
          <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'signin' ? (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
            <form onSubmit={handleSignIn} noValidate className="space-y-4">
              <div className="space-y-1.5">
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
                    className="pl-10 bg-white/80 dark:bg-[#111214] border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
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
                    className="pl-10 bg-white/80 dark:bg-[#111214] border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-10 font-medium"
                disabled={loading}
              >
                {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
              </Button>
            </form>
            </motion.div>
          ) : (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
            <form onSubmit={handleSignUp} noValidate className="space-y-4">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                  Jelszó
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Erős jelszó"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "pl-10 bg-white dark:bg-secondary/30 border focus:ring-2 focus:ring-primary/20 transition-colors",
                      password.length > 0 && !(/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[._?@>]/.test(password))
                        ? "border-amber-400 dark:border-amber-500"
                        : "border-slate-200 dark:border-slate-800 focus:border-primary"
                    )}
                    required
                  />
                </div>
                {/* Password strength indicators */}
                {password.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                    {[
                      { label: 'Nagybetű (A-Z)', valid: /[A-Z]/.test(password) },
                      { label: 'Kisbetű (a-z)', valid: /[a-z]/.test(password) },
                      { label: 'Szám (0-9)', valid: /\d/.test(password) },
                      { label: 'Speciális (._?@>)', valid: /[._?@>]/.test(password) },
                    ].map((rule) => (
                      <div key={rule.label} className="flex items-center gap-1.5">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          rule.valid ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                        )} />
                        <span className={cn(
                          "text-[11px] transition-colors",
                          rule.valid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-confirm-password" className="text-sm font-medium text-foreground">
                  Jelszó mégegyszer
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="Jelszó újra"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "pl-10 bg-white dark:bg-secondary/30 border focus:ring-2 focus:ring-primary/20 transition-colors",
                      confirmPassword.length > 0 && password !== confirmPassword
                        ? "border-rose-400 dark:border-rose-500"
                        : "border-slate-200 dark:border-slate-800 focus:border-primary"
                    )}
                    required
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-rose-500">A két jelszó nem egyezik</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-10 font-medium"
                disabled={loading || !(
                  name.trim().length > 0 &&
                  email.includes('@') &&
                  password.length >= 6 &&
                  /[A-Z]/.test(password) &&
                  /[a-z]/.test(password) &&
                  /\d/.test(password) &&
                  /[._?@>]/.test(password) &&
                  password === confirmPassword
                )}
              >
                {loading ? 'Fiók létrehozása...' : 'Regisztráció'}
              </Button>
            </form>
            </motion.div>
          )}
          </AnimatePresence>
          </div>

          {/* Divider + Google Sign In + Privacy — commented out for now
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">vagy</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-10 font-medium"
            onClick={handleGoogleSignIn}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Folytatás Google-lel
          </Button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            A folytatással elfogadod az{' '}
            <a href="#" className="text-primary hover:underline">Adatvédelmi irányelveket</a>
            {' '}és a{' '}
            <a href="#" className="text-primary hover:underline">Felhasználási feltételeket</a>.
          </p>
          */}
          </>
          )}

          {/* Forgot Password Overlay */}
          {showForgotPassword && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-sm bg-background border border-border rounded-xl p-6 shadow-lg mx-4">
                <h2 className="text-xl font-bold text-foreground mb-2">Elfelejtett jelszó</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Add meg az email címedet és küldünk egy jelszó visszaállító linket.
                </p>
                <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
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
      </div>

      {/* Right Side - Visual Showcase (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] h-screen relative overflow-hidden z-10">


        {/* Content - Above all background layers */}
        <div
          className="relative z-30 flex flex-col items-center justify-center h-full px-8 xl:px-12"
          onClick={handleFadeDismiss}
        >
          <div ref={wrapperRef} className="relative w-full max-w-[480px]">

            {/* Title — static */}
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground dark:text-white mb-4 xl:mb-8">
              T<span className={cn(isEaisybooks ? "text-teal-500" : "text-primary")}>a</span>rtsd kézben a pénzügye<span className={cn(isEaisybooks ? "text-teal-500" : "text-primary")}>i</span>det
            </h2>

            {/* Waterfall tape window */}
            <div
              ref={containerRef}
              className="relative h-[calc(100vh-120px)] max-h-[660px] overflow-hidden cursor-default"
              onClick={e => e.stopPropagation()}
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 10%, black 22%, black 78%, rgba(0,0,0,0.6) 90%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 10%, black 22%, black 78%, rgba(0,0,0,0.6) 90%, transparent 100%)',
              }}
              onMouseEnter={() => { isHoverRef.current = true; }}
              onMouseLeave={() => { isHoverRef.current = false; }}
            >
              {/* Subtle greenish LED flare behind the tape */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 50%, rgba(20,220,170,0.09) 0%, rgba(20,220,170,0.03) 45%, transparent 70%)' }}
              />
              {/* Always-mounted neon border overlay — positioned over the centered slide */}
              <svg
                ref={svgRef}
                className="absolute pointer-events-none z-20"
                style={{
                  display: 'block',
                  left: 0,
                  width: (selectedDims ?? fadingDimsRef.current)?.w ?? 0,
                  height: (selectedDims ?? fadingDimsRef.current)?.h ?? 0,
                  overflow: 'visible',
                  opacity: (!selectedDims && !dismissing) ? 0 : (dismissing ? 0 : 1),
                  transition: dismissing ? 'opacity 0.5s ease' : 'none',
                }}
              >
                {/* CW: mid-left → up → top-right corner → down to mid-right */}
                <path
                  ref={svgPath1Ref}
                  fill="none" stroke="rgba(20,220,170,0.96)" strokeWidth="2.5" strokeLinecap="round"
                  d={selectedDims
                    ? `M 1,${selectedDims.h / 2} V 13 A 12,12 0 0,1 13,1 H ${selectedDims.w - 13} A 12,12 0 0,1 ${selectedDims.w - 1},13 V ${selectedDims.h / 2}`
                    : ''}
                />
                {/* CCW: mid-left → down → bottom-right corner → up to mid-right */}
                <path
                  ref={svgPath2Ref}
                  fill="none" stroke="rgba(20,220,170,0.96)" strokeWidth="2.5" strokeLinecap="round"
                  d={selectedDims
                    ? `M 1,${selectedDims.h / 2} V ${selectedDims.h - 13} A 12,12 0 0,0 13,${selectedDims.h - 1} H ${selectedDims.w - 13} A 12,12 0 0,0 ${selectedDims.w - 1},${selectedDims.h - 13} V ${selectedDims.h / 2}`
                    : ''}
                />
              </svg>

              {/* The tape — two copies stacked for seamless downward loop */}
              <div ref={tapeRef} className="will-change-transform relative z-1">
                {[...activeSlides, ...activeSlides].map((slide, i) => (
                  <div
                    key={i}
                    className="pb-8 relative cursor-pointer tape-slide"
                    onClick={(e) => { e.stopPropagation(); handleSlideClick(i, e.currentTarget); }}
                  >
                    <div className="tape-slide-inner">
                      {slide.visual}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Popup — invisible until traced, then fades in */}
            {selectedDims && selectedAbsIdx !== null && (
              <div
                ref={popupRef}
                className="absolute left-full top-0 ml-16 w-64"
                style={{
                  opacity: showPopup ? (dismissing ? 0 : 1) : 0,
                  transition: dismissing ? 'opacity 0.5s ease' : (showPopup ? 'opacity 0.3s ease' : 'none'),
                }}
              >
                <div className="rounded-xl border border-primary/40 bg-background/90 backdrop-blur-md p-5 shadow-2xl">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeSlides[selectedAbsIdx % activeSlides.length].text}
                  </p>
                </div>
              </div>
            )}

            {/* Connector SVG — L line + popup top/left border traces */}
            <svg
              ref={svgConnRef}
              className="absolute left-0 top-0 w-full h-full pointer-events-none z-30"
              style={{ overflow: 'visible' }}
            >
              <path ref={svgConnPathRef} fill="none" stroke="rgba(20,220,170,0.96)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path ref={svgConnTopRef} fill="none" stroke="rgba(20,220,170,0.96)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path ref={svgConnLeftRef} fill="none" stroke="rgba(20,220,170,0.96)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Auth;
