import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Banknote, Settings2, Star, Zap, ClipboardCheck, Calculator, FileText, ArrowRight } from 'lucide-react';
import { useParams, useLocation } from 'react-router-dom';
import { useScopedNavigate } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const OpgPage = React.lazy(() => import('@/pages/OpgPage'));
import { fmtBalance } from '@/components/petty-cash/types';
import type { SummaryRow, PettyCashRegister } from '@/components/petty-cash/types';
import RegistersTab from '@/components/petty-cash/RegistersTab';
import EntriesTab from '@/components/petty-cash/EntriesTab';
import RoutingRulesTab from '@/components/petty-cash/RoutingRulesTab';
import ApprovalTab from '@/components/petty-cash/ApprovalTab';
import CashReportsTab from '@/components/petty-cash/CashReportsTab';
import DenominationCalculatorDialog from '@/components/petty-cash/DenominationCalculatorDialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { getLocalizedRegisterName, isPendingPettyCashInvoice } from '@/lib/pettyCashUtils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PettyCashPage = () => {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';
  const scopedNavigate = useScopedNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const location = useLocation();

  const isOpgMode = tab === 'opg' || location.pathname.endsWith('/opg') || location.pathname.includes('/opg/');

  const [lastPettyCashTab, setLastPettyCashTab] = useState<string>(() => {
    if (tab && tab !== 'opg') return tab;
    return 'entries';
  });

  const activePettyCashTab = (tab && tab !== 'opg') ? tab : lastPettyCashTab;

  const handleTabChange = (val: string) => {
    setLastPettyCashTab(val);
    scopedNavigate(val === 'entries' ? 'petty-cash' : `petty-cash/${val}`);
  };

  const handleModeSwitch = (toOpg: boolean) => {
    if (toOpg) {
      scopedNavigate('petty-cash/opg');
    } else {
      scopedNavigate(activePettyCashTab === 'entries' ? 'petty-cash' : `petty-cash/${activePettyCashTab}`);
    }
  };

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcRegister, setCalcRegister] = useState<{ id: string; name: string; balance: number; currency: string } | null>(null);
  const [customLimit, setCustomLimit] = useState<number>(() => {
    if (typeof window !== 'undefined' && companyId) {
      const saved = localStorage.getItem(`visibill_pettycash_limit_${companyId}`);
      if (saved) return Number(saved);
    }
    return 1500000;
  });

  const prevCompanyIdRef = React.useRef(companyId);
  if (prevCompanyIdRef.current !== companyId) {
    prevCompanyIdRef.current = companyId;
    const saved = typeof window !== 'undefined' && companyId ? localStorage.getItem(`visibill_pettycash_limit_${companyId}`) : null;
    setCustomLimit(saved ? Number(saved) : 1500000);
  }

  const handleSaveLimit = (val: number) => {
    setCustomLimit(val);
    localStorage.setItem(`visibill_pettycash_limit_${companyId}`, String(val));
  };

  const handleOpenCalc = (regId: string, regName: string, balance: number, currency: string) => {
    setCalcRegister({ id: regId, name: regName, balance, currency });
    setCalcOpen(true);
  };

  // Count of pending approval invoices for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pettyCashPendingCount', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_type, fizetesi_mod')
        .eq('company_id', companyId)
        .eq('statusz', 'jovahagyasra_var')
        .in('invoice_type', ['penztarbizonylat', 'egyszerusitett_szla', 'penztargep_zaras']);
      if (error || !data) return 0;
      return data.filter(isPendingPettyCashInvoice).length;
    },
    enabled: !!companyId,
  });

  // Query OPG pending cash transactions for petty cash banner
  const { data: opgKpi } = useQuery({
    queryKey: ['opgTurnoverKpi', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { OpgService } = await import('@/services/opgService');
      return OpgService.getTurnoverKpis(companyId);
    },
    enabled: !!companyId,
  });

  // Registers list for passing to tabs
  const { data: registers = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers')
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  // P3: Summary computed from DB RPC get_petty_cash_summary
  // P3: Added staleTime: 30s to avoid unnecessary re-fetches (mutations invalidate)
  const { data: summary = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashSummary(companyId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_petty_cash_summary', {
        p_company_id: companyId
      });

      if (error) {
        throw error;
      }

      return ((data || []) as SummaryRow[]).sort((a, b) =>
        (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.register_name.localeCompare(b.register_name) || a.currency.localeCompare(b.currency)
      );
    },
    enabled: !!user && !!companyId,
    staleTime: 30_000, // P3: 30s cache — mutations invalidate when needed
  });

  // Aggregate by currency (total across all registers)
  // Aggregate by currency (total across all registers)
  const totalByCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    summary.forEach(r => {
      m[r.currency] = (m[r.currency] || 0) + r.current_balance;
    });
    return Object.entries(m).sort(([a], [b]) => a === 'HUF' ? -1 : b === 'HUF' ? 1 : a.localeCompare(b));
  }, [summary]);

  // Group by register
  const registerSummaries = useMemo(() => {
    const m: Record<string, { name: string; is_default: boolean; currencies: { currency: string; balance: number }[] }> = {};
    summary.forEach(r => {
      if (!m[r.register_id]) m[r.register_id] = { name: r.register_name, is_default: r.is_default, currencies: [] };
      m[r.register_id].currencies.push({ currency: r.currency, balance: r.current_balance });
    });
    
    // Sort currencies within each register consistently (HUF first, then alphabetically)
    Object.values(m).forEach(reg => {
      reg.currencies.sort((a, b) => a.currency === 'HUF' ? -1 : b.currency === 'HUF' ? 1 : a.currency.localeCompare(b.currency));
    });

    return Object.entries(m)
      .sort(([, a], [, b]) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name));
  }, [summary]);

  const registersExceedingLimit = useMemo(() => {
    return summary.filter(r => r.currency === 'HUF' && r.current_balance > customLimit);
  }, [summary, customLimit]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">{t('common:select_company_continue', 'Válassz egy céget a folytatáshoz')}</p>
      </div>
    );
  }

  if (isLoading) return <ContentSkeleton />;

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOpgMode ? (
              <Calculator className="h-7 w-7 text-primary transition-colors duration-200" />
            ) : (
              <Banknote className="h-7 w-7 text-primary transition-colors duration-200" />
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(false)}
                    className={cn(
                      "text-2xl font-bold tracking-tight transition-colors duration-200 outline-none select-none",
                      !isOpgMode
                        ? "text-foreground cursor-default"
                        : "text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                    )}
                  >
                    {t('pettyCash:title', 'Házipénztár')}
                  </button>
                  <span className="text-xl text-muted-foreground/30 font-light select-none">/</span>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch(true)}
                    className={cn(
                      "text-2xl font-bold tracking-tight transition-colors duration-200 outline-none select-none flex items-center gap-2",
                      isOpgMode
                        ? "text-foreground cursor-default"
                        : "text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                    )}
                  >
                    <span>OPG</span>
                    {opgKpi && opgKpi.pendingCashBookingCount > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "px-1.5 py-0 h-4 text-[10px] font-semibold transition-all",
                          isOpgMode
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-muted-foreground/10 text-muted-foreground/50 border-muted-foreground/20"
                        )}
                      >
                        {opgKpi.pendingCashBookingCount}
                      </Badge>
                    )}
                  </button>
                </div>

                {!isOpgMode && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <h4 className="font-medium leading-none">{t('pettyCash:settings_title', 'Házipénztár Beállítások')}</h4>
                        <p className="text-xs text-muted-foreground">{t('pettyCash:settings_desc', 'Készpénzállomány limit értékének testreszabása cég szinten.')}</p>
                        <div className="space-y-2">
                          <Label htmlFor="custom-limit-input">{t('pettyCash:limit_setting_label', 'Készpénz limit figyelmeztetés')}</Label>
                          <Input
                            id="custom-limit-input"
                            type="number"
                            value={customLimit}
                            onChange={(e) => handleSaveLimit(Number(e.target.value) || 0)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {isOpgMode
                  ? 'NAV Online Pénztárgépek kezelése és házipénztári bizonylat-átvezetés'
                  : t('pettyCash:subtitle', 'Többpénztáras készpénzforgalom nyilvántartás')}
              </p>
            </div>
          </div>
        </div>

        {isOpgMode ? (
          <div className="pt-2">
            <React.Suspense fallback={<ContentSkeleton />}>
              <OpgPage embedded />
            </React.Suspense>
          </div>
        ) : (
          <>
            {registersExceedingLimit.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 p-3.5 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 print:hidden">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-amber-900 dark:text-amber-300">{t('pettyCash:limit_warning_title', 'Pénztári limit figyelmeztetés')}</p>
                  <div className="text-xs opacity-90 mt-1 space-y-1">
                    <p>{t('pettyCash:limit_warning_desc', { limit: fmtBalance(customLimit, 'HUF'), defaultValue: `Az alábbi házipénztárak egyenlege meghaladja a megengedett ${fmtBalance(customLimit, 'HUF')} napi készpénzállományt:` })}</p>
                    {registersExceedingLimit.map(r => (
                      <div key={r.register_id} className="font-semibold pl-2 border-l border-amber-500/30">
                        {getLocalizedRegisterName(r.register_name, t)}: {fmtBalance(r.current_balance, 'HUF')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Total card */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">{t('pettyCash:total_summary', 'Összesítés')}</div>
                  {totalByCurrency.length === 0 ? (
                    <div className="text-lg font-bold text-muted-foreground">—</div>
                  ) : (
                    <div className="space-y-1">
                      {totalByCurrency.map(([cur, bal]) => (
                        <div key={cur} className={cn('text-lg font-bold tabular-nums', bal >= 0 ? 'text-foreground' : 'text-destructive')}>
                          {fmtBalance(bal, cur)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Per-register cards */}
              {registerSummaries.map(([regId, reg]) => (
                <Card key={regId} className={cn(
                  'transition-all hover:shadow-md duration-300',
                  reg.is_default && 'border-primary/30 bg-primary/5'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {reg.is_default && <Star className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />}
                        <span className="text-xs font-semibold text-muted-foreground truncate" title={getLocalizedRegisterName(reg.name, t)}>{getLocalizedRegisterName(reg.name, t)}</span>
                      </div>
                      {reg.is_default && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/20 text-primary bg-primary/5 font-semibold shrink-0">
                          {t('pettyCash:default_badge', 'Alapértelmezett')}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {reg.currencies.map(c => (
                        <div key={c.currency} className={cn('text-base font-bold tabular-nums', c.balance >= 0 ? 'text-foreground' : 'text-destructive')}>
                          {fmtBalance(c.balance, c.currency)}
                        </div>
                      ))}
                    </div>

                    {/* Cash Limit Utilization Progress Bar */}
                    <div className="space-y-2 mt-3 pt-3 border-t border-border/40">
                      {reg.currencies.map(c => {
                        const limit = c.currency === 'HUF' ? customLimit : 4000;
                        const pct = Math.min((Math.max(0, c.balance) / limit) * 100, 100);
                        const isHigh = pct >= 80;
                        return (
                          <div key={c.currency} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{t('pettyCash:limit_utilization', 'Limit kihasználtság')} ({c.currency})</span>
                              <span className={cn("font-medium", isHigh && "text-amber-500 font-bold")}>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-300", 
                                  isHigh ? "bg-amber-500" : "bg-primary"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cash Denomination Calculator Button */}
                    <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-end gap-2 flex-wrap">
                      {reg.currencies.map(c => (
                        <Button
                          key={c.currency}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] px-2 gap-1 text-primary hover:text-primary hover:bg-primary/5 select-none"
                          onClick={() => handleOpenCalc(regId, reg.name, c.balance, c.currency)}
                        >
                          <Calculator className="h-3 w-3" />
                          {t('pettyCash:denomination_calc', 'Címletszámoló')} ({c.currency})
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* OPG Cash Register Integration Banner */}
            {opgKpi && opgKpi.pendingCashBookingCount > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span>Online pénztárgép (OPG) készpénzforgalom</span>
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                        {opgKpi.pendingCashBookingCount} db könyvelésre váró tétel
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      A pénztárgépek készpénzes forgalma közvetlenül átvezethető a kijelölt házipénztárba.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                  onClick={() => handleModeSwitch(true)}
                >
                  <span>Váltás OPG-re</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activePettyCashTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/60 rounded-xl">
                <TabsTrigger value="entries" className="gap-1.5">
                  <Banknote className="w-4 h-4" /> {t('pettyCash:tabs.entries', 'Tételek')}
                </TabsTrigger>
                <TabsTrigger value="approvals" className="gap-1.5">
                  <ClipboardCheck className="w-4 h-4" /> {t('pettyCash:tabs.approvals', 'Jóváhagyások')}
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px] bg-amber-500/15 text-amber-500 border border-amber-500/30 font-semibold">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1.5">
                  <FileText className="w-4 h-4" /> {t('pettyCash:tabs.reports', 'Pénztárjelentések')}
                </TabsTrigger>
                <TabsTrigger value="registers" className="gap-1.5">
                  <Settings2 className="w-4 h-4" /> {t('pettyCash:tabs.registers', 'Pénztárak')}
                </TabsTrigger>
                <TabsTrigger value="rules" className="gap-1.5">
                  <Zap className="w-4 h-4" /> {t('pettyCash:tabs.rules', 'Routing szabályok')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entries" className="mt-4 focus-visible:outline-none">
                <EntriesTab />
              </TabsContent>
              <TabsContent value="reports" className="mt-4 focus-visible:outline-none">
                <CashReportsTab registers={registers} companyId={companyId} />
              </TabsContent>
              <TabsContent value="approvals" className="mt-4 focus-visible:outline-none">
                <ApprovalTab />
              </TabsContent>
              <TabsContent value="registers" className="mt-4 focus-visible:outline-none">
                <RegistersTab />
              </TabsContent>
              <TabsContent value="rules" className="mt-4 focus-visible:outline-none">
                <RoutingRulesTab />
              </TabsContent>
            </Tabs>
          </>
        )}
        
        {calcRegister && (
          <DenominationCalculatorDialog
            open={calcOpen}
            onOpenChange={setCalcOpen}
            registerName={calcRegister.name}
            currency={calcRegister.currency}
            theoreticalBalance={calcRegister.balance}
          />
        )}
      </main>
    </div>
  );
};

export default PettyCashPage;
