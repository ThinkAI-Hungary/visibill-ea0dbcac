import { useState, useCallback } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

export interface ChartLineFlags {
  revenuePaid: boolean;
  revenueUnpaid: boolean;
  expensesPaid: boolean;
  expensesUnpaid: boolean;
  salaries: boolean;
  cashFlow: boolean;
}

const CHART_LINE_DEFAULTS: ChartLineFlags = {
  revenuePaid: true,
  revenueUnpaid: true,
  expensesPaid: true,
  expensesUnpaid: true,
  salaries: true,
  cashFlow: true,
};

export function useDashboardPreferences() {
  const [showBrutto, setShowBruttoRaw] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DASHBOARD_SHOW_BRUTTO);
    return saved !== null ? saved === 'true' : false;
  });

  const [chartLines, setChartLinesRaw] = useState<ChartLineFlags>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DASHBOARD_CHART_LINES);
      if (saved) return { ...CHART_LINE_DEFAULTS, ...JSON.parse(saved) };
    } catch {}
    return CHART_LINE_DEFAULTS;
  });

  const [selectedCurrency, setSelectedCurrency] = useState<string>('HUF');
  const [vatSectionOpen, setVatSectionOpen] = useState(true);
  const [revenueSectionOpen, setRevenueSectionOpen] = useState(true);
  const [fxSectionOpen, setFxSectionOpen] = useState(true);

  const setShowBrutto = useCallback((v: boolean) => {
    setShowBruttoRaw(v);
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_SHOW_BRUTTO, String(v));
  }, []);

  const setChartLine = useCallback((key: keyof ChartLineFlags, v: boolean) => {
    setChartLinesRaw(prev => {
      const next = { ...prev, [key]: v };
      localStorage.setItem(STORAGE_KEYS.DASHBOARD_CHART_LINES, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    showBrutto,
    setShowBrutto,
    chartLines,
    setChartLine,
    selectedCurrency,
    setSelectedCurrency,
    vatSectionOpen,
    setVatSectionOpen,
    revenueSectionOpen,
    setRevenueSectionOpen,
    fxSectionOpen,
    setFxSectionOpen,
  };
}
