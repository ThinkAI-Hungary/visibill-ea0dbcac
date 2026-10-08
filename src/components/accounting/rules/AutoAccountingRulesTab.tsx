import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Copy,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Info,
} from 'lucide-react';
import {
  useAutoAccountingRules,
  useCompanyGlAccountsLookup,
  useCompanyJournalsLookup,
  useSaveAutoAccountingRules,
  type AutoAccountingRules,
} from '@/hooks/useAutoAccountingRules';
import { VatTransferRulesCard } from './VatTransferRulesCard';
import { FxDifferenceRulesCard } from './FxDifferenceRulesCard';
import { RoundingRulesCard } from './RoundingRulesCard';
import { CopyCompanyRulesModal } from './CopyCompanyRulesModal';

interface AutoAccountingRulesTabProps {
  companyId: string;
  companyName: string;
}

const DEFAULT_EMPTY_RULES = (companyId: string): AutoAccountingRules => ({
  company_id: companyId,
  vat_pf_payable_gl_id: null,
  vat_pf_deductible_gl_id: null,
  vat_advance_gross_gl_id: null,
  vat_intra_year_payable_gl_id: null,
  vat_intra_year_deductible_gl_id: null,
  vat_cross_year_payable_gl_id: null,
  vat_cross_year_deductible_gl_id: null,
  fx_realized_journal_id: null,
  fx_realized_gain_gl_id: null,
  fx_realized_loss_gl_id: null,
  fx_unrealized_journal_id: null,
  fx_unrealized_gain_gl_id: null,
  fx_unrealized_loss_gl_id: null,
  rounding_gain_gl_id: null,
  rounding_loss_gl_id: null,
  rounding_max_limit_huf: 10.0,
});

export const AutoAccountingRulesTab: React.FC<AutoAccountingRulesTabProps> = ({
  companyId,
  companyName,
}) => {
  const [userEdits, setUserEdits] = useState<Partial<AutoAccountingRules> | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const { data: rulesData, isLoading, refetch } = useAutoAccountingRules(companyId);
  const { data: accounts = [], isLoading: isLoadingAccounts } = useCompanyGlAccountsLookup(companyId);
  const { data: journals = [], isLoading: isLoadingJournals } = useCompanyJournalsLookup(companyId);

  const saveMutation = useSaveAutoAccountingRules();

  // Pure derived state from query data + local user edits (zero cascading effect renders)
  const formData = useMemo<AutoAccountingRules>(() => {
    return {
      ...DEFAULT_EMPTY_RULES(companyId),
      ...rulesData?.rules,
      ...userEdits,
      company_id: companyId,
      rounding_max_limit_huf: (userEdits?.rounding_max_limit_huf ?? rulesData?.rules?.rounding_max_limit_huf) ?? 10.0,
    };
  }, [companyId, rulesData?.rules, userEdits]);

  const isDirty = useMemo(() => {
    return userEdits !== null && Object.keys(userEdits).length > 0;
  }, [userEdits]);

  const handleFieldChange = (field: keyof AutoAccountingRules, value: any) => {
    setUserEdits((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData, {
      onSuccess: () => {
        setUserEdits(null);
      },
    });
  };

  const handleReset = () => {
    setUserEdits(null);
  };

  if (isLoading || isLoadingAccounts || isLoadingJournals) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        <p className="text-xs text-muted-foreground">Automata könyvelési szabályok és számlatükör betöltése...</p>
      </div>
    );
  }

  const isConfigured = rulesData?.is_configured ?? false;

  return (
    <div className="space-y-6">
      {/* Top action & status banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">
              Automata Könyvelés és Átvezetések Paraméterezése
            </h2>
            {isConfigured ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Egyedileg beállítva</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Alapértelmezett sablon</span>
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A háttérben automatikusan lefutó ÁFA átvezetések, árfolyam-különbözetek és kerekítések központi felparaméterezése.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCopyModalOpen(true)}
            className="text-xs gap-1.5 h-9 bg-background/80 hover:bg-background"
          >
            <Copy className="h-3.5 w-3.5 text-primary" />
            <span>Átvétel másik cégből</span>
          </Button>

          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs gap-1.5 h-9 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Visszaállítás</span>
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="text-xs gap-1.5 h-9 font-semibold shadow-sm"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Mentés...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Beállítások Mentése</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Suggested notice if not configured yet */}
      {!isConfigured && (
        <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-3 text-xs">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Első beállítás a(z) {companyName} cégnél
            </p>
            <p className="text-muted-foreground text-[11px]">
              A felület automatikusan felajánlja az elérhető számlatükörből és a Vegyes (VE) naplóból a leggyakrabban használt kontókat. Szükség esetén módosítsd a kívánt mezőket, majd kattints a fenti „Beállítások Mentése” gombra, vagy vegyél át egy másik cégből egy már kész szabályrendszert.
            </p>
          </div>
        </div>
      )}

      {/* Information about rules validity */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-foreground font-semibold">Tájékoztatás a szabályok érvényességéről:</strong> A módosított automatikus könyvelési szabályok a mentést követően indított új könyvelési tételekre, vegyes napló átvezetésekre és draft generálásokra vonatkoznak. A korábban már lekönyvelt bizonylatok és főkönyvi tételek sértetlenek maradnak.
        </p>
      </div>

      {/* Cards stack */}
      <div className="space-y-6">
        <VatTransferRulesCard
          rules={formData}
          onChange={handleFieldChange}
          accounts={accounts}
          disabled={saveMutation.isPending}
        />

        <FxDifferenceRulesCard
          rules={formData}
          onChange={handleFieldChange}
          accounts={accounts}
          journals={journals}
          disabled={saveMutation.isPending}
        />

        <RoundingRulesCard
          rules={formData}
          onChange={handleFieldChange}
          accounts={accounts}
          disabled={saveMutation.isPending}
        />
      </div>

      {/* Sticky footer save action if dirty */}
      {isDirty && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between p-3 bg-card/95 backdrop-blur-md rounded-xl border border-primary/30 shadow-lg animate-in slide-in-from-bottom-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5 ml-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Nem mentett módosítások vannak a szabályokban.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs h-8"
            >
              Mégse
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="text-xs h-8 font-semibold gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Mentés</span>
            </Button>
          </div>
        </div>
      )}

      {/* Copy cross-company modal */}
      <CopyCompanyRulesModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        targetCompanyId={companyId}
        targetCompanyName={companyName}
      />
    </div>
  );
};
