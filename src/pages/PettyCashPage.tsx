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
