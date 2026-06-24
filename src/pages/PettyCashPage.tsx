import React, { useMemo } from 'react';
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
import { Banknote, Settings2, Star, Zap } from 'lucide-react';
import { fmtBalance } from '@/components/petty-cash/types';
import type { SummaryRow } from '@/components/petty-cash/types';
import RegistersTab from '@/components/petty-cash/RegistersTab';
import EntriesTab from '@/components/petty-cash/EntriesTab';
import RoutingRulesTab from '@/components/petty-cash/RoutingRulesTab';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PettyCashPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';

  // P3: Summary computed from raw tables (RPC get_petty_cash_summary not deployed yet)
  // K1: Removed all console.log/console.warn calls
  // P3: Added staleTime: 30s to avoid unnecessary re-fetches (mutations invalidate)
  const { data: summary = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashSummary(companyId),
    queryFn: async () => {
      const [regRes, obRes, entRes] = await Promise.all([
        supabase.from('petty_cash_registers' as any).select('*').eq('company_id', companyId),
        // P3: Only fetch opening balances for registers belonging to this company (via join-like filter)
        supabase.from('petty_cash_opening_balances' as any).select('*'),
        supabase.from('petty_cash_entries' as any).select('register_id, currency, amount').eq('company_id', companyId),
      ]);

      const registers = (regRes.data || []) as any[];
      const openingBalances = (obRes.data || []) as any[];
      const entries = (entRes.data || []) as any[];

      if (registers.length === 0) return [];

      const regIds = new Set(registers.map((r: any) => r.id));
      // P3: Filter opening balances to only include this company's registers
      const filteredOB = openingBalances.filter((ob: any) => regIds.has(ob.register_id));

      const summaryMap: Record<string, SummaryRow> = {};

      // Seed from opening balances
      filteredOB.forEach((ob: any) => {
        const reg = registers.find((r: any) => r.id === ob.register_id);
        if (!reg) return;
        const key = `${ob.register_id}::${ob.currency}`;
        summaryMap[key] = {
          register_id: ob.register_id,
          register_name: reg.name,
          is_default: reg.is_default,
          currency: ob.currency,
          opening_balance: Number(ob.amount || 0),
          start_date: ob.start_date,
          total_income: 0,
          total_expense: 0,
          current_balance: 0,
        };
      });

      // Aggregate entries
      entries.forEach((e: any) => {
        const key = `${e.register_id}::${e.currency}`;
        if (!summaryMap[key]) {
          const reg = registers.find((r: any) => r.id === e.register_id);
          if (!reg) return;
          summaryMap[key] = {
            register_id: e.register_id,
            register_name: reg.name,
            is_default: reg.is_default,
            currency: e.currency,
            opening_balance: 0,
            start_date: null,
            total_income: 0,
            total_expense: 0,
            current_balance: 0,
          };
        }
        const amount = Number(e.amount || 0);
        if (amount > 0) summaryMap[key].total_income += amount;
        else summaryMap[key].total_expense += amount;
      });

      // Compute current_balance
      Object.values(summaryMap).forEach(row => {
        const raw = row.opening_balance + row.total_income + row.total_expense;
        row.current_balance = row.currency === 'HUF' ? Math.round(raw / 5) * 5 : raw;
      });

      return Object.values(summaryMap).sort((a, b) =>
        (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.register_name.localeCompare(b.register_name) || a.currency.localeCompare(b.currency)
      );
    },
    enabled: !!user && !!companyId,
    staleTime: 30_000, // P3: 30s cache — mutations invalidate when needed
  });

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
    return Object.entries(m)
      .sort(([, a], [, b]) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name));
  }, [summary]);

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
        <div className="flex items-center gap-3">
          <Banknote className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Házipénztár</h1>
            <p className="text-muted-foreground text-sm">Többpénztáras készpénzforgalom nyilvántartás</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="flex flex-wrap gap-3">
          {/* Total card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent min-w-[200px]">
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
              'min-w-[160px] transition-all',
              reg.is_default && 'border-primary/30'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  {reg.is_default && <Star className="w-3 h-3 text-primary fill-primary" />}
                  <span className="text-xs font-medium text-muted-foreground">{reg.name}</span>
                </div>
                <div className="space-y-0.5">
                  {reg.currencies.map(c => (
                    <div key={c.currency} className={cn('text-base font-semibold tabular-nums', c.balance >= 0 ? 'text-foreground' : 'text-destructive')}>
                      {fmtBalance(c.balance, c.currency)}
                    </div>
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
      </main>
    </div>
  );
};

export default PettyCashPage;
