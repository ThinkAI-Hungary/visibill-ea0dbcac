import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { seedAccountyAssignments } from '@/utils/seedAccounty';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Rocket,
  Briefcase,
  Calculator,
  Landmark,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  FileText,
  Plus,
  Sparkles,
  PartyPopper,
  BarChart2,
  Shield,
  Link2,
  ChevronRight,
} from 'lucide-react';

/* ─── Step Indicator ─── */
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { num: 1, label: 'Üdvözlő' },
    { num: 2, label: 'Ügyfél' },
    { num: 3, label: 'Kész' },
  ].slice(0, totalSteps);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500',
                step.num < currentStep
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : step.num === currentStep
                    ? 'bg-primary/15 border-2 border-primary text-primary shadow-md shadow-primary/10'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {step.num < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                step.num
              )}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium transition-colors duration-300',
                step.num === currentStep ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'w-12 h-0.5 mb-5 rounded-full transition-all duration-500',
                step.num < currentStep
                  ? 'bg-primary'
                  : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-950/30',
      icon: 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400',
      border: 'border-teal-200/50 dark:border-teal-800/50',
    },
    violet: {
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      icon: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
      border: 'border-violet-200/50 dark:border-violet-800/50',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      icon: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
      border: 'border-amber-200/50 dark:border-amber-800/50',
    },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div
      className={cn(
        'rounded-xl p-5 border transition-all duration-500 hover:shadow-lg hover:-translate-y-1 cursor-default',
        c.bg,
        c.border,
        'animate-in fade-in slide-in-from-bottom-4'
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', c.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

/* ─── Confetti burst (lightweight CSS-only) ─── */
function ConfettiBurst() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; rotation: number }>>([]);

  useEffect(() => {
    const colors = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#f97316'];
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 80,
      y: 40 + (Math.random() - 0.5) * 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${1.5 + Math.random()}s ease-out forwards`,
            animationDelay: `${Math.random() * 0.3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translateY(120px) rotate(${360 + Math.random() * 360}deg) scale(0.3); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ═══ MAIN WIZARD COMPONENT ═══ */
/* ═══════════════════════════════════════════════════════════ */

interface AccountyWelcomeWizardProps {
  onComplete: () => void;
}

export default function AccountyWelcomeWizard({ onComplete }: AccountyWelcomeWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  // Step 2: Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned'>('idle');
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string; tax_number: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [clientAdded, setClientAdded] = useState(false);

  const goTo = useCallback((targetStep: number) => {
    setSlideDir(targetStep > step ? 'left' : 'right');
    setStep(targetStep);
  }, [step]);

  /* ─── Invite Code Handlers ─── */
  const handleValidateCode = async () => {
    if (!inviteCode.trim()) return;
    setCodeStatus('validating');
    setLinkedCompany(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-partner-code', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.valid) {
        setCodeStatus('valid');
        setLinkedCompany(data.company);
      } else if (data?.error === 'token_expired') {
        setCodeStatus('expired');
      } else {
        setCodeStatus('invalid');
      }
    } catch (err) {
      reportError({ type: 'edge_function', component: 'AccountyWelcomeWizard', action: 'error', message: 'Failed to validate partner code:', error: err });
      setCodeStatus('invalid');
    }
  };

  const handleJoinAsAccountant = async () => {
    if (!inviteCode.trim() || codeStatus !== 'valid') return;
    setIsJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-company-as-accountant', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.error === 'already_assigned') {
        setCodeStatus('already_assigned');
        return;
      }
      if (data?.error) {
        setCodeStatus('invalid');
        return;
      }
      setClientAdded(true);
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      // Auto-advance to completion step
      setTimeout(() => goTo(3), 800);
    } catch (err) {
      reportError({ type: 'edge_function', component: 'AccountyWelcomeWizard', action: 'error', message: 'Failed to join as accountant:', error: err });
      setCodeStatus('invalid');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSyncEaisybill = async () => {
    setIsSyncing(true);
    try {
      const result = await seedAccountyAssignments();
      if (result && !('error' in result)) {
        setClientAdded(true);
        queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
        queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
        setTimeout(() => goTo(3), 800);
      }
    } catch (err) {
      reportError({ type: 'edge_function', component: 'AccountyWelcomeWizard', action: 'error', message: 'Failed to sync eaisybill:', error: err });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  /* ═══ STEP 1: Welcome ═══ */
  const renderStep1 = () => (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
      {/* Hero icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/30 animate-in zoom-in duration-500">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center animate-bounce shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-amber-900" />
        </div>
      </div>

      {/* Greeting */}
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
        Üdvözlünk az eaisybooks-ban! 🎉
      </h1>
      <p className="text-base text-slate-500 dark:text-slate-400 mb-8 max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
        A könyvelőirodád digitális munkatársa. Néhány lépésben beállítjuk az alapokat, hogy azonnal dolgozni tudj.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
        <FeatureCard
          icon={Briefcase}
          title="Portfólió kezelés"
          description="Minden ügyféladatot egy helyen kezelhetsz, valós idejű áttekintéssel."
          color="teal"
          delay={200}
        />
        <FeatureCard
          icon={Calculator}
          title="Bérszámfejtés"
          description="Automatizált bérszámfejtés, bevallások és kifizetési jegyzékek."
          color="violet"
          delay={350}
        />
        <FeatureCard
          icon={Landmark}
          title="TAO / KIVA"
          description="Társasági adó és KIVA kalkuláció, összehasonlítás és bevallás."
          color="amber"
          delay={500}
        />
      </div>

      {/* CTA */}
      <Button
        onClick={() => goTo(2)}
        size="lg"
        className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-xl shadow-primary/25 px-8 gap-2 animate-in fade-in slide-in-from-bottom-3 duration-500"
        style={{ animationDelay: '600ms', animationFillMode: 'both' }}
      >
        Kezdjük el!
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );

  /* ═══ STEP 2: Add Client ═══ */
  const renderStep2 = () => (
    <div className="max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 animate-in zoom-in duration-300">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Első ügyfél hozzáadása</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Válaszd ki, hogyan szeretnéd hozzáadni az első ügyfeledet
        </p>
      </div>

      {/* Success state */}
      {clientAdded && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500 rounded-xl flex items-center gap-3 mb-6 animate-in fade-in zoom-in duration-300">
          <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Ügyfél sikeresen hozzáadva!</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-500">Lépj tovább a befejezéshez.</p>
          </div>
        </div>
      )}

      {/* Option cards */}
      {!clientAdded && (
        <div className="space-y-4">
          {/* Option 1: Invite Code */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <details className="group">
              <summary className="flex items-center gap-4 p-5 cursor-pointer select-none hover:bg-primary/5 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Meghívó kóddal</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Az ügyfeled eaisybill fiókjából kapott kóddal</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-90" />
              </summary>

              <div className="px-5 pb-5 pt-2 border-t border-border/50 animate-in fade-in duration-200">
                <div className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                    <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">Így működik:</p>
                    <p>1. Kérd meg az ügyfelet, hogy generáljon meghívó kódot az eaisybill Beállításokban</p>
                    <p>2. Írd be ide a kapott 6 jegyű kódot</p>
                    <p>3. Ha érvényes, azonnal hozzárendelődik</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Meghívó kód</Label>
                    <Input
                      placeholder="pl. A1B2C3"
                      value={inviteCode}
                      onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeStatus('idle'); setLinkedCompany(null); }}
                      className="font-mono uppercase tracking-widest text-center text-lg h-12"
                      maxLength={6}
                    />
                  </div>

                  {/* Validation feedback */}
                  {codeStatus === 'valid' && linkedCompany && (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2 duration-300">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Cég megtalálva: <strong>{linkedCompany.name}</strong> ({linkedCompany.tax_number})</span>
                    </div>
                  )}
                  {codeStatus === 'invalid' && (
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Érvénytelen meghívó kód</span>
                    </div>
                  )}
                  {codeStatus === 'expired' && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>A meghívó kód lejárt — kérj újat az ügyféltől!</span>
                    </div>
                  )}
                  {codeStatus === 'already_assigned' && (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 animate-in fade-in duration-200">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Ez a cég már hozzá van rendelve a fiókodhoz</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    {codeStatus === 'valid' ? (
                      <Button onClick={handleJoinAsAccountant} disabled={isJoining} className="gap-2">
                        {isJoining ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Hozzáadás...</>
                        ) : (
                          <><Check className="w-4 h-4" /> Ügyfél hozzáadása</>
                        )}
                      </Button>
                    ) : (
                      <Button onClick={handleValidateCode} disabled={!inviteCode.trim() || codeStatus === 'validating'} className="gap-2">
                        {codeStatus === 'validating' ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Ellenőrzés...</>
                        ) : (
                          <>Kód ellenőrzése</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Option 2: Sync from eaisybill */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">eaisybill cégek szinkronizálása</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Meglévő eaisybill cégeid automatikus hozzárendelése</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncEaisybill}
                disabled={isSyncing}
                className="shrink-0 gap-2"
              >
                {isSyncing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Szinkronizálás...</>
                ) : (
                  <>Szinkronizálás</>
                )}
              </Button>
            </div>
          </div>

          {/* Option 3: Manual new client */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Új ügyfél kézi felvétele</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cégadatok megadása a New Client wizarddal</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Mark onboarding as done and navigate to new client wizard
                  onComplete();
                  navigate('/eaisybooks/new-client');
                }}
                className="shrink-0 gap-2"
              >
                Új ügyfél
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
        <Button variant="ghost" onClick={() => goTo(1)} className="gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          Vissza
        </Button>

        <div className="flex items-center gap-3">
          {!clientAdded && (
            <Button variant="ghost" onClick={() => goTo(3)} className="text-muted-foreground text-sm">
              Kihagyom, később
            </Button>
          )}
          {clientAdded && (
            <Button onClick={() => goTo(3)} className="gap-2">
              Tovább
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  /* ═══ STEP 3: Completion ═══ */
  const renderStep3 = () => (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto relative">
      <ConfettiBurst />

      {/* Success icon */}
      <div className="relative mb-6 animate-in zoom-in duration-500">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <PartyPopper className="w-10 h-10 text-white" />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-500">
        Készen állsz! 🚀
      </h2>
      <p className="text-base text-slate-500 dark:text-slate-400 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '100ms' }}>
        {clientAdded
          ? 'Az első ügyfeled hozzáadva. Fedezd fel az eaisybooks funkcióit!'
          : 'Bármikor hozzáadhatsz ügyfeleket a portfólió oldalon.'}
      </p>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        {[
          { icon: Briefcase, label: 'Portfólió', desc: 'Ügyfelek áttekintése', path: '/eaisybooks' },
          { icon: Sparkles, label: 'AI Asszisztens', desc: 'Intelligens segítség', path: '/eaisybooks/ai-assistant' },
          { icon: Shield, label: 'Segítség', desc: 'Dokumentáció és FAQ', path: '/eaisybooks/help' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => { onComplete(); navigate(link.path); }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
          >
            <link.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{link.label}</span>
            <span className="text-[10px] text-muted-foreground">{link.desc}</span>
          </button>
        ))}
      </div>

      {/* Main CTA */}
      <Button
        onClick={handleFinish}
        size="lg"
        className="bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 text-white shadow-xl shadow-primary/25 px-10 gap-2 animate-in fade-in slide-in-from-bottom-3 duration-500"
        style={{ animationDelay: '400ms', animationFillMode: 'both' }}
      >
        Fedezd fel az eaisybooks-t
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );

  /* ═══ RENDER ═══ */
  return (
    <div className="w-full min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <StepIndicator currentStep={step} totalSteps={3} />

        {/* Step content with simple animation */}
        <div
          key={step}
          className={cn(
            'animate-in fade-in duration-400',
            slideDir === 'left' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'
          )}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </div>
    </div>
  );
}
