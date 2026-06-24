import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FinancialPageSkeleton } from '@/components/ui/financial-skeleton';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronRight, ChevronLeft, FileText, Download, RefreshCw,
  ClipboardCheck, BookOpen, DollarSign, Upload, Shield, Database,
  Lock, Unlock, Plus, Trash2, RotateCcw, ExternalLink, Eye
} from 'lucide-react';
import { generateAnnualReportPdf, generateAnnualReportPreviewUrl } from '@/lib/annualReportPdf';
import { downloadEBeszamoloCsv, E_BESZAMOLO_PORTAL_URL } from '@/lib/annualReportCsv';
import { useFixedAssets } from '@/hooks/useFixedAssets';
import { useScopedNavigate } from '@/lib/navigation';
import { useExchangeRates } from '@/hooks/useExchangeRates';


// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface AnnualReport {
  id: string;
  company_id: string;
  preset_id: string;
  fiscal_year: number;
  status: string;
  representative_name: string | null;
  representative_role: string | null;
  report_date: string | null;
  frozen_bs_data: any[] | null;
  frozen_pnl_data: any[] | null;
  frozen_at: string | null;
  validation_results: any[];
  validated_at: string | null;
  notes_sections: any[];
  net_income: number;
  dividend_amount: number;
  retained_earnings: number;
  dividend_resolution_date: string | null;
  dividend_resolution_number: string | null;
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ═══════════════════════════════════════════
// Step definitions
// ═══════════════════════════════════════════
const STEPS = [
  { id: 1, title: 'Alapadatok', icon: FileText, description: 'Év, cégadatok, képviselő' },
  { id: 2, title: 'Adatimport', icon: Database, description: 'Mérleg & P&L befagyasztás' },
  { id: 3, title: 'Validáció', icon: Shield, description: 'Törvényi ellenőrzések' },
  { id: 4, title: 'Kieg. Melléklet', icon: BookOpen, description: 'Szöveges sablonok' },
  { id: 5, title: 'Osztalék', icon: DollarSign, description: 'Eredményfelosztás' },
  { id: 6, title: 'Export', icon: Download, description: 'PDF letöltés, zárás' },
];

const STEP_HINTS: Record<number, string> = {
  1: 'Töltsd ki a céges alapadatokat és a képviselő nevét. Ezek az adatok a végleges PDF borítójára kerülnek.',
  2: 'Fagyaszd be a Mérleg és Eredménykimutatás adatait. Ez egy pillanatfelvételt készít a főkönyvi adatokból.',
  3: 'Futtasd le az automatikus ellenőrzéseket. A rendszer ellenőrzi a mérlegegyezőséget, az EK-Mérleg összhangot és a kitöltöttséget.',
  4: 'Szerkeszd a Kiegészítő Melléklet szöveges sablonjait. A {{változónevek}} automatikusan behelyettesítődnek a PDF-ben.',
  5: 'Ha volt nyereség, itt dönthetsz az osztalékról és az eredménytartalékba helyezésről.',
  6: 'Ellenőrizd az összefoglaló checklistet, töltsd le a PDF-et, majd véglegesítsd a beszámolót.',
};

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function AnnualReportPage() {
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scopedNavigate = useScopedNavigate();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentStep, setCurrentStep] = useState(1);
  const { data: exchangeRates } = useExchangeRates();

  // B11: Fetch all reports for this company (for history/archive)
  const { data: allReports } = useQuery({
    queryKey: ['annual_reports_all', selectedCompany?.id, activePresetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return [];
      const { data, error } = await supabase
        .from('annual_reports')
        .select('id, fiscal_year, status, frozen_at, validated_at, created_at, updated_at')
        .eq('company_id', selectedCompany.id)
        .eq('preset_id', activePresetId)
        .order('fiscal_year', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!activePresetId
  });


  // ── Fetch or create report ──
  const { data: report, isLoading: isLoadingReport } = useQuery({
    queryKey: ['annual_report', selectedCompany?.id, activePresetId, selectedYear],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return null;

      const { data, error } = await supabase
        .from('annual_reports')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('preset_id', activePresetId)
        .eq('fiscal_year', selectedYear)
        .maybeSingle();

      if (error) throw error;
      return data as AnnualReport | null;
    },
    enabled: !!selectedCompany?.id && !!activePresetId
  });

  // ── Create report mutation ──
  const createReport = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !activePresetId) throw new Error('Missing data');
      const { data, error } = await supabase
        .from('annual_reports')
        .insert({
          company_id: selectedCompany.id,
          preset_id: activePresetId,
          fiscal_year: selectedYear,
          created_by: session?.user?.id,
          representative_name: selectedCompany?.name || '',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      toast({ title: 'Beszámoló létrehozva', description: `${selectedYear}. évi beszámoló elkezdve.` });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Update report mutation ──
  const updateReport = useMutation({
    mutationFn: async (updates: Partial<AnnualReport>) => {
      if (!report?.id) throw new Error('No report');
      const { error } = await supabase
        .from('annual_reports')
        .update(updates as any)
        .eq('id', report.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annual_report'] })
  });

  // ── Debounced field editing (prevents lag from per-keystroke DB writes) ──
  const [draftFields, setDraftFields] = useState<Record<string, any>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setField = useCallback((field: string, value: any, extras?: Record<string, any>) => {
    setDraftFields(prev => ({ ...prev, [field]: value, ...extras }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDraftFields(prev => {
        const updates = { ...prev };
        updateReport.mutate(updates as any);
        return {}; // clear draft after flush
      });
    }, 800);
  }, [updateReport]);

  // Flush on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Helper: get field value (draft takes priority over server)
  const getField = (field: keyof AnnualReport) => {
    return field in draftFields ? draftFields[field] : report?.[field];
  };

  // ── Freeze data mutation ──
  const freezeData = useMutation({
    mutationFn: async () => {
      if (!report?.id || !selectedCompany?.id || !activePresetId) throw new Error('Missing');
      const { data, error } = await supabase.rpc('freeze_annual_data', {
        p_report_id: report.id,
        p_company_id: selectedCompany.id,
        p_preset_id: activePresetId,
        p_fiscal_year: selectedYear,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      toast({
        title: 'Adatok befagyasztva',
        description: `Mérleg: ${data?.bs_row_count || 0} sor, P&L: ${data?.pnl_row_count || 0} sor`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Validate mutation ──
  const validateReport = useMutation({
    mutationFn: async () => {
      if (!report?.id) throw new Error('No report');
      const { data, error } = await supabase.rpc('validate_annual_report', {
        p_report_id: report.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      const passed = data?.all_passed;
      const results: any[] = data?.results || [];
      const errors = results.filter((r: any) => r.severity === 'error' && !r.passed);
      const warnings = results.filter((r: any) => r.severity === 'warning' && !r.passed);

      if (passed) {
        toast({
          title: '✓ Minden ellenőrzés sikeres!',
          description: `${results.length} szabály ellenőrizve — a beszámoló megfelel a követelményeknek.`,
        });
      } else {
        toast({
          title: 'Ellenőrzés kész',
          description: `${errors.length} hiba${warnings.length > 0 ? `, ${warnings.length} figyelmeztetés` : ''} — lásd a részleteket lent.`,
        });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Notes templates ──
  const { data: notesTemplates } = useQuery({
    queryKey: ['notes_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_report_notes_templates')
        .select('*')
        .order('order_num');
      if (error) throw error;
      return data;
    }
  });

  // ── Fixed Assets (TENY) for dynamic table ──
  const { data: fixedAssets } = useQuery({
    queryKey: ['fixedAssets', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('id, name, acquisition_value, residual_value, status, activation_date, disposal_date, useful_life_months, currency')
        .eq('company_id', selectedCompany.id);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id
  });

  // ── Salary data for headcount/cost table ──
  const { data: salaryData } = useQuery({
    queryKey: ['salary_annual', selectedCompany?.id, selectedYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('salary')
        .select('id, név, összeg, tipus, munkavallalo_neve, dátum')
        .eq('company_id', selectedCompany.id)
        .gte('dátum', `${selectedYear}-01-01`)
        .lte('dátum', `${selectedYear}-12-31`);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id
  });

  // ── Computed: salary metrics for the fiscal year ──
  const salaryMetrics = useMemo(() => {
    if (!salaryData || salaryData.length === 0) return null;
    const employees = new Set(salaryData.filter((s: any) => s.munkavallalo_neve).map((s: any) => s.munkavallalo_neve));
    const totalWages = salaryData.filter((s: any) => s.tipus === 'bér').reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
    const totalContrib = salaryData.filter((s: any) => s.tipus === 'járulék').reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
    return { headcount: employees.size, totalWages, totalContrib, total: totalWages + totalContrib };
  }, [salaryData]);

  // ── Computed: fixed asset movement table ──
  const assetMovement = useMemo(() => {
    if (!fixedAssets || fixedAssets.length === 0) return null;
    const active = fixedAssets.filter((a: any) => a.status === 'active');
    const disposed = fixedAssets.filter((a: any) => a.status === 'disposed' || a.status === 'sold');
    const totalAcquisition = fixedAssets.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
    const activeAcquisition = active.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
    return { total: fixedAssets.length, active: active.length, disposed: disposed.length, totalAcquisition, activeAcquisition };
  }, [fixedAssets]);

  // ── Computed: equity rows from frozen BS ──
  const equityRows = useMemo(() => {
    if (!report?.frozen_bs_data) return [];
    return (report.frozen_bs_data as any[]).filter((r: any) =>
      r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type !== 'total'
    );
  }, [report?.frozen_bs_data]);

  // ── Financial metrics from frozen data (for variable substitution) ──
  const financialMetrics = useMemo(() => {
    const bs = (report?.frozen_bs_data as any[]) || [];
    const totalAssets = bs.filter((r: any) => r.section === 'assets' && r.type === 'total')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const totalLiabilities = bs.filter((r: any) => r.section === 'liabilities' && r.type === 'total')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const equityTotal = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const equityPrior = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.prior_year_balance || 0), 0);
    const currentAssets = bs.filter((r: any) => r.section === 'assets' && (r.row_code || '').startsWith('B') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const shortTermLiab = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('F') && r.type === 'letter')
      .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
    const netIncome = report?.net_income || 0;
    const roe = equityTotal > 0 ? ((netIncome / equityTotal) * 100).toFixed(1) : '0.0';
    const liquidity = shortTermLiab > 0 ? (currentAssets / shortTermLiab).toFixed(2) : 'N/A';
    const equityChange = equityTotal >= equityPrior ? 'növekedett' : 'csökkent';
    const liquidityEval = Number(liquidity) >= 1.3 ? 'biztonsággal fedezik' : Number(liquidity) >= 1.0 ? 'éppen fedezik' : 'nem fedezik';
    return { totalAssets, totalLiabilities, equityTotal, equityPrior, equityChange, roe, liquidity, liquidityEval, netIncome };
  }, [report?.frozen_bs_data, report?.net_income]);

  // ── Dynamic variable replacement for notes templates ──
  const replaceVariables = (text: string): string => {
    const vars: Record<string, string> = {
      '[Cégnév]': selectedCompany?.name || '___',
      '[Székhely]': selectedCompany?.address || '___',
      '[Adószám]': selectedCompany?.tax_number || '___',
      '[Tárgyév]': String(selectedYear),
      '[Tárgyév+1]': String(selectedYear + 1),
      '[Képviselő neve]': report?.representative_name || '___',
      '[Képviselő beosztása]': report?.representative_role || 'ügyvezető',
      '[Saját tőke]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.equityTotal / 1000)),
      '[Saját tőke változás]': financialMetrics.equityChange,
      '[Mérlegfőösszeg]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.totalAssets / 1000)),
      '[ROE]': financialMetrics.roe,
      '[Likviditás]': financialMetrics.liquidity,
      '[Likviditás értékelés]': financialMetrics.liquidityEval,
      '[Adózott eredmény]': new Intl.NumberFormat('hu-HU').format(Math.round(financialMetrics.netIncome / 1000)),
      '[Osztalék]': new Intl.NumberFormat('hu-HU').format(Math.round((report?.dividend_amount || 0) / 1000)),
      '[Eredménytartalék]': new Intl.NumberFormat('hu-HU').format(Math.round((report?.retained_earnings || 0) / 1000)),
    };
    let result = text;
    for (const [key, val] of Object.entries(vars)) {
      result = result.split(key).join(val);
    }
    return result;
  };

  // ── Custom sections state ──
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // ── PDF Preview state (B2) ──
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  // ── Loading state ──
  if (isLoadingReport) {
    return <FinancialPageSkeleton title="Beszámoló betöltése..." />;
  }

  // ── No report yet → show create ──
  if (!report) {
    return (
      <div className="max-w-2xl mx-auto py-12 page-animate">
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 text-primary p-4 rounded-2xl w-fit mb-4">
              <ClipboardCheck className="w-10 h-10" />
            </div>
            <CardTitle className="text-2xl">Éves Beszámoló Varázsló</CardTitle>
            <p className="text-muted-foreground mt-2">
              Készítsd el a {selectedYear}. évi beszámolót lépésről lépésre.
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div className="flex items-center gap-4 justify-center">
              <Label className="font-medium">Üzleti év:</Label>
              <div className="flex items-center gap-2">
                {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                  <Button
                    key={y}
                    variant={selectedYear === y ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedYear(y)}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              className="w-full h-12 text-base"
              onClick={() => createReport.mutate()}
              disabled={createReport.isPending}
            >
              {createReport.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileText className="w-5 h-5 mr-2" />}
              Beszámoló indítása — {selectedYear}
            </Button>

            {/* B11: Archive — previous years */}
            {allReports && allReports.length > 0 && (
              <div className="border-t border-border/40 pt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Korábbi beszámolók</p>
                <div className="space-y-2">
                  {allReports.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedYear(r.fiscal_year); setCurrentStep(1); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/40 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                        r.status === 'finalized' ? 'bg-emerald-500/10 text-emerald-600' :
                        r.frozen_at ? 'bg-blue-500/10 text-blue-600' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {r.fiscal_year}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{r.fiscal_year}. évi beszámoló</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.status === 'finalized' ? 'Véglegesítve' : r.frozen_at ? 'Befagyasztva' : 'Vázlat'}
                          {' • '}
                          {new Date(r.updated_at).toLocaleDateString('hu-HU')}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Wizard view ──
  const validationResults: ValidationResult[] = (report.validation_results as any[]) || [];

  const isStepCompleted = (stepId: number) => {
    switch (stepId) {
      case 1:
        return !!report.representative_name;
      case 2:
        return !!report.frozen_at;
      case 3:
        return !!report.validated_at && validationResults.every(r => r.passed || r.severity !== 'error');
      case 4:
        return ((report.notes_sections as any[]) || []).length > 0;
      case 5:
        return report.net_income <= 0 || report.dividend_amount > 0 || report.dividend_resolution_number !== null;
      case 6:
        return report.status === 'finalized';
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6 page-animate">
      {/* B11: Year selector + Stepper */}
      <div className="bg-muted/30 p-2 rounded-xl border border-border/50 print:hidden overflow-hidden">
        {/* Year tabs (B11) */}
        {allReports && allReports.length > 1 && (
          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-border/30">
            <span className="text-[10px] text-muted-foreground font-medium px-2">Év:</span>
            {allReports.map((r: any) => (
              <button
                key={r.fiscal_year}
                onClick={() => setSelectedYear(r.fiscal_year)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  selectedYear === r.fiscal_year
                    ? "bg-primary text-primary-foreground"
                    : r.status === 'finalized'
                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {r.fiscal_year}
                {r.status === 'finalized' && ' ✓'}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = isStepCompleted(step.id);

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all flex-1 min-w-0",
                    isActive ? "bg-primary text-primary-foreground shadow-lg" :
                    isCompleted ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" :
                    "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                    isActive ? "bg-primary-foreground/20" : isCompleted ? "bg-emerald-500/20" : "bg-muted"
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-bold truncate">{step.id}. {step.title}</div>
                    <div className="text-[9px] opacity-70 truncate hidden xl:block">{step.description}</div>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* ── Progress Bar (B1) ── */}
        {(() => {
          const stepsDone = [
            !!(report.representative_name && report.report_date), // step 1
            !!report.frozen_at, // step 2
            !!report.validated_at, // step 3
            ((report.notes_sections as any[]) || []).length > 0 || (notesTemplates && notesTemplates.length > 0), // step 4
            report.net_income <= 0 || (report.dividend_amount >= 0), // step 5
            report.status === 'finalized', // step 6
          ];
          const completedCount = stepsDone.filter(Boolean).length;
          const pct = Math.round((completedCount / 6) * 100);
          return (
            <div className="mt-2 print:hidden">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{completedCount}/6 lépés kész</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Step content */}
      <Card className="border-border/60 shadow-md">
        <CardContent className="p-6 overflow-hidden">
          <div key={currentStep} className="step-animate">
          {/* ── Step Help Hint (B6) ── */}
          {STEP_HINTS[currentStep] && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 px-4 py-2.5 rounded-lg border border-border/30 mb-5 print:hidden">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
              <span>{STEP_HINTS[currentStep]}</span>
            </div>
          )}
          {/* STEP 1: Basic Info (B4: extended with company data + report_date) */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                1. Alapadatok
              </h2>

              {/* Company info (read-only from company profile) */}
              <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Cégadatok (a cégprofilból)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cégnév</Label>
                    <Input value={selectedCompany?.name || '—'} disabled className="mt-1 bg-muted/20" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Székhely</Label>
                    <Input value={selectedCompany?.address || '—'} disabled className="mt-1 bg-muted/20" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Adószám</Label>
                    <Input value={selectedCompany?.tax_number || '—'} disabled className="mt-1 bg-muted/20" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Üzleti év</Label>
                  <Input value={report.fiscal_year} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Beszámoló státusza</Label>
                  <Input value={report.status === 'draft' ? 'Vázlat' : report.status === 'finalized' ? 'Véglegesítve' : report.status} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Képviselő neve *</Label>
                  <Input
                    value={getField('representative_name') || ''}
                    onChange={(e) => setField('representative_name', e.target.value)}
                    placeholder="pl. Kiss János"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Beosztás</Label>
                  <Input
                    value={getField('representative_role') || 'ügyvezető'}
                    onChange={(e) => setField('representative_role', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Beszámoló dátuma *</Label>
                  <Input
                    type="date"
                    value={getField('report_date') || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setField('report_date', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Számviteli módszer</Label>
                  <Input
                    value={getField('accounting_method') || 'kettős könyvvitel'}
                    onChange={(e) => setField('accounting_method', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Data Import */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                2. Mérleg & Eredménykimutatás Import
              </h2>
              <p className="text-muted-foreground">
                A rendszer befagyasztja a {report.fiscal_year}. december 31-i záró állapotot.
              </p>

              {report.frozen_at ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">Adatok befagyasztva</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Időpont: {new Date(report.frozen_at).toLocaleString('hu-HU')}<br />
                        Mérleg sorok: {report.frozen_bs_data?.length || 0}<br />
                        P&L sorok: {report.frozen_pnl_data?.length || 0}
                      </p>
                      <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => freezeData.mutate()} disabled={freezeData.isPending}>
                        <RefreshCw className={cn("w-4 h-4", freezeData.isPending && "animate-spin")} />
                        Újra befagyasztás
                      </Button>
                    </div>
                  </div>

                  {/* B5: Frozen data financial summary */}
                  {(() => {
                    const bs = (report.frozen_bs_data as any[]) || [];
                    const pnl = (report.frozen_pnl_data as any[]) || [];
                    const totalAssets = bs.find((r: any) => r.section === 'assets' && r.type === 'total');
                    const totalLiab = bs.find((r: any) => r.section === 'liabilities' && r.type === 'total');
                    const netIncome = pnl.filter((r: any) => r.type === 'roman')
                      .reduce((a: number, r: any) => a + (Number(r.balance || 0) * Number(r.multiplier || 1)), 0);
                    const assetsVal = Number(totalAssets?.current_balance || 0);
                    const liabVal = Number(totalLiab?.current_balance || 0);
                    const diff = assetsVal - liabVal;
                    const fmtK = (v: number) => new Intl.NumberFormat('hu-HU').format(Math.round(v / 1000));
                    return (
                      <div className="bg-muted/20 border border-border/30 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-muted/40 border-b border-border/30">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Befagyasztott adatok összefoglalója</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/20">
                          {[
                            { label: 'Eszközök', value: `${fmtK(assetsVal)} E Ft` },
                            { label: 'Források', value: `${fmtK(liabVal)} E Ft` },
                            { label: 'Eltérés', value: `${fmtK(diff)} E Ft`, color: Math.abs(diff) > 1 ? 'text-red-500' : 'text-emerald-600' },
                            { label: 'Adózott eredmény', value: `${fmtK(netIncome)} E Ft`, color: netIncome >= 0 ? 'text-emerald-600' : 'text-red-500' },
                          ].map((item, i) => (
                            <div key={i} className="bg-background p-3 text-center">
                              <p className="text-[10px] text-muted-foreground">{item.label}</p>
                              <p className={cn("text-sm font-bold tabular-nums mt-0.5", (item as any).color)}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <Button className="h-12 gap-2 text-base" onClick={() => freezeData.mutate()} disabled={freezeData.isPending}>
                  {freezeData.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Adatok befagyasztása ({report.fiscal_year}.12.31)
                </Button>
              )}
            </div>
          )}

          {/* STEP 3: Validation */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                3. Validáció — Az „Őrszem"
              </h2>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {
                    validateReport.reset();
                    validateReport.mutate();
                  }}
                  disabled={validateReport.isPending || !report.frozen_at}
                  className="gap-2"
                >
                  {validateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {validationResults.length > 0 ? 'Újra ellenőrzés' : 'Ellenőrzések futtatása'}
                </Button>
                {validateReport.isError && (
                  <p className="text-sm text-red-500">Hiba: {(validateReport.error as any)?.message || 'Ismeretlen hiba'}</p>
                )}
              </div>

              {!report.frozen_at && (
                <p className="text-amber-600 text-sm">⚠️ Először fagyaszd be az adatokat a 2. lépésben!</p>
              )}

              {validationResults.length > 0 && (
                <div className="space-y-3">
                  {validationResults.map((r: ValidationResult) => {
                    // Map rule_id to navigation target actions
                    const ruleNavMap: Record<string, { type: 'step' | 'page'; target: number | string; label: string }[]> = {
                      'V1': [{ type: 'page', target: '/balance-sheet?tab=mapping', label: 'Mérleg hozzárendelések' }],
                      'V2': [
                        { type: 'page', target: '/profit-and-loss?tab=mapping', label: 'Eredménykimutatás hozzárendelések' },
                        { type: 'page', target: '/balance-sheet?tab=mapping', label: 'Mérleg hozzárendelések' }
                      ],
                      'V3': [{ type: 'step', target: 1, label: 'Ugrás az 1. lépésre' }],
                      'V4': [{ type: 'step', target: 5, label: 'Ugrás az 5. lépésre' }],
                      'V5': [{ type: 'step', target: 2, label: 'Ugrás a 2. lépésre' }],
                      'V6': [{ type: 'page', target: '/balance-sheet', label: 'Mérleg megtekintése' }],
                      'V7': [{ type: 'step', target: 2, label: 'Adatok újrabefagyasztása' }],
                      'V8': [{ type: 'step', target: 4, label: 'Ugrás a 4. lépésre' }],
                    };
                    const navActions = ruleNavMap[r.rule_id] || [];

                    return (
                    <div key={r.rule_id} className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border",
                      r.passed ? "bg-emerald-500/5 border-emerald-500/20" :
                      r.severity === 'error' ? "bg-red-500/5 border-red-500/20" :
                      "bg-amber-500/5 border-amber-500/20"
                    )}>
                      {r.passed ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" /> :
                       r.severity === 'error' ? <XCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
                       <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{r.rule_id}: {r.rule_name}</p>
                        <p className="text-sm text-muted-foreground">{r.message}</p>
                      </div>
                      {!r.passed && navActions.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          {navActions.map((action, actionIdx) => (
                            <Button
                              key={actionIdx}
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => {
                                if (action.type === 'step') {
                                  setCurrentStep(action.target as number);
                                } else {
                                  scopedNavigate(action.target as string);
                                }
                              }}
                            >
                              {action.type === 'page' ? <ExternalLink className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Supplementary Notes */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                4. Kiegészítő Melléklet
              </h2>
              <p className="text-muted-foreground text-sm">
                Jogszabályi szöveges sablonok. Módosítsd a szöveget, ha szükséges.
              </p>

              {notesTemplates?.map((tmpl: any) => {
                const saved = (report.notes_sections as any[])?.find((s: any) => s.section_key === tmpl.section_key);
                const rawText = saved?.text || tmpl.default_text;
                const text = replaceVariables(rawText);
                const isAssetSection = tmpl.section_key === 'asset_movement';
                const isEquitySection = tmpl.section_key === 'equity_changes';
                const isSalarySection = tmpl.section_key === 'employee_info';

                return (
                  <div key={tmpl.section_key} className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <span className="font-bold text-sm">{tmpl.section_title}</span>
                      <div className="flex items-center gap-2">
                        {saved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => {
                              const sections = ((report.notes_sections as any[]) || []).filter((s: any) => s.section_key !== tmpl.section_key);
                              updateReport.mutate({ notes_sections: sections } as any);
                              // Clear local draft too
                              setDraftFields(prev => {
                                const next = { ...prev };
                                delete next[`note_${tmpl.section_key}`];
                                return next;
                              });
                              toast({ title: 'Visszaállítva', description: `${tmpl.section_title} alapértelmezettre állítva.` });
                            }}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Alapértelmezett
                          </Button>
                        )}
                        {(isAssetSection || isEquitySection || isSalarySection) && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">Auto-fill</span>
                        )}
                        {tmpl.is_required && <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Kötelező</span>}
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Dynamic table: TENY */}
                      {isAssetSection && assetMovement && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Mutató</th>
                              <th className="p-2 text-right">Érték</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              <tr><td className="p-2">Összes eszköz (db)</td><td className="p-2 text-right tabular-nums">{assetMovement.total}</td></tr>
                              <tr><td className="p-2">Aktív eszközök</td><td className="p-2 text-right tabular-nums">{assetMovement.active}</td></tr>
                              <tr><td className="p-2">Kivezetett eszközök</td><td className="p-2 text-right tabular-nums">{assetMovement.disposed}</td></tr>
                              <tr className="font-medium"><td className="p-2">Bruttó érték összesen</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(assetMovement.totalAcquisition)} Ft</td></tr>
                              <tr><td className="p-2">Aktív eszközök bruttó értéke</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(assetMovement.activeAcquisition)} Ft</td></tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Dynamic table: Equity */}
                      {isEquitySection && equityRows.length > 0 && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Sor</th>
                              <th className="p-2 text-left">Megnevezés</th>
                              <th className="p-2 text-right">Előző év</th>
                              <th className="p-2 text-right">Tárgyév</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              {equityRows.map((r: any) => (
                                <tr key={r.bs_structure_id}>
                                  <td className="p-2 font-mono text-xs">{r.row_code}</td>
                                  <td className="p-2">{r.name}</td>
                                  <td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.prior_year_balance) || 0) / 1000))} E</td>
                                  <td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.current_balance) || 0) / 1000))} E</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Dynamic table: Salary */}
                      {isSalarySection && salaryMetrics && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Mutató</th>
                              <th className="p-2 text-right">Érték</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              <tr><td className="p-2">Átlagos létszám</td><td className="p-2 text-right tabular-nums">{salaryMetrics.headcount} fő</td></tr>
                              <tr><td className="p-2">Bérköltség</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalWages)} Ft</td></tr>
                              <tr><td className="p-2">Bérjárulékok</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalContrib)} Ft</td></tr>
                              <tr className="font-medium"><td className="p-2">Összes személyi jellegű ráfordítás</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.total)} Ft</td></tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      <RichTextEditor
                        key={`rte_${tmpl.section_key}_${saved?.text?.length ?? 0}_${!saved ? 'default' : 'saved'}`}
                        initialContent={saved?.text || tmpl.default_text}
                        onChange={(newText) => {
                          // Debounce the DB write — no local draft needed since editor is uncontrolled
                          if (debounceRef.current) clearTimeout(debounceRef.current);
                          debounceRef.current = setTimeout(() => {
                            const sections = [...((report.notes_sections as any[]) || [])];
                            const idx = sections.findIndex((s: any) => s.section_key === tmpl.section_key);
                            const entry = { section_key: tmpl.section_key, text: newText };
                            if (idx >= 0) sections[idx] = entry; else sections.push(entry);
                            updateReport.mutate({ notes_sections: sections } as any);
                          }, 1200);
                        }}
                        placeholder={tmpl.section_title}
                        variables={[
                          { key: '[Cégnév]', label: 'Cég neve' },
                          { key: '[Székhely]', label: 'Székhely' },
                          { key: '[Adószám]', label: 'Adószám' },
                          { key: '[Tárgyév]', label: 'Tárgyév' },
                          { key: '[Tárgyév+1]', label: 'Tárgyév+1' },
                          { key: '[Képviselő neve]', label: 'Képviselő' },
                          { key: '[Képviselő beosztása]', label: 'Beosztás' },
                          { key: '[Saját tőke]', label: 'Saját tőke (E Ft)' },
                          { key: '[Saját tőke változás]', label: 'Tőke változás iránya' },
                          { key: '[Mérlegfőösszeg]', label: 'Mérlegfőösszeg (E Ft)' },
                          { key: '[ROE]', label: 'ROE %' },
                          { key: '[Likviditás]', label: 'Likviditási mutató' },
                          { key: '[Likviditás értékelés]', label: 'Likviditás szöveges értékelés' },
                          { key: '[Adózott eredmény]', label: 'Adózott eredmény (E Ft)' },
                          { key: '[Osztalék]', label: 'Osztalék (E Ft)' },
                          { key: '[Eredménytartalék]', label: 'Eredménytartalék (E Ft)' },
                        ]}
                      />

                      {/* Live preview with variables replaced */}
                      {(() => {
                        const currentText = saved?.text || tmpl.default_text;
                        const hasVars = /\[.+?\]/.test(currentText);
                        if (!hasVars) return null;
                        return (
                          <div className="bg-muted/20 border border-border/30 rounded-lg p-3 mt-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                              <Info className="w-3 h-3" /> Előnézet (behelyettesített változókkal)
                            </p>
                            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                              {replaceVariables(currentText)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {/* Custom sections added by user */}
              {((report.notes_sections as any[]) || []).filter((s: any) => s.is_custom).map((s: any) => (
                <div key={s.section_key} className="border border-border/50 rounded-xl overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                    <span className="font-bold text-sm">{s.title || 'Egyéni szekció'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => {
                        const sections = ((report.notes_sections as any[]) || []).filter((x: any) => x.section_key !== s.section_key);
                        updateReport.mutate({ notes_sections: sections } as any);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="p-4">
                    <Textarea
                      value={(draftFields[`note_${s.section_key}`] !== undefined) ? draftFields[`note_${s.section_key}`] : (s.text || '')}
                      rows={4}
                      className="text-sm"
                      onChange={(e) => {
                        const newText = e.target.value;
                        setDraftFields(prev => ({ ...prev, [`note_${s.section_key}`]: newText }));
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                          const sections = [...((report.notes_sections as any[]) || [])];
                          const idx = sections.findIndex((x: any) => x.section_key === s.section_key);
                          if (idx >= 0) sections[idx] = { ...s, text: newText };
                          updateReport.mutate({ notes_sections: sections } as any);
                          setDraftFields(prev => {
                            const next = { ...prev };
                            delete next[`note_${s.section_key}`];
                            return next;
                          });
                        }, 800);
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Add custom section */}
              <div className="border-2 border-dashed border-border/40 rounded-xl p-4 flex items-center gap-3">
                <Input
                  placeholder="Új szekció címe (pl. Egyéb tájékoztatás)"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newSectionTitle.trim()}
                  onClick={() => {
                    const key = `custom_${Date.now()}`;
                    const sections = [...((report.notes_sections as any[]) || []), {
                      section_key: key,
                      title: newSectionTitle.trim(),
                      text: '',
                      is_custom: true
                    }];
                    updateReport.mutate({ notes_sections: sections } as any);
                    setNewSectionTitle('');
                    toast({ title: 'Szekció hozzáadva', description: newSectionTitle.trim() });
                  }}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Hozzáadás
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Dividend (B8: auto-fill net_income + határozat szám) */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                5. Osztalék és Eredményfelosztás
              </h2>

              {/* B8: Auto-computed net income from frozen PnL */}
              {(() => {
                const pnl = (report.frozen_pnl_data as any[]) || [];
                const computedIncome = pnl.filter((r: any) => r.type === 'roman')
                  .reduce((a: number, r: any) => a + (Number(r.balance || 0) * Number(r.multiplier || 1)), 0);
                const currentNetIncome = getField('net_income') || 0;
                const needsSync = report.frozen_at && Math.abs(computedIncome - currentNetIncome) > 1;
                return needsSync ? (
                  <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2.5 rounded-lg border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>A befagyasztott P&L alapján az adózott eredmény: <strong>{new Intl.NumberFormat('hu-HU').format(Math.round(computedIncome))} Ft</strong></span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-6 px-2 text-[10px] gap-1"
                      onClick={() => {
                        const ni = Math.round(computedIncome);
                        setField('net_income', ni, { retained_earnings: ni - (getField('dividend_amount') || 0) });
                      }}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Szinkronizálás
                    </Button>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Adózott eredmény (Ft)</Label>
                  <Input
                    type="number"
                    value={getField('net_income') || 0}
                    onChange={(e) => {
                      const ni = Number(e.target.value);
                      setField('net_income', ni, { retained_earnings: ni - (getField('dividend_amount') || 0) });
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Osztalék (Ft)</Label>
                  <Input
                    type="number"
                    value={getField('dividend_amount') || 0}
                    onChange={(e) => {
                      const div = Number(e.target.value);
                      const ni = getField('net_income') || 0;
                      setField('dividend_amount', div, { retained_earnings: ni - div });
                    }}
                    className="mt-1.5"
                  />
                  {/* B8: Client-side max validation */}
                  {(getField('dividend_amount') || 0) > (getField('net_income') || 0) && (getField('net_income') || 0) > 0 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Az osztalék nem haladhatja meg az adózott eredményt!
                    </p>
                  )}
                </div>
                <div>
                  <Label>Eredménytartalékba (Ft)</Label>
                  <Input value={getField('retained_earnings') || 0} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Határozat dátuma</Label>
                  <Input
                    type="date"
                    value={getField('dividend_resolution_date') || ''}
                    onChange={(e) => setField('dividend_resolution_date', e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Határozat száma</Label>
                  <Input
                    value={getField('dividend_resolution_number') || ''}
                    onChange={(e) => setField('dividend_resolution_number', e.target.value)}
                    placeholder="pl. 1/2026. (V.15.)"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Auto-generated resolution text */}
              {(getField('net_income') || 0) > 0 && (
                <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2">Automatikus határozat szövege:</p>
                  <p className="text-sm italic">
                    „A(z) {selectedCompany?.name || '...'} taggyűlése {getField('dividend_resolution_date') || '...'}-án megtartott
                    ülésén a {report.fiscal_year}. üzleti év {new Intl.NumberFormat('hu-HU').format(getField('net_income') || 0)} Ft
                    adózott eredményéből {new Intl.NumberFormat('hu-HU').format(getField('dividend_amount') || 0)} Ft osztalék
                    kifizetéséről döntött. A fennmaradó {new Intl.NumberFormat('hu-HU').format(getField('retained_earnings') || 0)} Ft
                    az eredménytartalékba kerül."
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Export & Finalization */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                6. Zárás és Exportálás
              </h2>
              <p className="text-sm text-muted-foreground -mt-3">
                Ellenőrizd a beszámoló állapotát, töltsd le a végleges PDF-et, majd zárd le a dokumentumot.
              </p>

              {/* ── Summary Checklist ── */}
              {(() => {
                const validationResults: ValidationResult[] = (report.validation_results as any[]) || [];
                const validationErrors = validationResults.filter(v => v.severity === 'error' && !v.passed);
                const validationWarnings = validationResults.filter(v => v.severity === 'warning' && !v.passed);
                const notesSections = (report.notes_sections as any[]) || [];
                const hasBasicData = !!(report.representative_name && report.report_date);
                const hasFrozenData = !!report.frozen_at;
                const hasValidation = !!report.validated_at;
                const validationPassed = hasValidation && validationErrors.length === 0;
                const hasNotes = notesSections.length > 0 || (notesTemplates && notesTemplates.length > 0);
                const hasDividend = report.net_income <= 0 || (report.dividend_amount >= 0 && report.retained_earnings >= 0);
                const allReady = hasBasicData && hasFrozenData && validationPassed && hasNotes && hasDividend;

                const checks = [
                  { label: 'Alapadatok kitöltve', sublabel: `${report.representative_name || '—'} • ${report.report_date || '—'}`, ok: hasBasicData, step: 1 },
                  { label: 'Mérleg & EK befagyasztva', sublabel: report.frozen_at ? `Befagyasztva: ${new Date(report.frozen_at).toLocaleString('hu-HU')}` : 'Még nincs befagyasztva', ok: hasFrozenData, step: 2 },
                  { label: 'Validáció lefutott', sublabel: validationPassed ? `${validationResults.length} szabály ellenőrizve — mind OK` : validationErrors.length > 0 ? `${validationErrors.length} hiba, ${validationWarnings.length} figyelmeztetés` : 'Még nem futott le', ok: validationPassed, warn: hasValidation && !validationPassed, step: 3 },
                  { label: 'Kiegészítő melléklet', sublabel: `${notesSections.length} egyéni szekció • ${notesTemplates?.length || 0} sablon`, ok: hasNotes, step: 4 },
                  { label: 'Eredményfelosztás', sublabel: report.net_income > 0 ? `Osztalék: ${new Intl.NumberFormat('hu-HU').format(report.dividend_amount || 0)} Ft • Tartalék: ${new Intl.NumberFormat('hu-HU').format(report.retained_earnings || 0)} Ft` : 'Nincs pozitív eredmény — nem szükséges', ok: hasDividend, step: 5 },
                ];

                return (
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                        Beszámoló állapot
                        {allReady ? (
                          <span className="ml-auto text-xs font-semibold bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full">
                            ✓ Minden rendben
                          </span>
                        ) : (
                          <span className="ml-auto text-xs font-semibold bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full">
                            Teendők vannak
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {checks.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentStep(c.step)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40",
                            i < checks.length - 1 && "border-b border-border/30"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                            c.ok ? "bg-emerald-500/10 text-emerald-600" :
                            (c as any).warn ? "bg-amber-500/10 text-amber-600" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {c.ok ? <CheckCircle2 className="w-4 h-4" /> :
                             (c as any).warn ? <AlertTriangle className="w-3.5 h-3.5" /> :
                             <XCircle className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{c.label}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.sublabel}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* ── Export & Finalize Grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PDF Export Card */}
                <Card className={cn(
                  "border-border/50 transition-colors",
                  report.frozen_at ? "hover:border-primary/40" : "opacity-60"
                )}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm">Vezetői PDF</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Nyomtatható, aláírható beszámoló — Mérleg, EK, Kiegészítő Melléklet, Osztalékhatározat</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={!report.frozen_at}
                      onClick={() => {
                        try {
                          const pdfData = {
                            companyName: selectedCompany?.name || '',
                            companyAddress: selectedCompany?.address || '',
                            companyTaxNumber: selectedCompany?.tax_number || '',
                            fiscalYear: report.fiscal_year,
                            representativeName: report.representative_name || '',
                            representativeRole: report.representative_role || 'ügyvezető',
                            reportDate: report.report_date || new Date().toISOString().slice(0, 10),
                            frozenBsData: report.frozen_bs_data || [],
                            frozenPnlData: report.frozen_pnl_data || [],
                            notesSections: (report.notes_sections as any[]) || [],
                            notesTemplates: notesTemplates || [],
                            netIncome: report.net_income || 0,
                            dividendAmount: report.dividend_amount || 0,
                            retainedEarnings: report.retained_earnings || 0,
                            dividendResolutionDate: report.dividend_resolution_date || '',
                            assetMovement: assetMovement || undefined,
                            salaryMetrics: salaryMetrics || undefined,
                            equityRows: equityRows || undefined,
                          };
                          const url = generateAnnualReportPreviewUrl(pdfData);
                          setPreviewUrl(url);
                        } catch (err) {
                          toast({ title: 'Hiba', description: 'Nem sikerült az előnézet generálás.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Eye className="w-4 h-4" /> Előnézet
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={!report.frozen_at}
                      onClick={() => {
                        try {
                          generateAnnualReportPdf({
                            companyName: selectedCompany?.name || '',
                            companyAddress: selectedCompany?.address || '',
                            companyTaxNumber: selectedCompany?.tax_number || '',
                            fiscalYear: report.fiscal_year,
                            representativeName: report.representative_name || '',
                            representativeRole: report.representative_role || 'ügyvezető',
                            reportDate: report.report_date || new Date().toISOString().slice(0, 10),
                            frozenBsData: report.frozen_bs_data || [],
                            frozenPnlData: report.frozen_pnl_data || [],
                            notesSections: (report.notes_sections as any[]) || [],
                            notesTemplates: notesTemplates || [],
                            netIncome: report.net_income || 0,
                            dividendAmount: report.dividend_amount || 0,
                            retainedEarnings: report.retained_earnings || 0,
                            dividendResolutionDate: report.dividend_resolution_date || '',
                            assetMovement: assetMovement || undefined,
                            salaryMetrics: salaryMetrics || undefined,
                            equityRows: equityRows || undefined,
                          });
                          toast({ title: 'PDF generálva', description: 'A letöltés megkezdődött.' });
                        } catch (err) {
                          toast({ title: 'Hiba', description: 'Nem sikerült a PDF generálás.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Download className="w-4 h-4" /> Letöltés
                    </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* B9: e-Beszámoló CSV Export Card */}
                <Card className={cn(
                  "border-border/50 transition-colors",
                  report.frozen_at ? "hover:border-primary/40" : "opacity-60"
                )}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500/10 text-blue-600 p-2.5 rounded-xl">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm">e-Beszámoló CSV</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Mérleg + EK adatok CSV formátumban — importálható az e-Beszámoló online kitöltőbe</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={!report.frozen_at}
                        onClick={() => {
                          try {
                            downloadEBeszamoloCsv({
                              companyName: selectedCompany?.name || '',
                              companyTaxNumber: selectedCompany?.tax_number || '',
                              fiscalYear: report.fiscal_year,
                              frozenBsData: report.frozen_bs_data || [],
                              frozenPnlData: report.frozen_pnl_data || [],
                              netIncome: report.net_income || 0,
                              dividendAmount: report.dividend_amount || 0,
                              retainedEarnings: report.retained_earnings || 0,
                            });
                            toast({ title: 'CSV letöltve', description: '3 fájl: Mérleg, EK, Összefoglaló' });
                          } catch (err) {
                            toast({ title: 'Hiba', description: 'CSV generálás sikertelen.', variant: 'destructive' });
                          }
                        }}
                      >
                        <Download className="w-4 h-4" /> CSV letöltés
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => window.open(E_BESZAMOLO_PORTAL_URL, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" /> e-Beszámoló portál
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Finalization Card */}
                <Card className={cn(
                  "border-2 transition-all",
                  report.status === 'finalized'
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border/50 hover:border-primary/40"
                )}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl",
                        report.status === 'finalized'
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      )}>
                        {report.status === 'finalized' ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm">
                          {report.status === 'finalized' ? 'Véglegesítve ✓' : 'Véglegesítés'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.status === 'finalized'
                            ? `Zárolva • Módosításhoz oldd fel`
                            : !report.frozen_at
                              ? 'Előfeltétel: adat befagyasztás'
                              : !report.validated_at
                                ? 'Előfeltétel: validáció lefuttatása'
                                : 'Zárd le — ezután nem módosítható'}
                        </p>
                      </div>
                    </div>
                    {report.status !== 'finalized' ? (
                      <Button
                        className="w-full gap-2"
                        disabled={!report.frozen_at || !report.validated_at}
                        onClick={() => {
                          updateReport.mutate({ status: 'finalized' } as any);
                          toast({ title: '🎉 Beszámoló véglegesítve!', description: 'A beszámoló sikeresen zárolva. Gratulálunk!' });
                        }}
                      >
                        <Lock className="w-4 h-4" /> Véglegesítés
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => {
                          updateReport.mutate({ status: 'draft' } as any);
                          toast({ title: 'Zárolás feloldva', description: 'A beszámoló újra szerkeszthető.' });
                        }}
                      >
                        <Unlock className="w-4 h-4" /> Zárolás feloldása
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── B3: Változás-log (Audit Trail) ── */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Változás-napló
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(() => {
                    const events: { date: string; label: string; icon: typeof CheckCircle2; color: string }[] = [];
                    
                    if (report.created_at) events.push({
                      date: report.created_at,
                      label: 'Beszámoló létrehozva',
                      icon: FileText,
                      color: 'text-blue-500 bg-blue-500/10'
                    });
                    if (report.frozen_at) events.push({
                      date: report.frozen_at,
                      label: 'Mérleg & EK adatok befagyasztva',
                      icon: Lock,
                      color: 'text-cyan-500 bg-cyan-500/10'
                    });
                    if (report.validated_at) events.push({
                      date: report.validated_at,
                      label: 'Validáció lefuttatva',
                      icon: Shield,
                      color: 'text-amber-500 bg-amber-500/10'
                    });
                    if (report.status === 'finalized') events.push({
                      date: report.updated_at,
                      label: 'Beszámoló véglegesítve',
                      icon: CheckCircle2,
                      color: 'text-emerald-500 bg-emerald-500/10'
                    });
                    if (report.updated_at && report.updated_at !== report.created_at) events.push({
                      date: report.updated_at,
                      label: 'Utolsó módosítás',
                      icon: RefreshCw,
                      color: 'text-muted-foreground bg-muted'
                    });

                    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    return events.map((ev, i) => {
                      const Icon = ev.icon;
                      return (
                        <div key={i} className={cn(
                          "flex items-center gap-3 px-5 py-3",
                          i < events.length - 1 && "border-b border-border/30"
                        )}>
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", ev.color)}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{ev.label}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {new Date(ev.date).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>

              {/* ── Footer info ── */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg border border-border/40">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  A véglegesítés után a beszámoló nem módosítható. A PDF és CSV bármikor újra letölthető.
                  A CSV fájlokat az e-Beszámoló online kitöltőbe importálhatod.
                </span>
              </div>
            </div>
          )}
          </div>{/* end step-animate wrapper */}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Előző
        </Button>
        <Button onClick={() => setCurrentStep(s => Math.min(6, s + 1))} disabled={currentStep === 6} className="gap-2">
          Következő <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* B2: PDF Live Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => {
        if (!open) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-primary" />
              Beszámoló előnézet — {selectedYear}. üzleti év
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Éves Beszámoló Előnézet"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
