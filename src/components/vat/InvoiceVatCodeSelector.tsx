import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, Check, Tag, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VatCodeOption {
  codeId?: string | null;
  codeName: string;
  label: string;
  targetRow: string;
  vatPercent?: number;
  direction?: 'INBOUND' | 'OUTBOUND';
  group: 'standard' | 'special' | 'exemption';
}

interface InvoiceVatCodeSelectorProps {
  companyId?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  navInvoiceId?: string;
  currentVatCodeId?: string | null;
  currentVatRowOverride?: string | null;
  direction?: 'INBOUND' | 'OUTBOUND';
  invoiceType?: 'inbound' | 'outbound' | 'INBOUND' | 'OUTBOUND';
  size?: 'sm' | 'default';
  className?: string;
  onChanged?: (newVatCodeId: string | null, newRowOverride: string | null) => void;
  onUpdated?: () => void;
}

export function InvoiceVatCodeSelector({
  companyId,
  invoiceNumber,
  invoiceId,
  navInvoiceId,
  currentVatCodeId,
  currentVatRowOverride,
  direction,
  invoiceType,
  size = 'sm',
  className,
  onChanged,
  onUpdated,
}: InvoiceVatCodeSelectorProps) {
  const { toast } = useToast();
  const { t } = useTranslation(['invoices', 'common']);
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  const [open, setOpen] = React.useState(false);

  const effectiveCompanyId = companyId || selectedCompany?.id;
  const effectiveDirection: 'INBOUND' | 'OUTBOUND' = React.useMemo(() => {
    if (direction) return direction.toUpperCase() as 'INBOUND' | 'OUTBOUND';
    if (invoiceType) return invoiceType.toUpperCase() as 'INBOUND' | 'OUTBOUND';
    return 'INBOUND';
  }, [direction, invoiceType]);

  // 1. Fetch company's custom vat_codes if available
  const { data: dbVatCodes = [] } = useQuery({
    queryKey: ['vat_codes', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];
      const { data, error } = await supabase
        .from('vat_codes')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('sort_order');
      if (error) return [];
      return data || [];
    },
    enabled: !!effectiveCompanyId,
    staleTime: 60_000,
  });

  // 2. Build complete list of available VAT options
  const defaultOptions: VatCodeOption[] = React.useMemo(() => {
    if (effectiveDirection === 'OUTBOUND') {
      return [
        { codeName: 'KIM_27', label: '27% Értékesítés', targetRow: '07', vatPercent: 27, direction: 'OUTBOUND', group: 'standard' },
        { codeName: 'KIM_18', label: '18% Értékesítés', targetRow: '05', vatPercent: 18, direction: 'OUTBOUND', group: 'standard' },
        { codeName: 'KIM_5', label: '5% Értékesítés', targetRow: '03', vatPercent: 5, direction: 'OUTBOUND', group: 'standard' },
        { codeName: 'ELOLEG', label: 'Előleg számla (05-07)', targetRow: '45', vatPercent: 27, direction: 'OUTBOUND', group: 'special' },
        { codeName: 'KIM_EU_SZOLG', label: 'EU szolgáltatásnyújtás', targetRow: '92', vatPercent: 0, direction: 'OUTBOUND', group: 'special' },
        { codeName: 'KIM_ATHK', label: 'Közösségen kívüli / ATHK', targetRow: '91', vatPercent: 0, direction: 'OUTBOUND', group: 'special' },
        { codeName: 'AAM', label: 'Adómentes értékesítés', targetRow: '01', vatPercent: 0, direction: 'OUTBOUND', group: 'exemption' },
      ];
    } else {
      return [
        { codeName: 'BE_27', label: '27% Belföldi beszerzés', targetRow: '66', vatPercent: 27, direction: 'INBOUND', group: 'standard' },
        { codeName: 'BE_18', label: '18% Belföldi beszerzés', targetRow: '65', vatPercent: 18, direction: 'INBOUND', group: 'standard' },
        { codeName: 'BE_5', label: '5% Belföldi beszerzés', targetRow: '64', vatPercent: 5, direction: 'INBOUND', group: 'standard' },
        { codeName: 'TARGYESZKOZ', label: 'Tárgyi eszköz / Beruházás', targetRow: '77', vatPercent: 27, direction: 'INBOUND', group: 'special' },
        { codeName: 'FAD', label: 'Fordított adózás (FAD)', targetRow: '29', vatPercent: 0, direction: 'INBOUND', group: 'special' },
        { codeName: 'EUK_SZOLG', label: 'EU szolgáltatás igénybevétel', targetRow: '18', vatPercent: 27, direction: 'INBOUND', group: 'special' },
        { codeName: 'ATHK_SZOLG', label: '3. országbeli szolgáltatás', targetRow: '27', vatPercent: 27, direction: 'INBOUND', group: 'special' },
        { codeName: 'TAM', label: 'Adómentes beszerzés', targetRow: '63', vatPercent: 0, direction: 'INBOUND', group: 'exemption' },
      ];
    }
  }, [effectiveDirection]);

  // Combine DB custom codes with default list
  const combinedOptions = React.useMemo(() => {
    const list = [...defaultOptions];
    dbVatCodes.forEach((vc: any) => {
      const targetRow = vc.target_rows?.[0]?.row || '';
      if (!list.some(o => o.codeName === vc.code)) {
        list.push({
          codeId: vc.id,
          codeName: vc.code,
          label: vc.label,
          targetRow: targetRow,
          vatPercent: vc.vat_percent,
          direction: vc.direction,
          group: 'special',
        });
      }
    });
    return list;
  }, [defaultOptions, dbVatCodes]);

  // Mutation to persist manual VAT code override
  const updateVatCodeMutation = useMutation({
    mutationFn: async ({ codeId, targetRow }: { codeId: string | null; targetRow: string | null }) => {
      // 1. Update invoices table by ID if provided
      if (invoiceId) {
        const { error } = await supabase
          .from('invoices')
          .update({
            vat_code_id: codeId,
            vat_row_override: targetRow,
            frissitve: new Date().toISOString(),
          } as any)
          .eq('id', invoiceId);
        if (error) console.warn('invoices vat update error:', error.message);
      }

      // 2. Update nav_invoices table by ID if provided
      if (navInvoiceId) {
        const { error } = await supabase
          .from('nav_invoices')
          .update({
            vat_code_id: codeId,
            vat_row_override: targetRow,
          } as any)
          .eq('id', navInvoiceId);
        if (error) console.warn('nav_invoices vat update error:', error.message);
      }

      // 3. Update by invoiceNumber if available
      if (invoiceNumber) {
        let navQuery = supabase.from('nav_invoices').update({
          vat_code_id: codeId,
          vat_row_override: targetRow,
        } as any).eq('invoice_number', invoiceNumber);
        if (effectiveCompanyId) navQuery = navQuery.eq('company_id', effectiveCompanyId);
        await navQuery;

        let invQuery = supabase.from('invoices').update({
          vat_code_id: codeId,
          vat_row_override: targetRow,
          frissitve: new Date().toISOString(),
        } as any).eq('bizonylatsorszam', invoiceNumber);
        if (effectiveCompanyId) invQuery = invQuery.eq('company_id', effectiveCompanyId);
        await invQuery;
      }

      return { codeId, targetRow };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['company-invoices'] });
      qc.invalidateQueries({ queryKey: ['submittedInvoices'] });
      qc.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
      qc.invalidateQueries({ queryKey: ['nav_invoices'] });
      qc.invalidateQueries({ queryKey: ['nav-invoices'] });
      qc.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      qc.invalidateQueries({ queryKey: ['recentInvoices'] });
      qc.invalidateQueries({ queryKey: ['vat_row_drill'] });
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      qc.invalidateQueries({ queryKey: ['vat_return_lines'] });

      const label = invoiceNumber ? `Bizonylat: ${invoiceNumber}` : 'ÁFA beállítás mentve';
      toast({
        title: data?.targetRow ? `ÁFA besorolás beállítva: ${data.targetRow}. sor` : 'ÁFA besorolás visszaállítva automatikusra',
        description: label,
      });
      onChanged?.(data?.codeId ?? null, data?.targetRow ?? null);
      onUpdated?.();
      setOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a mentés során',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Find active selected label
  const activeSelection = React.useMemo(() => {
    if (currentVatRowOverride) {
      const match = combinedOptions.find(o => o.targetRow === currentVatRowOverride);
      if (match) return match;
      return {
        codeName: currentVatRowOverride,
        label: `${currentVatRowOverride}. sor`,
        targetRow: currentVatRowOverride,
        group: 'special' as const,
      };
    }
    if (currentVatCodeId) {
      const match = combinedOptions.find(o => o.codeId === currentVatCodeId);
      if (match) return match;
    }
    return null;
  }, [currentVatRowOverride, currentVatCodeId, combinedOptions]);

  const isPending = updateVatCodeMutation.isPending;

  return (
    <div className={cn("inline-flex items-center", className)} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {activeSelection ? (
            <Badge
              variant="outline"
              className={cn(
                "font-mono font-medium gap-1 cursor-pointer transition-all border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-xs",
                size === 'sm' ? 'text-[10px] px-1.5 py-0.5 h-5' : 'text-xs px-2 py-1'
              )}
              title={t('invoices:vat_selector.edit_title', 'ÁFA kód és bevallási sor módosítása')}
            >
              {isPending ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Tag className="w-2.5 h-2.5 shrink-0 opacity-70" />
              )}
              <span>{t('invoices:vat_selector.row_suffix', { row: activeSelection.targetRow, defaultValue: `${activeSelection.targetRow}. sor` })}</span>
              <span className="opacity-60 hidden sm:inline">({activeSelection.label})</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-5 text-[10px] px-1.5 text-muted-foreground/60 hover:text-foreground border border-dashed border-border/50 hover:border-primary/40 rounded gap-1",
                size === 'sm' ? 'h-5 text-[10px] px-1.5' : 'h-7 text-xs px-2'
              )}
              title={t('invoices:vat_selector.override_title', 'ÁFA kód / 2665 bevallási sor felülbírálata')}
            >
              {isPending ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Tag className="w-2.5 h-2.5" />
              )}
              <span>{t('invoices:vat_selector.button_label', 'ÁFA kód')}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-40" />
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto z-50">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            {t('invoices:vat_selector.menu_title', 'ÁFA kód & 2665-ös bevallási sor')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Reset option */}
          <DropdownMenuItem
            className="text-xs gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => updateVatCodeMutation.mutate({ codeId: null, targetRow: null })}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('invoices:vat_selector.default_option', 'Alapértelmezett (kontírozás alapján)')}</span>
            {!activeSelection && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Group: Standard Rates */}
          <DropdownMenuGroup>
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase">
              {t('invoices:vat_selector.group_standard', 'Normál belföldi adómértékek')}
            </div>
            {combinedOptions.filter(o => o.group === 'standard').map((opt) => {
              const isSelected = activeSelection?.targetRow === opt.targetRow;
              return (
                <DropdownMenuItem
                  key={opt.codeName}
                  className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                  onClick={() => updateVatCodeMutation.mutate({ codeId: opt.codeId || null, targetRow: opt.targetRow })}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1">
                      {t('invoices:vat_selector.row_suffix', { row: opt.targetRow, defaultValue: `${opt.targetRow}. sor` })}
                    </Badge>
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {/* Group: Special Cases */}
          <DropdownMenuGroup>
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase">
              {t('invoices:vat_selector.group_special', 'Különleges & Kiemelt sorok')}
            </div>
            {combinedOptions.filter(o => o.group === 'special').map((opt) => {
              const isSelected = activeSelection?.targetRow === opt.targetRow;
              return (
                <DropdownMenuItem
                  key={opt.codeName}
                  className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                  onClick={() => updateVatCodeMutation.mutate({ codeId: opt.codeId || null, targetRow: opt.targetRow })}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1">
                      {t('invoices:vat_selector.row_suffix', { row: opt.targetRow, defaultValue: `${opt.targetRow}. sor` })}
                    </Badge>
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {/* Group: Tax Exemptions */}
          <DropdownMenuGroup>
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase">
              {t('invoices:vat_selector.group_exemption', 'Adómentes & Speciális')}
            </div>
            {combinedOptions.filter(o => o.group === 'exemption').map((opt) => {
              const isSelected = activeSelection?.targetRow === opt.targetRow;
              return (
                <DropdownMenuItem
                  key={opt.codeName}
                  className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                  onClick={() => updateVatCodeMutation.mutate({ codeId: opt.codeId || null, targetRow: opt.targetRow })}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1">
                      {t('invoices:vat_selector.row_suffix', { row: opt.targetRow, defaultValue: `${opt.targetRow}. sor` })}
                    </Badge>
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
