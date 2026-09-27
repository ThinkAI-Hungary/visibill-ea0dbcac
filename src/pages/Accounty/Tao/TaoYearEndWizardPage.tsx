import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useParams, useSearchParams , useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calculator, Landmark, Save, Loader2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountyClients } from '@/hooks/accounty';
import { useTaoYearly, useSaveTaoYearly } from '@/hooks/useAdminData';
import { useDevelopmentReserves } from '@/hooks/useDevelopmentReserves';
import { useFixedAssets } from '@/hooks/useFixedAssets';
import { calculateAnnualDepreciation } from '@/hooks/useDepreciation';
import { toast } from '@/hooks/use-toast';
import {
  STEPS, DECREASING_ITEMS, INCREASING_ITEMS, CREDIT_ITEMS, DONATION_ITEMS,
  fmt,
} from './taoWizardData';
import type { TaoFormData } from './taoWizardTypes';
import { RenderStep1, RenderStep2 } from './wizard-steps/TaoBasicInfoSteps';
import { RenderItemsStep, RenderStep5, RenderStep6 } from './wizard-steps/TaoAdjustmentSteps';
import { RenderStep7, RenderStep10, RenderStep11 } from './wizard-steps/TaoResultSteps';
import { TaoWizardStepper, TaoWizardSidebar } from './TaoWizardShell';


// =============================================================================
// MAIN COMPONENT
// =============================================================================


export default function TaoYearEndWizardPage() {
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const { companyId, year, dateRange } = useParams<{ companyId: string; year: string; dateRange: string }>();
  const id = companyId;
  const taxYear = parseInt(year || '2025', 10);
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);


  const [searchParams] = useSearchParams();
  const initialStep = Math.min(11, Math.max(1, parseInt(searchParams.get('step') || '1', 10)));
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [filingGenerated, setFilingGenerated] = useState(false);


  // DB hooks
  const companyUuid = client?.id || id; // actual UUID for DB
  const { data: savedData, isLoading: loadingData } = useTaoYearly(companyUuid, taxYear);
  const saveMutation = useSaveTaoYearly();
  const { data: devReserves = [] } = useDevelopmentReserves(companyUuid);
  const { data: fixedAssets = [] } = useFixedAssets(companyUuid);


  // ── Form state ──
  const [data, setData] = useState({
    // Step 1 — Beszámoló
    revenue: 0,
    other_revenue: 0,
    material_costs: 0,
    personnel_costs: 0,
    depreciation: 0,
    other_costs: 0,
    financial_result: 0,
    // Step 3 — 7.§
    decreasing: {} as Record<string, number>,
    // Step 4 — 8.§
    increasing: {} as Record<string, number>,
    // Step 5 — Kamatkorlát
    interest_expense: 0,
    // Step 6 — CFC
    has_cfc: false,
    cfc_country: '',
    cfc_company: '',
    cfc_income: 0,
    cfc_tax_rate: 0,
    // Step 8 — Kedvezmények
    credits: {} as Record<string, number>,
    // Step 9 — Felajánlás
    donations: {} as Record<string, number>,
    // Step 10 — Előlegek
    advance_payments: 0,
  });


  const upd = useCallback((key: string, val: any) =>
    setData(prev => ({ ...prev, [key]: val })), []);


  const updItem = useCallback((group: 'decreasing' | 'increasing' | 'credits' | 'donations', key: string, val: number) =>
    setData(prev => ({
      ...prev,
      [group]: { ...prev[group], [key]: val },
    })), []);


  // Load saved data from DB (only on initial load)
  const hasLoadedRef = React.useRef(false);
  useEffect(() => {
    if (savedData && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setData(prev => ({
        ...prev,
        revenue: savedData.revenue || 0,
        other_revenue: savedData.other_revenue || 0,
        material_costs: savedData.material_costs || 0,
        personnel_costs: savedData.personnel_costs || 0,
        depreciation: savedData.depreciation || 0,
        other_costs: savedData.other_costs || 0,
        financial_result: savedData.financial_result || 0,
        decreasing: savedData.decreasing_items || {},
        increasing: savedData.increasing_items || {},
        interest_expense: savedData.interest_expense || 0,
        has_cfc: savedData.has_cfc || false,
        cfc_country: savedData.cfc_data?.country || '',
        cfc_company: savedData.cfc_data?.company || '',
        cfc_income: savedData.cfc_data?.income || 0,
        cfc_tax_rate: savedData.cfc_data?.tax_rate || 0,
        credits: savedData.tax_credits || {},
        donations: savedData.donations || {},
        advance_payments: savedData.advance_payments || 0,
      }));
      if (savedData.current_step && !searchParams.get('step')) {
        setStep(savedData.current_step);
      }
      if (savedData.filing_status === 'generated' || savedData.filing_status === 'submitted') {
        setFilingGenerated(true);
      }
    }
  }, [savedData]);


  // ── Computed values ──
  const computed = useMemo(() => {
    const totalRevenue = data.revenue + data.other_revenue;
    const totalCosts = data.material_costs + data.personnel_costs + data.depreciation + data.other_costs;
    const aee = totalRevenue - totalCosts + data.financial_result;

    const decreasingTotal = Object.values(data.decreasing).reduce((s, v) => s + (v || 0), 0);
    const increasingTotal = Object.values(data.increasing).reduce((s, v) => s + (v || 0), 0);

    const ebitda = aee + data.depreciation;
    const interestLimit = Math.round(ebitda * 0.3);
    const interestAdjustment = Math.max(0, data.interest_expense - interestLimit);

    const modifiedTaxBase = aee + increasingTotal - decreasingTotal + interestAdjustment;
    const taxBase = Math.max(0, modifiedTaxBase);

    const calculatedTax = Math.round(taxBase * 0.09);

    const creditsTotal = Object.values(data.credits).reduce((s, v) => s + (v || 0), 0);
    const donationsTotal = Object.values(data.donations).reduce((s, v) => s + (v || 0), 0);
    const maxDonation = Math.round(calculatedTax * 0.8);
    const effectiveDonations = Math.min(donationsTotal, maxDonation);

    const payableTax = Math.max(0, calculatedTax - creditsTotal - effectiveDonations - data.advance_payments);

    return {
      totalRevenue, totalCosts, aee,
      decreasingTotal, increasingTotal,
      ebitda, interestLimit, interestAdjustment,
      modifiedTaxBase, taxBase,
      calculatedTax, creditsTotal,
      donationsTotal, effectiveDonations, maxDonation,
      payableTax,
    };
  }, [data]);

  // ── TENY és Fejlesztési Tartalék összefoglaló ──
  const tenySummary = useMemo(() => {
    const reservesCreatedThisYear = devReserves.filter(r => r.creation_year === taxYear);
    const totalReserveCreated = reservesCreatedThisYear.reduce((s, r) => s + (Number(r.reserve_amount) || 0), 0);

    let totalAccountingDep = 0;
    let totalTaxDep = 0;

    fixedAssets.forEach(asset => {
      const dep = calculateAnnualDepreciation({
        acquisitionValue: asset.acquisition_value,
        residualValue: asset.residual_value,
        activationDate: asset.activation_date,
        usefulLifeMonths: asset.useful_life_months,
        taoRatePercent: asset.tao_template?.tao_rate_percent || 0,
        developmentReserveAmount: asset.development_reserve_amount,
        year: taxYear,
        disposalDate: asset.disposal_date ? asset.disposal_date : undefined,
        depreciationMethod: asset.depreciation_method,
        totalPlannedPerformance: asset.total_planned_performance,
        depreciationSchedule: asset.depreciation_schedule,
      });
      totalAccountingDep += dep.accounting;
      totalTaxDep += dep.tax;
    });

    const depDiff = Math.max(0, Math.round(totalAccountingDep) - Math.round(totalTaxDep));

    return {
      totalReserveCreated,
      totalAccountingDep: Math.round(totalAccountingDep),
      totalTaxDep: Math.round(totalTaxDep),
      depDiff: Math.round(depDiff),
      hasAssets: fixedAssets.length > 0,
      hasReserves: reservesCreatedThisYear.length > 0,
    };
  }, [devReserves, fixedAssets, taxYear]);

  const handleApplyStep1Teny = () => {
    upd('depreciation', tenySummary.totalAccountingDep);
    toast({
      title: 'Számviteli ÉCS betöltve',
      description: `TENY számviteli értékcsökkenés (${fmt(tenySummary.totalAccountingDep)} Ft) beillesztve a beszámoló sorba.`,
    });
  };

  const handleApplyStep3Teny = () => {
    if (tenySummary.totalReserveCreated > 0) {
      updItem('decreasing', 'investment_allowance', tenySummary.totalReserveCreated);
    }
    if (tenySummary.totalTaxDep > 0) {
      updItem('decreasing', 'depreciation_tax', tenySummary.totalTaxDep);
    }
    toast({
      title: 'TENY csökkentő tételek betöltve',
      description: `Fejlesztési tartalék (${fmt(tenySummary.totalReserveCreated)} Ft) és Tao ÉCS (${fmt(tenySummary.totalTaxDep)} Ft) beillesztve.`,
    });
  };

  const handleApplyStep4Teny = () => {
    updItem('increasing', 'depreciation_diff', tenySummary.depDiff);
    toast({
      title: 'ÉCS különbözet betöltve',
      description: `Számviteli-adó ÉCS különbözet (${fmt(tenySummary.depDiff)} Ft) beillesztve.`,
    });
  };


  // Save to DB
  const handleSave = useCallback(async () => {
    if (!companyUuid) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        company_id: companyUuid,
        tax_year: taxYear,
        current_step: step,
        status: step >= 11 ? 'calculated' : 'in_progress',
        revenue: data.revenue,
        other_revenue: data.other_revenue,
        material_costs: data.material_costs,
        personnel_costs: data.personnel_costs,
        depreciation: data.depreciation,
        other_costs: data.other_costs,
        financial_result: data.financial_result,
        aee: computed.aee,
        decreasing_items: data.decreasing,
        decreasing_total: computed.decreasingTotal,
        increasing_items: data.increasing,
        increasing_total: computed.increasingTotal,
        ebitda: computed.ebitda,
        interest_expense: data.interest_expense,
        interest_limit: computed.interestLimit,
        interest_adjustment: computed.interestAdjustment,
        has_cfc: data.has_cfc,
        cfc_data: data.has_cfc ? { country: data.cfc_country, company: data.cfc_company, income: data.cfc_income, tax_rate: data.cfc_tax_rate } : {},
        modified_tax_base: computed.modifiedTaxBase,
        tax_base: computed.taxBase,
        tax_credits: data.credits,
        tax_credits_total: computed.creditsTotal,
        donations: data.donations,
        donations_total: computed.donationsTotal,
        calculated_tax: computed.calculatedTax,
        advance_payments: data.advance_payments,
        payable_tax: computed.payableTax,
      });
    } finally {
      setSaving(false);
    }
  }, [companyUuid, taxYear, step, data, computed, saveMutation]);


  // ── Shared step props ──
  const stepProps = { data, computed, upd, updItem };

  const handleGenerateFiling = () => {
    setFilingGenerated(true);
    toast({
      title: '29-es bevallás generálva',
      description: `${taxYear}. adóévi TAO bevallás (2929) sikeresen elkészült. Fizetendő: ${fmt(computed.payableTax)} Ft`,
    });
    if (companyUuid) {
      saveMutation.mutate({
        company_id: companyUuid,
        tax_year: taxYear,
        current_step: 11,
        status: 'calculated',
        filing_status: 'generated',
        calculated_tax: computed.calculatedTax,
        payable_tax: computed.payableTax,
        tax_base: computed.taxBase,
        aee: computed.aee,
      });
    }
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return <RenderStep1 {...stepProps} />;
      case 2: return <RenderStep2 {...stepProps} />;
      case 3: return <RenderItemsStep {...stepProps} items={DECREASING_ITEMS} group="decreasing" total={computed.decreasingTotal} color="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" />;
      case 4: return <RenderItemsStep {...stepProps} items={INCREASING_ITEMS} group="increasing" total={computed.increasingTotal} color="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" />;
      case 5: return <RenderStep5 {...stepProps} />;
      case 6: return <RenderStep6 {...stepProps} />;
      case 7: return <RenderStep7 {...stepProps} />;
      case 8: return <RenderItemsStep {...stepProps} items={CREDIT_ITEMS} group="credits" total={computed.creditsTotal} color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" />;
      case 9: return <RenderItemsStep {...stepProps} items={DONATION_ITEMS} group="donations" total={computed.donationsTotal} color="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" />;
      case 10: return <RenderStep10 {...stepProps} />;
      case 11: return <RenderStep11 data={data} computed={computed} taxYear={taxYear} clientName={client?.name || 'Ügyfél'} filingGenerated={filingGenerated} onGenerateFiling={handleGenerateFiling} />;
      default: return null;
    }
  };


  const currentStepDef = STEPS.find(s => s.num === step)!;


  return (
    <div className="w-full space-y-6 page-animate">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`${prefix}/eaisybooks/${id}/${dateRange}/tao`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/25">
          <Landmark className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            TAO Éves Záró — {taxYear}
          </h1>
          <p className="text-sm text-muted-foreground">{client?.name || 'Ügyfél'}</p>
        </div>
        <Link to={`${prefix}/eaisybooks/${id}/${dateRange}/tao/kiva`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Calculator className="w-3.5 h-3.5" /> KIVA összehasonlítás
          </Button>
        </Link>
      </div>


      {/* Stepper */}
      <TaoWizardStepper currentStep={step} onStepChange={setStep} />


      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step content */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-lg border border-border p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <currentStepDef.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {step}. {currentStepDef.label}
                </h2>
                <p className="text-xs text-muted-foreground">{currentStepDef.desc}</p>
              </div>
            </div>

            {/* TENY Integrációs Bannerek */}
            {step === 1 && tenySummary.totalAccountingDep > 0 && (
              <div className="mb-5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-950 dark:text-blue-200">
                      TENY Számviteli ÉCS elérhető ({taxYear}):
                    </span>{' '}
                    <span className="font-bold text-foreground">{fmt(tenySummary.totalAccountingDep)} Ft</span>
                    <span className="text-muted-foreground ml-1">({fixedAssets.length} eszköz alapján)</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyStep1Teny}
                  className="h-7 text-xs bg-white dark:bg-card border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Érték átvétele
                </Button>
              </div>
            )}

            {step === 3 && (tenySummary.totalReserveCreated > 0 || tenySummary.totalTaxDep > 0) && (
              <div className="mb-5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-950 dark:text-amber-200">
                      TENY és Tartalék nyilvántartás ({taxYear}):
                    </span>
                    <div className="text-[11px] text-muted-foreground mt-0.5 space-x-2">
                      {tenySummary.totalReserveCreated > 0 && (
                        <span>
                          Fejlesztési tartalék képzés (7.§ (1) f)): <strong>{fmt(tenySummary.totalReserveCreated)} Ft</strong>
                        </span>
                      )}
                      {tenySummary.totalTaxDep > 0 && (
                        <span>
                          Adó szerinti ÉCS (7.§ (1) d)): <strong>{fmt(tenySummary.totalTaxDep)} Ft</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyStep3Teny}
                  className="h-7 text-xs bg-white dark:bg-card border-amber-300 text-amber-700 hover:bg-amber-50 shrink-0"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Tételek átvétele
                </Button>
              </div>
            )}

            {step === 4 && tenySummary.depDiff > 0 && (
              <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-rose-950 dark:text-rose-200">
                      Számviteli-adó ÉCS különbözet (8.§ (1) b)):
                    </span>{' '}
                    <span className="font-bold text-foreground">{fmt(tenySummary.depDiff)} Ft</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Számviteli ÉCS ({fmt(tenySummary.totalAccountingDep)}) − Adó ÉCS ({fmt(tenySummary.totalTaxDep)})
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyStep4Teny}
                  className="h-7 text-xs bg-white dark:bg-card border-rose-300 text-rose-700 hover:bg-rose-50 shrink-0"
                >
                  Különbözet átvétele
                </Button>
              </div>
            )}

            {renderCurrentStep()}
          </div>


          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1))}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Előző lépés
            </Button>
            {step < 11 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Mentés
                </Button>
                <Button
                  onClick={() => { handleSave(); setStep(s => Math.min(11, s + 1)); }}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Tovább <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleSave} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Mentés és lezárás
              </Button>
            )}
          </div>
        </div>


        {/* Sidebar — summary */}
        <TaoWizardSidebar
          computed={computed}
          advancePayments={data.advance_payments}
          currentStep={step}
          onStepChange={setStep}
        />
      </div>
    </div>
  );
}
