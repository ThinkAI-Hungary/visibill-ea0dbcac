import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Lock, Unlock, Plus, Trash2, RotateCcw, ExternalLink, Eye, Scale
} from 'lucide-react';
import { generateAnnualReportPdf, generateAnnualReportPreviewUrl } from '@/lib/annualReportPdf';
import { downloadAnnualReportXml } from '@/lib/annualReportXml';
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
  const [activeSectionKey, setActiveSectionKey] = useState<string>('');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeScrollRef = useRef(0);

  // B11: Fetch all reports for this company (for history/archive)
  const { data: allReports } = useQuery({
    queryKey: ['annual_reports_all', selectedCompany?.id, activePresetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return [];
      const { data, error } = await supabase
        .from('annual_reports')
        .select('id, fiscal_year, status, net_income, frozen_at, validated_at, created_at, updated_at')
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
        })
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

  // Simple micro-confetti burst animation using canvas or DOM elements
  const triggerConfetti = () => {
    const colors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#f59e0b', '#3b82f6'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.width = `${Math.random() * 8 + 5}px`;
      el.style.height = `${Math.random() * 8 + 5}px`;
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = '50%';
      el.style.top = '60%';
      el.style.borderRadius = '50%';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
      el.style.transform = 'translate(-50%, -50%)';
      document.body.appendChild(el);
      
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 12 + 6;
      let vx = Math.cos(angle) * velocity;
      let vy = Math.sin(angle) * velocity - 5; // upward bias
      let x = window.innerWidth / 2;
      let y = window.innerHeight * 0.6;
      let opacity = 1;
      
      const animate = () => {
        x += vx;
        y += vy;
        vy += 0.35; // gravity
        vx *= 0.98; // drag
        opacity -= 0.015;
        
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.opacity = String(opacity);
        
        if (opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          el.remove();
        }
      };
      
      requestAnimationFrame(animate);
    }
  };

  // ── Update report mutation ──
  const updateReport = useMutation({
    mutationFn: async (updates: Partial<AnnualReport>) => {
      if (!report?.id) throw new Error('No report');
      const { error } = await supabase
        .from('annual_reports')
        .update(updates as any)
        .eq('id', report.id);
      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      if (updates?.status === 'finalized') {
        triggerConfetti();
      }
    }
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

  // ── Tax Loss Carryforward (Veszteségelhatárolás) helpers ──
  const priorLossReports = useMemo(() => {
    if (!allReports) return [];
    return allReports
      .filter((r: any) => r.fiscal_year < selectedYear && (r.net_income || 0) < 0)
      .sort((a: any, b: any) => a.fiscal_year - b.fiscal_year);
  }, [allReports, selectedYear]);

  const accumulatedPriorLosses = useMemo(() => {
    return priorLossReports.reduce((sum, r) => sum + Math.abs(r.net_income || 0), 0);
  }, [priorLossReports]);

  const maxLossOffset = useMemo(() => {
    const currentNet = getField('net_income') || 0;
    return currentNet > 0 ? Math.round(currentNet * 0.5) : 0;
  }, [draftFields, report?.net_income]);

  const appliedLossOffset = useMemo(() => {
    const entry = ((report?.notes_sections as any[]) || []).find((s: any) => s.section_key === 'tax_loss_applied');
    return entry ? Number(entry.text) || 0 : 0;
  }, [report?.notes_sections]);

  const setAppliedLossOffset = (val: number) => {
    const sections = [...((report?.notes_sections as any[]) || [])];
    const idx = sections.findIndex((s: any) => s.section_key === 'tax_loss_applied');
    const entry = { section_key: 'tax_loss_applied', text: String(val) };
    if (idx >= 0) sections[idx] = entry; else sections.push(entry);
    updateReport.mutate({ notes_sections: sections });
  };

  // ── Complete PDF Data object for live preview and exports ──
  const pdfData = useMemo(() => {
    return {
      companyName: selectedCompany?.name || '',
      companyAddress: selectedCompany?.address || '',
      companyTaxNumber: selectedCompany?.tax_number || '',
      fiscalYear: report?.fiscal_year ?? selectedYear,
      representativeName: getField('representative_name') || '',
      representativeRole: getField('representative_role') || 'ügyvezető',
      reportDate: getField('report_date') || new Date().toISOString().slice(0, 10),
      frozenBsData: report?.frozen_bs_data || [],
      frozenPnlData: report?.frozen_pnl_data || [],
      notesSections: (report?.notes_sections as any[]) || [],
      notesTemplates: notesTemplates || [],
      netIncome: getField('net_income') || 0,
      dividendAmount: getField('dividend_amount') || 0,
      retainedEarnings: getField('retained_earnings') || 0,
      dividendResolutionDate: getField('dividend_resolution_date') || '',
      assetMovement: assetMovement || undefined,
      salaryMetrics: salaryMetrics || undefined,
      equityRows: equityRows || undefined,
    };
  }, [report, selectedCompany, notesTemplates, assetMovement, salaryMetrics, equityRows, draftFields]);

  // ── Debounced Live Preview Generator ──
  useEffect(() => {
    if (currentStep !== 4) return;
    
    const debounceTimer = setTimeout(() => {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          try {
            iframeScrollRef.current = iframeRef.current.contentWindow.scrollY;
          } catch (e) {
            // Ignore
          }
        }
        const url = generateAnnualReportPreviewUrl(pdfData);
        setLivePreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error(err);
      }
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  }, [pdfData, currentStep]);

  // ── Initialize active notes tab key ──
  useEffect(() => {
    if (notesTemplates && notesTemplates.length > 0 && !activeSectionKey) {
      setActiveSectionKey(notesTemplates[0].section_key);
    }
  }, [notesTemplates, activeSectionKey]);

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
    const toHtml = (txt: string) => {
      if (!txt) return '';
      if (txt.includes('<p>') || txt.includes('<div>') || txt.includes('<br>')) return txt;
      return txt.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('');
    };

    const fmtK = (v: number) => new Intl.NumberFormat('hu-HU').format(Math.round(v / 1000));
    const fmtF = (v: number) => new Intl.NumberFormat('hu-HU').format(v);

    const assetTable = assetMovement ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Mutató</th>
              <th class="p-2 text-right">Érték</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr><td class="p-2 border-r border-border font-medium">Összes eszköz</td><td class="p-2 text-right">${assetMovement.total} db</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Aktív eszközök</td><td class="p-2 text-right">${assetMovement.active} db</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Kivezetett eszközök</td><td class="p-2 text-right">${assetMovement.disposed} db</td></tr>
            <tr class="bg-muted/40 font-bold"><td class="p-2 border-r border-border">Bruttó érték összesen</td><td class="p-2 text-right">${fmtF(assetMovement.totalAcquisition)} Ft</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Aktív eszközök bruttó értéke</td><td class="p-2 text-right">${fmtF(assetMovement.activeAcquisition)} Ft</td></tr>
          </tbody>
        </table>
      </div>
    ` : `<p class="text-xs text-muted-foreground italic my-2">Tárgyi eszköz adatok nem érhetők el.</p>`;

    const equityTable = equityRows && equityRows.length > 0 ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Sor</th>
              <th class="p-2 text-left border-r border-border">Megnevezés</th>
              <th class="p-2 text-right border-r border-border">Előző év</th>
              <th class="p-2 text-right">Tárgyév</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            ${equityRows.map((r: any) => `
              <tr>
                <td class="p-2 border-r border-border font-mono text-[10px]">${r.row_code || ''}</td>
                <td class="p-2 border-r border-border">${r.name || ''}</td>
                <td class="p-2 border-r border-border text-right font-mono">${fmtK(Number(r.prior_year_balance) || 0)} E Ft</td>
                <td class="p-2 text-right font-mono">${fmtK(Number(r.current_balance) || 0)} E Ft</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `<p class="text-xs text-muted-foreground italic my-2">Saját tőke adatok nem érhetők el.</p>`;

    const salaryTable = salaryMetrics ? `
      <div class="my-3 overflow-x-auto">
        <table class="w-full text-[11px] border-collapse border border-border">
          <thead>
            <tr class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-b border-border">
              <th class="p-2 text-left border-r border-border">Mutató</th>
              <th class="p-2 text-right">Érték</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr><td class="p-2 border-r border-border font-medium">Átlagos statisztikai létszám</td><td class="p-2 text-right">${salaryMetrics.headcount} fő</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Bérköltség</td><td class="p-2 text-right">${fmtF(salaryMetrics.totalWages)} Ft</td></tr>
            <tr><td class="p-2 border-r border-border font-medium">Bérjárulékok</td><td class="p-2 text-right">${fmtF(salaryMetrics.totalContrib)} Ft</td></tr>
            <tr class="bg-muted/40 font-bold"><td class="p-2 border-r border-border">Összes személyi jellegű ráfordítás</td><td class="p-2 text-right">${fmtF(salaryMetrics.total)} Ft</td></tr>
          </tbody>
        </table>
      </div>
    ` : `<p class="text-xs text-muted-foreground italic my-2">Foglalkoztatotti adatok nem érhetők el.</p>`;

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
      '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]': assetTable,
      '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]': equityTable,
      '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]': salaryTable,
    };
    let result = toHtml(text);
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
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap pb-1">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = isStepCompleted(step.id);

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all flex-1 min-w-0 border",
                    isActive ? "bg-primary text-primary-foreground border-primary shadow-lg" :
                    isCompleted ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" :
                    "bg-muted/20 text-muted-foreground/60 border-dashed border-border/60 hover:bg-muted/40 hover:text-foreground"
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
        {/* ── Circular Progress Ring & Step Checklist ── */}
        {(() => {
          const stepsDone = [
            isStepCompleted(1), // step 1
            isStepCompleted(2), // step 2
            isStepCompleted(3), // step 3
            isStepCompleted(4), // step 4
            isStepCompleted(5), // step 5
            isStepCompleted(6), // step 6
          ];
          const completedCount = stepsDone.filter(Boolean).length;
          const pct = Math.round((completedCount / 6) * 100);
          return (
            <div className="mt-3 pt-3 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3">
                {/* SVG Circular Progress Ring */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      className="text-muted/20"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="transparent"
                      r="20"
                      cx="24"
                      cy="24"
                    />
                    <circle
                      className="text-primary transition-all duration-500 ease-out"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="20"
                      cx="24"
                      cy="24"
                    />
                  </svg>
                  <span className="absolute text-[10px] font-extrabold tabular-nums text-foreground">{pct}%</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">{completedCount} a 6-ból lépés befejezve</p>
                  <p className="text-[10px] text-muted-foreground">
                    {pct === 100 ? "Beszámoló kész a lezárásra!" : "Folytasd a lépések kitöltését a véglegesítéshez."}
                  </p>
                </div>
              </div>
              
              {/* Horizontal steps checklist */}
              <div className="flex items-center gap-4 flex-wrap text-[10px] font-medium print:hidden">
                {STEPS.map(s => {
                  const done = isStepCompleted(s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-1.5 transition-all select-none">
                      {done ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.3)] shrink-0" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{s.title}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full border border-dashed border-muted-foreground/60 bg-muted/20 shrink-0" />
                          <span className="text-muted-foreground/45 font-normal italic">{s.title}</span>
                        </>
                      )}
                    </div>
                  );
                })}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    4. Kiegészítő Melléklet
                  </h2>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Jogszabályi szöveges sablonok és egyéni mellékletek szerkesztése élő PDF előnézettel.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Side: Sidebar + Active Editor */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Vertical Tabs Sidebar & Content Area */}
                  <div className="flex flex-col md:flex-row gap-4 border border-border/40 rounded-2xl p-4 bg-muted/10">
                    {/* Vertical tab buttons */}
                    <div className="flex flex-col gap-1 md:w-48 shrink-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 pl-2">Szekciók</p>
                      {(() => {
                        const templates = (notesTemplates || []).map((t: any) => ({
                          key: t.section_key,
                          title: t.section_title,
                          isCustom: false,
                          isRequired: t.is_required,
                          defaultText: t.default_text,
                        }));
                        const custom = (((report?.notes_sections as any[]) || []).filter((s: any) => s.is_custom) || []).map((s: any) => ({
                          key: s.section_key,
                          title: s.title || 'Egyéni szekció',
                          isCustom: true,
                          isRequired: false,
                          defaultText: '',
                        }));
                        const allNotesTabs = [...templates, ...custom];
                        return (
                          <>
                            {allNotesTabs.map((tab) => {
                              const isActive = activeSectionKey === tab.key;
                              const saved = (report.notes_sections as any[])?.find((s: any) => s.section_key === tab.key);
                              return (
                                <Button
                                  key={tab.key}
                                  variant={isActive ? 'default' : 'ghost'}
                                  size="sm"
                                  className={cn(
                                    "justify-start text-xs font-semibold px-3 py-2 h-auto text-left rounded-lg transition-all",
                                    isActive 
                                      ? "bg-primary text-primary-foreground shadow" 
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                  onClick={() => setActiveSectionKey(tab.key)}
                                >
                                  <span className="truncate flex-1">{tab.title}</span>
                                  {saved && <span className="ml-1.5 text-[9px] text-emerald-500 font-bold shrink-0">✓</span>}
                                </Button>
                              );
                            })}

                            {/* Add custom section button in sidebar */}
                            <div className="border-t border-border/40 pt-3 mt-2 space-y-2">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-2">Egyéni szekció</p>
                              <div className="flex flex-col gap-1.5 px-2">
                                <Input
                                  placeholder="Új címe..."
                                  value={newSectionTitle}
                                  onChange={(e) => setNewSectionTitle(e.target.value)}
                                  className="h-7 text-xs"
                                />
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="w-full text-[10px] gap-1 h-6"
                                  disabled={!newSectionTitle.trim()}
                                  onClick={() => {
                                    const key = `custom_${Date.now()}`;
                                    const sections = [...((report.notes_sections as any[]) || []), {
                                      section_key: key,
                                      title: newSectionTitle.trim(),
                                      text: '',
                                      is_custom: true
                                    }];
                                    updateReport.mutate({ notes_sections: sections });
                                    setActiveSectionKey(key);
                                    setNewSectionTitle('');
                                    toast({ title: 'Szekció hozzáadva', description: newSectionTitle.trim() });
                                  }}
                                >
                                  <Plus className="w-3 h-3" /> Hozzáadás
                                </Button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Active Editor content container */}
                    <div className="flex-1 min-w-0 bg-background border border-border/30 rounded-xl overflow-hidden shadow-sm p-4 space-y-4">
                      {(() => {
                        const templates = (notesTemplates || []).map((t: any) => ({
                          key: t.section_key,
                          title: t.section_title,
                          isCustom: false,
                          isRequired: t.is_required,
                          defaultText: t.default_text,
                        }));
                        const custom = (((report?.notes_sections as any[]) || []).filter((s: any) => s.is_custom) || []).map((s: any) => ({
                          key: s.section_key,
                          title: s.title || 'Egyéni szekció',
                          isCustom: true,
                          isRequired: false,
                          defaultText: '',
                        }));
                        const allNotesTabs = [...templates, ...custom];
                        const tab = allNotesTabs.find(t => t.key === activeSectionKey);
                        if (!tab) {
                          return (
                            <div className="text-center py-8 text-muted-foreground text-xs">
                              Válassz ki egy szekciót a szerkesztéshez a bal oldali menüből.
                            </div>
                          );
                        }

                        const saved = (report.notes_sections as any[])?.find((s: any) => s.section_key === tab.key);
                        const isAssetSection = tab.key === 'asset_movement';
                        const isEquitySection = tab.key === 'equity_changes';
                        const isSalarySection = tab.key === 'employee_info';

                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-border/40">
                              <h3 className="font-bold text-sm text-foreground">{tab.title}</h3>
                              <div className="flex items-center gap-2">
                                {saved && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                                    onClick={() => {
                                      const sections = ((report.notes_sections as any[]) || []).filter((s: any) => s.section_key !== tab.key);
                                      updateReport.mutate({ notes_sections: sections });
                                      setResetCounter(prev => prev + 1);
                                      toast({ title: 'Visszaállítva', description: `${tab.title} alapértelmezettre állítva.` });
                                    }}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Visszaállítás
                                  </Button>
                                )}
                                {tab.isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 gap-1 hover:bg-red-500/5"
                                    onClick={() => {
                                      const sections = ((report.notes_sections as any[]) || []).filter((s: any) => s.section_key !== tab.key);
                                      updateReport.mutate({ notes_sections: sections });
                                      toast({ title: 'Törölve', description: `${tab.title} eltávolítva.` });
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Törlés
                                  </Button>
                                )}
                                {(isAssetSection || isEquitySection || isSalarySection) && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold select-none">Auto-fill</span>
                                )}
                                {tab.isRequired && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold select-none">Kötelező</span>}
                              </div>
                            </div>

                            {/* Supplementary Tables */}
                            {isAssetSection && assetMovement && (
                              <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                    <th className="p-2 text-left">Mutató</th>
                                    <th className="p-2 text-right">Érték</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-border/10">
                                    <tr><td className="p-2">Összes eszköz (db)</td><td className="p-2 text-right font-mono font-medium">{assetMovement.total}</td></tr>
                                    <tr><td className="p-2">Aktív eszközök</td><td className="p-2 text-right font-mono font-medium">{assetMovement.active}</td></tr>
                                    <tr><td className="p-2">Kivezetett eszközök</td><td className="p-2 text-right font-mono font-medium">{assetMovement.disposed}</td></tr>
                                    <tr className="font-semibold"><td className="p-2">Bruttó érték összesen</td><td className="p-2 text-right font-mono text-primary">{new Intl.NumberFormat('hu-HU').format(assetMovement.totalAcquisition)} Ft</td></tr>
                                    <tr><td className="p-2">Aktív eszközök bruttó értéke</td><td className="p-2 text-right font-mono font-medium">{new Intl.NumberFormat('hu-HU').format(assetMovement.activeAcquisition)} Ft</td></tr>
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {isEquitySection && equityRows.length > 0 && (
                              <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                    <th className="p-2 text-left">Sor</th>
                                    <th className="p-2 text-left">Megnevezés</th>
                                    <th className="p-2 text-right">Előző év</th>
                                    <th className="p-2 text-right">Tárgyév</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-border/10">
                                    {equityRows.map((r: any) => (
                                      <tr key={r.bs_structure_id}>
                                        <td className="p-2 font-mono text-[10px] text-muted-foreground">{r.row_code}</td>
                                        <td className="p-2 font-medium">{r.name}</td>
                                        <td className="p-2 text-right font-mono">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.prior_year_balance) || 0) / 1000))} E</td>
                                        <td className="p-2 text-right font-mono font-semibold text-primary">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.current_balance) || 0) / 1000))} E</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {isSalarySection && salaryMetrics && (
                              <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden text-xs">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                    <th className="p-2 text-left">Mutató</th>
                                    <th className="p-2 text-right">Érték</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-border/10">
                                    <tr><td className="p-2">Átlagos létszám</td><td className="p-2 text-right font-mono font-medium">{salaryMetrics.headcount} fő</td></tr>
                                    <tr><td className="p-2">Bérköltség</td><td className="p-2 text-right font-mono font-medium">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalWages)} Ft</td></tr>
                                    <tr><td className="p-2">Bérjárulékok</td><td className="p-2 text-right font-mono font-medium">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalContrib)} Ft</td></tr>
                                    <tr className="font-semibold"><td className="p-2">Összes személyi jellegű ráfordítás</td><td className="p-2 text-right font-mono text-primary">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.total)} Ft</td></tr>
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {tab.isCustom ? (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Szekció szövege</Label>
                                <Textarea
                                  value={(draftFields[`note_${tab.key}`] !== undefined) ? draftFields[`note_${tab.key}`] : (saved?.text || '')}
                                  rows={12}
                                  className="text-xs font-sans leading-relaxed"
                                  onChange={(e) => {
                                    const newText = e.target.value;
                                    setDraftFields(prev => ({ ...prev, [`note_${tab.key}`]: newText }));
                                    if (debounceRef.current) clearTimeout(debounceRef.current);
                                    debounceRef.current = setTimeout(() => {
                                      const sections = [...((report.notes_sections as any[]) || [])];
                                      const idx = sections.findIndex((x: any) => x.section_key === tab.key);
                                      if (idx >= 0) sections[idx] = { ...saved, text: newText };
                                      updateReport.mutate({ notes_sections: sections });
                                      setDraftFields(prev => {
                                        const next = { ...prev };
                                        delete next[`note_${tab.key}`];
                                        return next;
                                      });
                                    }, 800);
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Szerkesztő (sablon változókkal)</Label>
                                <RichTextEditor
                                  key={`rte_${tab.key}_${resetCounter}`}
                                  initialContent={saved?.text || tab.defaultText}
                                  onChange={(newText) => {
                                    if (debounceRef.current) clearTimeout(debounceRef.current);
                                    debounceRef.current = setTimeout(() => {
                                      const sections = [...((report.notes_sections as any[]) || [])];
                                      const idx = sections.findIndex((s: any) => s.section_key === tab.key);
                                      const entry = { section_key: tab.key, text: newText };
                                      if (idx >= 0) sections[idx] = entry; else sections.push(entry);
                                      updateReport.mutate({ notes_sections: sections });
                                    }, 1000);
                                  }}
                                  placeholder={tab.title}
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
                                    { key: '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]', label: 'Tárgyi Eszköz Táblázat' },
                                    { key: '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]', label: 'Saját Tőke Táblázat' },
                                    { key: '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]', label: 'Létszám/Bér Táblázat' },
                                  ]}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Side: Sticky Live Preview Panel */}
                <div className="lg:col-span-5">
                  <div className="sticky top-4 h-[75vh] flex flex-col border border-border/80 rounded-2xl overflow-hidden bg-muted/5 shadow-lg">
                    <div className="bg-muted/40 px-4 py-3 text-xs font-bold border-b border-border/60 flex items-center justify-between shrink-0 select-none">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        Éves Beszámoló Élő PDF Előnézet
                      </span>
                      <span className="text-[9px] text-muted-foreground font-normal">Gépelésre automatikusan frissül</span>
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900">
                      {livePreviewUrl ? (
                        <iframe
                          ref={iframeRef}
                          src={livePreviewUrl}
                          className="w-full h-full border-0"
                          title="Éves Beszámoló Élő PDF Előnézet"
                          onLoad={() => {
                            if (iframeRef.current && iframeRef.current.contentWindow) {
                              try {
                                iframeRef.current.contentWindow.scrollTo(0, iframeScrollRef.current);
                              } catch (e) {
                                // Ignore
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary/50 mb-2" />
                          <span>Előnézet betöltése...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
                <div className="space-y-6">
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

                {/* Right side: Tax Loss Carryforward & Summary */}
                <div className="space-y-4">
                  {/* Tax Loss Carryforward Panel */}
                  <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Veszteségelhatárolás (Tax Loss Carryforward)
                      </h3>
                      <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                        Sztv. & TAO Megfelelőség
                      </Badge>
                    </div>
                    
                    {accumulatedPriorLosses > 0 ? (
                      <div className="space-y-4">
                        <div className="text-xs space-y-2">
                          <p className="leading-relaxed">
                            A cégnek az előző években felhalmozott vesztesége van: <strong>{new Intl.NumberFormat('hu-HU').format(accumulatedPriorLosses)} Ft</strong>.
                            A hatályos szabályok szerint a tárgyévi pozitív adóalap maximum <strong>50%-a</strong> csökkenthető a korábbi évek elhatárolt veszteségével.
                          </p>
                          
                          {/* Prior losses history table */}
                          <div className="border border-border/40 rounded-lg overflow-hidden bg-background">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/50 font-bold border-b text-[10px] uppercase text-muted-foreground">
                                  <th className="p-2 text-left">Üzleti év</th>
                                  <th className="p-2 text-right">Veszteség összege</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {priorLossReports.map((r: any) => (
                                  <tr key={r.id}>
                                    <td className="p-2 font-medium">{r.fiscal_year}</td>
                                    <td className="p-2 text-right font-mono text-red-500">
                                      -{new Intl.NumberFormat('hu-HU').format(Math.abs(r.net_income))} Ft
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Maximálisan elszámolható elhatárolás (50%):</span>
                            <span className="font-mono font-bold">{new Intl.NumberFormat('hu-HU').format(maxLossOffset)} Ft</span>
                          </div>
                          
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              value={appliedLossOffset || ''}
                              onChange={(e) => {
                                const val = Math.min(accumulatedPriorLosses, Math.min(maxLossOffset, Number(e.target.value) || 0));
                                setAppliedLossOffset(val);
                              }}
                              placeholder="Felhasznált veszteségelhatárolás (Ft)"
                              className="text-xs font-mono h-8"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => setAppliedLossOffset(Math.min(accumulatedPriorLosses, maxLossOffset))}
                              className="text-[10px] h-8 shrink-0"
                              disabled={appliedLossOffset === Math.min(accumulatedPriorLosses, maxLossOffset)}
                            >
                              Max
                            </Button>
                            {appliedLossOffset > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => setAppliedLossOffset(0)}
                                className="text-[10px] h-8 text-muted-foreground"
                              >
                                Töröl
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Calculation display */}
                        {appliedLossOffset > 0 && (
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-xs space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Kalkulált adóalap és megtakarítás:</p>
                            <div className="flex justify-between font-mono">
                              <span>Eredeti eredmény:</span>
                              <span>{new Intl.NumberFormat('hu-HU').format(getField('net_income') || 0)} Ft</span>
                            </div>
                            <div className="flex justify-between font-mono text-emerald-600 dark:text-emerald-400">
                              <span>Veszteségcsökkentés:</span>
                              <span>-{new Intl.NumberFormat('hu-HU').format(appliedLossOffset)} Ft</span>
                            </div>
                            <div className="flex justify-between font-mono font-bold border-t border-emerald-500/20 pt-1 mt-1">
                              <span>Csökkentett adóalap:</span>
                              <span>{new Intl.NumberFormat('hu-HU').format((getField('net_income') || 0) - appliedLossOffset)} Ft</span>
                            </div>
                            <div className="flex justify-between font-mono text-blue-600 dark:text-blue-400 pt-1">
                              <span>Társasági adó megtakarítás (9%):</span>
                              <span>{new Intl.NumberFormat('hu-HU').format(Math.round(appliedLossOffset * 0.09))} Ft</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Nem található korábbi veszteséges év ennél a cégnél, így nincs felhasználható veszteségelhatárolás.
                      </p>
                    )}
                  </div>
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

              {/* Wax Seal lock banner */}
              {report.status === 'finalized' && (
                <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl relative overflow-hidden select-none animate-in zoom-in duration-300">
                  {/* Wax Seal element */}
                  <div className="w-28 h-28 rounded-full bg-red-700 dark:bg-red-800 shadow-2xl flex items-center justify-center border-4 border-red-800 dark:border-red-900 ring-4 ring-red-600/20 relative cursor-pointer transform hover:scale-105 hover:rotate-6 transition-all duration-300">
                    <div className="absolute inset-2 rounded-full border border-dashed border-red-500/30" />
                    <Scale className="w-12 h-12 text-amber-100 opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 rounded-full" />
                  </div>
                  <div className="text-center mt-4">
                    <h3 className="font-bold text-base text-foreground tracking-wide flex items-center gap-1.5 justify-center">
                      ⚖️ Hivatalos Zárópecsét
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      A(z) {selectedCompany?.name} {report.fiscal_year}. évi beszámolója hivatalosan lezárva és hitelesítve.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Hitelesítés ideje: {new Date(report.updated_at || '').toLocaleString('hu-HU')}
                    </p>
                  </div>
                  {/* Subtle diagonal background stripes */}
                  <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,rgba(16,185,129,0.03)_25%,transparent_25%,transparent_50%,rgba(16,185,129,0.03)_50%,rgba(16,185,129,0.03)_75%,transparent_75%,transparent)] bg-[size:40px_40px]" />
                </div>
              )}

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <Download className="w-4 h-4" /> Letöltés
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => window.open(E_BESZAMOLO_PORTAL_URL, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" /> Portál
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* OBR XML Export Card */}
                <Card className={cn(
                  "border-border/50 transition-colors",
                  report.frozen_at ? "hover:border-primary/40" : "opacity-60"
                )}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-indigo-500/10 text-indigo-600 p-2.5 rounded-xl">
                        <Database className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm">OBR XML Export</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Online Beszámoló Rendszer (OBR) sémának megfelelő hivatalos XML fájl letöltése</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-indigo-500/20 hover:bg-indigo-500/5 hover:text-indigo-600"
                      disabled={!report.frozen_at}
                      onClick={() => {
                        try {
                          downloadAnnualReportXml({
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
                          });
                          toast({ title: 'XML letöltve', description: 'Az OBR kompatibilis beszámoló fájl mentésre került.' });
                        } catch (err) {
                          toast({ title: 'Hiba', description: 'XML generálás sikertelen.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Download className="w-4 h-4" /> XML Letöltés
                    </Button>
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
                          updateReport.mutate({ status: 'finalized' });
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
                          updateReport.mutate({ status: 'draft' });
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
