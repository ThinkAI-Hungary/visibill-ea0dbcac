import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AlertTriangle, Banknote, Settings2, Star, Zap, ClipboardCheck, Calculator } from 'lucide-react';
import { fmtBalance } from '@/components/petty-cash/types';
import type { SummaryRow } from '@/components/petty-cash/types';
import RegistersTab from '@/components/petty-cash/RegistersTab';
import EntriesTab from '@/components/petty-cash/EntriesTab';
import RoutingRulesTab from '@/components/petty-cash/RoutingRulesTab';
import DenominationCalculatorDialog from '@/components/petty-cash/DenominationCalculatorDialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PettyCashPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcRegister, setCalcRegister] = useState<{ id: string; name: string; balance: number; currency: string } | null>(null);
  const [customLimit, setCustomLimit] = useState<number>(1500000);

  useEffect(() => {
    if (companyId) {
      const saved = localStorage.getItem(`visibill_pettycash_limit_${companyId}`);
      setCustomLimit(saved ? Number(saved) : 1500000);
    }
  }, [companyId]);

  const handleSaveLimit = (val: number) => {
    setCustomLimit(val);
    localStorage.setItem(`visibill_pettycash_limit_${companyId}`, String(val));
  };

  const handleOpenCalc = (regId: string, regName: string, balance: number, currency: string) => {
    setCalcRegister({ id: regId, name: regName, balance, currency });
    setCalcOpen(true);
  };

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
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
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
            <Banknote className="h-7 w-7 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Házipénztár</h1>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-medium leading-none">Házipénztár Beállítások</h4>
                      <p className="text-xs text-muted-foreground">Készpénzállomány limit értékének testreszabása cég szinten.</p>
                      <div className="space-y-2">
                        <Label htmlFor="custom-limit-input">HUF készpénz limit figyelmeztetés (Ft)</Label>
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
              </div>
              <p className="text-muted-foreground text-sm">Többpénztáras készpénzforgalom nyilvántartás</p>
            </div>
          </div>
        </div>

        {registersExceedingLimit.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 p-3.5 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-900 dark:text-amber-300">Pénztári limit figyelmeztetés</p>
              <div className="text-xs opacity-90 mt-1 space-y-1">
                <p>Az alábbi házipénztárak egyenlege meghaladja a megengedett {fmtBalance(customLimit, 'HUF')} napi készpénzállományt:</p>
                {registersExceedingLimit.map(r => (
                  <div key={r.register_id} className="font-semibold pl-2 border-l border-amber-500/30">
                    {r.register_name}: {fmtBalance(r.current_balance, 'HUF')}
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
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Összesítés</div>
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
                    <span className="text-xs font-semibold text-muted-foreground truncate" title={reg.name}>{reg.name}</span>
                  </div>
                  {reg.is_default && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/20 text-primary bg-primary/5 font-semibold shrink-0">
                      Alapértelmezett
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
                          <span>Limit kihasználtság ({c.currency})</span>
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
                      Címletszámoló ({c.currency})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="entries" className="w-full">
          <TabsList>
            <TabsTrigger value="entries" className="gap-1.5">
              <Banknote className="w-4 h-4" /> Tételek
            </TabsTrigger>
            <TabsTrigger value="registers" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Pénztárak
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="w-4 h-4" /> Routing szabályok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="mt-4">
            <EntriesTab />
          </TabsContent>
          <TabsContent value="registers" className="mt-4">
            <RegistersTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RoutingRulesTab />
          </TabsContent>
        </Tabs>
        
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
