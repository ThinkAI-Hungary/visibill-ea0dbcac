import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Info, ArrowRightLeft } from 'lucide-react';
import { GlAccountCombobox } from './GlAccountCombobox';
import type { AutoAccountingRules, GlAccountOption } from '@/hooks/useAutoAccountingRules';

interface VatTransferRulesCardProps {
  rules: AutoAccountingRules;
  onChange: (field: keyof AutoAccountingRules, value: any) => void;
  accounts: GlAccountOption[];
  disabled?: boolean;
}

export const VatTransferRulesCard: React.FC<VatTransferRulesCardProps> = ({
  rules,
  onChange,
  accounts,
  disabled = false,
}) => {
  return (
    <Card className="border-border/60 shadow-sm bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              1. ÁFA Átvezetések Paraméterezése
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Automatikus ÁFA könyvelési és átvezetési tételek technikai kontói (pénzforgalmi, előleg, időszaki elhatárolás).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* A) Pénzforgalmi ÁFA átvezetése */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>A.) Pénzforgalmi ÁFA Átvezetése</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-3.5 rounded-lg border border-border/40">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Fizetendő ÁFA átvezetése <span className="text-muted-foreground font-mono text-[11px]">(pl. 47911 / 47993)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_pf_payable_gl_id}
                onChange={(val) => onChange('vat_pf_payable_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['47911', '47993', '479']}
                disabled={disabled}
                placeholder="Válassz fizetendő ÁFA átvezetési számlát..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Levonható ÁFA átvezetése <span className="text-muted-foreground font-mono text-[11px]">(pl. 36911 / 3689)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_pf_deductible_gl_id}
                onChange={(val) => onChange('vat_pf_deductible_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['36911', '3689', '369', '368']}
                disabled={disabled}
                placeholder="Válassz levonható ÁFA átvezetési számlát..."
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            Pénzforgalmi ÁFA adóalanyoknál a számla kibocsátásakor a technikai számlára kerül, pénzügyi rendezéskor pedig a végleges ÁFA számlára vezet át.
          </p>
        </div>

        {/* B) Bruttó előleg ÁFA kezelése */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>B.) Bruttó Előleg ÁFA Kezelése</span>
          </div>
          <div className="bg-muted/20 p-3.5 rounded-lg border border-border/40">
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs font-medium text-foreground">
                Átvezetési főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 36914 – Bruttó előleg ÁFA)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_advance_gross_gl_id}
                onChange={(val) => onChange('vat_advance_gross_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['36914', '369']}
                disabled={disabled}
                placeholder="Válassz bruttó előleg ÁFA számlát..."
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            Készletekre adott előleget bruttó módon (áfával növelten) kell nyilvántartani.
          </p>
        </div>

        {/* C) Automatikus ÁFA átvezetés éven belül */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>C.) Automatikus ÁFA Átvezetés Éven Belül</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-3.5 rounded-lg border border-border/40">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Éven belüli fizetendő ÁFA <span className="text-muted-foreground font-mono text-[11px]">(pl. 47912)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_intra_year_payable_gl_id}
                onChange={(val) => onChange('vat_intra_year_payable_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['47912', '4791', '479']}
                disabled={disabled}
                placeholder="Válassz éven belüli fizetendő ÁFA számlát..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Éven belüli levonható ÁFA <span className="text-muted-foreground font-mono text-[11px]">(pl. 36912)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_intra_year_deductible_gl_id}
                onChange={(val) => onChange('vat_intra_year_deductible_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['36912', '3691', '369']}
                disabled={disabled}
                placeholder="Válassz éven belüli levonható ÁFA számlát..."
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            Akkor szükséges, ha a számla könyvelési időszaka és az ÁFA teljesítés dátuma eltérő naptári hónapra esik.
          </p>
        </div>

        {/* D) Automatikus ÁFA átvezetés évek között */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>D.) Automatikus ÁFA Átvezetés Évek Között</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-3.5 rounded-lg border border-border/40">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Éven túli fizetendő ÁFA <span className="text-muted-foreground font-mono text-[11px]">(pl. 47913)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_cross_year_payable_gl_id}
                onChange={(val) => onChange('vat_cross_year_payable_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['47913', '479']}
                disabled={disabled}
                placeholder="Válassz éven túli fizetendő ÁFA számlát..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Éven túli levonható ÁFA <span className="text-muted-foreground font-mono text-[11px]">(pl. 36913)</span>
              </Label>
              <GlAccountCombobox
                value={rules.vat_cross_year_deductible_gl_id}
                onChange={(val) => onChange('vat_cross_year_deductible_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['36913', '369']}
                disabled={disabled}
                placeholder="Válassz éven túli levonható ÁFA számlát..."
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            Üzleti éveken átnyúló teljesítések és áthúzódó ÁFA kötelezettségek szabályozásához.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
