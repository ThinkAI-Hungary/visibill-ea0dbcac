import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { generateAnnualReportPreviewUrl } from '@/lib/annualReportPdf';
import type { AnnualReport, ValidationResult, NotesTemplateItem } from '../types';
import {
  calculateFinancialMetrics,
  calculateSalaryMetrics,
  calculateAssetMovement,
  extractEquityRows,
  calculateTaxLossCarryforward,
  isStepCompleted as evaluateStepCompleted,
} from '../core/annualReportEngine';

export function useAnnualReportData() {
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentStep, setCurrentStep] = useState(1);
  const { data: exchangeRates } = useExchangeRates();
  const [activeSectionKey, setActiveSectionKey] = useState<string>('');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeScrollRef = useRef(0);

  // Archive - fetch all reports for this company
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
    enabled: !!selectedCompany?.id && !!activePresetId,
  });

  // Current year report
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
    enabled: !!selectedCompany?.id && !!activePresetId,
  });

  // Confetti trigger
  const triggerConfetti = useCallback(() => {
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
      let vy = Math.sin(angle) * velocity - 5;
      let x = window.innerWidth / 2;
      let y = window.innerHeight * 0.6;
      let opacity = 1;

      const animate = () => {
        x += vx;
        y += vy;
        vy += 0.35;
        vx *= 0.98;
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
  }, []);

  // Create report mutation
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
    },
  });

  // Update report mutation
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
    },
  });

  // Debounced field editing
  const [draftFields, setDraftFields] = useState<Record<string, any>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setField = useCallback(
    (field: string, value: any, extras?: Record<string, any>) => {
      setDraftFields((prev) => ({ ...prev, [field]: value, ...extras }));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDraftFields((prev) => {
          const updates = { ...prev };
          updateReport.mutate(updates as any);
          return {};
        });
      }, 800);
    },
    [updateReport]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getField = useCallback(
    (field: keyof AnnualReport) => {
      return field in draftFields ? draftFields[field] : report?.[field];
    },
    [draftFields, report]
  );

  // Freeze data mutation
  const freezeData = useMutation({
    mutationFn: async () => {
      if (!report?.id || !selectedCompany?.id || !activePresetId) throw new Error('Missing');
      const { data, error } = await supabase.rpc('freeze_annual_data', {
        p_report_id: report.id,
        p_company_id: selectedCompany.id,
        p_preset_id: activePresetId,
        p_fiscal_year: selectedYear,
        p_exchange_rates: exchangeRates || {},
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
    },
  });

  // Validate report mutation
  const validateReport = useMutation({
    mutationFn: async () => {
      if (!report?.id) throw new Error('No report');
      const { data, error } = await supabase.rpc('validate_annual_report', {
        p_report_id: report.id,
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
    },
  });

  // Supplementary Notes Templates
  const { data: notesTemplates } = useQuery<NotesTemplateItem[]>({
    queryKey: ['notes_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_report_notes_templates')
        .select('*')
        .order('order_num');
      if (error) throw error;
      return (data || []) as NotesTemplateItem[];
    },
  });

  // Fixed Assets for asset movement
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
    enabled: !!selectedCompany?.id,
  });

  // Salary data
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
    enabled: !!selectedCompany?.id,
  });

  // Pure engine calculations
  const salaryMetrics = useMemo(() => calculateSalaryMetrics(salaryData), [salaryData]);
  const assetMovement = useMemo(() => calculateAssetMovement(fixedAssets), [fixedAssets]);
  const equityRows = useMemo(() => extractEquityRows(report?.frozen_bs_data), [report?.frozen_bs_data]);
  const financialMetrics = useMemo(
    () => calculateFinancialMetrics(report?.frozen_bs_data, report?.frozen_pnl_data, report?.net_income),
    [report?.frozen_bs_data, report?.frozen_pnl_data, report?.net_income]
  );

  const taxLoss = useMemo(
    () =>
      calculateTaxLossCarryforward(
        allReports,
        selectedYear,
        getField('net_income') || 0,
        report?.notes_sections
      ),
    [allReports, selectedYear, draftFields, report?.net_income, report?.notes_sections, getField]
  );

  const setAppliedLossOffset = useCallback(
    (val: number) => {
      const sections = [...((report?.notes_sections as any[]) || [])];
      const idx = sections.findIndex((s: any) => s.section_key === 'tax_loss_applied');
      const entry = { section_key: 'tax_loss_applied', text: String(val) };
      if (idx >= 0) sections[idx] = entry;
      else sections.push(entry);
      updateReport.mutate({ notes_sections: sections });
    },
    [report?.notes_sections, updateReport]
  );

  // Complete PDF Data bundle
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
  }, [
    report,
    selectedCompany,
    notesTemplates,
    assetMovement,
    salaryMetrics,
    equityRows,
    draftFields,
    selectedYear,
    getField,
  ]);

  // Live PDF preview debounced updater
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (currentStep !== 4 || !report) return;

    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeScrollRef.current = iframeRef.current.contentWindow.scrollY || 0;
      } catch (e) {
        // Ignore iframe cross-context security
      }
    }

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      try {
        const url = generateAnnualReportPreviewUrl(pdfData);
        setLivePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error('[AnnualReport] Failed to generate live preview:', err);
      }
    }, 400);

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [pdfData, currentStep, report]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (livePreviewUrl) URL.revokeObjectURL(livePreviewUrl);
    };
  }, [livePreviewUrl]);

  const validationResults: ValidationResult[] = useMemo(
    () => (report?.validation_results as any[]) || [],
    [report?.validation_results]
  );

  const isStepCompleted = useCallback(
    (stepId: number) => evaluateStepCompleted(stepId, report, validationResults),
    [report, validationResults]
  );

  return {
    selectedCompany,
    activePresetId,
    selectedYear,
    setSelectedYear,
    currentStep,
    setCurrentStep,
    allReports,
    report,
    isLoadingReport,
    createReport,
    updateReport,
    freezeData,
    validateReport,
    setField,
    getField,
    draftFields,
    setDraftFields,
    notesTemplates,
    activeSectionKey,
    setActiveSectionKey,
    resetCounter,
    setResetCounter,
    livePreviewUrl,
    iframeRef,
    iframeScrollRef,
    salaryMetrics,
    assetMovement,
    equityRows,
    financialMetrics,
    taxLoss,
    setAppliedLossOffset,
    pdfData,
    validationResults,
    isStepCompleted,
    triggerConfetti,
  };
}
