import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, FileSpreadsheet, Calculator, Save, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Download, Pencil, Shield, Settings2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDateRange } from '@/contexts/DateRangeContext';
import { generateVatReturnPdf } from '@/lib/vatReturnPdf';
import { generateVatReturnXml } from '@/lib/vatReturnXml';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { reportError } from '@/lib/errorReporter';

// V5: Extracted components
import { VatCodeConfigTab } from '@/components/vat/VatCodeConfigTab';
import { VatRowDrillDown } from '@/components/vat/VatRowDrillDown';
import { VatTrendChart } from '@/components/vat/VatTrendChart';
import { ReturnHistoryTable } from '@/components/vat/ReturnHistoryTable';

/* ────────────────────────────────────────── */
/*  VAT Return View Tab                       */
/* ────────────────────────────────────────── */

interface ReturnLine { row_number: string; base_amount: number; tax_amount: number; base_amount_rounded: number; tax_amount_rounded: number; is_calculated: boolean; source_vat_codes: string[] | null; }
interface MLine { id: string; partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount: number; tax_18_amount: number; tax_27_amount: number; invoice_details: any[]; }

const MONTHS = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'];
const fmtEft = (v: number | null | undefined) => (v === null || v === undefined) ? '—' : `${v.toLocaleString('hu-HU')} eFt`;

function VatReturnViewTab() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() || 12); // prev month
  const [frequency, setFrequency] = useState<'H' | 'N'>('H'); // H=havi, N=negyedéves
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [expandedFormRow, setExpandedFormRow] = useState<string | null>(null);
  const togglePartner = (id: string) => setExpandedPartners(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  // Current return for this period
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
      if (error) { reportError({ type: 'db_query', component: 'VatReturnPage', action: 'error', message: 'vat_returns query error:', error: error }); return null; }
      return data as any;
    },
    enabled: !!selectedCompany?.id,
  });
  const isFinalized = (vatReturn as any)?.status === 'finalized';

  const { data: lines = [] } = useQuery({
    queryKey: ['vat_return_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase.from('vat_return_lines').select('*').eq('vat_return_id', vatReturn.id);
      if (error) { reportError({ type: 'db_query', component: 'VatReturnPage', action: 'error', message: 'vat_return_lines error:', error: error }); return []; }
      return (data || []) as unknown as ReturnLine[];
    },
    enabled: !!vatReturn?.id,
  });

  const { data: mLines = [] } = useQuery({
    queryKey: ['vat_return_m_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase.from('vat_return_m_lines').select('*').eq('vat_return_id', vatReturn.id).order('base_amount_rounded', { ascending: false });
      if (error) { reportError({ type: 'db_query', component: 'VatReturnPage', action: 'error', message: 'vat_return_m_lines error:', error: error }); return []; }
      return (data || []) as unknown as MLine[];
    },
    enabled: !!vatReturn?.id,
  });

  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vat_form_rows').select('*').order('sort_order');
      if (error) { reportError({ type: 'db_query', component: 'VatReturnPage', action: 'error', message: 'vat_form_rows error:', error: error }); return []; }
      return (data || []) as unknown as FormRow[];
    },
  });

  // Previous period for comparison
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
      const { data } = await supabase.from('vat_return_lines').select('row_number, base_amount_rounded, tax_amount_rounded').eq('vat_return_id', prevReturn.id);
      return (data || []) as unknown as ReturnLine[];
    },
    enabled: !!prevReturn?.id,
  });
  const prevLineMap: Record<string, ReturnLine> = {};
  prevLines.forEach(l => { prevLineMap[l.row_number] = l; });

  // Kintlévőségből származó ÁFA — unpaid outbound invoices' VAT in this period
  const { data: unpaidVatEft = 0 } = useQuery({
    queryKey: ['vat_unpaid_outbound', selectedCompany?.id, year, month, frequency],
    queryFn: async () => {
      // Calculate date range (same logic as the RPC)
      let dateFrom: string, dateTo: string;
      if (frequency === 'H') {
        dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      } else {
        const startMonth = (month - 1) * 3 + 1;
        dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
      }

      // Get all OUTBOUND NAV invoices in this period that have no transaction (unpaid)
      const { data: invoices, error } = await supabase
        .from('nav_invoices')
        .select('id')
        .eq('company_id', selectedCompany!.id)
        .eq('invoice_direction', 'OUTBOUND')
        .is('transaction_id', null)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      if (error || !invoices || invoices.length === 0) return 0;

      // Get VAT amounts for those invoice items
      const invoiceIds = invoices.map(i => i.id);
      let totalVat = 0;
      // Batch in chunks of 50 to avoid URI length limits
      for (let i = 0; i < invoiceIds.length; i += 50) {
        const chunk = invoiceIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from('nav_invoice_items')
          .select('vat_amount')
          .in('nav_invoice_id', chunk);
        if (items) {
          totalVat += items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
        }
      }
      return Math.round(totalVat / 1000); // Convert to eFt
    },
    enabled: !!selectedCompany?.id && !!vatReturn,
  });

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
      toast({ title: 'Számítás kész', description: `${year}/${String(month).padStart(2,'0')} bevallás generálva` });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  // V1: Status change mutations (previously inline onClick handlers)
  const validateReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase.from('vat_returns').update({ status: 'validated' }).eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Bevallás ellenőrzöttnek jelölve' });
    },
    onError: (e: any) => toast({ title: 'Státusz váltás hiba', description: e.message, variant: 'destructive' }),
  });

  const finalizeReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase.from('vat_returns').update({ status: 'finalized' }).eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Bevallás véglegesítve', description: 'Változtatás csak visszanyitás után lehetséges.' });
    },
    onError: (e: any) => toast({ title: 'Véglegesítés hiba', description: e.message, variant: 'destructive' }),
  });

  const reopenReturn = useMutation({
    mutationFn: async () => {
      if (!vatReturn?.id) throw new Error('Nincs bevallás');
      const { error } = await supabase.from('vat_returns').update({ status: 'draft' }).eq('id', (vatReturn as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Bevallás visszanyitva piszkozatba' });
    },
    onError: (e: any) => toast({ title: 'Visszanyitás hiba', description: e.message, variant: 'destructive' }),
  });

  // V3: Carryforward mutation (previously inline onBlur handler)
  const saveCarryforward = useMutation({
    mutationFn: async (newVal: number) => {
      const returnId = (vatReturn as any).id;
      if (!returnId) throw new Error('Nincs bevallás');
      // Update row 82
      const line82 = lines.find(l => l.row_number === '82');
      if (line82) {
        await supabase.from('vat_return_lines')
          .update({ tax_amount_rounded: newVal, tax_amount: newVal * 1000 })
          .eq('vat_return_id', returnId)
          .eq('row_number', '82');
      } else {
        await supabase.from('vat_return_lines')
          .insert({ vat_return_id: returnId, row_number: '82', tax_amount_rounded: newVal, tax_amount: newVal * 1000, is_calculated: false });
      }
      // Recalculate 83-86
      const payTax = getVal('36', 'tax');
      const dedTax = getVal('76', 'tax');
      const net83 = payTax - dedTax - newVal;
      const upsertLine = async (row: string, taxEft: number) => {
        const existing = lines.find(l => l.row_number === row);
        if (existing) {
          await supabase.from('vat_return_lines')
            .update({ tax_amount_rounded: taxEft, tax_amount: taxEft * 1000 })
            .eq('vat_return_id', returnId).eq('row_number', row);
        } else {
          await supabase.from('vat_return_lines')
            .insert({ vat_return_id: returnId, row_number: row, tax_amount_rounded: taxEft, tax_amount: taxEft * 1000, is_calculated: true });
        }
      };
      await upsertLine('83', net83);
      if (net83 > 0) {
        await upsertLine('84', net83);
        await upsertLine('85', 0);
        await upsertLine('86', 0);
      } else {
        await upsertLine('84', 0);
        await upsertLine('85', Math.abs(net83));
        await upsertLine('86', Math.abs(net83));
      }
      // Update header
      await supabase.from('vat_returns')
        .update({
          prev_period_carryforward: newVal * 1000,
          net_result: net83 * 1000,
          amount_to_pay: net83 > 0 ? net83 * 1000 : 0,
          amount_reclaimable: net83 < 0 ? Math.abs(net83) * 1000 : 0,
          amount_carryforward: net83 < 0 ? Math.abs(net83) * 1000 : 0,
        })
        .eq('id', returnId);
      return { newVal, net83 };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['vat_return_lines'] });
      qc.invalidateQueries({ queryKey: ['vat_return'] });
      toast({ title: 'Áthozat frissítve', description: `82. sor: ${result.newVal} eFt → 83. sor: ${result.net83} eFt` });
    },
    onError: (e: any) => toast({ title: 'Áthozat mentési hiba', description: e.message, variant: 'destructive' }),
  });

  // V3: Controlled carryforward state
  const [carryforwardValue, setCarryforwardValue] = useState<string>('');
  React.useEffect(() => {
    const val = getVal('82', 'tax') || prevLineMap['86']?.tax_amount_rounded || 0;
    setCarryforwardValue(String(val || ''));
  }, [lines.length, prevLines.length]);

  const lineMap = useMemo(() => {
    const m: Record<string, ReturnLine> = {};
    for (const l of lines) m[l.row_number] = l;
    return m;
  }, [lines]);

  const getVal = (row: string, col: 'base' | 'tax') => {
    const line = lineMap[row];
    if (!line) return 0;
    const val = col === 'base' ? line.base_amount_rounded : line.tax_amount_rounded;
    return val ?? 0;
  };

  const getPrevVal = (row: string, col: 'base' | 'tax') => {
    const line = prevLineMap[row];
    if (!line) return 0;
    const val = col === 'base' ? line.base_amount_rounded : line.tax_amount_rounded;
    return val ?? 0;
  };

  const hasPrevData = prevLines.length > 0;

  const DeltaBadge = ({ current, prev }: { current: number; prev: number }) => {
    if (!hasPrevData || prev === 0) return null;
    const delta = current - prev;
    const pct = Math.round((delta / Math.abs(prev)) * 100);
    if (delta === 0) return null;
    return (
      <span className={cn("text-[10px] ml-1.5 tabular-nums", delta > 0 ? 'text-red-400' : 'text-emerald-500')}>
        {delta > 0 ? '↑' : '↓'}{Math.abs(pct)}%
      </span>
    );
  };

  // Auto-open sections that have data
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);

  const filteredMLines = useMemo(() => {
    const q = partnerSearch.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return mLines;
    return mLines.filter(ml => {
      const partnerNameNormalized = (ml.partner_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const partnerTaxNormalized = ml.partner_tax_number || '';
      return partnerNameNormalized.includes(q) || partnerTaxNormalized.includes(q);
    });
  }, [mLines, partnerSearch]);

  // ── Inline editing for detail rows ──
  const [editDrafts, setEditDrafts] = useState<Record<string, { base?: number; tax?: number }>>({}); 
  const editTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const saveDetailRow = React.useCallback(async (rowNumber: string, base: number, tax: number) => {
    if (!vatReturn?.id) return;
    setIsSavingLine(true);
    const { error } = await supabase
      .from('vat_return_lines')
      .upsert({
        vat_return_id: (vatReturn as any).id,
        row_number: rowNumber,
        base_amount: base * 1000,
        tax_amount: tax * 1000,
        base_amount_rounded: base,
        tax_amount_rounded: tax,
        is_calculated: false,
      } as any, { onConflict: 'vat_return_id,row_number' });
    if (error) {
      reportError({ type: 'db_query', component: 'VatReturnPage', action: 'error', message: 'Detail row save error:', error: error });
      toast({ title: 'Mentési hiba', description: error.message, variant: 'destructive' });
    } else {
      qc.invalidateQueries({ queryKey: ['vat_return_lines', (vatReturn as any).id] });
      qc.invalidateQueries({ queryKey: ['vat_return', selectedCompany?.id, year, month, frequency] });
    }
    setIsSavingLine(false);
  }, [vatReturn, qc, toast, selectedCompany?.id, year, month, frequency]);

  const handleDetailEdit = React.useCallback((rowNumber: string, field: 'base' | 'tax', value: string) => {
    const numVal = value === '' ? 0 : parseInt(value, 10) || 0;
    setEditDrafts(prev => {
      const existing = prev[rowNumber] || {};
      const line = lineMap[rowNumber];
      const updated = {
        base: field === 'base' ? numVal : (existing.base ?? line?.base_amount_rounded ?? 0),
        tax: field === 'tax' ? numVal : (existing.tax ?? line?.tax_amount_rounded ?? 0),
      };
      const next = { ...prev, [rowNumber]: updated };
      // Debounce save
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
      editTimerRef.current = setTimeout(() => {
        saveDetailRow(rowNumber, updated.base!, updated.tax!);
        setEditDrafts(p => { const n = { ...p }; delete n[rowNumber]; return n; });
      }, 800);
      return next;
    });
  }, [lineMap, saveDetailRow]);

  // When lines change (after calculate), auto-open relevant sections
  React.useEffect(() => {
    if (lines.length > 0 && formRows.length > 0) {
      const withData = new Set<string>();
      for (const sec of ['payable', 'deductible', 'settlement']) {
        const sectionRows = formRows.filter((r: any) => r.section === sec);
        if (sectionRows.some((r: any) => lineMap[r.row_number])) withData.add(sec);
      }
      setOpenSections(withData);
    }
  }, [lines.length, formRows.length]);

  const toggleSection = (key: string) => setOpenSections(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Section groups for rendering
  const sections = [
    { key: 'payable', title: 'Fizetendő általános forgalmi adó (01–36)', page: 'A-01', icon: '📤' },
    { key: 'detail', title: 'Részletező sorok (37–62)', page: 'A-02', icon: '📋' },
    { key: 'deductible', title: 'Levonható ÁFA (63–79)', page: 'A-02/03', icon: '📥' },
    { key: 'settlement', title: 'Elszámolás (82–86)', page: 'A-03', icon: '⚖️' },
    { key: 'm_sheet', title: 'M-lap összesítő (105–109)', page: 'A-05', icon: '📊' },
  ];

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-5 page-animate">
      {/* Period Selector + Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
          {/* Frequency toggle */}
          <div className="flex bg-muted/50 border rounded-lg p-0.5">
            <button
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", frequency === 'H' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => { if (frequency === 'N') { setMonth((month - 1) * 3 + 1); } setFrequency('H'); }}
            >Havi</button>
            <button
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", frequency === 'N' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => { setFrequency('N'); setMonth(Math.ceil(month / 3)); }}
            >Negyedéves</button>
          </div>
          <div className="border-l pl-3 border-border/60 flex items-center gap-2">
            <Select value={String(year)} onValueChange={v => setYear(+v)}>
              <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {frequency === 'H' ? (
              <Select value={String(month)} onValueChange={v => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {String(i + 1).padStart(2, '0')} — {MONTHS[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={String(month)} onValueChange={v => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (jan–márc)</SelectItem>
                  <SelectItem value="2">Q2 (ápr–jún)</SelectItem>
                  <SelectItem value="3">Q3 (júl–szept)</SelectItem>
                  <SelectItem value="4">Q4 (okt–dec)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => calculate.mutate()} disabled={calculate.isPending || isFinalized} size="sm" className="h-9 gap-2">
            {calculate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {isFinalized ? 'Véglegesítve' : 'Számítás'}
          </Button>
          <div className="border-l pl-2 border-border/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!vatReturn} size="sm" className="h-9 gap-2">
                  <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                if (!vatReturn || !selectedCompany) return;
                generateVatReturnPdf({
                  companyName: selectedCompany.name || '',
                  companyTaxNumber: (selectedCompany as any).tax_number || '',
                  companyAddress: (selectedCompany as any).address || '',
                  periodYear: year,
                  periodMonth: month,
                  frequency,
                  formRows: formRows as any[],
                  lines: lines as any[],
                  mLines: mLines as any[],
                });
              }}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> PDF nyomtatás
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (!vatReturn || !selectedCompany) return;
                generateVatReturnXml({
                  companyName: selectedCompany.name || '',
                  companyTaxNumber: (selectedCompany as any).tax_number || '',
                  companyAddress: (selectedCompany as any).address || '',
                  periodYear: year,
                  periodMonth: month,
                  frequency,
                  lines: lines as any[],
                  mLines: mLines as any[],
                });
              }}>
                <Download className="w-4 h-4 mr-2" /> ÁNYK XML letöltés
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </div>

      {/* Status Bar */}
      {vatReturn && (
        <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-xs text-muted-foreground">Státusz:</span>
          <Badge className={cn("text-xs", {
            'bg-amber-500/10 text-amber-600 border-amber-500/20': (vatReturn as any).status === 'draft',
            'bg-blue-500/10 text-blue-600 border-blue-500/20': (vatReturn as any).status === 'validated',
            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': (vatReturn as any).status === 'finalized',
          })}>
            {(vatReturn as any).status === 'draft' ? 'Piszkozat' : (vatReturn as any).status === 'validated' ? 'Ellenőrzött' : 'Véglegesítve'}
          </Badge>
          <div className="ml-auto flex gap-2">
            {(vatReturn as any).status === 'draft' && (
              <Button variant="outline" size="sm" onClick={() => validateReturn.mutate()} disabled={validateReturn.isPending}>
                {validateReturn.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />} Ellenőrzés kész
              </Button>
            )}
            {(vatReturn as any).status === 'validated' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={finalizeReturn.isPending}>
                    {finalizeReturn.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1.5" />} Véglegesítés
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bevallás véglegesítése</AlertDialogTitle>
                    <AlertDialogDescription>
                      A véglegesítés után a bevallás sorai nem módosíthatók. Visszanyitás csak a „Visszanyitás" gombbal lehetséges.
                      <br /><br />
                      Biztosan véglegesíted a <strong>{year}/{String(month).padStart(2,'0')}</strong> időszak bevallását?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Mégse</AlertDialogCancel>
                    <AlertDialogAction onClick={() => finalizeReturn.mutate()}>
                      Véglegesítés
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(vatReturn as any).status === 'finalized' && (
              <Button variant="outline" size="sm" onClick={() => reopenReturn.mutate()} disabled={reopenReturn.isPending}>
                {reopenReturn.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Visszanyitás
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pénzforgalmi ÁFA banner */}
      {selectedCompany?.vat_regime === 'penzforgalmi' && (
        <div className="flex items-center gap-2.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            Ez a cég pénzforgalmi ÁFA elszámolást alkalmaz (Áfa tv. XIII/A. fejezet) — az ÁFA fizetési kötelezettség és levonási jog csak a tényleges kifizetéskor keletkezik.
          </span>
        </div>
      )}

      {/* Alanyi adómentes banner */}
      {selectedCompany?.vat_regime === 'alanyi_mentes' && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            Ez a cég alanyi adómentességet alkalmaz (Áfa tv. XIII. fejezet) — ÁFA felszámítási és bevallási kötelezettség nem áll fenn.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="relative">
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-200", isSavingLine && "opacity-60 pointer-events-none")} style={{ animationDelay: '100ms' }}>
          {[
            { label: 'Fizetendő ÁFA (36.)', value: getVal('36','tax'), prev: getPrevVal('36','tax'), color: 'text-red-500', bg: 'bg-red-500/10', borderColor: 'border-red-500/20', unpaidHint: unpaidVatEft > 0 ? `ebből kintlévőség: ${fmtEft(unpaidVatEft)}` : null },
            { label: 'Levonható ÁFA (76.)', value: getVal('76','tax'), prev: getPrevVal('76','tax'), color: 'text-emerald-600', bg: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', unpaidHint: null },
            { label: 'Egyenleg (83.)', value: getVal('83','tax'), prev: getPrevVal('83','tax'), color: getVal('83','tax') > 0 ? 'text-red-500' : 'text-emerald-600', bg: getVal('83','tax') > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10', borderColor: getVal('83','tax') > 0 ? 'border-red-500/20' : 'border-emerald-500/20', unpaidHint: unpaidVatEft > 0 ? `kintlévőség nélkül: ${fmtEft(getVal('83','tax') - unpaidVatEft)}` : null },
            { label: getVal('84','tax') ? 'Befizetendő (84.)' : 'Visszaigénylés (85.)', value: getVal('84','tax') || getVal('85','tax'), prev: getPrevVal('84','tax') || getPrevVal('85','tax'), color: getVal('84','tax') ? 'text-red-500' : 'text-emerald-600', bg: getVal('84','tax') ? 'bg-red-500/10' : 'bg-emerald-500/10', borderColor: getVal('84','tax') ? 'border-red-500/20' : 'border-emerald-500/20', unpaidHint: null },
          ].map((kpi, idx) => (
            <Card key={kpi.label} className={cn("border transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both", kpi.borderColor)} style={{ animationDelay: `${(idx * 75 + 50)}ms` }}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", kpi.bg)}>
                  <FileSpreadsheet className={cn("w-5 h-5", kpi.color)} />
                </div>
                <div className="min-w-0">
                  <div className={cn("text-2xl font-bold tabular-nums leading-tight", kpi.color)}>
                    {vatReturn ? fmtEft(kpi.value) : '—'}
                    <DeltaBadge current={kpi.value} prev={kpi.prev} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{kpi.label}</div>
                  {vatReturn && kpi.unpaidHint && (
                    <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{kpi.unpaidHint}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {isSavingLine && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px] rounded-xl z-20">
            <div className="flex items-center gap-2 bg-card border px-4 py-2 rounded-lg shadow-md animate-in zoom-in-95 duration-150">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-semibold text-foreground/80">Kalkuláció mentése...</span>
            </div>
          </div>
        )}
      </div>

      {/* V6: ÁFA Trend Chart (12 hónap) */}
      {vatReturn && (
        <VatTrendChart companyId={selectedCompany!.id} />
      )}

      {/* Carryforward + Validations */}
      {vatReturn && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Manual Carryforward (82. sor) */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Előző időszak áthozat (82. sor)</div>
                <Badge variant="outline" className="text-[10px]">manuálisan szerkeszthető</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">
                    Automatikus (előző hó 86. sor): {fmtEft(prevLineMap['86']?.tax_amount_rounded ?? 0)}
                    {prevLineMap['86']?.tax_amount_rounded != null && prevLineMap['86']?.tax_amount_rounded !== Number(carryforwardValue || 0) && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 ml-2 text-[10px] text-primary"
                        onClick={() => {
                          const prevVal = prevLineMap['86']?.tax_amount_rounded ?? 0;
                          setCarryforwardValue(String(prevVal));
                        }}
                      >
                        ← Betöltés
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      className="w-40 h-8 text-sm tabular-nums"
                      placeholder="eFt"
                      value={carryforwardValue}
                      onChange={(e) => setCarryforwardValue(e.target.value)}
                      disabled={isFinalized}
                    />
                    <span className="text-xs text-muted-foreground">eFt</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={saveCarryforward.isPending || isFinalized}
                      onClick={() => saveCarryforward.mutate(Number(carryforwardValue) || 0)}
                    >
                      {saveCarryforward.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Warnings */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2">Ellenőrzési pontok</div>
              <div className="space-y-1.5">
                {(() => {
                  const warnings: { msg: string; type: 'ok' | 'warn' | 'error' }[] = [];
                  // Check: has VAT codes
                  const payTax = getVal('36', 'tax');
                  const dedTax = getVal('76', 'tax');

                  if (payTax === 0 && dedTax === 0) {
                    warnings.push({ msg: 'Nincs fizetendő és levonható ÁFA az időszakban', type: 'warn' });
                  } else {
                    warnings.push({ msg: `Fizetendő: ${fmtEft(payTax)}, Levonható: ${fmtEft(dedTax)}`, type: 'ok' });
                  }
                  // Check: M-lap vs deductible
                  const mTotal = getVal('105', 'tax');
                  if (dedTax > 0 && mTotal === 0) {
                    warnings.push({ msg: 'M-lap üres, de van levonható ÁFA — ellenőrizd a partner adószámokat', type: 'warn' });
                  } else if (mTotal > 0) {
                    warnings.push({ msg: `M-lap összesítő: ${fmtEft(mTotal)} (${mLines.length} partner)`, type: 'ok' });
                  }
                  // Check: carryforward
                  const carry = getVal('86', 'tax');
                  if (carry > 0) {
                    warnings.push({ msg: `Következő hónapra átvihető: ${fmtEft(carry)}`, type: 'ok' });
                  }

                  return warnings.map((w, i) => (
                    <div key={i} className={cn("flex items-center gap-2 text-xs", w.type === 'ok' ? 'text-emerald-600' : w.type === 'warn' ? 'text-amber-600' : 'text-red-500')}>
                      {w.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      {w.msg}
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* A-Lap Table */}
      {!vatReturn ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nyomd meg a „Számítás" gombot a bevallás generálásához</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Show all rows toggle */}
          <div className="flex items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showAllRows} onCheckedChange={setShowAllRows} className="scale-75" />
              Minden sor megjelenítése
            </label>
          </div>

          {sections.map(sec => {
            const sectionRows = formRows.filter(r => r.section === sec.key);
            const rowsWithData = sectionRows.filter(r => lineMap[r.row_number]);
            const hasData = rowsWithData.length > 0;
            const isOpen = openSections.has(sec.key);
            const displayRows = (sec.key === 'detail' || showAllRows) ? sectionRows : sectionRows.filter(r => lineMap[r.row_number] || r.is_summary);
            const isEditable = sec.key === 'detail' && !isFinalized;
            // Section total for badge
            const summaryRow = sectionRows.find(r => r.is_summary);
            const summaryTax = summaryRow ? getVal(summaryRow.row_number, 'tax') : 0;

            return (
              <Card key={sec.key} className={cn("overflow-hidden transition-all hover:shadow-sm", hasData ? "border-l-2 border-l-primary/40 border-border/60" : "border-border/40")}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => toggleSection(sec.key)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("transition-transform duration-200", isOpen && "rotate-90")}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-base">{sec.icon}</span>
                    <span className="font-medium text-sm">{sec.title}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">{sec.page}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasData && summaryTax !== 0 && (
                      <span className="text-sm font-semibold tabular-nums text-primary">{fmtEft(summaryTax)}</span>
                    )}
                    {hasData && <Badge variant="secondary" className="text-[10px]">{rowsWithData.length} sor</Badge>}
                  </div>
                </button>
                {isOpen && displayRows.length > 0 && (
                  <div className="divide-y divide-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Editable hint for detail section */}
                    {isEditable && (
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary text-xs border-b border-primary/10">
                        <Pencil className="w-3 h-3" />
                        <span>Szerkeszthető — kattints a mezőkre az értékek kitöltéséhez (eFt-ban)</span>
                      </div>
                    )}
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                      <div className="col-span-1">Sor</div>
                      <div className={hasPrevData ? "col-span-3" : "col-span-7"}>Megnevezés</div>
                      <div className="col-span-2 text-right">{isEditable ? 'Adóalap (eFt)' : 'Adóalap'}</div>
                      <div className="col-span-2 text-right">{isEditable ? 'Adó (eFt)' : 'Adó'}</div>
                      {hasPrevData && <div className="col-span-2 text-right">Előző hó</div>}
                      {hasPrevData && <div className="col-span-2 text-right">Δ</div>}
                    </div>
                    {displayRows.map(row => {
                      const line = lineMap[row.row_number];
                      const prevLine = prevLineMap[row.row_number];
                      const isSummary = row.is_summary;
                      const curTax = line?.tax_amount_rounded ?? 0;
                      const prevTax = prevLine?.tax_amount_rounded ?? 0;
                      const delta = curTax - prevTax;
                      const hasDrillData = !!line && !isSummary && !line.is_calculated && line.source_vat_codes && line.source_vat_codes.length > 0;
                      const isDrillExpanded = expandedFormRow === row.row_number;
                      return (
                        <React.Fragment key={row.row_number}>
                        <div
                          className={cn(
                            "grid grid-cols-12 gap-2 px-4 py-1.5 text-sm items-center",
                            isSummary ? "bg-primary/5 font-semibold border-t-2 border-primary/20" : "hover:bg-muted/20",
                            !line && !isEditable && "opacity-40",
                            hasDrillData && "cursor-pointer",
                            isDrillExpanded && "bg-primary/5 border-l-2 border-l-primary"
                          )}
                          onClick={() => {
                            if (hasDrillData) setExpandedFormRow(isDrillExpanded ? null : row.row_number);
                          }}
                        >
                          <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center gap-1">
                            {hasDrillData && (
                              isDrillExpanded
                                ? <ChevronDown className="w-3 h-3 text-primary" />
                                : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                            )}
                            {row.row_number}.
                          </div>
                          <div className={cn("text-xs leading-snug truncate flex items-center gap-1.5", hasPrevData ? "col-span-3" : "col-span-7")} title={row.label}>
                            {row.label}
                            {/* V2: manual/auto badge for detail section */}
                            {isEditable && line && !isSummary && (
                              line.is_calculated
                                ? <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground/60">⚡ auto</span>
                                : <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600">✏️ kézi</span>
                            )}
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-xs">
                            {isEditable && row.has_base && !isSummary ? (
                              <input
                                type="number"
                                className="w-full text-right bg-muted/40 border border-border/80 rounded px-2 py-1 text-xs tabular-nums focus:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                value={editDrafts[row.row_number]?.base ?? (line?.base_amount_rounded || '')}
                                onChange={e => handleDetailEdit(row.row_number, 'base', e.target.value)}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              row.has_base && line ? fmtEft(line.base_amount_rounded) : ''
                            )}
                          </div>
                          <div className="col-span-2 text-right tabular-nums text-xs font-medium">
                            {isEditable && row.has_tax && !isSummary ? (
                              <input
                                type="number"
                                className="w-full text-right bg-muted/40 border border-border/80 rounded px-2 py-1 text-xs tabular-nums font-medium focus:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                value={editDrafts[row.row_number]?.tax ?? (line?.tax_amount_rounded || '')}
                                onChange={e => handleDetailEdit(row.row_number, 'tax', e.target.value)}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              row.has_tax && line ? fmtEft(line.tax_amount_rounded) : ''
                            )}
                          </div>
                          {hasPrevData && (
                            <div className="col-span-2 text-right tabular-nums text-muted-foreground text-xs">
                              {row.has_tax && prevLine ? fmtEft(prevTax) : ''}
                            </div>
                          )}
                          {hasPrevData && (
                            <div className={cn("col-span-2 text-right tabular-nums text-xs font-medium",
                              delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-500' : 'text-muted-foreground'
                            )}>
                              {line && prevLine && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('hu-HU')}` : ''}
                            </div>
                          )}
                        </div>
                        {isDrillExpanded && selectedCompany?.id && (
                          <VatRowDrillDown
                            sourceVatCodes={line!.source_vat_codes!}
                            companyId={selectedCompany.id}
                            year={year}
                            month={month}
                            frequency={frequency}
                          />
                        )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* M-Lap Partner Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                M-Lap - Belföldi összesítő
                <Badge variant="secondary" className="text-xs">
                  {filteredMLines.length === mLines.length ? `${mLines.length} partner` : `${filteredMLines.length} / ${mLines.length} találat`}
                </Badge>
              </CardTitle>
              {mLines.length > 0 && (
                <div className="relative w-full sm:w-64 print:hidden">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Partner keresése adószám/név..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/30 focus:bg-background transition-colors"
                  />
                  {partnerSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setPartnerSearch('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {filteredMLines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">
                  {mLines.length === 0 ? 'Nincs belföldi levonható számla az időszakban' : 'Nincs találat a keresési feltételekre'}
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                    <div className="col-span-3">Partner</div>
                    <div className="col-span-2">Adószám</div>
                    <div className="col-span-1 text-center">Számlák</div>
                    <div className="col-span-2 text-right">Adóalap (eFt)</div>
                    <div className="col-span-2 text-right">Adó (eFt)</div>
                    <div className="col-span-2 text-right">27% / 18% / 5%</div>
                  </div>
                  {filteredMLines.map(ml => (
                    <React.Fragment key={ml.id}>
                      <div
                        className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => togglePartner(ml.id)}
                      >
                        <div className="col-span-3 flex items-center gap-1.5 truncate">
                          {expandedPartners.has(ml.id) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{ml.partner_name}</span>
                        </div>
                        <div className="col-span-2 font-mono text-xs">{ml.partner_tax_number}</div>
                        <div className="col-span-1 text-center">{ml.invoice_count}</div>
                        <div className="col-span-2 text-right tabular-nums">{fmtEft(ml.base_amount_rounded)}</div>
                        <div className="col-span-2 text-right tabular-nums">{fmtEft(ml.tax_amount_rounded)}</div>
                        <div className="col-span-2 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round(ml.tax_27_amount / 1000)} / {Math.round(ml.tax_18_amount / 1000)} / {Math.round(ml.tax_5_amount / 1000)}
                        </div>
                      </div>
                      {expandedPartners.has(ml.id) && ml.invoice_details?.length > 0 && (
                        <div className="bg-muted/30 px-6 py-2 border-t border-border/20">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">Számlák:</div>
                          {/* Invoice header */}
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider pb-1 mb-1 border-b border-border/20 pl-4">
                            <div className="col-span-3">Számlaszám</div>
                            <div className="col-span-2">Teljesítés</div>
                            <div className="col-span-2 text-right">Nettó (eFt)</div>
                            <div className="col-span-2 text-right">ÁFA (eFt)</div>
                            <div className="col-span-3 text-right">ÁFA kulcs</div>
                          </div>
                          {(ml.invoice_details as any[]).map((inv: any, i: number) => {
                            const invKey = `${ml.id}_${inv.invoice_number}_${i}`;
                            const isInvExpanded = expandedInvoice === invKey;
                            return (
                              <React.Fragment key={i}>
                                <div
                                  className="grid grid-cols-12 gap-2 text-xs py-1.5 pl-4 transition-colors cursor-pointer hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                                  onClick={() => setExpandedInvoice(isInvExpanded ? null : invKey)}
                                >
                                  <div className="col-span-3 font-mono flex items-center gap-1">
                                    {isInvExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
                                    {inv.invoice_number}
                                  </div>
                                  <div className="col-span-2">{inv.delivery_date?.substring(0, 10)}</div>
                                  <div className="col-span-2 text-right tabular-nums">{Math.round((inv.net || 0) / 1000).toLocaleString('hu-HU')} eFt</div>
                                  <div className="col-span-2 text-right tabular-nums">{Math.round((inv.vat || 0) / 1000).toLocaleString('hu-HU')} eFt</div>
                                  <div className="col-span-3 text-right font-medium">{inv.vat_rate === '0.27' ? '27%' : inv.vat_rate === '0.18' ? '18%' : inv.vat_rate === '0.05' ? '5%' : inv.vat_rate}</div>
                                </div>
                                {/* Invoice items drill-down — live query */}
                                {isInvExpanded && (
                                  <InvoiceItemsDrillDown invoiceNumber={inv.invoice_number} companyId={selectedCompany!.id} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Previous Returns History */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Korábbi bevallások</CardTitle>
              <CardDescription className="text-xs">Gyors áttekintés és navigáció</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ReturnHistoryTable
                companyId={selectedCompany!.id}
                currentReturnId={(vatReturn as any)?.id}
                onNavigate={(y, m) => { setYear(y); setMonth(m); }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}



/* ────────────────────────────────────────── */
/*  Main Page                                 */
/* ────────────────────────────────────────── */
export default function VatReturnPage() {
  const { selectedCompany } = useCompany();

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Válassz céget a folytatáshoz</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6 print:py-0 page-animate">
      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb="ÁFA Bevallás (2665)"
        title="ÁFA Bevallás"
        description="2665-ös nyomtatvány — havi és negyedéves ÁFA bevallás generálás"
      />

      <Tabs defaultValue="return" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="return" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Calculator className="w-4 h-4" /> Bevallás
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Settings2 className="w-4 h-4" /> Beállítás
          </TabsTrigger>
        </TabsList>
        <TabsContent value="return">
          <VatReturnErrorBoundary><VatReturnViewTab /></VatReturnErrorBoundary>
        </TabsContent>
        <TabsContent value="config"><VatCodeConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}

class VatReturnErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Card className="border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Hiba történt a renderelés során</span>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => this.setState({ error: null })}>Újrapróbálás</Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

