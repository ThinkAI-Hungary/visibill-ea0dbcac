import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UseAggreg8Props {
  companyId: string;
}

async function parseEdgeFunctionError(fnError: any, data: any, defaultMsg: string): Promise<string> {
  let msg = data?.error;
  if (!msg && fnError) {
    try {
      if (fnError.context && typeof fnError.context.json === 'function') {
        const body = await fnError.context.json();
        if (body?.error) msg = body.error;
        else if (body?.message) msg = body.message;
      }
    } catch {
      // ignore JSON parse error
    }
    if (!msg && fnError.message && fnError.message !== 'Edge Function returned a non-2xx status code') {
      msg = fnError.message;
    }
  }

  if (!msg) msg = defaultMsg;

  // Sanitize raw technical Aggreg8 / JSON errors into clear Hungarian messages:
  if (typeof msg === 'string') {
    if (msg.includes('Bad Request') || msg.includes('originatedFrom') || msg.includes('a8-ais-api')) {
      return 'A banki azonosítási kérelem érvénytelen, vagy a kapcsolódó hozzájárulás felhasználója eltér a jelenleg bejelentkezett fióktól. Kérjük, használd a kapcsolatot létrehozó felhasználói fiókot.';
    }
    if (msg.includes('Unauthorized') || msg.includes('401')) {
      return 'A banki hitelesítés érvénytelen vagy lejárt. Kérjük, jelentkezz be újra.';
    }
    if (msg.includes('Too Many Requests') || msg.includes('429')) {
      return 'Túl sok szinkronizációs kérés érkezett rövid időn belül. Kérjük, várj pár percet az újabb próbálkozás előtt.';
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return 'A banki aggregátor (Aggreg8) vagy a partnerbank szolgáltatása jelenleg átmenetileg nem elérhető. Kérjük, próbáld újra később.';
    }
  }

  return msg;
}

export interface Aggreg8Account {
  id: string;
  consent_id: string;
  company_id: string;
  a8_account_id: string;
  company_bank_account_id: string | null;
  account_name: string | null;
  account_number: string;
  currency: string;
  balance: number | null;
  last_ordinal_on_account: number | null;
  last_synced_at: string | null;
  last_synced_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Aggreg8Consent {
  id: string;
  company_id: string;
  user_id: string;
  info_sharing_consent_id: string;
  a8_user_id: string;
  bank_id: string;
  bank_name: string | null;
  bank_logo_url: string | null;
  active_sync_enabled: boolean | null;
  passive_sync_enabled: boolean | null;
  active_sync_expiration_date: string | null;
  passive_sync_expiration_date: string | null;
  status: 'active' | 'expired' | 'deleted';
  created_at: string;
  updated_at: string;
  accounts?: Aggreg8Account[];
}

export function useAggreg8(companyId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFlow, setActiveFlow] = useState<'ADD_BANK' | 'ON_DEMAND' | 'EXTEND_CONSENT' | null>(null);
  const [activeConsentId, setActiveConsentId] = useState<string | null>(null);
  const isFlowLoading = activeFlow !== null;
  const isAddingBank = activeFlow === 'ADD_BANK';
  const syncingConsentId = activeFlow === 'ON_DEMAND' ? activeConsentId : null;
  const extendingConsentId = activeFlow === 'EXTEND_CONSENT' ? activeConsentId : null;

  const [isSyncing, setIsSyncing] = useState(false);
  const popupTimerRef = useRef<number | null>(null);
  const delayedTimersRef = useRef<number[]>([]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (popupTimerRef.current !== null) {
        clearInterval(popupTimerRef.current);
      }
      delayedTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      delayedTimersRef.current = [];
    };
  }, []);

  // Realtime subscription to aggreg8_consents and aggreg8_accounts for instant updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`aggreg8-realtime-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aggreg8_consents',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });
          setIsSyncing(false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aggreg8_accounts',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });
          queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
          queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
          setIsSyncing(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  // 1. Fetch consents & accounts for company
  const {
    data: consents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Aggreg8Consent[]>({
    queryKey: ['aggreg8-consents', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error: fetchErr } = await supabase
        .from('aggreg8_consents')
        .select(`
          *,
          accounts:aggreg8_accounts(*)
        `)
        .eq('company_id', companyId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      return (data || []) as unknown as Aggreg8Consent[];
    },
  });

  // Helper to open SyncUI popup with delayed retry to avoid race condition with webhooks
  const openSyncUiPopup = useCallback(
    (url: string, onComplete?: () => Promise<void> | void) => {
      const width = 500;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        'aggreg8_sync_ui',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        // Fallback if popup blocked: redirect
        window.location.href = url;
        return;
      }

      if (popupTimerRef.current !== null) {
        clearInterval(popupTimerRef.current);
      }

      // Check when popup closes
      popupTimerRef.current = window.setInterval(async () => {
        if (popup.closed) {
          if (popupTimerRef.current !== null) {
            clearInterval(popupTimerRef.current);
            popupTimerRef.current = null;
          }

          setIsSyncing(true);

          if (onComplete) {
            try {
              await onComplete();
            } catch (err) {
              console.error('[useAggreg8] onComplete error:', err);
            }
          }

          // 1. Immediate invalidation
          queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });
          queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
          queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });

          // 2. Delayed invalidation after 2.5s (in case webhook is in-flight)
          const t1 = window.setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });
            queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
          }, 2500);
          delayedTimersRef.current.push(t1);

          // 3. Delayed invalidation after 6.0s (final catch-up for slower bank callbacks)
          const t2 = window.setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });
            queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
            queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
            setIsSyncing(false);
          }, 6000);
          delayedTimersRef.current.push(t2);
        }
      }, 1000);
    },
    [companyId, queryClient]
  );

  const startAddBankFlow = useCallback(async () => {
    setActiveFlow('ADD_BANK');
    setActiveConsentId(null);
    const flowStartedAt = new Date().toISOString();
    try {
      const { data, error: fnError } = await supabase.functions.invoke('aggreg8-api', {
        body: {
          action: 'init-flow',
          flowType: 'ADD_BANK',
          companyId,
        },
      });

      if (fnError || !data?.success) {
        const errorMsg = await parseEdgeFunctionError(fnError, data, 'Nem sikerült elindítani a bankkapcsolatot.');
        throw new Error(errorMsg);
      }

      toast({
        title: 'Aggreg8 Bankcsatlakozás indítása',
        description: 'Kérjük, végezd el az azonosítást a megnyíló banki ablakban.',
      });

      // Third-party popup window is now opening: stop button spinner
      setActiveFlow(null);
      setActiveConsentId(null);

      openSyncUiPopup(data.syncUiUrl, async () => {
        try {
          const { data: syncRes, error: syncErr } = await supabase.functions.invoke('aggreg8-api', {
            body: {
              action: 'sync-transactions',
              companyId,
              requestedAfter: flowStartedAt,
            },
          });

          if (syncErr || !syncRes?.success) {
            toast({
              title: 'Bankcsatlakozási folyamat lezárult',
              description: 'A rendszer frissíti a banki hozzájárulások és tranzakciók listáját.',
            });
            return;
          }

          const count = syncRes.totalSynced ?? 0;
          const bankName = syncRes.bankName || 'Bank';
          const hasMore = !!syncRes.hasMore;

          toast({
            title: 'Sikeres bankcsatlakozás!',
            description: count > 0
              ? hasMore
                ? `${bankName}: ${count} db tranzakció sikeresen szinkronizálva. A további korábbi tételek letöltése a háttérben automatikusan folytatódik.`
                : `${bankName}: ${count} db tranzakció sikeresen szinkronizálva.`
              : `${bankName} sikeresen csatlakoztatva a rendszerhez.`,
          });
        } catch (e: any) {
          toast({
            variant: 'destructive',
            title: 'Hiba a kapcsolat véglegesítésekor',
            description: e.message,
          });
        }
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba a bankkapcsolat indításakor',
        description: err.message,
      });
    } finally {
      setActiveFlow(null);
      setActiveConsentId(null);
    }
  }, [companyId, openSyncUiPopup, toast]);

  // 3. Start On-Demand Sync (ON_DEMAND)
  const startOnDemandSync = useCallback(
    async (infoSharingConsentId: string) => {
      setActiveFlow('ON_DEMAND');
      setActiveConsentId(infoSharingConsentId);
      const flowStartedAt = new Date().toISOString();
      try {
        const { data, error: fnError } = await supabase.functions.invoke('aggreg8-api', {
          body: {
            action: 'init-flow',
            flowType: 'ON_DEMAND',
            companyId,
            infoSharingConsentId,
          },
        });

        if (fnError || !data?.success) {
          const errorMsg = await parseEdgeFunctionError(fnError, data, 'A szinkronizáció indítása sikertelen.');
          throw new Error(errorMsg);
        }

        // Third-party popup window is now opening: stop button spinner
        setActiveFlow(null);
        setActiveConsentId(null);

        openSyncUiPopup(data.syncUiUrl, async () => {
          try {
            const { data: syncRes, error: syncErr } = await supabase.functions.invoke('aggreg8-api', {
              body: {
                action: 'sync-transactions',
                companyId,
                infoSharingConsentId,
                requestedAfter: flowStartedAt,
              },
            });

            if (syncErr || !syncRes?.success) {
              const err = syncRes?.error || syncErr?.message || 'A szinkronizáció feldolgozása sikertelen.';
              toast({
                variant: 'destructive',
                title: 'Szinkronizációs hiba',
                description: err,
              });
              return;
            }

            const count = syncRes.totalSynced ?? 0;
            const hasMore = !!syncRes.hasMore;

            if (count > 0) {
              toast({
                title: 'Szinkronizáció befejezve',
                description: hasMore
                  ? `${count} db új tranzakció sikeresen szinkronizálva. A további korábbi tranzakciók letöltése a háttérben automatikusan folytatódik.`
                  : `${count} db új tranzakció sikeresen szinkronizálva és könyvelésre előkészítve.`,
              });
            } else {
              toast({
                title: 'Bankszámla naprakész',
                description: 'Nem található új tranzakció az utolsó szinkronizáció óta.',
              });
            }
          } catch (e: any) {
            toast({
              variant: 'destructive',
              title: 'Szinkronizációs hiba',
              description: e.message || 'Nem sikerült letölteni a legfrissebb tranzakciókat.',
            });
          }
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Szinkronizációs hiba',
          description: err.message,
        });
      } finally {
        setActiveFlow(null);
        setActiveConsentId(null);
      }
    },
    [companyId, openSyncUiPopup, toast]
  );

  // 4. Extend PSD2 consent (EXTEND_CONSENT)
  const startExtendConsent = useCallback(
    async (infoSharingConsentId: string) => {
      setActiveFlow('EXTEND_CONSENT');
      setActiveConsentId(infoSharingConsentId);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('aggreg8-api', {
          body: {
            action: 'init-flow',
            flowType: 'EXTEND_CONSENT',
            companyId,
            infoSharingConsentId,
          },
        });

        if (fnError || !data?.success) {
          const errorMsg = await parseEdgeFunctionError(fnError, data, 'A meghosszabbítás indítása sikertelen.');
          throw new Error(errorMsg);
        }

        setActiveFlow(null);
        setActiveConsentId(null);

        openSyncUiPopup(data.syncUiUrl, () => {
          toast({
            title: 'Hozzájárulás megújítva',
            description: 'A 180 napos banki felhatalmazás sikeresen meghosszabbítva.',
          });
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Megújítási hiba',
          description: err.message,
        });
      } finally {
        setActiveFlow(null);
        setActiveConsentId(null);
      }
    },
    [companyId, openSyncUiPopup, toast]
  );

  // 5. Delete Consent (Revoke)
  const revokeConsent = useCallback(
    async (consentId: string, infoSharingConsentId: string) => {
      try {
        // Try calling Aggreg8 to revoke
        await supabase.functions.invoke('aggreg8-api', {
          body: {
            action: 'init-flow',
            flowType: 'DELETE_INFO_SHARING_CONSENT',
            companyId,
            infoSharingConsentId,
          },
        });

        // Update local DB status
        const { error: dbErr } = await supabase
          .from('aggreg8_consents')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', consentId);

        if (dbErr) throw dbErr;

        queryClient.invalidateQueries({ queryKey: ['aggreg8-consents', companyId] });

        toast({
          title: 'Bankkapcsolat törölve',
          description: 'A számlaadatok megosztása visszavonásra került.',
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Hiba a kapcsolat törlésekor',
          description: err.message,
        });
      }
    },
    [companyId, queryClient, toast]
  );

  return {
    consents,
    isLoading,
    isError,
    error,
    isFlowLoading,
    isAddingBank,
    syncingConsentId,
    extendingConsentId,
    isSyncing,
    refetch,
    startAddBankFlow,
    startOnDemandSync,
    startExtendConsent,
    revokeConsent,
  };
}
