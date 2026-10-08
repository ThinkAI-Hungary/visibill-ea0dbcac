import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, AlertTriangle, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { invalidateGlQueries } from '@/lib/cache';
import { useTranslation } from 'react-i18next';

interface CopyChartOfAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCompanyId: string | undefined;
  targetCompanyName?: string;
  onSuccess?: (newPresetId: string) => void;
}

interface SourceCompanyOption {
  id: string;
  name: string;
  preset_id: string;
  preset_name: string;
  accounts_count: number;
}

export function CopyChartOfAccountsModal({
  open,
  onOpenChange,
  targetCompanyId,
  targetCompanyName,
  onSuccess,
}: CopyChartOfAccountsModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSourceCompanyId, setSelectedSourceCompanyId] = useState<string>('');

  // Fetch available source companies with active charts of accounts
  const { data: sourceCompanies = [], isLoading: isLoadingSources } = useQuery<SourceCompanyOption[]>({
    queryKey: ['coa-copy-source-companies', targetCompanyId],
    queryFn: async () => {
      if (!targetCompanyId) return [];

      // Query companies that have active presets and at least one account
      const { data, error } = await supabase
        .from('chart_of_accounts_presets')
        .select(`
          id,
          name,
          company_id,
          is_active,
          companies:company_id (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .neq('company_id', targetCompanyId)
        .not('company_id', 'is', null);

      if (error) {
        console.error('Error fetching source presets for copy:', error);
        return [];
      }

      // Collect unique company presets
      const results: SourceCompanyOption[] = [];
      for (const item of (data || [])) {
        const comp = (item as any).companies;
        if (!comp || !comp.id) continue;

        // Count accounts in this preset
        const { count } = await supabase
          .from('gl_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('preset_id', item.id);

        if ((count || 0) > 0) {
          results.push({
            id: comp.id,
            name: comp.name,
            preset_id: item.id,
            preset_name: item.name,
            accounts_count: count || 0,
          });
        }
      }

      return results.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    },
    enabled: !!targetCompanyId && open,
  });

  const selectedSource = sourceCompanies.find(c => c.id === selectedSourceCompanyId);

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!targetCompanyId) throw new Error('A cél cég nem azonosítható!');
      if (!selectedSourceCompanyId) throw new Error('Kérjük, válasszon egy forrás céget!');

      const { data, error } = await supabase.rpc('acc_copy_chart_of_accounts', {
        p_source_company_id: selectedSourceCompanyId,
        p_target_company_id: targetCompanyId,
      });

      if (error) throw error;
      return data as {
        success: boolean;
        target_preset_id: string;
        target_preset_name: string;
        accounts_copied: number;
        source_company_name: string;
        bs_mappings_copied?: number;
        pnl_mappings_copied?: number;
      };
    },
    onSuccess: async (res) => {
      if (targetCompanyId) {
        await invalidateGlQueries(queryClient, targetCompanyId, res?.target_preset_id);
      }
      await queryClient.invalidateQueries({ queryKey: ['coaPresets', targetCompanyId] });
      await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      await queryClient.invalidateQueries({ queryKey: ['glItems'] });
      await queryClient.invalidateQueries({ queryKey: ['general-ledger-tree'] });
      await queryClient.invalidateQueries({ queryKey: ['subledger'] });
      await queryClient.invalidateQueries({ queryKey: ['gl-accounts-lookup'] });
      await queryClient.invalidateQueries({ queryKey: ['bsMapping'] });
      await queryClient.invalidateQueries({ queryKey: ['pnlMapping'] });

      const mappingDetails = (res?.bs_mappings_copied || res?.pnl_mappings_copied)
        ? ` (${res?.accounts_copied} számlaszám, ${res?.bs_mappings_copied || 0} mérleg- és ${res?.pnl_mappings_copied || 0} eredménykimutatás hozzárendelés)`
        : ` (${res?.accounts_copied} számlaszám)`;

      toast({
        title: 'Számlatükör sikeresen átmásolva',
        description: `${res?.source_company_name} számlatükre${mappingDetails} átvéve. Az új számlatükör azonnal aktív.`,
        className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
      });

      onSuccess?.(res?.target_preset_id);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a számlatükör másolásakor',
        description: err.message || 'Nem sikerült átmásolni a számlatükröt.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Copy className="h-5 w-5 text-primary" />
            <span>Számlatükör Másolása Másik Cégből</span>
          </DialogTitle>
          <DialogDescription>
            {targetCompanyName ? (
              <span>Célvállalat: <strong className="text-foreground">{targetCompanyName}</strong></span>
            ) : (
              'Vegye át egy másik, már beállított cég teljes számlatükrét annak minden beállításával együtt.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-2">
            <Label htmlFor="source-company" className="font-semibold text-foreground">
              Forrás cég kiválasztása <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedSourceCompanyId}
              onValueChange={setSelectedSourceCompanyId}
              disabled={isLoadingSources || copyMutation.isPending}
            >
              <SelectTrigger id="source-company" className="w-full">
                <SelectValue placeholder={isLoadingSources ? 'Cégek betöltése...' : 'Válasszon forrás céget...'} />
              </SelectTrigger>
              <SelectContent>
                {sourceCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({c.accounts_count} főkönyvi szám)
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {sourceCompanies.length === 0 && !isLoadingSources && (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Nem található másolható számlatükörrel rendelkező cég.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedSource && (
            <div className="p-3 rounded-lg border border-border/80 bg-muted/30 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Átvételre kijelölve: {selectedSource.name}</span>
              </div>
              <p className="text-muted-foreground">
                Aktív sablon: <strong>{selectedSource.preset_name}</strong> • <strong>{selectedSource.accounts_count}</strong> főkönyvi számlaszám
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Egyetlen aktív számlatükör szabály:</strong>
              <span className="leading-relaxed block">
                A másolás során a cél céghez létrejön egy új egyedi számlatükör, amely azonnal aktívvá válik. A cél cég korábbi sablonjai inaktiválásra kerülnek, elkerülve a számlatükrök keveredését.
                Átvételre kerülnek a hierarchikus alábontások, a csoportszámla jellegek, a mérleg- és eredménykimutatás besorolások (BS/PNL mapping), valamint a partnerkényszer és folyószámla beállítások is.
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copyMutation.isPending}
          >
            Mégse
          </Button>
          <Button
            type="button"
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending || !selectedSourceCompanyId}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {copyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>1-kattintásos átmásolás</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
