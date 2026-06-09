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
import { useAccountyClients } from '@/hooks/useAccountyData';
import { useTaoYearly, useSaveTaoYearly } from '@/hooks/useAdminData';
import { toast } from '@/hooks/use-toast';

// ── Step Definitions ──
const STEPS = [
  { num: 1,  label: 'Beszámoló',   icon: FileText,      desc: 'Eredménykimutatás alapadatok' },
  { num: 2,  label: 'AEE',         icon: Calculator,    desc: 'Adózás előtti eredmény' },
  { num: 3,  label: '7.§ csökk.',  icon: TrendingDown,  desc: 'Adóalap-csökkentő tételek' },
  { num: 4,  label: '8.§ növ.',    icon: TrendingUp,    desc: 'Adóalap-növelő tételek' },
  { num: 5,  label: 'Kamatkorlát', icon: Scale,         desc: 'EBITDA 30% szabály' },
  { num: 6,  label: 'CFC',         icon: Globe,         desc: 'Ellenőrzött külföldi társaság' },
  { num: 7,  label: 'Adóalap',     icon: Calculator,    desc: 'Módosított adóalap kiszámítása' },
  { num: 8,  label: 'Kedvezm.',    icon: Shield,        desc: 'Adókedvezmények' },
  { num: 9,  label: 'Felajánlás',  icon: Heart,         desc: 'Látvány-csapatsport, film' },
  { num: 10, label: 'Fizetendő',   icon: Landmark,      desc: 'Fizetendő TAO összeg' },
  { num: 11, label: 'Beküldés',    icon: Send,          desc: '29-es bevallás generálás' },
];

// ── 7.§ Csökkentő tételek ──
const DECREASING_ITEMS = [
  { key: 'rd_allowance', label: 'Kutatás-fejlesztés (K+F) közvetlen költsége', hint: 'Tao tv. 7.§ (1) t)' },
  { key: 'investment_allowance', label: 'Fejlesztési tartalék', hint: 'Tao tv. 7.§ (1) f)' },
  { key: 'provision_release', label: 'Céltartalék felszabadítás', hint: 'Tao tv. 7.§ (1) ly)' },
  { key: 'royalty_income', label: 'Szellemi tulajdon (IP) bevétel 50%-a', hint: 'Tao tv. 7.§ (1) s)' },
  { key: 'donation_allowance', label: 'Közérdekű adomány 20%-a (max AEE 50%)', hint: 'Tao tv. 7.§ (1) z)' },
  { key: 'sme_investment', label: 'KKV beruházási kedvezmény', hint: 'Tao tv. 7.§ (1) zs)' },
  { key: 'depreciation_tax', label: 'Adó szerinti értékcsökkenés', hint: 'Tao tv. 7.§ (1) d)' },
  { key: 'other', label: 'Egyéb csökkentő tételek', hint: '' },
];

// ── 8.§ Növelő tételek ──
const INCREASING_ITEMS = [
  { key: 'depreciation_diff', label: 'Számviteli-adó ÉCS különbözet', hint: 'Tao tv. 8.§ (1) b)' },
  { key: 'thin_cap', label: 'Alultőkésítés miatti kamatkorrekció', hint: 'Tao tv. 8.§ (1) j)' },
  { key: 'transfer_pricing', label: 'Transzferár-korrekció', hint: 'Tao tv. 18.§' },
  { key: 'penalty_fine', label: 'Bírság, pótlék, büntetés', hint: 'Tao tv. 8.§ (1) d)' },
  { key: 'non_deductible', label: 'Nem elismert költségek', hint: 'Tao tv. 8.§ (1) a)' },
  { key: 'provision_formed', label: 'Céltartalék képzés', hint: 'Tao tv. 8.§ (1) a)' },
  { key: 'representation', label: 'Reprezentáció nem elismert része', hint: 'Tao tv. 3. mell. B/3.' },
  { key: 'other', label: 'Egyéb növelő tételek', hint: '' },
];

// ── Adókedvezmények ──
const CREDIT_ITEMS = [
  { key: 'development', label: 'Fejlesztési adókedvezmény', hint: 'Tao tv. 22/B.§' },
  { key: 'energy_efficiency', label: 'Energiahatékonysági beruházás', hint: 'Tao tv. 22/E.§' },
  { key: 'performing_arts', label: 'Előadó-művészeti kedvezmény', hint: 'Tao tv. 22/C.§' },
  { key: 'sports_development', label: 'Sportfejlesztési kedvezmény', hint: 'Tao tv. 22/C.§' },
  { key: 'small_business', label: 'KKV adókedvezmény', hint: 'Tao tv. 22/A.§' },
  { key: 'other', label: 'Egyéb kedvezmények', hint: '' },
];

// ── Felajánlás ──
const DONATION_ITEMS = [
  { key: 'spectator_sports', label: 'Látvány-csapatsport (TAO felajánlás)', hint: 'max. a számított adó 80%-a' },
  { key: 'film', label: 'Filmalkotás, előadó-művészet', hint: 'max. a számított adó 80%-a' },
];

// ── Helper: format currency ──
const fmt = (n: number) => new Intl.NumberFormat('hu-HU', { style: 'decimal', maximumFractionDigits: 0 }).format(n);

// ── NumberInput component ──
function NumberInput({ value, onChange, label, hint, suffix = 'Ft' }: {
  value: number; onChange: (v: number) => void; label: string; hint?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
        {label}
        {hint && <span className="ml-1 text-slate-400 font-normal">({hint})</span>}
      </label>
      <div className="relative">
        <Input
          type="text"
          value={value === 0 ? '' : fmt(value)}
          onChange={e => {
            const raw = e.target.value.replace(/[^\d-]/g, '');
            onChange(raw ? parseInt(raw, 10) : 0);
          }}
          className="bg-background pr-10 text-right font-mono"
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════

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

  // ── Render Steps ──

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Az eredménykimutatás fősorait töltse ki — az AEE automatikusan számolódik a következő lépésben.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput label="Értékesítés nettó árbevétele" value={data.revenue} onChange={v => upd('revenue', v)} />
        <NumberInput label="Egyéb bevételek" value={data.other_revenue} onChange={v => upd('other_revenue', v)} />
        <NumberInput label="Anyagjellegű ráfordítások" value={data.material_costs} onChange={v => upd('material_costs', v)} />
        <NumberInput label="Személyi jellegű ráfordítások" value={data.personnel_costs} onChange={v => upd('personnel_costs', v)} />
        <NumberInput label="Értékcsökkenési leírás" value={data.depreciation} onChange={v => upd('depreciation', v)} />
        <NumberInput label="Egyéb ráfordítások" value={data.other_costs} onChange={v => upd('other_costs', v)} />
        <NumberInput label="Pénzügyi eredmény (+/-)" value={data.financial_result} onChange={v => upd('financial_result', v)} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800">
        <p className="text-xs text-slate-500 mb-1">Adózás Előtti Eredmény (AEE)</p>
        <p className={cn('text-4xl font-black', computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {fmt(computed.aee)} Ft
        </p>
        <p className="text-xs text-slate-400 mt-2">= Bevételek ({fmt(computed.totalRevenue)}) − Költségek ({fmt(computed.totalCosts)}) + Pénzügyi ({fmt(data.financial_result)})</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Összbevétel</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.totalRevenue)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Összköltség</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.totalCosts)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Pénzügyi eredmény</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(data.financial_result)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">AEE</p>
          <p className={cn('text-sm font-bold', computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{fmt(computed.aee)} Ft</p>
        </div>
      </div>
    </div>
  );

  const renderItemsStep = (
    items: typeof DECREASING_ITEMS,
    group: 'decreasing' | 'increasing' | 'credits' | 'donations',
    total: number,
    color: string,
  ) => (
    <div className="space-y-4">
      {items.map(item => (
        <NumberInput
          key={item.key}
          label={item.label}
          hint={item.hint}
          value={data[group][item.key] || 0}
          onChange={v => updItem(group, item.key, v)}
        />
      ))}
      <div className={cn('rounded-lg p-4 border', color)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Összesen:</span>
          <span className="text-lg font-black">{fmt(total)} Ft</span>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-5">
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          A nettó finanszírozási költség maximum az EBITDA 30%-áig vonható le (Tao tv. 8.§ (1) j) pont). Az e feletti rész növelő tételként jelentkezik.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput label="Nettó kamatráfordítás" value={data.interest_expense} onChange={v => upd('interest_expense', v)} />
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">EBITDA (számított)</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-border px-3 py-2 text-sm font-mono text-right">
            {fmt(computed.ebitda)} Ft
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[10px] text-slate-500">EBITDA × 30%</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(computed.interestLimit)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[10px] text-slate-500">Kamatráfordítás</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{fmt(data.interest_expense)} Ft</p>
        </div>
        <div className={cn('rounded-lg border p-4', computed.interestAdjustment > 0 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200')}>
          <p className="text-[10px] text-slate-500">Korrekció</p>
          <p className={cn('text-sm font-bold', computed.interestAdjustment > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {computed.interestAdjustment > 0 ? '+' : ''}{fmt(computed.interestAdjustment)} Ft
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.has_cfc}
            onChange={e => upd('has_cfc', e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Van ellenőrzött külföldi társaság (CFC)?</span>
        </label>
      </div>
      {!data.has_cfc && (
        <div className="py-12 text-center text-sm text-slate-400">
          <Globe className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          Nincs CFC érintettség — továbbléphet.
        </div>
      )}
      {data.has_cfc && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              CFC (Controlled Foreign Company) szabályok — Tao tv. 4.§ 11. pont. Az alacsony adókulcsú (ETR &lt; 9%) külföldi leányvállalat jövedelme hozzáadódik az adóalaphoz.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Székhely országa</label>
              <Input value={data.cfc_country} onChange={e => upd('cfc_country', e.target.value)} className="bg-background" placeholder="pl. Ciprus" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Társaság neve</label>
              <Input value={data.cfc_company} onChange={e => upd('cfc_company', e.target.value)} className="bg-background" placeholder="pl. XYZ Holdings Ltd" />
            </div>
            <NumberInput label="CFC jövedelem" value={data.cfc_income} onChange={v => upd('cfc_income', v)} />
            <NumberInput label="Helyi effektív adókulcs (%)" value={data.cfc_tax_rate} onChange={v => upd('cfc_tax_rate', v)} suffix="%" />
          </div>
          {data.cfc_tax_rate > 0 && data.cfc_tax_rate < 9 && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-700 dark:text-rose-300">
                <strong>CFC érintettség!</strong> A helyi ETR ({data.cfc_tax_rate}%) alacsonyabb, mint a magyar TAO kulcs (9%). A CFC jövedelem ({fmt(data.cfc_income)} Ft) hozzáadódik a magyar adóalaphoz.
              </p>
            </div>
          )}
          {data.cfc_tax_rate >= 9 && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                A helyi ETR ({data.cfc_tax_rate}%) eléri a 9%-ot — nincs CFC korrekciós kötelezettség.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
        <p className="text-xs text-slate-500 mb-1">Módosított adóalap</p>
        <p className={cn('text-4xl font-black', computed.taxBase > 0 ? 'text-indigo-600' : 'text-slate-400')}>
          {fmt(computed.taxBase)} Ft
        </p>
      </div>
      <div className="space-y-2">
        {[
          { label: 'AEE', value: computed.aee, color: computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600' },
          { label: '+ 8.§ növelő tételek', value: computed.increasingTotal, color: 'text-rose-500' },
          { label: '− 7.§ csökkentő tételek', value: -computed.decreasingTotal, color: 'text-emerald-500' },
          { label: '+ Kamatkorlát korrekció', value: computed.interestAdjustment, color: 'text-amber-500' },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
            <span className={cn('text-sm font-bold font-mono', row.color)}>{fmt(row.value)} Ft</span>
          </div>
        ))}
        <div className="border-t border-border pt-2 mt-2">
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">= Módosított adóalap</span>
            <span className="text-lg font-black text-indigo-600">{fmt(computed.modifiedTaxBase)} Ft</span>
          </div>
          {computed.modifiedTaxBase < 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <span className="text-sm text-emerald-600">= Adóalap (min. 0)</span>
              <span className="text-lg font-black text-emerald-600">0 Ft</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep10 = () => (
    <div className="space-y-5">
      <NumberInput label="Befizetett adóelőlegek" value={data.advance_payments} onChange={v => upd('advance_payments', v)} />
      <div className="space-y-3 bg-card rounded-xl border border-border p-5">
        {[
          { label: 'Adóalap', value: computed.taxBase },
          { label: '× 9% TAO kulcs', value: computed.calculatedTax },
          { label: '− Adókedvezmények', value: -computed.creditsTotal },
          { label: '− Felajánlások', value: -computed.effectiveDonations },
          { label: '− Adóelőlegek', value: -data.advance_payments },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{fmt(row.value)} Ft</span>
          </div>
        ))}
        <div className="border-t-2 border-emerald-300 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">= Fizetendő TAO</span>
            <span className={cn('text-2xl font-black', computed.payableTax > 0 ? 'text-emerald-600' : 'text-slate-400')}>
              {fmt(computed.payableTax)} Ft
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const handleGenerateFiling = () => {
    setFilingGenerated(true);
    toast({
      title: '29-es bevallás generálva',
      description: `${taxYear}. adóévi TAO bevallás (2929) sikeresen elkészült. Fizetendő: ${fmt(computed.payableTax)} Ft`,
    });
    // Save filing status to DB
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

  const renderStep11 = () => (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">TAO Kalkuláció Kész</h3>
        <p className="text-sm text-slate-500">A {taxYear}. adóévi társasági adó kiszámítása befejeződött.</p>
        <p className="text-3xl font-black text-emerald-600 mt-4">{fmt(computed.payableTax)} Ft</p>
        <p className="text-xs text-slate-400 mt-1">fizetendő társasági adó</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">AEE</p>
          <p className="text-sm font-bold">{fmt(computed.aee)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Adóalap</p>
          <p className="text-sm font-bold">{fmt(computed.taxBase)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Számított adó</p>
          <p className="text-sm font-bold">{fmt(computed.calculatedTax)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Kedvezmények</p>
          <p className="text-sm font-bold text-blue-600">{fmt(computed.creditsTotal + computed.effectiveDonations)} Ft</p>
        </div>
      </div>

      {/* 29-es bevallás generálás */}
      {!filingGenerated ? (
        <Button onClick={handleGenerateFiling} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="lg">
          <Send className="w-4 h-4" /> 29-es bevallás generálása
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Bevallás generálva</p>
              <p className="text-xs text-slate-500">2929 TAO bevallás — {taxYear}. adóév</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={() => {
              const companyName = client?.name || 'Ügyfél';
              const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>2929 TAO Bevallás - ${taxYear}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
  h1{font-size:22px;border-bottom:3px solid #059669;padding-bottom:8px;color:#059669}
  h2{font-size:16px;margin-top:24px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .meta{background:#f8fafc;padding:12px;border-radius:8px;margin:12px 0;font-size:13px;border:1px solid #e2e8f0}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{text-align:left;padding:6px 8px;font-size:13px}
  td:last-child{text-align:right;font-family:monospace;font-weight:bold}
  tr:nth-child(even){background:#f8fafc}
  .total{border-top:2px solid #059669;font-weight:bold;font-size:15px}
  .total td{padding-top:10px;color:#059669}
  .big{font-size:28px;text-align:center;color:#059669;font-weight:900;margin:20px 0}
  .footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
<h1>Társasági adó bevallás (2929) — ${taxYear}. adóév</h1>
<div class="meta">
  <strong>Adózó:</strong> ${companyName}<br>
  <strong>Adóév:</strong> ${taxYear}<br>
  <strong>Generálva:</strong> ${new Date().toLocaleDateString('hu-HU')} ${new Date().toLocaleTimeString('hu-HU')}
</div>
<h2>1. Eredménykimutatás</h2>
<table>
  <tr><td>Értékesítés nettó árbevétele</td><td>${fmt(data.revenue)} Ft</td></tr>
  <tr><td>Egyéb bevételek</td><td>${fmt(data.other_revenue)} Ft</td></tr>
  <tr><td>Anyagjellegű ráfordítások</td><td>${fmt(data.material_costs)} Ft</td></tr>
  <tr><td>Személyi jellegű ráfordítások</td><td>${fmt(data.personnel_costs)} Ft</td></tr>
  <tr><td>Értékcsökkenési leírás</td><td>${fmt(data.depreciation)} Ft</td></tr>
  <tr><td>Egyéb ráfordítások</td><td>${fmt(data.other_costs)} Ft</td></tr>
  <tr><td>Pénzügyi eredmény</td><td>${fmt(data.financial_result)} Ft</td></tr>
</table>
<h2>2. Adózás Előtti Eredmény (AEE)</h2>
<table><tr class="total"><td>AEE</td><td>${fmt(computed.aee)} Ft</td></tr></table>
<h2>3. Adóalap-korrekciók</h2>
<table>
  <tr><td>7.§ csökkentő tételek összesen</td><td>-${fmt(computed.decreasingTotal)} Ft</td></tr>
  <tr><td>8.§ növelő tételek összesen</td><td>+${fmt(computed.increasingTotal)} Ft</td></tr>
  <tr><td>Kamatkorlát korrekció</td><td>+${fmt(computed.interestAdjustment)} Ft</td></tr>
  <tr class="total"><td>Módosított adóalap</td><td>${fmt(computed.taxBase)} Ft</td></tr>
</table>
<h2>4. Adószámítás</h2>
<table>
  <tr><td>Adóalap</td><td>${fmt(computed.taxBase)} Ft</td></tr>
  <tr><td>TAO kulcs</td><td>9%</td></tr>
  <tr><td>Számított adó</td><td>${fmt(computed.calculatedTax)} Ft</td></tr>
  <tr><td>Adókedvezmények</td><td>-${fmt(computed.creditsTotal)} Ft</td></tr>
  <tr><td>Felajánlás</td><td>-${fmt(computed.effectiveDonations)} Ft</td></tr>
  <tr><td>Befizetett előlegek</td><td>-${fmt(data.advance_payments)} Ft</td></tr>
  <tr class="total"><td>Fizetendő TAO</td><td>${fmt(computed.payableTax)} Ft</td></tr>
</table>
<div class="footer">
  Generálva: Accounty TAO modul — ${new Date().toISOString()}<br>
  Ez a dokumentum nem helyettesíti a NAV felé benyújtandó hivatalos 29-es bevallást.
</div>
</body></html>`;
              const blob = new Blob([html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              // Open print dialog for PDF save
              const printWin = window.open(url, '_blank');
              if (printWin) {
                printWin.addEventListener('load', () => {
                  setTimeout(() => printWin.print(), 300);
                });
              }
              toast({ title: 'PDF generálva', description: 'A nyomtatási ablakban válaszd a "Mentés PDF-ként" opciót.' });
            }}>
              <Download className="w-4 h-4" /> PDF letöltés
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              const companyName = client?.name || 'Ügyfél';
              const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bevallas xmlns="http://www.nav.gov.hu/2929" adoev="${taxYear}">
  <adozo>
    <nev>${companyName}</nev>
  </adozo>
  <eredmenykimutatas>
    <arbev>${data.revenue}</arbev>
    <egyeb_bev>${data.other_revenue}</egyeb_bev>
    <anyag_kts>${data.material_costs}</anyag_kts>
    <szemelyi_kts>${data.personnel_costs}</szemelyi_kts>
    <ecs>${data.depreciation}</ecs>
    <egyeb_kts>${data.other_costs}</egyeb_kts>
    <penzugyi>${data.financial_result}</penzugyi>
  </eredmenykimutatas>
  <adoalap>
    <aee>${computed.aee}</aee>
    <csokkentok>${computed.decreasingTotal}</csokkentok>
    <novelok>${computed.increasingTotal}</novelok>
    <kamatkorlat>${computed.interestAdjustment}</kamatkorlat>
    <modositott>${computed.modifiedTaxBase}</modositott>
    <adoalap>${computed.taxBase}</adoalap>
  </adoalap>
  <adoszamitas>
    <szamitott_ado>${computed.calculatedTax}</szamitott_ado>
    <kedvezmenyek>${computed.creditsTotal}</kedvezmenyek>
    <felajanlas>${computed.effectiveDonations}</felajanlas>
    <elolegek>${data.advance_payments}</elolegek>
    <fizetendo>${computed.payableTax}</fizetendo>
  </adoszamitas>
</bevallas>`;
              const blob = new Blob([xml], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `2929_TAO_${taxYear}_${companyName.replace(/\s+/g, '_')}.xml`;
              a.click();
              URL.revokeObjectURL(url);
              toast({ title: 'XML letöltve', description: `2929_TAO_${taxYear}.xml — importálható az ÁNYK keretprogramba` });
            }}>
              <FileText className="w-4 h-4" /> ÁNYK XML export
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderItemsStep(DECREASING_ITEMS, 'decreasing', computed.decreasingTotal, 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800');
      case 4: return renderItemsStep(INCREASING_ITEMS, 'increasing', computed.increasingTotal, 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800');
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderItemsStep(CREDIT_ITEMS, 'credits', computed.creditsTotal, 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800');
      case 9: return renderItemsStep(DONATION_ITEMS, 'donations', computed.donationsTotal, 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800');
      case 10: return renderStep10();
      case 11: return renderStep11();
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
