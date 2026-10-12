/**
 * Technical Accounting Hooks (Module 22)
 * React Query state management for partner 360, omni ledger,
 * batch reclassifications, and AI audit anomalies.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPartner360Matrix,
  getOmniPartnerLedger,
  simulateReclassification,
  executeReclassification,
  rollbackReclassification,
  detectAccountingAnomalies,
  getReclassificationHistory,
  type Partner360Data,
  type OmniPartnerLedgerItem,
  type ReclassificationSimulationResult,
  type ReclassificationExecutionResult,
  type AccountingAnomaliesResult,
  type ReclassificationRecord,
} from '@/services/technicalAccountingService';
import { useToast } from '@/hooks/use-toast';

export function usePartner360(
  companyId?: string,
  partnerId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery<Partner360Data>({
    queryKey: ['partner-360', companyId, partnerId, startDate, endDate],
    queryFn: () => getPartner360Matrix(companyId!, partnerId!, startDate, endDate),
    enabled: !!companyId && !!partnerId,
    staleTime: 60 * 1000,
  });
}

export function useOmniPartnerLedger(
  companyId?: string,
  glAccountId?: string,
  accountCodePrefix?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery<OmniPartnerLedgerItem[]>({
    queryKey: ['omni-partner-ledger', companyId, glAccountId, accountCodePrefix, startDate, endDate],
    queryFn: () => getOmniPartnerLedger(companyId!, glAccountId, accountCodePrefix, startDate, endDate),
    enabled: !!companyId,
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
  });
}

export function useReclassificationHistory(companyId?: string) {
  return useQuery<ReclassificationRecord[]>({
    queryKey: ['reclassification-history', companyId],
    queryFn: () => getReclassificationHistory(companyId!),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });
}

export function useAccountingAnomalies(
  companyId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery<AccountingAnomaliesResult>({
    queryKey: ['accounting-anomalies', companyId, startDate, endDate],
    queryFn: () => detectAccountingAnomalies(companyId!, startDate, endDate),
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}

export function useSimulateReclassification() {
  const { toast } = useToast();

  return useMutation<ReclassificationSimulationResult, Error, {
    companyId: string;
    sourceGlAccountId: string;
    targetGlAccountId: string;
    journalLineIds: string[];
    reclassificationDate: string;
    reason?: string;
  }>({
    mutationFn: (params) => simulateReclassification(params),
    onError: (err) => {
      toast({
        title: 'Szimulációs hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExecuteReclassification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<ReclassificationExecutionResult, Error, {
    companyId: string;
    sourceGlAccountId: string;
    targetGlAccountId: string;
    journalLineIds: string[];
    reclassificationDate: string;
    reason: string;
    clearingGlAccountId?: string;
  }>({
    mutationFn: (params) => executeReclassification(params),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reclassification-history', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['partner-360', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['omni-partner-ledger', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['accounting-anomalies', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['general-ledger'] });

      toast({
        title: 'Átvezetés sikeresen végrehajtva',
        description: `Bizonylatszám: ${res.document_id} (${res.affected_lines_count} tétel)`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Átvezetési hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRollbackReclassification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    { success: boolean; storno_document_id: string; storno_header_id: string },
    Error,
    { companyId: string; reclassificationId: string; reason?: string }
  >({
    mutationFn: ({ companyId, reclassificationId, reason }) =>
      rollbackReclassification(companyId, reclassificationId, reason),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reclassification-history', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['partner-360', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['omni-partner-ledger', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['accounting-anomalies', vars.companyId] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['general-ledger'] });

      toast({
        title: 'Sikeres visszagörgetés (Rollback)',
        description: `Sztornó bizonylat kiállítva: ${res.storno_document_id}`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Visszagörgetési hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
