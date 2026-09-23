import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, Loader2, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CustomerGlOption {
  code: '311' | '312' | '315' | '316' | '317';
  label: string;
  description: string;
}

export const ALLOWED_CUSTOMER_GL_OPTIONS: CustomerGlOption[] = [
  { code: '311', label: '311 - Belföldi vevők', description: 'Standard belföldi forintos vevőkövetelés' },
  { code: '312', label: '312 - Külföldi vevők', description: 'Exportértékesítés, devizás külföldi követelés' },
  { code: '315', label: '315 - Kapcsolt vállalkozások', description: 'Cégcsoporton belüli vevőkövetelés' },
  { code: '316', label: '316 - Jelentős tulajdoni részesedés', description: 'Jelentős tulajdoni viszonyban álló vevő' },
  { code: '317', label: '317 - Egyéb részesedési viszony', description: 'Egyéb részesedési viszonyban álló vevő' },
];

export const ALLOWED_SUPPLIER_GL_OPTIONS = [
  { code: '4541', label: '4541 - Belföldi szállítók', description: 'Belföldi szállítói kötelezettség' },
  { code: '4542', label: '4542 - Külföldi szállítók', description: 'Külföldi szállítói kötelezettség' },
];

interface InvoiceGlAccountSelectorProps {
  invoiceId?: string | null;
  navInvoiceId?: string | null;
  invoiceNumber?: string | null;
  companyId?: string;
  direction?: 'inbound' | 'outbound' | 'INBOUND' | 'OUTBOUND';
  currency?: string | null;
  currentPartnerGlNumber?: string | null;
  currentVatGlNumber?: string | null;
  onUpdated?: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function InvoiceGlAccountSelector({
  invoiceId,
  navInvoiceId,
  invoiceNumber,
  companyId,
  direction = 'INBOUND',
  currency = 'HUF',
  currentPartnerGlNumber,
  currentVatGlNumber,
  onUpdated,
  disabled = false,
  className,
  compact = false,
}: InvoiceGlAccountSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const effectiveCompanyId = companyId || selectedCompany?.id;
  const isOutbound = direction.toUpperCase() === 'OUTBOUND';

  // Fetch from DB if not passed in props
  const queryResult = useQuery({
    queryKey: ['invoice-gl-account', invoiceId || navInvoiceId || invoiceNumber],
    queryFn: async () => {
      if (invoiceId) {
        const { data } = await supabase.from('invoices').select('partner_gl_number, vat_gl_number').eq('id', invoiceId).maybeSingle();
        if ((data as any)?.partner_gl_number) return data as any;
      }
      if (navInvoiceId) {
        const { data } = await supabase.from('nav_invoices').select('partner_gl_number, vat_gl_number').eq('id', navInvoiceId).maybeSingle();
        if ((data as any)?.partner_gl_number) return data as any;
      }
      if (invoiceNumber) {
        const { data } = await supabase.from('nav_invoices').select('partner_gl_number, vat_gl_number').eq('invoice_number', invoiceNumber).maybeSingle();
        if ((data as any)?.partner_gl_number) return data as any;
        const { data: invData } = await supabase.from('invoices').select('partner_gl_number, vat_gl_number').eq('bizonylatsorszam', invoiceNumber).maybeSingle();
        if ((invData as any)?.partner_gl_number) return invData as any;
      }
      return null;
    },
    enabled: !currentPartnerGlNumber && !!(invoiceId || navInvoiceId || invoiceNumber),
    staleTime: 30_000,
  });
  const dbInvoiceGl = queryResult?.data;

  // Determine active partner GL code
  const resolvedPartnerGl = currentPartnerGlNumber || dbInvoiceGl?.partner_gl_number;
  const activePartnerGl = useMemo(() => {
    if (resolvedPartnerGl) return resolvedPartnerGl;
    if (isOutbound) {
      // Default to 312 for non-HUF foreign, otherwise 311
      return (currency && currency.toUpperCase() !== 'HUF') ? '312' : '311';
    }
    return (currency && currency.toUpperCase() !== 'HUF') ? '4542' : '4541';
  }, [resolvedPartnerGl, isOutbound, currency]);

  // Fixed VAT code: 467 for Outbound (payable), 466 for Inbound (deductible)
  const fixedVatCode = isOutbound ? '467' : '466';
  const fixedVatLabel = isOutbound ? '467 - Fizetendő ÁFA' : '466 - Levonható ÁFA';

  const updateMutation = useMutation({
    mutationFn: async (newPartnerGl: string) => {
      const updates = {
        partner_gl_number: newPartnerGl,
        vat_gl_number: fixedVatCode,
      };

      if (invoiceId) {
        const { error } = await supabase
          .from('invoices')
          .update({ ...updates, frissitve: new Date().toISOString() } as any)
          .eq('id', invoiceId);
        if (error) console.warn('invoices gl update error:', error.message);
      }

      if (navInvoiceId) {
        const { error } = await supabase
          .from('nav_invoices')
          .update(updates as any)
          .eq('id', navInvoiceId);
        if (error) console.warn('nav_invoices gl update error:', error.message);
      }

      if (invoiceNumber) {
        let invQuery = supabase.from('invoices').update({ ...updates, frissitve: new Date().toISOString() } as any).eq('bizonylatsorszam', invoiceNumber);
        if (effectiveCompanyId) invQuery = invQuery.eq('company_id', effectiveCompanyId);
        await invQuery;

        let navQuery = supabase.from('nav_invoices').update(updates as any).eq('invoice_number', invoiceNumber);
        if (effectiveCompanyId) navQuery = navQuery.eq('company_id', effectiveCompanyId);
        await navQuery;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Kontírszám frissítve',
        description: isOutbound
          ? 'A vevői követelés kontírszáma sikeresen rögzítve.'
          : 'A szállítói kötelezettség kontírszáma sikeresen rögzítve.',
      });
      queryClient.invalidateQueries({ queryKey: ['invoice-gl-account'] });
      queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['nav-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['gl_balances'] });
      onUpdated?.();
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a kontírszám mentésekor',
        description: err.message || 'Nem sikerült menteni a kontírszámot.',
        variant: 'destructive',
      });
    },
  });

  // Selected label for clean display
  const selectedLabel = useMemo(() => {
    if (isOutbound) {
      return ALLOWED_CUSTOMER_GL_OPTIONS.find((o) => o.code === activePartnerGl)?.label || activePartnerGl;
    }
    return ALLOWED_SUPPLIER_GL_OPTIONS.find((o) => o.code === activePartnerGl)?.label || activePartnerGl;
  }, [isOutbound, activePartnerGl]);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Partner Account Selector */}
      <div className="flex items-center gap-1.5">
        <span 
          className="text-xs text-muted-foreground font-medium shrink-0" 
          title={isOutbound ? 'Tartozik (T) vevőkövetelés számla' : 'Követel (K) szállítói kötelezettség számla'}
        >
          {isOutbound ? 'Vevői számla:' : 'Szállítói számla:'}
        </span>
        <Select
          value={activePartnerGl}
          onValueChange={(val) => updateMutation.mutate(val)}
          disabled={disabled || updateMutation.isPending}
        >
          <SelectTrigger className={cn("h-8 text-xs font-mono font-medium px-2.5 py-0 border-border/40 bg-background/60", compact ? "w-[175px]" : "w-[215px]")}>
            {updateMutation.isPending ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Mentés...</span>
              </span>
            ) : (
              <SelectValue placeholder="Válassz...">
                <span className="truncate">{selectedLabel}</span>
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent className="text-xs z-50">
            {isOutbound ? (
              ALLOWED_CUSTOMER_GL_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code} title={opt.description} className="text-xs py-1.5 cursor-pointer font-mono">
                  {opt.label}
                </SelectItem>
              ))
            ) : (
              ALLOWED_SUPPLIER_GL_OPTIONS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code} title={opt.description} className="text-xs py-1.5 cursor-pointer font-mono">
                  {opt.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Rögzített ÁFA Kontírszám Badge (Fix 467 / 466) */}
      <div 
        className="flex items-center gap-1.5 shrink-0" 
        title={isOutbound ? 'Követel (K) fizetendő ÁFA számla' : 'Tartozik (T) levonható ÁFA számla'}
      >
        <span className="text-xs text-muted-foreground font-medium">ÁFA kontír:</span>
        <Badge
          variant="outline"
          className="h-8 px-2 text-xs font-mono font-semibold gap-1.5 bg-muted/40 text-foreground border-border/40 select-none cursor-default"
        >
          <Lock className="h-3 w-3 text-muted-foreground" />
          <span>{fixedVatLabel}</span>
        </Badge>
      </div>
    </div>
  );
}
