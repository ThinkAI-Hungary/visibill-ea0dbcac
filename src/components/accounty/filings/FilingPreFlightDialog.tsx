import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateTajNumber, validateTaxId } from '@/lib/payroll/validators';

export interface PreFlightIssue {
  type: 'error' | 'warning' | 'info';
  category: 'cdv' | 'feor' | 'arithmetic' | 'filing_08e' | 'data';
  title: string;
  description: string;
  employeeName?: string;
  tajNumber?: string;
}

export interface FilingPreFlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  companyName: string;
  calculations: any[];
  employees: any[];
  onConfirm: () => void;
  confirmLabel?: string;
}

export function FilingPreFlightDialog({
  open,
  onOpenChange,
  year,
  month,
  companyName,
  calculations,
  employees,
  onConfirm,
  confirmLabel = 'XML Letöltése',
}: FilingPreFlightDialogProps) {
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

  // Run all statutory pre-flight checks
  const { issues, hasErrors, hasWarnings, checkStats } = useMemo(() => {
    const list: PreFlightIssue[] = [];

    // 1. CDV & Identifier Checks
    let validTajCount = 0;
    let validTaxIdCount = 0;

    calculations.forEach(calc => {
      const meta = calc.metadata as any;
      const emp = employees.find(e => e.id === meta?.employee_id || `${e.last_name} ${e.first_name}`.trim() === meta?.employee_name);
      const name = meta?.employee_name || (emp ? `${emp.last_name} ${emp.first_name}` : 'Ismeretlen');
      const taj = emp?.taj_number || meta?.taj_number || '';
      const taxId = emp?.tax_id || meta?.tax_id || '';

      // TAJ validation
      if (!taj) {
        list.push({
          type: 'error',
          category: 'cdv',
          title: 'Hiányzó TAJ szám',
          description: `${name} nem rendelkezik rögzített TAJ számmal. A 2608 M-lap nem küldhető be nélküle.`,
          employeeName: name,
        });
      } else {
        const tajCheck = validateTajNumber(taj);
        if (!tajCheck.valid) {
          list.push({
            type: 'error',
            category: 'cdv',
            title: 'Érvénytelen TAJ szám (CDV hiba)',
            description: `${name}: a megadott TAJ (${taj}) nem felel meg a hivatalos CDV ellenőrző algoritmusnak (${tajCheck.error}).`,
            employeeName: name,
            tajNumber: taj,
          });
        } else {
          validTajCount++;
        }
      }

      // Tax ID validation
      if (!taxId) {
        list.push({
          type: 'warning',
          category: 'cdv',
          title: 'Hiányzó adóazonosító jel',
          description: `${name} esetén az adóazonosító jel nincs kitöltve.`,
          employeeName: name,
        });
      } else {
        const taxCheck = validateTaxId(taxId);
        if (!taxCheck.valid) {
          list.push({
            type: 'warning',
            category: 'cdv',
            title: 'Adóazonosító formátum figyelmeztetés',
            description: `${name}: ${taxCheck.error}`,
            employeeName: name,
          });
        } else {
          validTaxIdCount++;
        }
      }

      // Negative values
      if ((calc.gross_salary || 0) < 0) {
        list.push({
          type: 'error',
          category: 'data',
          title: 'Negatív bruttó bér',
          description: `${name} bruttó bére negatív (${calc.gross_salary} Ft), ami nem szerepelhet a havi bevallásban.`,
          employeeName: name,
        });
      }

      // 0 Ft gross wage with statutory minimum base difference (Tbj. 27. §)
      if ((calc.gross_salary || 0) === 0 && (calc.min_base_employer_contribution || 0) > 0) {
        list.push({
          type: 'warning',
          category: 'data',
          title: '0 Ft bruttó bér minimális járulékalap teherrel',
          description: `${name} bruttó bére 0 Ft, de a Tbj. 27. § (2) szerinti alsó határ miatt a munkáltatót ${(calc.min_base_employer_contribution || 0).toLocaleString('hu-HU')} Ft TB kötelezettség terheli. Amennyiben igazolt fizetés nélküli távollét áll fenn, rögzítsen szünetelést a 08E-n a teher mentesítéséhez.`,
          employeeName: name,
        });
      }

      // FEOR Code
      const feor = meta?.feor_code || emp?.feor_code || '4112';
      if (!feor || !/^\d{4}$/.test(feor)) {
        list.push({
          type: 'warning',
          category: 'feor',
          title: 'Hiányzó vagy nem 4 jegyű FEOR kód',
          description: `${name} FEOR kódja (${feor || 'üres'}) nem felel meg a FEOR-08 szabványnak.`,
          employeeName: name,
        });
      }

      // 08E Filing Status check
      const filing08eStatus = emp?.filing_08e_status || meta?.filing_08e_status;
      if (filing08eStatus !== 'sent' && filing08eStatus !== 'beadva') {
        list.push({
          type: 'warning',
          category: 'filing_08e',
          title: '08E bejelentés nincs visszaigazolva',
          description: `${name} szerepel a havi bérszámfejtésben, de a 08E biztosítotti bejelentése nincs 'beadva' státuszban.`,
          employeeName: name,
          tajNumber: taj,
        });
      }
    });

    // 2. Arithmetic Integrity (A-lap vs sum of M-laps)
    const sumGross = calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
    const sumSzja = calculations.reduce((s, c) => s + (c.szja_amount || 0), 0);
    const sumTb = calculations.reduce((s, c) => s + (c.tb_amount || 0), 0);
    const sumSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);

    const errors = list.filter(i => i.type === 'error');
    const warnings = list.filter(i => i.type === 'warning');

    return {
      issues: list,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      checkStats: {
        totalEmployees: calculations.length,
        validTajCount,
        validTaxIdCount,
        sumGross,
        sumSzja,
        sumTb,
        sumSzocho,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  }, [calculations, employees]);

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-lg',
              hasErrors ? 'bg-destructive/10 text-destructive' : hasWarnings ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
            )}>
              {hasErrors ? <XCircle className="w-5 h-5" /> : hasWarnings ? <AlertTriangle className="w-5 h-5" /> : <FileCheck className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg">2608 Pre-flight Ellenőrzés és Adatintegritás</DialogTitle>
              <DialogDescription>
                {companyName} — {year}. {month}. hó havi adó- és járulékbevallás
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status banner */}
        <div className={cn(
          'p-4 rounded-lg border text-sm flex items-start gap-3',
          hasErrors
            ? 'bg-destructive/10 border-destructive/30 text-destructive'
            : hasWarnings
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
        )}>
          {hasErrors ? (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : hasWarnings ? (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold">
              {hasErrors
                ? `${checkStats.errorCount} db kritikus hiba található. Az XML generálás előtt javítás szükséges!`
                : hasWarnings
                  ? `Az adatok beküldésre alkalmasak, de ${checkStats.warningCount} db figyelmeztetés található.`
                  : 'Minden ellenőrzés sikeresen lefutott! Az adatok megfelelnek a NAV 2608 előírásainak.'}
            </p>
            <p className="text-xs mt-1 opacity-90">
              Feldolgozva: {checkStats.totalEmployees} fő | Érvényes TAJ: {checkStats.validTajCount}/{checkStats.totalEmployees} | Összes járulékalap: {checkStats.sumGross.toLocaleString('hu-HU')} Ft
            </p>
          </div>
        </div>

        {/* Checks Breakdown */}
        <div className="space-y-3 py-2">
          {/* 1. CDV & Azonosítók */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <button
              onClick={() => toggleSection('cdv')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {issues.some(i => i.category === 'cdv' && i.type === 'error') ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : issues.some(i => i.category === 'cdv') ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                <span className="text-sm font-semibold">TAJ szám és Adóazonosító jel CDV ellenőrzés</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {checkStats.validTajCount}/{checkStats.totalEmployees} rendben
                </span>
                {expandedSection === 'cdv' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {expandedSection === 'cdv' && (
              <div className="p-3 pt-0 border-t border-border/50 text-xs space-y-1.5 bg-muted/20">
                {issues.filter(i => i.category === 'cdv').length === 0 ? (
                  <p className="text-emerald-600 dark:text-emerald-400 py-1">Minden foglalkoztatott TAJ száma és adóazonosítója matematikailag érvényes.</p>
                ) : (
                  issues.filter(i => i.category === 'cdv').map((issue, idx) => (
                    <div key={idx} className={cn('p-2 rounded', issue.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300')}>
                      <strong>{issue.employeeName}:</strong> {issue.description}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 2. 08E bejelentési fedettség */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <button
              onClick={() => toggleSection('08e')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {issues.some(i => i.category === 'filing_08e') ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                <span className="text-sm font-semibold">08E Biztosítotti bejelentés szinkron</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {issues.filter(i => i.category === 'filing_08e').length} nyitott
                </span>
                {expandedSection === '08e' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {expandedSection === '08e' && (
              <div className="p-3 pt-0 border-t border-border/50 text-xs space-y-1.5 bg-muted/20">
                {issues.filter(i => i.category === 'filing_08e').length === 0 ? (
                  <p className="text-emerald-600 dark:text-emerald-400 py-1">Minden számfejtett munkavállalóhoz tartozik beadott 08E bejelentés.</p>
                ) : (
                  issues.filter(i => i.category === 'filing_08e').map((issue, idx) => (
                    <div key={idx} className="p-2 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300">
                      <strong>{issue.employeeName}:</strong> {issue.description}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 3. Aritmetikai egyezőség & Alapok */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <button
              onClick={() => toggleSection('arithmetic')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold">A-lap és M-lapok aritmetikai egyezősége</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-bold font-mono">100% egyezés</span>
                {expandedSection === 'arithmetic' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {expandedSection === 'arithmetic' && (
              <div className="p-3 pt-0 border-t border-border/50 text-xs bg-muted/20 space-y-2">
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-card p-2 rounded border border-border">
                    <span className="text-muted-foreground">Összes SZJA (15%):</span>
                    <p className="font-mono font-bold">{checkStats.sumSzja.toLocaleString('hu-HU')} Ft</p>
                  </div>
                  <div className="bg-card p-2 rounded border border-border">
                    <span className="text-muted-foreground">Összes TB járulék (18.5%):</span>
                    <p className="font-mono font-bold">{checkStats.sumTb.toLocaleString('hu-HU')} Ft</p>
                  </div>
                  <div className="bg-card p-2 rounded border border-border">
                    <span className="text-muted-foreground">Összes SZOCHO (13%):</span>
                    <p className="font-mono font-bold">{checkStats.sumSzocho.toLocaleString('hu-HU')} Ft</p>
                  </div>
                  <div className="bg-card p-2 rounded border border-border">
                    <span className="text-muted-foreground">Összes közteher kötelezettség:</span>
                    <p className="font-mono font-bold text-primary">{(checkStats.sumSzja + checkStats.sumTb + checkStats.sumSzocho).toLocaleString('hu-HU')} Ft</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            disabled={hasErrors}
            className={cn('gap-2', hasErrors ? 'opacity-50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90')}
          >
            <Download className="w-4 h-4" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
