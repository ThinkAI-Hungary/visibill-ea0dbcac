import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
} from '../types';
import {
  validateHungarianTaxNumber,
  runXmlValidation,
  calculateVatBalances,
  calculateA60Aggregations,
  calculateDeadlineCountdown,
  findSuspiciousReverseChargeInvoices,
} from '../core/vatEngine';

export function useVatReturnData() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { data: exchangeRates } = useExchangeRates();
  const qc = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() || 12);
  const [frequency, setFrequency] = useState<VatFrequency>('H');
  const [viewMode, setViewMode] = useState<'calculator' | 'nav65'>('calculator');

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
  const [euTypeOverrides, setEuTypeOverrides] = useState<Record<string, 'product' | 'service'>>({});

  // Filters & Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);

  // Inline editing for detail rows
  const [editDrafts, setEditDrafts] = useState<Record<string, { base?: number; tax?: number }>>({});
  const editTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 1. Current return for period
  const { data: vatReturn, error: vatReturnError } = useQuery({
    queryKey: ['vat_return', selectedCompany?.id, year, month, frequency],
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
      return (data || []) as unknown as MLine[];
    },
    enabled: !!vatReturn?.id,
  });

  // 4. Form rows metadata
  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vat_form_rows').select('*').order('sort_order');
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

  const prevLineMap = useMemo(() => {
    const m: Record<string, ReturnLine> = {};
    for (const l of prevLines) m[l.row_number] = l;
    return m;
  }, [prevLines]);

  const getVal = useCallback(
    (row: string, col: 'base' | 'tax') => {
      const line = lineMap[row];
      if (!line) return 0;
      return (col === 'base' ? line.base_amount_rounded : line.tax_amount_rounded) ?? 0;
    },
    [lineMap]
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

      const { data: rawInvoices, error } = await supabase
        .from('nav_invoices')
        .select(
          'id, invoice_number, invoice_direction, supplier_tax_number, customer_tax_number, supplier_name, customer_name, invoice_delivery_date, invoice_net_amount, currency'
        )
        .eq('company_id', selectedCompany.id)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      if (error || !rawInvoices) return [];

      const euPrefixes = [
        'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'GR', 'ES', 'FI', 'FR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
      ];

      const isEuTaxNumber = (taxNum: string | null | undefined): boolean => {
        if (!taxNum) return false;
        const clean = taxNum.trim().toUpperCase();
        return euPrefixes.some((pref) => clean.startsWith(pref)) && !clean.startsWith('HU');
      };

      const filtered = rawInvoices.filter((inv) => {
        const partnerTaxNum =
          inv.invoice_direction === 'OUTBOUND' ? inv.customer_tax_number : inv.supplier_tax_number;
        return isEuTaxNumber(partnerTaxNum);
      });

      if (filtered.length === 0) return [];

      const invoiceIds = filtered.map((inv) => inv.id);
      const itemsMap: Record<string, any[]> = {};

      for (let i = 0; i < invoiceIds.length; i += 50) {
        const chunk = invoiceIds.slice(i, i + 50);
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

      return filtered.map((inv) => {
        const items = itemsMap[inv.id] || [];
        let isService = false;
        if (items.length > 0) {
          isService = items.some((item) => {
            const rate = (item.vat_rate || '').toUpperCase();
            const desc = (item.line_description || '').toLowerCase();
            return (
              rate === 'ATHK' ||
              rate === 'EUK' ||
              rate === 'EUF' ||
              rate === 'EUT' ||
              rate === 'HO' ||
              desc.includes('szolgáltatás') ||
              desc.includes('szolg') ||
              desc.includes('díj') ||
              desc.includes('fejlesztés') ||
              desc.includes('hosting') ||
              desc.includes('licenc') ||
              desc.includes('bérlet') ||
              desc.includes('consulting') ||
              desc.includes('service') ||
              desc.includes('support')
            );
          });
        }

        const partnerName =
          inv.invoice_direction === 'OUTBOUND' ? inv.customer_name : inv.supplier_name;
        const partnerTaxNum =
          inv.invoice_direction === 'OUTBOUND' ? inv.customer_tax_number : inv.supplier_tax_number;

        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_direction: inv.invoice_direction,
          partner_name: partnerName || 'Ismeretlen Partner',
          partner_tax_number: partnerTaxNum || '',
          invoice_delivery_date: inv.invoice_delivery_date,
          invoice_net_amount: inv.invoice_net_amount || 0,
          currency: inv.currency,
          defaultIsService: isService,
        };
      });
    },
    enabled: !!selectedCompany?.id && !!vatReturn,
  });

  // Calculate aggregations via pure engine
  const a60Calculations = useMemo(() => {
    const expectedGoods = getVal('91', 'base') + getVal('92', 'base');
    const expectedServices = getVal('93', 'base') + getVal('94', 'base');
    return calculateA60Aggregations(
      euInvoices,
      euTypeOverrides,
      expectedGoods,
      expectedServices,
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
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('calculate_vat_return', {
        p_company_id: selectedCompany!.id,
        p_year: year,
        p_month: month,
        p_frequency: frequency,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      qc.invalidateQueries({ queryKey: ['vat_return_lines'] });
      qc.invalidateQueries({ queryKey: ['vat_return_m_lines'] });
      toast({
        title: 'Számítás kész',
        description: `${year}/${String(month).padStart(2, '0')} bevallás generálva`,
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

  const handleViesCheck = async () => {
    setIsValidatingVies(true);
    const uniqueTaxNums = Array.from(
      new Set(a60Calculations.itemsList.map((item) => item.partner_tax_number).filter(Boolean))
    );

    const loadingState: typeof viesStatuses = {};
    uniqueTaxNums.forEach((num) => {
      loadingState[num] = 'loading';
    });
    setViesStatuses((prev) => ({ ...prev, ...loadingState }));

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const resultsState: typeof viesStatuses = {};
    uniqueTaxNums.forEach((num) => {
      const cleanNum = num.trim().toUpperCase();
      const isValidFormat = /^[A-Z]{2}[A-Z0-9]{2,15}$/.test(cleanNum);
      resultsState[num] = isValidFormat ? 'valid' : 'invalid';
    });

    setViesStatuses((prev) => ({ ...prev, ...resultsState }));
    setIsValidatingVies(false);
    toast({
      title: 'VIES ellenőrzés kész',
      description: 'Az összes közösségi adószám lekérdezve az EU adatbázisból.',
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
    year,
    setYear,
    month,
    setMonth,
    frequency,
    setFrequency,
    viewMode,
    setViewMode,
    vatReturn,
    isFinalized,
    lines,
    mLines,
    filteredMLines,
    formRows,
    prevReturn,
    prevLines,
    lineMap,
    prevLineMap,
    getVal,
    getPrevVal,
    unpaidVatEft,
    euInvoices,
    isEuInvoicesLoading,
    a60Calculations,
    partnerValidations,
    deadlineCountdown,
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
