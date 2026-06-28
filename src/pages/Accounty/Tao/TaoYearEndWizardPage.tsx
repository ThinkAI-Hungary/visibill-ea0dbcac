import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle, Calculator, FileText, TrendingUp,
  TrendingDown, Scale, Globe, Shield, Landmark, Heart, Send, Save,
  ChevronRight, AlertTriangle, Info, Loader2, Download, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';
import { useTaoYearly, useSaveTaoYearly } from '@/hooks/useAdminData';
import { toast } from '@/hooks/use-toast';
import {
  STEPS, DECREASING_ITEMS, INCREASING_ITEMS, CREDIT_ITEMS, DONATION_ITEMS,
  fmt, NumberInput,
} from './taoWizardData';
import type { TaoFormData, TaoComputed } from './taoWizardTypes';
import { RenderStep1, RenderStep2 } from './wizard-steps/TaoBasicInfoSteps';
import { RenderItemsStep, RenderStep5, RenderStep6 } from './wizard-steps/TaoAdjustmentSteps';
import { RenderStep7, RenderStep10, RenderStep11 } from './wizard-steps/TaoResultSteps';



// =============================================================================
// MAIN COMPONENT
// =============================================================================


export default function TaoYearEndWizardPage() {
  const { id, year } = useParams<{ id: string; year: string }>();
  const taxYear = parseInt(year || '2025', 10);
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);


  const [searchParams] = useSearchParams();
  const initialStep = Math.min(11, Math.max(1, parseInt(searchParams.get('step') || '1', 10)));
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [filingGenerated, setFilingGenerated] = useState(false);


  // DB hooks
  const companyUuid = client?.id; // actual UUID for DB
  const { data: savedData, isLoading: loadingData } = useTaoYearly(companyUuid, taxYear);
  const saveMutation = useSaveTaoYearly();


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
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
          <Landmark className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            TAO Éves Záró — {taxYear}
          </h1>
          <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'}</p>
        </div>
        <Link to={`/accounty/client/${id}/tao/kiva`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Calculator className="w-3.5 h-3.5" /> KIVA összehasonlítás
          </Button>
        </Link>
      </div>


      {/* Stepper */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const isDone = s.num < step;
          const isCurrent = s.num === step;
          return (
            <React.Fragment key={s.num}>
              <button
                onClick={() => setStep(s.num)}
                className="flex flex-col items-center min-w-[68px] group"
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  isDone ? 'bg-emerald-500 text-white' :
                  isCurrent ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                )}>
                  {isDone ? <CheckCircle className="w-4 h-4" /> : s.num}
                </div>
                <span className={cn(
                  'text-[10px] mt-1.5 text-center whitespace-nowrap',
                  isDone ? 'text-emerald-600 font-medium' :
                  isCurrent ? 'text-emerald-700 dark:text-emerald-300 font-bold' :
                  'text-slate-400'
                )}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 min-w-3 mt-[-12px]',
                  s.num < step ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>


      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step content */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <currentStepDef.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {step}. {currentStepDef.label}
                </h2>
                <p className="text-xs text-slate-500">{currentStepDef.desc}</p>
              </div>
            </div>
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
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft sticky top-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" /> Összesítő
            </h3>
            {[
              { label: 'AEE', value: computed.aee, step: 2 },
              { label: '7.§ csökkentők', value: -computed.decreasingTotal, step: 3, color: 'text-emerald-500' },
              { label: '8.§ növelők', value: computed.increasingTotal, step: 4, color: 'text-rose-500' },
              { label: 'Kamatkorlát korr.', value: computed.interestAdjustment, step: 5, color: 'text-amber-500' },
              { label: 'Adóalap', value: computed.taxBase, step: 7, bold: true },
              { label: 'Számított adó (9%)', value: computed.calculatedTax, step: 10 },
              { label: 'Kedvezmények', value: -computed.creditsTotal, step: 8, color: 'text-blue-500' },
              { label: 'Felajánlás', value: -computed.effectiveDonations, step: 9, color: 'text-purple-500' },
              { label: 'Előlegek', value: -data.advance_payments, step: 10, color: 'text-slate-500' },
            ].map((row, i) => (
              <button
                key={i}
                onClick={() => setStep(row.step)}
                className={cn(
                  'flex items-center justify-between w-full py-1.5 px-2 rounded-md text-left transition-colors',
                  row.step === step ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  row.bold && 'border-t border-border pt-3 mt-1'
                )}
              >
                <span className={cn('text-xs', row.bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-500')}>
                  {row.label}
                </span>
                <span className={cn('text-xs font-mono font-bold', row.color || 'text-slate-700 dark:text-slate-300')}>
                  {fmt(row.value)}
                </span>
              </button>
            ))}
            <div className="border-t-2 border-emerald-400 pt-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Fizetendő TAO</span>
                <span className="text-lg font-black text-emerald-600">{fmt(computed.payableTax)} Ft</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
