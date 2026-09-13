import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { AccountyRoleProvider } from './AccountyRoleContext';
import { AccountyShellProvider, useAccountyShell } from '@/pages/Accounty/AccountyShellContext';
import { useAuth } from '@/contexts/AuthContext';
import { FeedbackFab } from '@/components/FeedbackFab';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  Settings, 
  HelpCircle, 
  Building2, 
  X, 
  Rocket, 
  Landmark, 
  Shield, 
  WifiOff, 
  Coins, 
  Calculator, 
  ClipboardList 
} from 'lucide-react';
import CookieConsentBanner from '@/components/accounty/CookieConsentBanner';
import { AccountyErrorBoundary } from '@/components/accounty/AccountyErrorBoundary';
import { useAccountyRealtime } from '@/hooks/useAccountyRealtime';
import { Button } from '@/components/ui/button';

import AccountySidebar from '@/components/accounty/layout/AccountySidebar';
import AccountyHeader from '@/components/accounty/layout/AccountyHeader';
import AccountyCommandPalette from '@/components/accounty/layout/AccountyCommandPalette';
import AccountyTour from '@/components/accounty/layout/AccountyTour';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Track whether eaisyBooks has mounted and initialized in the current browser session.
// Resets to false on page refresh (F5).
let hasAccountyInitialized = false;

export default function AccountyLayout() {
  return (
    <AccountyRoleProvider>
      <AccountyShellProvider>
        <AccountyLayoutInner />
      </AccountyShellProvider>
    </AccountyRoleProvider>
  );
}

function AccountyLayoutInner() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const location = useLocation();
  useAccountyRealtime();

  const {
    sidebarOpen,
    setSidebarOpen,
    runTour,
    setRunTour,
    helpDrawerOpen,
    setHelpDrawerOpen,
    setHoveredHelpSection,
    isCollapsed,
    toggleSidebarCollapse,
    allClients,
    isClientsLoading,
  } = useAccountyShell();

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [gdprBannerDismissed, setGdprBannerDismissed] = useState(() => sessionStorage.getItem('gdpr_banner_dismissed') === '1');

  // Cold vs Warm initialization state:
  // - Cold (first visit after F5): initialLoading = true, shows LoadingSpinner until clients load
  // - Warm (subsequent visits/switches): initialLoading = false, instant SPA switch without spinner
  const [initialLoading, setInitialLoading] = useState(() => !hasAccountyInitialized);

  // Complete cold start when all clients are ready, plus a short 400ms grace period for clean mount
  useEffect(() => {
    if (initialLoading && !isClientsLoading && allClients) {
      const timer = setTimeout(() => {
        hasAccountyInitialized = true;
        setInitialLoading(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [initialLoading, isClientsLoading, allClients]);

  // Fallback safety timeout (4s)
  useEffect(() => {
    if (initialLoading) {
      const timer = setTimeout(() => {
        hasAccountyInitialized = true;
        setInitialLoading(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [initialLoading]);

  // Eager background prefetch of primary eaisybooks page chunks
  useEffect(() => {
    const timer = setTimeout(() => {
      void import('@/pages/Accounty/MissingInvoicesPage');
      void import('@/pages/Accounty/TaxCalendarPage');
      void import('@/pages/Accounty/ReportsPage');
      void import('@/pages/Accounty/ApprovalQueuePage');
      void import('@/pages/Accounty/SettingsPage');
      void import('@/pages/Accounty/AiAssistantPage');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Profile role for impersonation checks and tour auto-start
  const { data: profileRole } = useQuery({
    queryKey: ['profile-role-accounty', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user!.id)
        .single();
      return data?.role || 'user';
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (user && profileRole) {
      const completed = localStorage.getItem(`accounty_tour_completed_${user.id}`);
      if (completed !== 'true' && profileRole !== 'support_admin') {
        const timer = setTimeout(() => setRunTour(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, profileRole, setRunTour]);

  // Check for active impersonation (support_admin role in company_members)
  const { data: hasImpersonation, isPending: impersonationLoading } = useQuery({
    queryKey: ['has-impersonation-accounty', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('role', 'support_admin' as any);
      return (count ?? 0) > 0;
    },
    enabled: !!user && (profileRole === 'management' || profileRole === 'thinkai'),
    staleTime: 30_000,
  });

  // Redirect if management/thinkai role user does not have active impersonation
  if ((profileRole === 'management' || profileRole === 'thinkai') && !impersonationLoading && !hasImpersonation) {
    return <Navigate to="/management" replace />;
  }

  // Cold start: render loading spinner until clients are loaded.
  // Warm switch: instant rendering without fullPage spinner.
  const shouldShowSpinner = !hasAccountyInitialized && (initialLoading || (!allClients && isClientsLoading));
  if (shouldShowSpinner) {
    return <LoadingSpinner fullPage={true} message="eaisyBooks betöltése..." />;
  }

  return (
    <>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        
        {/* Zero-prop compound sidebar */}
        <AccountySidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Zero-prop header */}
          <AccountyHeader />

          <div id="accounty-main-scroll" className="flex-1 overflow-y-auto p-8 relative" style={{ scrollbarGutter: 'stable' }}>
            {!isOnline && (
              <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <WifiOff className="w-4 h-4 text-red-500 shrink-0" />
                <p className="flex-1 text-red-800 dark:text-red-300">
                  <span className="font-medium">Nincs internetkapcsolat</span>
                  <span className="text-red-600 dark:text-red-400"> — Az adatok nem frissülnek amíg a kapcsolat nem áll helyre.</span>
                </p>
              </div>
            )}

            {(() => {
              if (gdprBannerDismissed) return null;

              let cookieOk = false;
              let privacyOk = false;
              try {
                const cc = localStorage.getItem('accounty_cookie_consent');
                cookieOk = cc ? JSON.parse(cc).version === '1.0' : false;
              } catch {}
              try {
                const pp = localStorage.getItem('accounty_privacy_consent');
                privacyOk = pp ? JSON.parse(pp).version === '1.0' : false;
              } catch {}

              if (cookieOk && privacyOk) return null;

              return (
                <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-xl text-sm animate-in fade-in slide-in-from-top-2 duration-500">
                  <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="flex-1 text-amber-800 dark:text-amber-300">
                    <span className="font-medium">GDPR megfelelőség hiányos</span>
                    <span className="text-amber-600 dark:text-amber-400"> — Az adatvédelmi követelmények teljesítéséhez fogadja el a süti beállításokat és az adatkezelési tájékoztatót.</span>
                  </p>
                  <Link
                    to="/eaisybooks/settings"
                    className="shrink-0 px-3 py-1 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
                  >
                    Beállítások
                  </Link>
                  <button
                    onClick={() => { sessionStorage.setItem('gdpr_banner_dismissed', '1'); setGdprBannerDismissed(true); }}
                    className="shrink-0 p-1 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                    title="Elutasítás"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}

            <AccountyErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </AccountyErrorBoundary>

            <AccountyTour
              run={runTour}
              onComplete={() => setRunTour(false)}
            />

            {helpDrawerOpen && (
              <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-background/85 backdrop-blur-xl border-l border-border/50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary animate-pulse" />
                    <h3 className="text-sm font-bold text-foreground">Súgó és Funkcióleírások</h3>
                  </div>
                  <button onClick={() => setHelpDrawerOpen(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-5 space-y-4">
                  <p className="text-[10px] text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg p-2.5 leading-relaxed">
                    💡 <span className="font-semibold text-foreground">Tipp:</span> Vigye a kurzort az alábbi leírások fölé, és a hozzájuk tartozó menüpont automatikusan kiemelésre kerül az oldalsávban!
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        id: 'portfolio',
                        title: 'Portfólió kezelés',
                        icon: Briefcase,
                        color: 'text-primary bg-primary/10',
                        desc: 'Az irodához rendelt összes ügyfél listája, státusza, hiányzó számlák darabszáma és határidők egyetlen központi képernyőn.',
                        levels: ['portfolio', 'company']
                      },
                      {
                        id: 'missing-invoices',
                        title: 'Hiányzó számlák bekérése',
                        icon: FileWarning,
                        color: 'text-orange-500 bg-orange-500/10',
                        desc: 'Kereshető lista azokról a kiadásokról/tranzakciókról, amikhez nem tartozik számlakép. Azonnali e-mail kiküldési sablon az ügyfeleknek.',
                        levels: ['portfolio', 'company']
                      },
                      {
                        id: 'calendar',
                        title: 'Naptár & Határidők',
                        icon: Calendar,
                        color: 'text-amber-500 bg-amber-500/10',
                        desc: 'Az iroda naptára a legfontosabb adózási, bevallási és befizetési határidőkkel, hogy egyetlen leadási dátumról se csússz le.',
                        levels: ['portfolio']
                      },
                      {
                        id: 'reports',
                        title: 'Pénzügyi Riportok',
                        icon: BarChart2,
                        color: 'text-blue-500 bg-blue-500/10',
                        desc: 'PDF és Excel formátumú könyvelési riportok, főkönyvi kivonatok, eredménykimutatások és egyéb irodai statisztikák generálása.',
                        levels: ['portfolio']
                      },
                      {
                        id: 'settings',
                        title: 'Cégkapu & NAV szinkron',
                        icon: Building2,
                        color: 'text-emerald-500 bg-emerald-500/10',
                        desc: 'Automatizált adatkapcsolat, ami közvetlenül letölti a cégek hivatalos NAV Online Számla bizonylatait és a Cégkapura érkező üzeneteket.',
                        levels: ['company']
                      },
                      {
                        id: 'ev',
                        title: 'Egyéni Vállalkozás (EV)',
                        icon: Coins,
                        color: 'text-teal-500 bg-teal-500/10',
                        desc: 'Speciális modul egyéni vállalkozók könyveléséhez. Átalányadó, tételes költségelszámolás kalkulációk és járulékfizetési kötelezettségek.',
                        levels: ['company']
                      },
                      {
                        id: 'tao',
                        title: 'Társasági Adó (TAO)',
                        icon: Landmark,
                        color: 'text-indigo-500 bg-indigo-500/10',
                        desc: 'Társasági adó hatálya alá tartozó cégek főkönyvi modulja, adóalap korrigáló tételek és a TAO bevalláshoz szükséges számítások.',
                        levels: ['company']
                      },
                      {
                        id: 'payroll',
                        title: 'Bérszámfejtés',
                        icon: Calculator,
                        color: 'text-violet-500 bg-violet-500/10',
                        desc: 'Havi számfejtési ciklusok kezelése, munkavállalói adatok és jogviszonyok, adókedvezmény-nyilatkozatok nyilvántartása.',
                        levels: ['company']
                      },
                      {
                        id: 'filings',
                        title: 'NAV bevallások',
                        icon: ClipboardList,
                        color: 'text-rose-500 bg-rose-500/10',
                        desc: 'A számfejtésből származó NAV 08-as havi bevallások és adatszolgáltatások automatikus összeállítása és előkészítése.',
                        levels: ['company']
                      }
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div 
                          key={item.id}
                          onMouseEnter={() => setHoveredHelpSection(item.id)}
                          onMouseLeave={() => setHoveredHelpSection(null)}
                          className="p-3.5 rounded-xl border border-border bg-card shadow-soft space-y-2 hover:border-primary/30 hover:bg-primary/[0.02] hover:scale-[1.01] hover:shadow-md transition-all duration-200 cursor-default"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                              <div className={`p-1.5 rounded-lg ${item.color} shrink-0`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span>{item.title}</span>
                            </div>
                            <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                              {item.levels.map(lvl => (
                                <span 
                                  key={lvl} 
                                  className={cn(
                                    "text-[8px] tracking-wide font-semibold px-1.5 py-0.5 rounded-md border",
                                    lvl === 'portfolio' 
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  )}
                                >
                                  {lvl === 'portfolio' ? 'Portfólió' : 'Cég'}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground leading-relaxed pl-1">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <Button 
                      onClick={() => {
                        setHelpDrawerOpen(false);
                        setRunTour(true);
                      }}
                      className="w-full gap-2 text-xs font-bold"
                    >
                      <Rocket className="w-4 h-4" />
                      Interaktív bemutató újraindítása
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Zero-prop Command Palette */}
      <AccountyCommandPalette />

      <FeedbackFab onAiOpen={() => setAiDrawerOpen(true)} aiDrawerOpen={aiDrawerOpen} onAiClose={() => setAiDrawerOpen(false)} />
      <CookieConsentBanner />
    </>
  );
}
