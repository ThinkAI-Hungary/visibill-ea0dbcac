import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Table2, ShieldAlert, CheckCircle2, FileSpreadsheet, 
  HelpCircle, Info, Sparkles 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { GlViewTemplate, GlSampleRow } from '@/types/glTemplate';
import { DEFAULT_SAMPLE_ROWS } from '@/types/glTemplate';
import { formatCurrency, cn } from '@/lib/utils';

interface GlTemplatePreviewProps {
  template: GlViewTemplate;
  isActive: boolean;
  customSampleRows?: GlSampleRow[];
}

export function GlTemplatePreview({ template, isActive, customSampleRows }: GlTemplatePreviewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const columns = template.columns || [];
  const rows = (customSampleRows && customSampleRows.length > 0) ? customSampleRows : DEFAULT_SAMPLE_ROWS;

  const renderCellContent = (row: GlSampleRow, colField: string, format?: string) => {
    switch (colField) {
      case 'id':
        return <span className="font-mono font-semibold text-foreground/90">{row.id}</span>;
      case 'name':
        return (
          <span className={cn(
            "font-medium truncate max-w-full block",
            row.isRoot ? "font-bold text-foreground" : "text-foreground/80 pl-2"
          )}>
            {row.name}
          </span>
        );
      case 'balance':
        return (
          <span className={cn(
            "font-mono font-medium",
            row.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {formatCurrency(row.balance)}
          </span>
        );
      case 'debitTurnover':
        return (
          <span className="font-mono text-foreground/90">
            {(row.debitTurnover ?? 0) > 0 ? formatCurrency(row.debitTurnover!) : '—'}
          </span>
        );
      case 'creditTurnover':
        return (
          <span className="font-mono text-foreground/90">
            {(row.creditTurnover ?? 0) > 0 ? formatCurrency(row.creditTurnover!) : '—'}
          </span>
        );
      case 'balanceDebit':
        return (
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
            {(row.balanceDebit ?? 0) > 0 ? formatCurrency(row.balanceDebit!) : '—'}
          </span>
        );
      case 'balanceCredit':
        return (
          <span className="font-mono text-rose-600 dark:text-rose-400 font-medium">
            {(row.balanceCredit ?? 0) > 0 ? formatCurrency(row.balanceCredit!) : '—'}
          </span>
        );
      case 'partner':
        return <span className="truncate text-muted-foreground">{row.partner || '—'}</span>;
      case 'invoiceNumber':
        return <span className="font-mono text-xs text-muted-foreground">{row.invoiceNumber || '—'}</span>;
      case 'date':
        return <span className="font-mono text-xs text-muted-foreground">{row.date || '—'}</span>;
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
            {template.description || t('accounting:general_ledger.view_modal.default_desc', 'Főkönyvi táblázat és export elrendezési struktúra.')}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-mono font-medium bg-muted px-2 py-1 rounded border border-border/60 text-muted-foreground">
            {columns.length} {t('accounting:general_ledger.view_modal.columns_count', 'oszlop')}
          </span>
        </div>
      </div>

      {/* ── 2. Minőségbiztosítási Figyelmeztetés Egyedi Sablonoknál ── */}
      {template.template_type === 'custom' && (
        <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 py-2.5 px-3">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs space-y-1">
            <AlertTitle className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>Automatizált mintafeldolgozással készült sablon</span>
              <CustomTooltip
                content={
                  <div className="max-w-xs space-y-1 text-xs">
                    <p className="font-semibold text-foreground">Hibajegy nyitási feltételek:</p>
                    <p>Amennyiben korrekcióra van szükség, nyisson hibajegyet a pontos elvárások leírásával, és feltétlenül csatolja a képernyőfotót szöveges magyarázattal, valamint az eredetileg használt minta fájlt.</p>
                  </div>
                }
                side="top"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 cursor-pointer" />
              </CustomTooltip>
            </AlertTitle>
            <AlertDescription className="text-[11px] text-amber-800/90 dark:text-amber-300 leading-normal">
              Kérjük, az első használat előtt alaposan ellenőrizze az oszlopszerkezetet! Eltérés esetén jelezze ügyfélszolgálatunknak (képernyőfotóval és mintafájllal kiegészítve).
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
                    "py-2.5 px-3 border-r border-border/50 uppercase tracking-wider font-semibold select-none",
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
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  row.isRoot ? "bg-muted/20 font-semibold" : ""
                )}
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={col.id || cIdx}
                    className={cn(
                      "py-2 px-3 border-r border-border/30 tabular-nums overflow-hidden",
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                      cIdx === columns.length - 1 ? 'border-r-0' : ''
                    )}
                  >
                    {renderCellContent(row, col.field, col.format)}
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
          <span>Ez a sablon vezérli mind a webes táblázatot, mind az Excel export oszlopszerkezetét.</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          ID: {template.id}
        </span>
      </div>
    </div>
  );
}
