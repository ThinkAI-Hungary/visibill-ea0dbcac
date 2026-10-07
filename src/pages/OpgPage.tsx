import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Receipt,
  Store,
  History,
  TrendingUp,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useOpg } from '@/hooks/useOpg';
import { OpgOverviewTab } from '@/components/opg/OpgOverviewTab';
import { OpgTransactionsTab } from '@/components/opg/OpgTransactionsTab';
import { OpgRegistersTab } from '@/components/opg/OpgRegistersTab';
import { OpgSyncLogsTab } from '@/components/opg/OpgSyncLogsTab';
import type { PettyCashRegister } from '@/components/petty-cash/types';

interface OpgPageProps {
  embedded?: boolean;
}

export const OpgPage: React.FC<OpgPageProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';

  const [activeTab, setActiveTab] = useState<string>('overview');

  // OPG adatok és műveletek hook
  const {
    registers,
    transactions,
    kpi,
    dailyTurnover,
    syncLogs,
    isLoading,
    discoverRegisters,
    isDiscovering,
    createRegister,
    updateRegister,
    deleteRegister,
    testConnection,
    isTestingConnection,
    bookTransaction,
    isBookingTransaction,
    bookAllPending,
    isBookingAllPending,
    syncTransactions,
    isSyncing,
    seedMockData,
  } = useOpg(companyId);

  // Házipénztárak betöltése a pénztárgép hozzárendeléshez
  const { data: pettyCashRegisters = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      if (!companyId) return [];
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

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Válasszon egy céget a folytatáshoz.</p>
      </div>
    );
  }

  if (isLoading && registers.length === 0 && transactions.length === 0) {
    return <ContentSkeleton />;
  }

  const content = (
    <div className="space-y-6">
      {/* Oldal Fejléc (csak ha nem beágyazott módban fut) */}
      {!embedded ? (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Online Pénztárgép (OPG)</h1>
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  NAV M2M
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Pénztárgépek kezelése, bizonylat- és forgalom-szinkronizáció, házipénztári könyvelés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTransactions()}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Szinkronizálás
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 pb-2 border-b">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>NAV Online Pénztárgépek kezelése és házipénztári bizonylat-átvezetés</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncTransactions()}
            disabled={isSyncing}
            className="gap-1.5 h-8 text-xs shrink-0"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            OPG Szinkronizáció
          </Button>
        </div>
      )}

      {/* Fülek (Tabs) navigáció */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>Forgalmi áttekintés</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2 text-xs sm:text-sm">
            <Receipt className="h-4 w-4" />
            <span>Bizonylatok & Nyugták</span>
            {transactions.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="registers" className="gap-2 text-xs sm:text-sm">
            <Store className="h-4 w-4" />
            <span>Pénztárgépek</span>
            {registers.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {registers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 text-xs sm:text-sm">
            <History className="h-4 w-4" />
            <span>Szinkron napló</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. Tab: Áttekintés */}
        <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
          <OpgOverviewTab
            kpi={kpi}
            dailyTurnover={dailyTurnover}
            isLoading={isLoading}
            onSyncNow={() => syncTransactions()}
            isSyncing={isSyncing}
            onBookAllPending={() => bookAllPending()}
            isBookingPending={isBookingAllPending}
            onNavigateToTransactions={() => setActiveTab('transactions')}
            onNavigateToRegisters={() => setActiveTab('registers')}
            onSeedDemoData={seedMockData}
          />
        </TabsContent>

        {/* 2. Tab: Tranzakciók / Nyugták */}
        <TabsContent value="transactions" className="space-y-6 focus-visible:outline-none">
          <OpgTransactionsTab
            transactions={transactions}
            registers={registers}
            isLoading={isLoading}
            onBookTransaction={bookTransaction}
            isBookingTransaction={isBookingTransaction}
            onBookAllPending={() => bookAllPending()}
            isBookingAllPending={isBookingAllPending}
          />
        </TabsContent>

        {/* 3. Tab: Pénztárgépek (AP Kódok) */}
        <TabsContent value="registers" className="space-y-6 focus-visible:outline-none">
          <OpgRegistersTab
            registers={registers}
            pettyCashRegisters={pettyCashRegisters}
            companyId={companyId}
            isLoading={isLoading}
            onCreateRegister={createRegister}
            onUpdateRegister={updateRegister}
            onDeleteRegister={deleteRegister}
            onTestConnection={testConnection}
            onDiscoverRegisters={discoverRegisters}
            isDiscovering={isDiscovering}
            onSeedDemoData={seedMockData}
            isTestingConnection={isTestingConnection}
          />
        </TabsContent>

        {/* 4. Tab: Szinkronizációs és Audit napló */}
        <TabsContent value="logs" className="space-y-6 focus-visible:outline-none">
          <OpgSyncLogsTab
            logs={syncLogs}
            isLoading={isLoading}
            onSyncNow={() => syncTransactions()}
            isSyncing={isSyncing}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4 space-y-6">
        {content}
      </main>
    </div>
  );
};

export default OpgPage;
