import React from 'react';
import { ShieldAlert, Scale, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getFadCategory, type ReverseChargeCategory } from '@/lib/fad/fadTypes';
import { validateFadInvoice, getOverallSeverity, type FadValidationResult } from '@/lib/fad/fadValidation';
import { cn } from '@/lib/utils';

interface FadInvoicePanelProps {
  invoice: {
    forditott_adozas?: boolean | null;
    is_reverse_charge?: boolean | null;
    reverse_charge_category?: string | null;
    adoalap_osszesen?: number | null;
    afa_osszeg_osszesen?: number | null;
    elado_vat_id?: string | null;
    vevo_vat_id?: string | null;
    supplier_tax_number?: string | null;
    customer_tax_number?: string | null;
    teljesites_datuma?: string | null;
    invoice_delivery_date?: string | null;
    invoice_net_amount?: number | null;
    penznem?: string | null;
    currency?: string | null;
  };
  className?: string;
}

const severityIcon: Record<string, React.ReactNode> = {
  error: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  info: <Info className="w-3.5 h-3.5 text-blue-500" />,
};

const severityBg: Record<string, string> = {
  error: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
};

export default function FadInvoicePanel({ invoice, className }: FadInvoicePanelProps) {
  const isFad = invoice.forditott_adozas === true || invoice.is_reverse_charge === true;
  if (!isFad) return null;

  const categoryMeta = getFadCategory(invoice.reverse_charge_category);
  const validationResults = validateFadInvoice(invoice);
  const overallSeverity = getOverallSeverity(validationResults);
  const currency = invoice.penznem || invoice.currency || 'HUF';
  const netAmount = Number(invoice.adoalap_osszesen || invoice.invoice_net_amount || 0);
  const estimatedVat = Math.round(netAmount * 0.27);

  const fmtAmount = (v: number) =>
    new Intl.NumberFormat('hu-HU', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);

  return (
    <div className={cn(
      'rounded-xl border-2 border-amber-300/60 dark:border-amber-700/60 bg-gradient-to-br from-amber-50/80 to-amber-100/30 dark:from-amber-950/30 dark:to-amber-900/10 p-4 space-y-3',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/10">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Fordított adózás</h3>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60">Az áfát a vevő fizeti</p>
          </div>
        </div>
        {overallSeverity && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold',
              overallSeverity === 'error' && 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20',
              overallSeverity === 'warning' && 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20',
              overallSeverity === 'info' && 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/20',
            )}
          >
            {overallSeverity === 'error' ? 'Hibás' : overallSeverity === 'warning' ? 'Figyelem' : 'OK'}
          </Badge>
        )}
      </div>

      {/* Category */}
      {categoryMeta ? (
        <div className={cn('rounded-lg px-3 py-2 border', categoryMeta.color, 'border-current/10')}>
          <div className="flex items-center justify-between">
            <div>
              <div className={cn('text-xs font-bold', categoryMeta.textColor)}>{categoryMeta.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{categoryMeta.description}</div>
            </div>
            <Badge variant="outline" className="text-[9px] font-mono shrink-0 ml-2">
              {categoryMeta.legalRef}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800 bg-amber-100/30 dark:bg-amber-950/20">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            ⚠ Kategória meghatározás szükséges
          </div>
          <div className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5">
            A pontos könyveléshez határozza meg a fordított adózás típusát
          </div>
        </div>
      )}

      {/* Estimated VAT */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-amber-200/30 dark:border-amber-800/30">
        <Scale className="w-4 h-4 text-amber-600/70 dark:text-amber-400/60 shrink-0" />
        <div className="flex-1">
          <div className="text-[10px] text-muted-foreground">Becsült fizetendő ÁFA (27%)</div>
          <div className="text-sm font-bold text-amber-800 dark:text-amber-300">{fmtAmount(estimatedVat)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground text-right">Adóalap</div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fmtAmount(netAmount)}</div>
        </div>
      </div>

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <div className="space-y-1.5">
          {validationResults.map((v, i) => (
            <div
              key={i}
              className={cn('flex items-start gap-2 px-3 py-1.5 rounded-lg border text-[11px]', severityBg[v.severity])}
            >
              <div className="mt-0.5 shrink-0">{severityIcon[v.severity]}</div>
              <span className="text-slate-700 dark:text-slate-300">{v.message}</span>
            </div>
          ))}
        </div>
      )}

      {validationResults.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Minden validáció rendben</span>
        </div>
      )}
    </div>
  );
}
