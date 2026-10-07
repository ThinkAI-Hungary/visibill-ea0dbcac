import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/hooks/use-toast';
import { OpgService } from '@/services/opgService';
import type {
  OpgTransactionFilter,
  CreateOpgRegisterInput,
  UpdateOpgRegisterInput,
} from '@/types/opg';

export function useOpg(companyId?: string, filters?: OpgTransactionFilter) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isEnabled = !!companyId && !!user;

  // 1. Pénztárgépek lekérdezése
  const {
    data: registers = [],
    isLoading: registersLoading,
    refetch: refetchRegisters,
  } = useQuery({
    queryKey: queryKeys.opgRegisters(companyId || ''),
    queryFn: () => OpgService.getCashRegisters(companyId || ''),
    enabled: isEnabled,
  });

  // 2. Tranzakciók lekérdezése
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: queryKeys.opgTransactions(companyId || '', filters as Record<string, unknown>),
    queryFn: () => OpgService.getTransactions(companyId || '', filters),
    enabled: isEnabled,
  });

  // 3. Forgalmi KPI mutatók
  const {
    data: kpi,
    isLoading: kpiLoading,
    refetch: refetchKpi,
  } = useQuery({
    queryKey: queryKeys.opgTurnoverKpi(companyId || '', filters?.startDate, filters?.endDate, filters?.opg_id),
    queryFn: () => OpgService.getTurnoverKpis(companyId || '', filters?.startDate, filters?.endDate, filters?.opg_id),
    enabled: isEnabled,
  });

  // 4. Napi forgalom összesítés
  const {
    data: dailyTurnover = [],
    isLoading: dailyLoading,
    refetch: refetchDailyTurnover,
  } = useQuery({
    queryKey: queryKeys.opgDailyTurnover(companyId || '', filters?.startDate, filters?.endDate, filters?.opg_id),
    queryFn: () => OpgService.getDailyTurnover(companyId || '', filters?.startDate, filters?.endDate, filters?.opg_id),
    enabled: isEnabled,
  });

  // 5. Szinkronizációs naplók
  const {
    data: syncLogs = [],
    isLoading: syncLogsLoading,
    refetch: refetchSyncLogs,
  } = useQuery({
    queryKey: queryKeys.opgSyncLogs(companyId || ''),
    queryFn: () => OpgService.getSyncLogs(companyId || '', filters?.opg_id),
    enabled: isEnabled,
  });

  // Segédfüggvény az OPG és kapcsolódó cache-ek frissítéséhez
  const invalidateAllOpg = async () => {
    if (!companyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.opgRegisters(companyId) }),
      queryClient.invalidateQueries({ queryKey: ['opgTransactions', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['opgTurnoverKpi', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['opgDailyTurnover', companyId] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.opgSyncLogs(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) }),
    ]);
  };

  // Új pénztárgép rögzítése
  const createRegisterMutation = useMutation({
    mutationFn: (input: CreateOpgRegisterInput) => OpgService.createCashRegister(input),
    onSuccess: async () => {
      await invalidateAllOpg();
      toast({
        title: 'Sikeres mentés',
        description: 'Az online pénztárgép regisztrációja megtörtént.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a pénztárgép mentésekor',
        description: err.message || 'Ismeretlen hiba történt.',
      });
    },
  });

  // Pénztárgép módosítása
  const updateRegisterMutation = useMutation({
    mutationFn: (input: UpdateOpgRegisterInput) => OpgService.updateCashRegister(input),
    onSuccess: async () => {
      await invalidateAllOpg();
      toast({
        title: 'Sikeres frissítés',
        description: 'A pénztárgép beállításai módosultak.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a pénztárgép módosításakor',
        description: err.message || 'Ismeretlen hiba történt.',
      });
    },
  });

  // Pénztárgép törlése
  const deleteRegisterMutation = useMutation({
    mutationFn: (registerId: string) => OpgService.deleteCashRegister(registerId),
    onSuccess: async () => {
      await invalidateAllOpg();
      toast({
        title: 'Pénztárgép törölve',
        description: 'A pénztárgép sikeresen eltávolításra került.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a törléskor',
        description: err.message || 'Nem sikerült a pénztárgép törlése.',
      });
    },
  });

  // Kapcsolat tesztelése
  const testConnectionMutation = useMutation({
    mutationFn: (registerId: string) => OpgService.testCashRegisterConnection(registerId),
    onSuccess: async (res) => {
      await invalidateAllOpg();
      if (res.success) {
        toast({
          title: 'Kapcsolat rendben',
          description: res.message,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Kapcsolódási hiba',
          description: res.message,
        });
      }
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Kapcsolat teszt hiba',
        description: err.message || 'Nem sikerült elérni a pénztárgépet.',
      });
    },
  });

  // Egyetlen tétel házipénztárba könyvelése
  const bookTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => OpgService.bookTransactionToPettyCash(transactionId),
    onSuccess: async (res) => {
      if (res.success) {
        await invalidateAllOpg();
        toast({
          title: 'Könyvelve a házipénztárba',
          description: 'A készpénzes tétel bekerült a kijelölt házipénztárba.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Könyvelési hiba',
          description: res.error || 'A tételt nem sikerült lekönyvelni.',
        });
      }
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a könyveléskor',
        description: err.message || 'Ismeretlen hiba történt.',
      });
    },
  });

  // Összes függő tétel kötegelt házipénztárba könyvelése
  const bookAllPendingMutation = useMutation({
    mutationFn: (opgId?: string) => OpgService.bookAllPendingToPettyCash(companyId || '', opgId),
    onSuccess: async (res) => {
      await invalidateAllOpg();
      toast({
        title: 'Házipénztári könyvelés befejezve',
        description: `Feldolgozva: ${res.processed} tétel, átugorva: ${res.skipped}, hibás: ${res.errors}.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a kötegelt könyveléskor',
        description: err.message || 'Ismeretlen hiba történt.',
      });
    },
  });

  // Manuális szinkronizáció indítása
  const syncMutation = useMutation({
    mutationFn: (variables?: { opgId?: string; periodFrom?: string; periodTo?: string }) =>
      OpgService.syncTransactions(
        companyId || '',
        variables?.opgId,
        variables?.periodFrom,
        variables?.periodTo
      ),
    onSuccess: async (res) => {
      await invalidateAllOpg();
      toast({
        title: 'Szinkronizáció sikeres',
        description: `Letöltve: ${res.fetched} bizonylat (${res.newRecords} új, ${res.duplicates} már meglévő).`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Szinkronizációs hiba',
        description: err.message || 'A szinkronizáció nem sikerült.',
      });
    },
  });

  // Demo adatok inicializálása
  const seedMockDataMutation = useMutation({
    mutationFn: () => OpgService.seedMockDataIfEmpty(companyId || ''),
    onSuccess: async (seeded) => {
      if (seeded) {
        await invalidateAllOpg();
        toast({
          title: 'Minta adatok létrehozva',
          description: 'A teszteléshez 2 pénztárgép és minta forgalmi bizonylatok generálva.',
        });
      }
    },
  });

  // NAV-ból történő automatikus pénztárgép felderítés
  const discoverRegistersMutation = useMutation({
    mutationFn: () => OpgService.discoverCashRegisters(companyId || ''),
    onSuccess: async (res) => {
      await invalidateAllOpg();
      toast({
        title: 'NAV felderítés sikeres',
        description: `Talált és szinkronizált online pénztárgépek: ${res.discoveredCount} db.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a NAV felderítéskor',
        description: err.message || 'Nem sikerült lekérdezni a pénztárgépeket a NAV-tól.',
      });
    },
  });

  return {
    // Data
    registers,
    transactions,
    kpi,
    dailyTurnover,
    syncLogs,

    // Loading states
    registersLoading,
    transactionsLoading,
    kpiLoading,
    dailyLoading,
    syncLogsLoading,
    isLoading: registersLoading || transactionsLoading || kpiLoading,

    // Actions
    refetchAll: invalidateAllOpg,
    refetchRegisters,
    refetchTransactions,
    refetchKpi,
    refetchDailyTurnover,
    refetchSyncLogs,

    // Mutations
    discoverRegisters: discoverRegistersMutation.mutateAsync,
    isDiscovering: discoverRegistersMutation.isPending,
    createRegister: createRegisterMutation.mutateAsync,
    isCreatingRegister: createRegisterMutation.isPending,
    updateRegister: updateRegisterMutation.mutateAsync,
    isUpdatingRegister: updateRegisterMutation.isPending,
    deleteRegister: deleteRegisterMutation.mutateAsync,
    isDeletingRegister: deleteRegisterMutation.isPending,
    testConnection: testConnectionMutation.mutateAsync,
    isTestingConnection: testConnectionMutation.isPending,
    bookTransaction: bookTransactionMutation.mutateAsync,
    isBookingTransaction: bookTransactionMutation.isPending,
    bookAllPending: bookAllPendingMutation.mutateAsync,
    isBookingAllPending: bookAllPendingMutation.isPending,
    syncTransactions: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
    seedMockData: seedMockDataMutation.mutateAsync,
  };
}
