import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { reportError } from '@/lib/errorReporter';
import { getVatReturnXmlString } from '@/lib/vatReturnXml';
import type {
  ReturnLine,
  MLine,
  FormRow,
  VatFrequency,
  TaxValidationResult,
  XmlValidationCheck,
  VatScope,
} from '../types';
import { shouldExcludeFromMLine } from '../types';
import { useDateRange } from '@/contexts/DateRangeContext';
import {
  validateHungarianTaxNumber,
  runXmlValidation,
  calculateVatBalances,
  calculateA60Aggregations,
  calculateDeadlineCountdown,
  findSuspiciousReverseChargeInvoices,
} from '../core/vatEngine';
import { useVatScope } from './useVatScope';

export function useVatReturnData() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { data: exchangeRates } = useExchangeRates();
  const dateRange = useDateRange();
  const qc = useQueryClient();

  const now = new Date();
  const getInitialPeriod = () => {
    if (!dateRange?.dateFrom || !dateRange?.dateTo) {
      return {
        year: now.getFullYear(),
        month: now.getMonth() || 12,
        frequency: 'H' as VatFrequency,
      };
    }
    const from = dateRange.dateFrom;
    const to = dateRange.dateTo;
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const fromYear = from.getFullYear();
    const toYear = to.getFullYear();
    const fromMonth = from.getMonth() + 1;
    const toMonth = to.getMonth() + 1;

    if (diffDays >= 300 || (fromMonth === 1 && toMonth === 12 && fromYear === toYear)) {
      return { year: fromYear, month: 12, frequency: 'E' as VatFrequency };
    } else if (diffDays >= 70 && diffDays <= 120 && Math.abs(toMonth - fromMonth) === 2) {
      return { year: fromYear, month: Math.ceil(fromMonth / 3), frequency: 'N' as VatFrequency };
    } else {
      return { year: fromYear, month: fromMonth, frequency: 'H' as VatFrequency };
    }
  };

  const initial = getInitialPeriod();
  const [year, setYearState] = useState(initial.year);
  const [month, setMonthState] = useState(initial.month);
  const [frequency, setFrequencyState] = useState<VatFrequency>(initial.frequency);
  const [searchParams] = useSearchParams();
  const initialViewMode = searchParams.get('view') === 'nav65' || searchParams.get('view') === 'replica' ? 'nav65' : 'calculator';
  const [viewMode, setViewMode] = useState<'calculator' | 'nav65' | 'steel'>(initialViewMode);

  const setYear = useCallback((newYear: number) => {
    setYearState(newYear);
    if (dateRange?.setDateFrom && dateRange?.setDateTo) {
      if (frequency === 'E') {
        dateRange.setDateFrom(new Date(newYear, 0, 1));
        dateRange.setDateTo(new Date(newYear, 11, 31));
      } else if (frequency === 'N') {
        const q = Math.max(1, Math.min(4, Math.ceil(month / 3)));
        const startM = (q - 1) * 3;
        dateRange.setDateFrom(new Date(newYear, startM, 1));
        dateRange.setDateTo(new Date(newYear, startM + 3, 0));
      } else {
        const m = Math.max(1, Math.min(12, month));
        dateRange.setDateFrom(new Date(newYear, m - 1, 1));
        dateRange.setDateTo(new Date(newYear, m, 0));
      }
    }
  }, [dateRange, month, frequency]);

  const setMonth = useCallback((newMonth: number) => {
    setMonthState(newMonth);
    if (dateRange?.setDateFrom && dateRange?.setDateTo) {
      if (frequency === 'E') {
        dateRange.setDateFrom(new Date(year, 0, 1));
        dateRange.setDateTo(new Date(year, 11, 31));
      } else if (frequency === 'N') {
        const q = Math.max(1, Math.min(4, newMonth));
        const startM = (q - 1) * 3;
        dateRange.setDateFrom(new Date(year, startM, 1));
        dateRange.setDateTo(new Date(year, startM + 3, 0));
      } else {
        const m = Math.max(1, Math.min(12, newMonth));
        dateRange.setDateFrom(new Date(year, m - 1, 1));
        dateRange.setDateTo(new Date(year, m, 0));
      }
    }
  }, [dateRange, year, frequency]);

  const setFrequency = useCallback((newFreq: VatFrequency) => {
    setFrequencyState(newFreq);
    if (dateRange?.setDateFrom && dateRange?.setDateTo) {
      if (newFreq === 'E') {
        setMonthState(12);
        dateRange.setDateFrom(new Date(year, 0, 1));
        dateRange.setDateTo(new Date(year, 11, 31));
      } else if (newFreq === 'N') {
        const q = Math.max(1, Math.min(4, Math.ceil(month / 3)));
        setMonthState(q);
        const startM = (q - 1) * 3;
        dateRange.setDateFrom(new Date(year, startM, 1));
        dateRange.setDateTo(new Date(year, startM + 3, 0));
      } else {
        const m = month > 12 ? 12 : month;
        setMonthState(m);
        dateRange.setDateFrom(new Date(year, m - 1, 1));
        dateRange.setDateTo(new Date(year, m, 0));
      }
    }
  }, [dateRange, year, month]);

  useEffect(() => {
    if (!dateRange?.dateFrom || !dateRange?.dateTo) return;
    const from = dateRange.dateFrom;
    const to = dateRange.dateTo;
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const fromYear = from.getFullYear();
    const toYear = to.getFullYear();
    const fromMonth = from.getMonth() + 1;
    const toMonth = to.getMonth() + 1;

    if (diffDays >= 300 || (fromMonth === 1 && toMonth === 12 && fromYear === toYear)) {
      setFrequencyState((prev) => (prev !== 'E' ? 'E' : prev));
      setYearState((prev) => (prev !== fromYear ? fromYear : prev));
      setMonthState((prev) => (prev !== 12 ? 12 : prev));
    } else if (diffDays >= 70 && diffDays <= 120 && Math.abs(toMonth - fromMonth) === 2) {
      const q = Math.ceil(fromMonth / 3);
      setFrequencyState((prev) => (prev !== 'N' ? 'N' : prev));
      setYearState((prev) => (prev !== fromYear ? fromYear : prev));
      setMonthState((prev) => (prev !== q ? q : prev));
    } else if (fromMonth === toMonth && fromYear === toYear) {
      setFrequencyState((prev) => (prev !== 'H' ? 'H' : prev));
      setYearState((prev) => (prev !== fromYear ? fromYear : prev));
      setMonthState((prev) => (prev !== fromMonth ? fromMonth : prev));
    } else {
      setYearState((prev) => (prev !== fromYear ? fromYear : prev));
    }
  }, [dateRange?.dateFrom, dateRange?.dateTo]);

  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [expandedFormRow, setExpandedFormRow] = useState<string | null>(null);

  // VIES EU Tax Validation state
  const [viesStatuses, setViesStatuses] = useState<Record<string, 'valid' | 'invalid' | 'loading' | null>>({});
  const [isValidatingVies, setIsValidatingVies] = useState(false);

  // Client-Side XML Validator state
  const [xmlValidationResults, setXmlValidationResults] = useState<XmlValidationCheck[]>([]);
  const [isValidatingXml, setIsValidatingXml] = useState(false);

  // Carryforward & EU type override states
  const [carryforwardValue, setCarryforwardValue] = useState<string>('');
  const [euTypeOverrides, setEuTypeOverrides] = useState<Record<string, string>>({});

  // Filters & Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);

  // Inline editing for detail rows
  const [editDrafts, setEditDrafts] = useState<Record<string, { base?: number; tax?: number }>>({});
  const editTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // URL scope for VAT calculations
  const urlScope = searchParams.get('vat_scope');
  const vatScope: VatScope = urlScope === 'with_image' ? 'with_image' : 'all';

  // Live scope missing deductions (computed from inbounds)
  const { missingDeductions } = useVatScope({
    companyId: selectedCompany?.id,
    year,
    month,
    frequency,
  });

  // 1. Current return for period
  const { data: vatReturn, error: vatReturnError } = useQuery({
    queryKey: ['vat_return', selectedCompany?.id, year, month, frequency, vatScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vat_returns')
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .eq('period_year', year)
        .eq('period_month', month)
        .eq('frequency', frequency)
        .maybeSingle();
      if (error) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'vat_returns query error:',
          error,
        });
        return null;
      }
      return data as any;
    },
    enabled: !!selectedCompany?.id,
  });

  const isFinalized = (vatReturn as any)?.status === 'finalized';

  // 2. Lines for current return
  const { data: lines = [] } = useQuery({
    queryKey: ['vat_return_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase
        .from('vat_return_lines')
        .select('*')
        .eq('vat_return_id', vatReturn.id);
      if (error) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'vat_return_lines error:',
          error,
        });
        return [];
      }
      return (data || []) as unknown as ReturnLine[];
    },
    enabled: !!vatReturn?.id,
  });

  // 3. M-Lines for current return
  const { data: mLines = [] } = useQuery({
    queryKey: ['vat_return_m_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase
        .from('vat_return_m_lines')
        .select('*')
        .eq('vat_return_id', vatReturn.id)
        .order('base_amount_rounded', { ascending: false });
      if (error) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'vat_return_m_lines error:',
          error,
        });
        return [];
      }
      const rawMLines = (data || []) as unknown as MLine[];
      return rawMLines
        .filter((ml) => !shouldExcludeFromMLine(ml))
        .map((ml) => {
          if (Array.isArray(ml.invoice_details)) {
            const cleanInvoices = ml.invoice_details.filter(
              (inv) => !shouldExcludeFromMLine({
                ...inv,
                partner_tax_number: ml.partner_tax_number,
                partner_name: ml.partner_name,
              })
            );
            return {
              ...ml,
              invoice_details: cleanInvoices,
              invoice_count: cleanInvoices.length,
            };
          }
          return ml;
        });
    },
    enabled: !!vatReturn?.id,
  });

  // 4. Form rows metadata
  const companyCountry = selectedCompany?.country_code || 'HU';
  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows', companyCountry],
    queryFn: async () => {
      const { data, error } = await (supabase.from('vat_form_rows') as any)
        .select('*')
        .eq('country_code', companyCountry)
        .order('sort_order');
      if (error) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'vat_form_rows error:',
          error,
        });
        return [];
      }
      return (data || []) as unknown as FormRow[];
    },
  });

  // 5. Previous period for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: prevReturn } = useQuery({
    queryKey: ['vat_return_prev', selectedCompany?.id, prevYear, prevMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('vat_returns')
        .select('id, total_payable_tax, total_deductible_tax, net_result')
        .eq('company_id', selectedCompany!.id)
        .eq('period_year', prevYear)
        .eq('period_month', prevMonth)
        .maybeSingle();
      return data as any;
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: prevLines = [] } = useQuery({
    queryKey: ['vat_return_lines_prev', prevReturn?.id],
    queryFn: async () => {
      if (!prevReturn?.id) return [];
      const { data } = await supabase
        .from('vat_return_lines')
        .select('row_number, base_amount_rounded, tax_amount_rounded')
        .eq('vat_return_id', prevReturn.id);
      return (data || []) as unknown as ReturnLine[];
    },
    enabled: !!prevReturn?.id,
  });

  const lineMap = useMemo(() => {
    const m: Record<string, ReturnLine> = {};
    for (const l of lines) m[l.row_number] = l;
    return m;
  }, [lines]);

  // Dynamically adjust lineMap and lines when in with_image scope
  const effectiveLineMap = useMemo(() => {
    if (vatScope !== 'with_image' || !missingDeductions) {
      return lineMap;
    }

    const m: Record<string, ReturnLine> = {};
    for (const [k, v] of Object.entries(lineMap)) {
      m[k] = { ...v };
    }

    const createFallbackLine = (row: string): ReturnLine => ({
      row_number: row,
      base_amount: 0,
      tax_amount: 0,
      base_amount_rounded: 0,
      tax_amount_rounded: 0,
      is_calculated: true,
      source_vat_codes: null,
    });

    const adjust = (row: string, subBaseEft: number, subTaxEft: number) => {
      const orig = m[row] || createFallbackLine(row);
      m[row] = {
        ...orig,
        base_amount_rounded: Math.max(0, (orig.base_amount_rounded || 0) - subBaseEft),
        tax_amount_rounded: Math.max(0, (orig.tax_amount_rounded || 0) - subTaxEft),
      };
    };

    if (missingDeductions.missing27BaseEft > 0 || missingDeductions.missing27TaxEft > 0) {
      adjust('66', missingDeductions.missing27BaseEft, missingDeductions.missing27TaxEft);
    }
    if (missingDeductions.missing18BaseEft > 0 || missingDeductions.missing18TaxEft > 0) {
      adjust('65', missingDeductions.missing18BaseEft, missingDeductions.missing18TaxEft);
    }
    if (missingDeductions.missing5BaseEft > 0 || missingDeductions.missing5TaxEft > 0) {
      adjust('64', missingDeductions.missing5BaseEft, missingDeductions.missing5TaxEft);
    }
    if (missingDeductions.missingExemptBaseEft > 0) {
      adjust('68', missingDeductions.missingExemptBaseEft, 0);
      adjust('110', missingDeductions.missingExemptBaseEft, 0);
    }

    // Row 76 (Total Deductible Tax)
    const orig76 = m['76'] || createFallbackLine('76');
    const new76Tax = Math.max(0, (orig76.tax_amount_rounded || 0) - missingDeductions.missingVatEft);
    m['76'] = {
      ...orig76,
      tax_amount_rounded: new76Tax,
    };

    // Row 36 (Total Payable Tax) - unchanged
    const payableTax36 = m['36']?.tax_amount_rounded || 0;
    const new83Tax = payableTax36 - new76Tax;

    const orig83 = m['83'] || createFallbackLine('83');
    m['83'] = {
      ...orig83,
      tax_amount_rounded: new83Tax,
    };

    const orig84 = m['84'] || createFallbackLine('84');
    m['84'] = {
      ...orig84,
      tax_amount_rounded: new83Tax > 0 ? new83Tax : 0,
    };

    const orig85 = m['85'] || createFallbackLine('85');
    m['85'] = {
      ...orig85,
      tax_amount_rounded: new83Tax < 0 ? Math.abs(new83Tax) : 0,
    };

    return m;
  }, [lineMap, vatScope, missingDeductions, vatReturn?.id]);

  const effectiveLines = useMemo(() => {
    return Object.values(effectiveLineMap);
  }, [effectiveLineMap]);

  const effectiveVatReturn = useMemo(() => {
    if (!vatReturn) return null;
    if (vatScope !== 'with_image' || !missingDeductions) {
      return vatReturn;
    }
    const newDed = Math.max(0, (vatReturn.total_deductible_tax || 0) - missingDeductions.missingVatEft * 1000);
    const newNet = (vatReturn.total_payable_tax || 0) - newDed;
    return {
      ...vatReturn,
      total_deductible_tax: newDed,
      net_result: newNet,
      amount_to_pay: newNet > 0 ? newNet : 0,
      amount_reclaimable: newNet < 0 ? Math.abs(newNet) : 0,
    };
  }, [vatReturn, vatScope, missingDeductions]);

  const prevLineMap = useMemo(() => {
    const m: Record<string, ReturnLine> = {};
    for (const l of prevLines) m[l.row_number] = l;
    return m;
  }, [prevLines]);

  const getVal = useCallback(
    (row: string, col: 'base' | 'tax') => {
      const line = effectiveLineMap[row];
      if (!line) return 0;
      return (col === 'base' ? line.base_amount_rounded : line.tax_amount_rounded) ?? 0;
    },
    [effectiveLineMap]
  );

  const getPrevVal = useCallback(
    (row: string, col: 'base' | 'tax') => {
      const line = prevLineMap[row];
      if (!line) return 0;
      return (col === 'base' ? line.base_amount_rounded : line.tax_amount_rounded) ?? 0;
    },
    [prevLineMap]
  );

  // 6. Unpaid outbound invoices' VAT in period
  const { data: unpaidVatEft = 0 } = useQuery({
    queryKey: ['vat_unpaid_outbound', selectedCompany?.id, year, month, frequency],
    queryFn: async () => {
      let dateFrom: string, dateTo: string;
      if (frequency === 'H') {
        dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      } else if (frequency === 'N') {
        const startMonth = (month - 1) * 3 + 1;
        dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
      } else {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }

      const { data: invoices, error } = await supabase
        .from('nav_invoices')
        .select('invoice_vat_amount')
        .eq('company_id', selectedCompany!.id)
        .eq('invoice_direction', 'OUTBOUND')
        .is('transaction_id', null)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      if (error || !invoices || invoices.length === 0) return 0;
      const totalVat = invoices.reduce((sum, inv) => sum + (Number(inv.invoice_vat_amount) || 0), 0);
      return Math.round(totalVat / 1000);
    },
    enabled: !!selectedCompany?.id && !!vatReturn,
  });

  // 6b. Period posting audit indicator (posted vs pending journal entries)
  const { data: postingAudit } = useQuery({
    queryKey: ['vat_period_posting_audit', selectedCompany?.id, year, month, frequency],
    queryFn: async () => {
      if (!selectedCompany?.id) return { postedCount: 0, pendingCount: 0, totalCount: 0, isFullyPosted: true };

      let dateFrom: string, dateTo: string;
      if (frequency === 'H') {
        dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      } else if (frequency === 'N') {
        const startMonth = (month - 1) * 3 + 1;
        dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
      } else {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }

      const { data: headers, error } = await supabase
        .from('acc_journal_headers')
        .select('id, status')
        .eq('company_id', selectedCompany.id)
        .gte('posting_date', dateFrom)
        .lte('posting_date', dateTo);

      if (error || !headers || headers.length === 0) {
        return { postedCount: 0, pendingCount: 0, totalCount: 0, isFullyPosted: false };
      }

      const postedCount = headers.filter(h => h.status === 'KONYVELT').length;
      const pendingCount = headers.filter(h => ['GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR'].includes(h.status)).length;
      const totalCount = headers.length;
      const isFullyPosted = pendingCount === 0 && postedCount > 0;

      return { postedCount, pendingCount, totalCount, isFullyPosted };
    },
    enabled: !!selectedCompany?.id,
  });

  // 7. EU Community invoices
  const { data: euInvoices = [], isLoading: isEuInvoicesLoading } = useQuery({
    queryKey: ['vat_eu_invoices', selectedCompany?.id, year, month, frequency],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      let dateFrom: string, dateTo: string;
      if (frequency === 'H') {
        dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      } else if (frequency === 'N') {
        const startMonth = (month - 1) * 3 + 1;
        dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
      } else {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }

      const euPrefixes = [
        'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'GR', 'ES', 'FI', 'FR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
      ];

      const KNOWN_EU_VENDORS = [
        { pattern: /google/i, country: 'IE', vatNumber: 'IE3668997OH', isService: true },
        { pattern: /zoho/i, country: 'NL', vatNumber: 'NL855264263B01', isService: true },
        { pattern: /openai/i, country: 'IE', vatNumber: 'IE3868789HH', isService: true },
        { pattern: /meta platforms|facebook/i, country: 'IE', vatNumber: 'IE9692928F', isService: true },
        { pattern: /hetzner/i, country: 'DE', vatNumber: 'DE202897834', isService: true },
        { pattern: /adobe/i, country: 'IE', vatNumber: 'IE4994993E', isService: true },
        { pattern: /microsoft ireland/i, country: 'IE', vatNumber: 'IE8256796U', isService: true },
        { pattern: /amazon web services|aws/i, country: 'LU', vatNumber: 'LU26372897', isService: true },
        { pattern: /linkedin ireland/i, country: 'IE', vatNumber: 'IE9740425P', isService: true },
        { pattern: /apple distribution/i, country: 'IE', vatNumber: 'IE9700053D', isService: true },
        { pattern: /digital charging/i, country: 'DE', vatNumber: 'DE312237805', isService: false },
      ];

      // 1. Fetch nav_invoices (OSA)
      const { data: rawNavInvoices } = await supabase
        .from('nav_invoices')
        .select(
          'id, invoice_number, invoice_direction, supplier_tax_number, customer_tax_number, supplier_name, customer_name, invoice_delivery_date, invoice_net_amount, currency'
        )
        .eq('company_id', selectedCompany.id)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      // 2. Fetch manual / uploaded invoices (invoices table)
      const { data: rawInvoices, error: rawInvoicesError } = await supabase
        .from('invoices')
        .select(
          'id, bizonylatsorszam, invoice_direction, elado_vat_id, vevo_vat_id, elado_nev, vevo_nev, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, penznem, termek_szolgaltatas_tipusa'
        )
        .eq('company_id', selectedCompany.id)
        .or(
          `and(teljesites_datuma.gte.${dateFrom},teljesites_datuma.lte.${dateTo}),and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom},kibocsatas_datuma.lte.${dateTo})`
        );

      if (rawInvoicesError) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'invoices query error in euInvoices:',
          error: rawInvoicesError,
        });
      }

      // 3. Fetch partners for company for country_code & eu_tax_number resolution
      const { data: partners } = await supabase
        .from('partners')
        .select('id, name, tax_number, eu_tax_number, country_code')
        .eq('company_id', selectedCompany.id);

      const partnerTaxMap = new Map<string, any>();
      partners?.forEach((p) => {
        const nameKey = p.name ? p.name.trim().toLowerCase() : '';
        if (nameKey) {
          const existing = partnerTaxMap.get(nameKey);
          const pTax = (p.tax_number || '').toUpperCase();
          const pEuTax = (p.eu_tax_number || '').toUpperCase();
          const isEu =
            (pTax && !pTax.startsWith('HU') && euPrefixes.some((pref) => pTax.startsWith(pref))) ||
            (pEuTax && !pEuTax.startsWith('HU') && euPrefixes.some((pref) => pEuTax.startsWith(pref))) ||
            (p.country_code && p.country_code !== 'HU' && euPrefixes.includes(p.country_code.toUpperCase()));
          if (!existing || isEu) {
            partnerTaxMap.set(nameKey, p);
          }
        }
        if (p.tax_number) partnerTaxMap.set(p.tax_number.replace(/[\s.-]/g, '').trim().toUpperCase(), p);
        if (p.eu_tax_number) partnerTaxMap.set(p.eu_tax_number.replace(/[\s.-]/g, '').trim().toUpperCase(), p);
      });

      const checkEuPartner = (
        taxNum: string | null | undefined,
        partnerName: string | null | undefined
      ): { isEu: boolean; cleanTax: string; country?: string; isKnownService?: boolean } => {
        const clean = (taxNum || '').replace(/[\s.-]/g, '').trim().toUpperCase();
        const nameLower = (partnerName || '').trim().toLowerCase();
        const known = KNOWN_EU_VENDORS.find((k) => k.pattern.test(nameLower));

        if (euPrefixes.some((pref) => clean.startsWith(pref)) && !clean.startsWith('HU')) {
          return {
            isEu: true,
            cleanTax: clean,
            country: clean.slice(0, 2),
            isKnownService: known?.isService,
          };
        }
        const pRecord = partnerTaxMap.get(nameLower) || (clean ? partnerTaxMap.get(clean) : null);
        if (pRecord?.eu_tax_number) {
          const pClean = pRecord.eu_tax_number.replace(/[\s.-]/g, '').trim().toUpperCase();
          if (euPrefixes.some((pref) => pClean.startsWith(pref)) && !pClean.startsWith('HU')) {
            return {
              isEu: true,
              cleanTax: pClean,
              country: pRecord.country_code || pClean.slice(0, 2),
              isKnownService: known?.isService,
            };
          }
        }
        if (pRecord?.tax_number) {
          const pClean = pRecord.tax_number.replace(/[\s.-]/g, '').trim().toUpperCase();
          if (euPrefixes.some((pref) => pClean.startsWith(pref)) && !pClean.startsWith('HU')) {
            return {
              isEu: true,
              cleanTax: pClean,
              country: pRecord.country_code || pClean.slice(0, 2),
              isKnownService: known?.isService,
            };
          }
        }
        if (pRecord?.country_code && euPrefixes.includes(pRecord.country_code.toUpperCase())) {
          return {
            isEu: true,
            cleanTax:
              clean && !clean.startsWith('HU')
                ? clean
                : pRecord.eu_tax_number || `${pRecord.country_code.toUpperCase()}${clean}`,
            country: pRecord.country_code.toUpperCase(),
            isKnownService: known?.isService,
          };
        }
        if (known) {
          return {
            isEu: true,
            cleanTax: clean && !clean.startsWith('HU') ? clean : known.vatNumber,
            country: known.country,
            isKnownService: known.isService,
          };
        }
        return { isEu: false, cleanTax: clean };
      };

      const candidateNav = (rawNavInvoices || []).map((inv) => {
        const isOut = (inv.invoice_direction || 'INBOUND').toUpperCase() === 'OUTBOUND';
        const partnerName = isOut ? inv.customer_name : inv.supplier_name;
        const partnerTaxNum = isOut ? inv.customer_tax_number : inv.supplier_tax_number;
        const eu = checkEuPartner(partnerTaxNum, partnerName);
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_direction: isOut ? ('OUTBOUND' as const) : ('INBOUND' as const),
          partner_name: partnerName || 'Ismeretlen Partner',
          partner_tax_number: eu.cleanTax,
          country_code: eu.country,
          invoice_delivery_date: inv.invoice_delivery_date,
          invoice_net_amount: inv.invoice_net_amount || 0,
          currency: inv.currency || 'HUF',
          isEu: eu.isEu,
          isKnownService: eu.isKnownService,
          source_table: 'nav_invoices' as const,
        };
      });

      const seenNumbers = new Set(
        candidateNav.map((c) => (c.invoice_number || '').trim().toLowerCase())
      );

      const candidateInvoices = (rawInvoices || [])
        .filter((inv) => {
          const num = (inv.bizonylatsorszam || '').trim().toLowerCase();
          return !seenNumbers.has(num);
        })
        .map((inv) => {
          const isOut = (inv.invoice_direction || 'INBOUND').toUpperCase() === 'OUTBOUND';
          const partnerName = isOut ? inv.vevo_nev : inv.elado_nev;
          const partnerTaxNum = isOut ? inv.vevo_vat_id : inv.elado_vat_id;
          const eu = checkEuPartner(partnerTaxNum, partnerName);
          const isServiceType = (inv.termek_szolgaltatas_tipusa || '').toLowerCase().includes('szolg');
          return {
            id: inv.id,
            invoice_number: inv.bizonylatsorszam,
            invoice_direction: isOut ? ('OUTBOUND' as const) : ('INBOUND' as const),
            partner_name: partnerName || 'Ismeretlen Partner',
            partner_tax_number: eu.cleanTax,
            country_code: eu.country,
            invoice_delivery_date: inv.teljesites_datuma || inv.kibocsatas_datuma,
            invoice_net_amount: inv.adoalap_osszesen || 0,
            currency: inv.penznem || 'HUF',
            isEu: eu.isEu,
            isKnownService: eu.isKnownService !== undefined ? eu.isKnownService : (isServiceType || undefined),
            source_table: 'invoices' as const,
          };
        });

      const filtered = [...candidateNav, ...candidateInvoices].filter((inv) => inv.isEu);

      if (filtered.length === 0) return [];

      const navIds = filtered.filter((i) => i.source_table === 'nav_invoices').map((i) => i.id);
      const subIds = filtered.filter((i) => i.source_table === 'invoices').map((i) => i.id);

      const itemsMap: Record<string, any[]> = {};

      for (let i = 0; i < navIds.length; i += 50) {
        const chunk = navIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from('nav_invoice_items')
          .select('nav_invoice_id, vat_rate, line_description')
          .in('nav_invoice_id', chunk);

        if (items) {
          items.forEach((item) => {
            if (!itemsMap[item.nav_invoice_id]) itemsMap[item.nav_invoice_id] = [];
            itemsMap[item.nav_invoice_id].push(item);
          });
        }
      }

      for (let i = 0; i < subIds.length; i += 50) {
        const chunk = subIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from('invoice_items')
          .select('invoice_id, vat_rate, vat_code, line_description')
          .in('invoice_id', chunk);

        if (items) {
          items.forEach((item) => {
            if (!itemsMap[item.invoice_id]) itemsMap[item.invoice_id] = [];
            itemsMap[item.invoice_id].push(item);
          });
        }
      }

      return filtered.map((inv) => {
        const items = itemsMap[inv.id] || [];
        const hasExplicitProductVatCode = items.some((item) =>
          (item.vat_code || '').toUpperCase().includes('TERM')
        );
        const hasExplicitServiceVatCode = items.some((item) =>
          (item.vat_code || '').toUpperCase().includes('SZOLG')
        );

        let isService: boolean;
        if (hasExplicitProductVatCode) {
          isService = false;
        } else if (hasExplicitServiceVatCode) {
          isService = true;
        } else if (inv.isKnownService !== undefined) {
          isService = inv.isKnownService;
        } else if (items.length > 0) {
          isService = items.some((item) => {
            const rate = (item.vat_rate || '').toUpperCase();
            const desc = (item.line_description || '').toLowerCase();
            return (
              rate === 'ATHK' ||
              rate === 'EUK' ||
              rate === 'EUF' ||
              rate === 'EUT' ||
              rate === 'HO' ||
              rate === 'EU_SZOLG_BE' ||
              rate === 'KIM_EU_SZOLG' ||
              desc.includes('szolgáltatás') ||
              desc.includes('szolg') ||
              desc.includes('díj') ||
              desc.includes('fejlesztés') ||
              desc.includes('hosting') ||
              desc.includes('licenc') ||
              desc.includes('bérlet') ||
              desc.includes('consulting') ||
              desc.includes('service') ||
              desc.includes('support') ||
              desc.includes('cloud') ||
              desc.includes('ads') ||
              desc.includes('hirdetés')
            );
          });
        } else {
          isService = false;
        }

        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_direction: inv.invoice_direction,
          partner_name: inv.partner_name,
          partner_tax_number: inv.partner_tax_number || '',
          country_code: inv.country_code,
          invoice_delivery_date: inv.invoice_delivery_date,
          invoice_net_amount: inv.invoice_net_amount || 0,
          currency: inv.currency,
          defaultIsService: isService,
          source_table: inv.source_table,
        };
      });
    },
    enabled: !!selectedCompany?.id,
  });

  // Calculate aggregations via pure engine for all 4 statutory categories
  const a60Calculations = useMemo(() => {
    // 1. Termékértékesítés -> 02. sor
    const expectedGoodsOut = getVal('02', 'base');
    // 2. Termékbeszerzés -> 11-16. sorok
    const expectedGoodsIn =
      getVal('11', 'base') +
      getVal('12', 'base') +
      getVal('13', 'base') +
      getVal('14', 'base') +
      getVal('15', 'base') +
      getVal('16', 'base');
    // 3. Szolgáltatásnyújtás -> 91-92. sorok
    const expectedServicesOut = getVal('91', 'base') + getVal('92', 'base');
    // 4. Szolgáltatás igénybevétele -> 18. sor
    const expectedServicesIn = getVal('18', 'base');

    return calculateA60Aggregations(
      euInvoices,
      euTypeOverrides,
      {
        goodsOut: expectedGoodsOut,
        goodsIn: expectedGoodsIn,
        servicesOut: expectedServicesOut,
        servicesIn: expectedServicesIn,
      },
      0,
      exchangeRates
    );
  }, [euInvoices, euTypeOverrides, exchangeRates, getVal]);

  // Partner validations
  const partnerValidations = useMemo(() => {
    const validations: Record<string, TaxValidationResult> = {};
    let hasErrors = false;
    let hasConflicts = false;

    mLines.forEach((ml) => {
      const v = validateHungarianTaxNumber(ml.partner_tax_number);
      validations[ml.id] = v;
      if (!v.isValid) hasErrors = true;
      if (v.status === 'exempt' && ml.tax_amount_rounded > 0) hasConflicts = true;
    });

    return { validations, hasErrors, hasConflicts };
  }, [mLines]);

  // Deadline countdown
  const deadlineCountdown = useMemo(
    () => calculateDeadlineCountdown(year, month, frequency),
    [year, month, frequency]
  );

  // Suspicious reverse charge invoices
  const reverseChargeSuspiciousInvoices = useMemo(
    () => findSuspiciousReverseChargeInvoices(mLines),
    [mLines]
  );

  // Mutations
  const calculate = useMutation({
    mutationFn: async (overrideScope?: VatScope | void) => {
      const scopeToUse = overrideScope || vatScope;

      // Try with p_scope first (matches post-migration RPC signature)
      const res = await (supabase.rpc as any)('calculate_vat_return', {
        p_company_id: selectedCompany!.id,
        p_year: year,
        p_month: month,
        p_frequency: frequency,
        p_scope: scopeToUse,
      });

      // If the remote DB hasn't been migrated with p_scope yet, fallback to legacy 4-param signature
      if (
        res.error &&
        (res.error.code === 'PGRST202' ||
          res.error.message?.includes('schema cache') ||
          res.error.message?.includes('p_scope'))
      ) {
        console.warn(
          'calculate_vat_return: falling back to 4-parameter RPC because p_scope migration is not yet applied to live DB',
          res.error.message
        );
        const legacyRes = await supabase.rpc('calculate_vat_return', {
          p_company_id: selectedCompany!.id,
          p_year: year,
          p_month: month,
          p_frequency: frequency,
        });
        if (legacyRes.error) throw legacyRes.error;
        return legacyRes.data;
      }

      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (_, overrideScope) => {
      const scopeUsed = overrideScope || vatScope;
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      qc.invalidateQueries({ queryKey: ['vat_return_lines'] });
      qc.invalidateQueries({ queryKey: ['vat_return_m_lines'] });
      qc.invalidateQueries({ queryKey: ['vat_scope_inbound_counts'] });
      qc.invalidateQueries({ queryKey: ['vat_annual_matrix'] });
      qc.invalidateQueries({ queryKey: ['vat_itemized_journal'] });
      qc.invalidateQueries({ queryKey: ['vatCollectorItems'] });
      qc.invalidateQueries({ queryKey: ['fallback_m_lines'] });
      toast({
        title: 'Számítás kész',
        description: `${year}/${String(month).padStart(2, '0')} bevallás generálva (${scopeUsed === 'with_image' ? 'Csak számlaképpel' : 'Minden számla'})`,
      });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const validateReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase
        .from('vat_returns')
        .update({ status: 'validated' })
        .eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Bevallás ellenőrzöttnek jelölve' });
    },
    onError: (e: any) =>
      toast({ title: 'Státusz váltás hiba', description: e.message, variant: 'destructive' }),
  });

  const finalizeReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase
        .from('vat_returns')
        .update({ status: 'finalized' })
        .eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({
        title: 'Bevallás véglegesítve',
        description: 'Változtatás csak visszanyitás után lehetséges.',
      });
    },
    onError: (e: any) =>
      toast({ title: 'Véglegesítés hiba', description: e.message, variant: 'destructive' }),
  });

  const reopenReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase
        .from('vat_returns')
        .update({ status: 'draft' })
        .eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Bevallás visszanyitva piszkozatba' });
    },
    onError: (e: any) =>
      toast({ title: 'Visszanyitás hiba', description: e.message, variant: 'destructive' }),
  });

  const saveCarryforward = useMutation({
    mutationFn: async (newVal: number) => {
      const returnId = (vatReturn as any).id;
      if (!returnId) throw new Error('Nincs bevallás');

      const line82 = lines.find((l) => l.row_number === '82');
      if (line82) {
        await supabase
          .from('vat_return_lines')
          .update({ tax_amount_rounded: newVal, tax_amount: newVal * 1000 })
          .eq('vat_return_id', returnId)
          .eq('row_number', '82');
      } else {
        await supabase.from('vat_return_lines').insert({
          vat_return_id: returnId,
          row_number: '82',
          tax_amount_rounded: newVal,
          tax_amount: newVal * 1000,
          is_calculated: false,
        });
      }

      const payTax = getVal('36', 'tax');
      const dedTax = getVal('76', 'tax');
      const balances = calculateVatBalances(payTax, dedTax, newVal);

      const upsertLine = async (row: string, taxEft: number) => {
        const existing = lines.find((l) => l.row_number === row);
        if (existing) {
          await supabase
            .from('vat_return_lines')
            .update({ tax_amount_rounded: taxEft, tax_amount: taxEft * 1000 })
            .eq('vat_return_id', returnId)
            .eq('row_number', row);
        } else {
          await supabase.from('vat_return_lines').insert({
            vat_return_id: returnId,
            row_number: row,
            tax_amount_rounded: taxEft,
            tax_amount: taxEft * 1000,
            is_calculated: true,
          });
        }
      };

      await upsertLine('83', balances.net83);
      await upsertLine('84', balances.toPay84);
      await upsertLine('85', balances.reclaimable85);
      await upsertLine('86', balances.carryforward86);

      await supabase
        .from('vat_returns')
        .update({
          prev_period_carryforward: newVal * 1000,
          net_result: balances.net83 * 1000,
          amount_to_pay: balances.toPay84 * 1000,
          amount_reclaimable: balances.reclaimable85 * 1000,
          amount_carryforward: balances.carryforward86 * 1000,
        })
        .eq('id', returnId);

      return { newVal, net83: balances.net83 };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['vat_return_lines'] });
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({
        title: 'Áthozat frissítve',
        description: `82. sor: ${result.newVal} eFt → 83. sor: ${result.net83} eFt`,
      });
    },
    onError: (e: any) =>
      toast({ title: 'Áthozat mentési hiba', description: e.message, variant: 'destructive' }),
  });

  const saveDetailRow = useCallback(
    async (rowNumber: string, base: number, tax: number) => {
      if (!vatReturn?.id) return;
      setIsSavingLine(true);
      const { error } = await supabase.from('vat_return_lines').upsert(
        {
          vat_return_id: (vatReturn as any).id,
          row_number: rowNumber,
          base_amount: base * 1000,
          tax_amount: tax * 1000,
          base_amount_rounded: base,
          tax_amount_rounded: tax,
          is_calculated: false,
        } as any,
        { onConflict: 'vat_return_id,row_number' }
      );
      if (error) {
        reportError({
          type: 'db_query',
          component: 'VatReturnPage',
          action: 'error',
          message: 'Detail row save error:',
          error,
        });
        toast({ title: 'Mentési hiba', description: error.message, variant: 'destructive' });
      } else {
        qc.invalidateQueries({ queryKey: ['vat_return_lines', (vatReturn as any).id] });
        qc.invalidateQueries({
          queryKey: ['vat_return', selectedCompany?.id, year, month, frequency],
        });
      }
      setIsSavingLine(false);
    },
    [vatReturn, qc, toast, selectedCompany?.id, year, month, frequency]
  );

  const handleDetailEdit = useCallback(
    (rowNumber: string, field: 'base' | 'tax', value: string) => {
      const numVal = value === '' ? 0 : parseInt(value, 10) || 0;
      setEditDrafts((prev) => {
        const existing = prev[rowNumber] || {};
        const line = lineMap[rowNumber];
        const updated = {
          base: field === 'base' ? numVal : existing.base ?? line?.base_amount_rounded ?? 0,
          tax: field === 'tax' ? numVal : existing.tax ?? line?.tax_amount_rounded ?? 0,
        };
        const next = { ...prev, [rowNumber]: updated };
        if (editTimerRef.current) clearTimeout(editTimerRef.current);
        editTimerRef.current = setTimeout(() => {
          saveDetailRow(rowNumber, updated.base!, updated.tax!);
          setEditDrafts((p) => {
            const n = { ...p };
            delete n[rowNumber];
            return n;
          });
        }, 800);
        return next;
      });
    },
    [lineMap, saveDetailRow]
  );

  const handleViesCheck = async (singleTaxNumber?: string) => {
    setIsValidatingVies(true);
    const taxNumsToCheck = singleTaxNumber
      ? [singleTaxNumber]
      : Array.from(
          new Set(
            a60Calculations.itemsList
              .map((item) => item.partner_tax_number)
              .filter(Boolean)
          )
        );

    if (taxNumsToCheck.length === 0) {
      setIsValidatingVies(false);
      toast({
        title: 'Nincs ellenőrizhető partner',
        description: 'Ebben az időszakban nem található közösségi (EU) adószámmal rendelkező tétel.',
      });
      return;
    }

    const loadingState: typeof viesStatuses = {};
    taxNumsToCheck.forEach((num) => {
      loadingState[num] = 'loading';
    });
    setViesStatuses((prev) => ({ ...prev, ...loadingState }));

    const resultsState: typeof viesStatuses = {};
    let liveCheckSucceeded = 0;

    await Promise.all(
      taxNumsToCheck.map(async (rawNum) => {
        const clean = rawNum.replace(/[\s.-]/g, '').trim().toUpperCase();
        if (!clean || clean.length < 4) {
          resultsState[rawNum] = 'invalid';
          return;
        }

        const countryCode = clean.slice(0, 2);
        const vatNumber = clean.slice(2);
        const isValidFormat = /^[A-Z]{2}[A-Z0-9+*.]{2,15}$/.test(clean);

        if (!isValidFormat) {
          resultsState[rawNum] = 'invalid';
          return;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const res = await fetch(
            `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`,
            {
              method: 'GET',
              headers: { Accept: 'application/json' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            resultsState[rawNum] = data.isValid ? 'valid' : 'invalid';
            liveCheckSucceeded++;
            return;
          }
          // Server returned error (e.g. 503 or invalid country), fallback to format
          resultsState[rawNum] = isValidFormat ? 'valid' : 'invalid';
        } catch {
          // Timeout or CORS/network failure -> graceful format validation fallback
          resultsState[rawNum] = isValidFormat ? 'valid' : 'invalid';
        }
      })
    );

    setViesStatuses((prev) => ({ ...prev, ...resultsState }));
    setIsValidatingVies(false);

    toast({
      title: 'VIES ellenőrzés befejezve',
      description:
        liveCheckSucceeded > 0
          ? `${taxNumsToCheck.length} db közösségi adószám lekérdezve az Európai Bizottság VIES adatbázisából.`
          : `${taxNumsToCheck.length} db adószám formátuma ellenőrizve (az EU VIES szerver közvetlenül nem volt elérhető).`,
    });
  };

  const runXmlValidationLocal = (xmlContent: string) => {
    setIsValidatingXml(true);
    const mTotal = getVal('105', 'tax');
    const dedTax = getVal('76', 'tax');
    const checks = runXmlValidation(
      xmlContent,
      selectedCompany?.tax_number || '',
      dedTax,
      mTotal
    );
    setXmlValidationResults(checks);
    setIsValidatingXml(false);
  };

  // Sync initial carryforward
  useEffect(() => {
    const val = getVal('82', 'tax') || prevLineMap['86']?.tax_amount_rounded || 0;
    setCarryforwardValue(String(val || ''));
  }, [lines.length, prevLines.length, getVal, prevLineMap]);

  // Auto-open sections on load
  useEffect(() => {
    if (lines.length > 0 && formRows.length > 0) {
      const withData = new Set<string>();
      for (const sec of ['payable', 'deductible', 'settlement']) {
        const sectionRows = formRows.filter((r: any) => r.section === sec);
        if (sectionRows.some((r: any) => lineMap[r.row_number])) withData.add(sec);
      }
      setOpenSections(withData);
    }
  }, [lines.length, formRows.length, lineMap, formRows]);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePartner = (id: string) =>
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filteredMLines = useMemo(() => {
    const q = partnerSearch.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return mLines;
    return mLines.filter((ml) => {
      const partnerNameNormalized = (ml.partner_name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const partnerTaxNormalized = ml.partner_tax_number || '';
      return partnerNameNormalized.includes(q) || partnerTaxNormalized.includes(q);
    });
  }, [mLines, partnerSearch]);

  return {
    selectedCompany,
    vatScope,
    year,
    setYear,
    month,
    setMonth,
    frequency,
    setFrequency,
    viewMode,
    setViewMode,
    vatReturn: effectiveVatReturn,
    isFinalized,
    lines: effectiveLines,
    mLines,
    filteredMLines,
    formRows,
    prevReturn,
    prevLines,
    lineMap: effectiveLineMap,
    prevLineMap,
    getVal,
    getPrevVal,
    unpaidVatEft,
    euInvoices,
    isEuInvoicesLoading,
    a60Calculations,
    partnerValidations,
    deadlineCountdown,
    postingAudit,
    reverseChargeSuspiciousInvoices,
    calculate,
    validateReturn,
    finalizeReturn,
    reopenReturn,
    saveCarryforward,
    carryforwardValue,
    setCarryforwardValue,
    saveDetailRow,
    handleDetailEdit,
    editDrafts,
    isSavingLine,
    viesStatuses,
    isValidatingVies,
    handleViesCheck,
    xmlValidationResults,
    isValidatingXml,
    runXmlValidationLocal,
    euTypeOverrides,
    setEuTypeOverrides,
    openSections,
    toggleSection,
    showAllRows,
    setShowAllRows,
    partnerSearch,
    setPartnerSearch,
    expandedPartners,
    togglePartner,
    expandedInvoice,
    setExpandedInvoice,
    expandedFormRow,
    setExpandedFormRow,
  };
}
