import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Table2, CheckCircle2, FileSpreadsheet, 
  HelpCircle, Info, Sparkles 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { VatViewTemplate, VatSampleRow } from '@/types/vatTemplate';
import { DEFAULT_VAT_SAMPLE_ROWS } from '@/types/vatTemplate';
import { formatCurrency, cn } from '@/lib/utils';

interface VatTemplatePreviewProps {
  template: VatViewTemplate;
  isActive: boolean;
  customSampleRows?: VatSampleRow[];
}

export function VatTemplatePreview({ template, isActive, customSampleRows }: VatTemplatePreviewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const columns = template.columns || [];
  const rows = (customSampleRows && customSampleRows.length > 0) ? customSampleRows : DEFAULT_VAT_SAMPLE_ROWS;

  const renderCellContent = (row: VatSampleRow, colField: string) => {
    switch (colField) {
      case 'entryNumber':
        return <span className="font-mono font-medium text-foreground/90">{row.entryNumber || '—'}</span>;
      case 'journalType':
        return (
          <Badge variant="outline" className={cn(
            "text-[10px] px-1.5 py-0 font-medium capitalize",
            row.journalType === 'szállító' ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" :
            row.journalType === 'vevő' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
            row.journalType === 'pénztár' ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" :
            "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
          )}>
            {row.journalType || 'szállító'}
          </Badge>
        );
      case 'vatDueDate':
        return <span className="font-mono text-xs text-muted-foreground">{row.vatDueDate || '—'}</span>;
      case 'invoiceNumber':
        return <span className="font-mono font-semibold text-foreground/90">{row.invoiceNumber || '—'}</span>;
      case 'partnerCode':
        return <span className="font-mono text-xs text-muted-foreground">{row.partnerCode || '—'}</span>;
      case 'partnerName':
        return <span className="font-medium truncate max-w-full block text-foreground/90">{row.partnerName || '—'}</span>;
      case 'description':
        return <span className="truncate text-muted-foreground text-xs block">{row.description || '—'}</span>;
      case 'vatRateLabel':
        return (
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
            {row.vatRateLabel || '27%-os'}
          </Badge>
        );
      case 'netAmount':
        return <span className="font-mono font-medium text-foreground/90">{formatCurrency(row.netAmount)}</span>;
      case 'vatAmount':
        return (
          <span className={cn(
            "font-mono font-medium",
            row.vatAmount > 0 ? "text-primary" : "text-muted-foreground"
          )}>
            {formatCurrency(row.vatAmount)}
          </span>
        );
      case 'grossAmount':
        return <span className="font-mono font-semibold text-foreground">{formatCurrency(row.grossAmount)}</span>;
      case 'returnRowCode':
        return (
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-border bg-muted/50">
            {row.returnRowCode || '—'}
          </Badge>
        );
      case 'netGlAccount':
        return <span className="font-mono text-xs text-muted-foreground">{row.netGlAccount || '—'}</span>;
      case 'vatGlAccount':
        return <span className="font-mono text-xs text-muted-foreground">{row.vatGlAccount || '—'}</span>;
      case 'grossGlAccount':
        return <span className="font-mono text-xs text-muted-foreground">{row.grossGlAccount || '—'}</span>;
      case 'payableNetAmount':
        return <span className="font-mono text-xs text-foreground/90">{row.journalType === 'vevő' ? formatCurrency(row.payableNetAmount ?? 0) : '—'}</span>;
      case 'payableVatAmount':
        return (
          <span className={cn(
            "font-mono text-xs",
            (row.payableVatAmount ?? 0) > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"
          )}>
            {row.journalType === 'vevő' ? formatCurrency(row.payableVatAmount ?? 0) : '—'}
          </span>
        );
      case 'deductibleNetAmount':
        return <span className="font-mono text-xs text-foreground/90">{row.journalType !== 'vevő' ? formatCurrency(row.deductibleNetAmount ?? 0) : '—'}</span>;
      case 'deductibleVatAmount':
        return (
          <span className={cn(
            "font-mono text-xs",
            (row.deductibleVatAmount ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
          )}>
            {row.journalType !== 'vevő' ? formatCurrency(row.deductibleVatAmount ?? 0) : '—'}
          </span>
        );
      case 'netVatPosition':
        return (
          <span className={cn(
            "font-mono text-xs font-semibold",
            (row.netVatPosition ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : (row.netVatPosition ?? 0) < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}>
            {formatCurrency(row.netVatPosition ?? 0)}
          </span>
        );
      default:
        return <span className="text-muted-foreground">—</span>;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card/50 rounded-xl border border-border p-4 gap-3.5">
      {/* ── 1. Fejléc & Sablon Infók ── */}
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base text-foreground tracking-tight flex items-center gap-2">
              <Table2 className="w-4 h-4 text-primary" />
              <span>{template.name}</span>
            </h3>
            {template.template_type === 'builtin' ? (
              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                {t('accounting:general_ledger.view_modal.badge_builtin', 'Beépített standard')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 uppercase font-bold tracking-wider px-2 py-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('accounting:general_ledger.view_modal.badge_custom', 'Egyedi sablon')}
              </Badge>
            )}
            {isActive && (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 uppercase font-bold px-2 py-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {t('accounting:general_ledger.view_modal.badge_active', 'Jelenleg aktív')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {template.description || 'ÁFA analitika táblázat és letölthető kimutatás elrendezési struktúra.'}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded border border-border/60 text-muted-foreground">
            {columns.length} oszlop
          </span>
        </div>
      </div>

      {/* ── 2. Minőségbiztosítási Figyelmeztetés Egyedi Sablonoknál ── */}
      {template.template_type === 'custom' && (
        <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 py-2.5 px-3">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs space-y-1">
            <AlertTitle className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>Automatizált mintafeldolgozással készült ÁFA sablon</span>
              <CustomTooltip
                content={
                  <div className="max-w-xs space-y-1 text-xs">
                    <p className="font-semibold text-foreground">Hibajegy nyitási feltételek:</p>
                    <p>Amennyiben korrekcióra vagy finomhangolásra van szükség, nyisson hibajegyet a konkrét elvárások megfogalmazásával, és feltétlenül csatolja a képernyőfotót magyarázattal, valamint az eredetileg használt minta fájlt.</p>
                  </div>
                }
                side="top"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 cursor-pointer" />
              </CustomTooltip>
            </AlertTitle>
            <AlertDescription className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-normal">
              Kérjük a könyvelőt, hogy az első használat előtt alaposan vizsgálja át az elrendezést! Eltérés esetén nyisson hibajegyet a képernyőfotó és az eredeti mintafájl csatolásával.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* ── 3. Élő Minta-Előnézeti Táblázat ── */}
      <div className="flex-1 overflow-auto rounded-lg border border-border/80 bg-background shadow-inner">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-muted/80 backdrop-blur border-b border-border text-foreground font-semibold sticky top-0 z-10">
              {columns.map((col, idx) => (
                <th
                  key={col.id || col.key || idx}
                  className={cn(
                    "py-2.5 px-3 border-r border-border/50 uppercase tracking-wider font-semibold select-none whitespace-nowrap",
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                    idx === columns.length - 1 ? 'border-r-0' : ''
                  )}
                  style={{ width: col.width || 'auto' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{col.label}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/60 lowercase">({col.field})</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row, rIdx) => (
              <tr 
                key={row.id || rIdx} 
                className="hover:bg-muted/30 transition-colors"
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={col.id || cIdx}
                    className={cn(
                      "py-2 px-3 border-r border-border/30 tabular-nums overflow-hidden whitespace-nowrap",
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                      cIdx === columns.length - 1 ? 'border-r-0' : ''
                    )}
                  >
                    {renderCellContent(row, col.field)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 4. Export & Képernyő Hatás Megjegyzés ── */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
        <span className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ez a sablon vezérli mind a képernyős ÁFA tétellistát, mind a letölthető ÁFA analitika exportot.</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          ID: {template.id}
        </span>
      </div>
    </div>
  );
}
