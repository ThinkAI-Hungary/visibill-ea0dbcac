import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
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
  const { signIn, signUp, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (user) { navigate('/'); }
  }, [user, navigate]);

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
      navigate('/');
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
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
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

          {/* Welcome Text – min-h reserves space for 2-line subtitle, preventing layout shifts */}
          <div className="mb-8 min-h-[6.5rem]">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {activeTab === 'signin' ? (isFirstVisit ? 'Üdv!' : 'Üdv újra!') : 'Kezdjük el!'}
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

          {/* Form */}
          {activeTab === 'signin' ? (
            <form onSubmit={handleSignIn} noValidate className="space-y-5">
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
            <form onSubmit={handleSignUp} noValidate className="space-y-5">
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
              <div className="space-y-2">
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
                className="w-full h-11 font-medium"
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
        <div
          className="relative z-30 flex flex-col items-center justify-center h-full px-8 xl:px-12"
          onClick={handleFadeDismiss}
        >
          <div ref={wrapperRef} className="relative w-full max-w-[480px]">

            {/* Title — static */}
            <h2 className="text-4xl font-bold text-foreground dark:text-white mb-8">
              Tartsd kézben a pénzügyeidet
            </h2>

            {/* Waterfall tape window */}
            <div
              ref={containerRef}
              className="relative h-[660px] overflow-hidden cursor-default"
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
                {[...carouselSlides, ...carouselSlides].map((slide, i) => (
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
                    {carouselSlides[selectedAbsIdx % carouselSlides.length].text}
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
