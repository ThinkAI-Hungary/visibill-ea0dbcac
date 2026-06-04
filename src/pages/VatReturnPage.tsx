import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet, Settings2, Calculator, Plus, Trash2, Edit2, Save, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Download, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDateRange } from '@/contexts/DateRangeContext';
import { generateVatReturnPdf } from '@/lib/vatReturnPdf';
import { generateVatReturnXml } from '@/lib/vatReturnXml';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/* ────────────────────────────────────────── */
/*  Types                                     */
/* ────────────────────────────────────────── */
interface VatCode {
  id: string;
  company_id: string;
  code: string;
  label: string;
  vat_percent: number;
  direction: 'OUTBOUND' | 'INBOUND';
  is_deductible: boolean;
  is_reverse_charge: boolean;
  is_eu: boolean;
  target_rows: { row: string; col: 'base' | 'tax' }[];
  sort_order: number;
}

interface FormRow {
  row_number: string;
  section: string;
  page: string;
  label: string;
  has_base: boolean;
  has_tax: boolean;
  is_summary: boolean;
  sort_order: number;
}

/* ────────────────────────────────────────── */
/*  VAT Code Configuration Tab                */
/* ────────────────────────────────────────── */
function VatCodeConfigTab() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingCode, setEditingCode] = useState<VatCode | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const { data: vatCodes = [], isLoading } = useQuery({
    queryKey: ['vat_codes', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('vat_codes' as any)
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as VatCode[];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vat_form_rows' as any)
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as FormRow[];
    },
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) throw new Error('No company');
      const { error } = await supabase.rpc('seed_default_vat_codes', { p_company_id: selectedCompany.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_codes'] });
      toast({ title: 'Alapértelmezett áfakódok betöltve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vat_codes' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_codes'] });
      toast({ title: 'Áfakód törölve' });
    },
  });

  const saveCode = useMutation({
    mutationFn: async (code: Partial<VatCode>) => {
      if (code.id) {
        const { error } = await supabase.from('vat_codes' as any).update(code as any).eq('id', code.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vat_codes' as any).insert({ ...code, company_id: selectedCompany!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_codes'] });
      setShowDialog(false);
      setEditingCode(null);
      toast({ title: 'Áfakód mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const outbound = vatCodes.filter(c => c.direction === 'OUTBOUND');
  const inbound = vatCodes.filter(c => c.direction === 'INBOUND');

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Áfakód Beállítások</h2>
          <p className="text-sm text-muted-foreground">Párosítsd össze az áfakódokat a 2665-ös nyomtatvány soraival</p>
        </div>
        <div className="flex gap-2">
          {vatCodes.length === 0 && (
            <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
              {seedDefaults.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings2 className="w-4 h-4 mr-2" />}
              Alapértelmezettek betöltése
            </Button>
          )}
          <Button onClick={() => { setEditingCode(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Új áfakód
          </Button>
        </div>
      </div>

      {/* Code Groups */}
      {[
        { title: 'Kimenő (Értékesítés)', codes: outbound, color: 'text-emerald-600' },
        { title: 'Bejövő (Beszerzés)', codes: inbound, color: 'text-blue-600' },
      ].map(group => (
        <Card key={group.title} className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className={cn("text-base", group.color)}>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {group.codes.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nincs áfakód ebben a kategóriában</p>
            ) : (
              <div className="divide-y divide-border/40">
                {group.codes.map(code => (
                  <div key={code.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm hover:bg-muted/30 transition-colors">
                    <div className="col-span-2 font-mono font-medium">{code.code}</div>
                    <div className="col-span-3">{code.label}</div>
                    <div className="col-span-1 text-center">
                      <Badge variant="outline" className="text-xs">{code.vat_percent}%</Badge>
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {code.target_rows.map((tr, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-mono">
                          {tr.row}.sor {tr.col === 'base' ? '(alap)' : '(adó)'}
                        </Badge>
                      ))}
                    </div>
                    <div className="col-span-2 flex gap-1.5">
                      {code.is_reverse_charge && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">Ford.</Badge>}
                      {code.is_eu && <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">EU</Badge>}
                      {code.is_deductible && code.direction === 'INBOUND' && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Lev.</Badge>}
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCode(code); setShowDialog(true); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCode.mutate(code.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Edit/Create Dialog */}
      <VatCodeDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        code={editingCode}
        formRows={formRows}
        onSave={(c) => saveCode.mutate(c)}
        saving={saveCode.isPending}
      />
    </div>
  );
}

/* ────────────────────────────────────────── */
/*  VAT Code Edit Dialog                      */
/* ────────────────────────────────────────── */
function VatCodeDialog({ open, onOpenChange, code, formRows, onSave, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: VatCode | null;
  formRows: FormRow[];
  onSave: (c: Partial<VatCode>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    code: '', label: '', vat_percent: 27, direction: 'INBOUND' as string,
    is_deductible: true, is_reverse_charge: false, is_eu: false,
    target_rows: [] as { row: string; col: 'base' | 'tax' }[], sort_order: 0,
  });

  React.useEffect(() => {
    if (code) {
      setForm({
        code: code.code, label: code.label, vat_percent: code.vat_percent,
        direction: code.direction, is_deductible: code.is_deductible,
        is_reverse_charge: code.is_reverse_charge, is_eu: code.is_eu,
        target_rows: code.target_rows || [], sort_order: code.sort_order,
      });
    } else {
      setForm({ code: '', label: '', vat_percent: 27, direction: 'INBOUND', is_deductible: true, is_reverse_charge: false, is_eu: false, target_rows: [], sort_order: 0 });
    }
  }, [code, open]);

  const addRow = () => setForm(f => ({ ...f, target_rows: [...f.target_rows, { row: '07', col: 'base' }] }));
  const removeRow = (i: number) => setForm(f => ({ ...f, target_rows: f.target_rows.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{code ? 'Áfakód szerkesztése' : 'Új áfakód'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Kód</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="KIM_27" /></div>
            <div><Label>Megnevezés</Label><Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Kimenő 27%" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>ÁFA %</Label><Input type="number" value={form.vat_percent} onChange={e => setForm(f => ({ ...f, vat_percent: +e.target.value }))} /></div>
            <div>
              <Label>Irány</Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Kimenő</SelectItem>
                  <SelectItem value="INBOUND">Bejövő</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Sorrend</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} /></div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_deductible} onCheckedChange={v => setForm(f => ({ ...f, is_deductible: v }))} /> Levonható</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_reverse_charge} onCheckedChange={v => setForm(f => ({ ...f, is_reverse_charge: v }))} /> Fordított</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_eu} onCheckedChange={v => setForm(f => ({ ...f, is_eu: v }))} /> EU</label>
          </div>
          {/* Target Rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Cél sorok (2665)</Label>
              <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-3 h-3 mr-1" /> Sor</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {form.target_rows.map((tr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={tr.row} onValueChange={v => setForm(f => ({ ...f, target_rows: f.target_rows.map((r, idx) => idx === i ? { ...r, row: v } : r) }))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {formRows.map(fr => (
                        <SelectItem key={fr.row_number} value={fr.row_number}>
                          {fr.row_number}. sor
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={tr.col} onValueChange={v => setForm(f => ({ ...f, target_rows: f.target_rows.map((r, idx) => idx === i ? { ...r, col: v as 'base' | 'tax' } : r) }))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Adóalap</SelectItem>
                      <SelectItem value="tax">Adó</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {formRows.find(fr => fr.row_number === tr.row)?.label?.substring(0, 40)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => onSave({ ...(code ? { id: code.id } : {}), ...form } as any)} disabled={saving || !form.code || !form.label}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────── */
/*  VAT Return View Tab                       */
/* ────────────────────────────────────────── */

interface ReturnLine { row_number: string; base_amount: number; tax_amount: number; base_amount_rounded: number; tax_amount_rounded: number; is_calculated: boolean; source_vat_codes: string[] | null; }
interface MLine { id: string; partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount: number; tax_18_amount: number; tax_27_amount: number; invoice_details: any[]; }

const MONTHS = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'];
const fmtEft = (v: number | null | undefined) => (v === null || v === undefined) ? '—' : `${v.toLocaleString('hu-HU')} eFt`;

/** Live-fetches invoice items when an invoice row is expanded */
function InvoiceItemsDrillDown({ invoiceNumber, companyId }: { invoiceNumber: string; companyId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['nav_invoice_items_drill', companyId, invoiceNumber],
    queryFn: async () => {
      // Find the invoice by number, then get its items
      const { data: inv } = await supabase
        .from('nav_invoices' as any)
        .select('id')
        .eq('company_id', companyId)
        .eq('invoice_number', invoiceNumber)
        .limit(1)
        .maybeSingle();
      if (!inv?.id) return [];
      const { data: items } = await supabase
        .from('nav_invoice_items' as any)
        .select('line_number, line_description, quantity, unit_price, net_amount, vat_amount, vat_rate')
        .eq('nav_invoice_id', inv.id)
        .order('line_number');
      return (items || []) as any[];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Tételek betöltése...
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="px-4 py-2 text-xs text-muted-foreground italic">Nincs tétel ehhez a számlához</div>;
  }

  return (
    <div className="bg-background/50 border border-border/20 rounded mx-4 mb-2 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/10 border-b border-border/10">
        <div className="col-span-4">Megnevezés</div>
        <div className="col-span-2 text-right">Mennyiség</div>
        <div className="col-span-2 text-right">Egységár</div>
        <div className="col-span-2 text-right">Nettó</div>
        <div className="col-span-2 text-right">ÁFA</div>
      </div>
      {items.map((item: any, j: number) => (
        <div key={j} className="grid grid-cols-12 gap-2 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors">
          <div className="col-span-4 truncate" title={item.line_description}>{item.line_description || '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{item.quantity != null ? Number(item.quantity).toLocaleString('hu-HU') : '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{item.unit_price != null ? Number(item.unit_price).toLocaleString('hu-HU') : '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{Number(item.net_amount || 0).toLocaleString('hu-HU')} Ft</div>
          <div className="col-span-2 text-right tabular-nums">{Number(item.vat_amount || 0).toLocaleString('hu-HU')} Ft</div>
        </div>
      ))}
    </div>
  );
}

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
        .from('vat_returns' as any)
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .eq('period_year', year)
        .eq('period_month', month)
        .eq('frequency', frequency)
        .maybeSingle();
      if (error) { console.error('vat_returns query error:', error); return null; }
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
  const isFinalized = (vatReturn as any)?.status === 'finalized';

  const { data: lines = [] } = useQuery({
    queryKey: ['vat_return_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase.from('vat_return_lines' as any).select('*').eq('vat_return_id', vatReturn.id);
      if (error) { console.error('vat_return_lines error:', error); return []; }
      return (data || []) as ReturnLine[];
    },
    enabled: !!vatReturn?.id,
  });

  const { data: mLines = [] } = useQuery({
    queryKey: ['vat_return_m_lines', vatReturn?.id],
    queryFn: async () => {
      if (!vatReturn?.id) return [];
      const { data, error } = await supabase.from('vat_return_m_lines' as any).select('*').eq('vat_return_id', vatReturn.id).order('base_amount_rounded', { ascending: false });
      if (error) { console.error('vat_return_m_lines error:', error); return []; }
      return (data || []) as MLine[];
    },
    enabled: !!vatReturn?.id,
  });

  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vat_form_rows' as any).select('*').order('sort_order');
      if (error) { console.error('vat_form_rows error:', error); return []; }
      return (data || []) as FormRow[];
    },
  });

  // Previous period for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: prevReturn } = useQuery({
    queryKey: ['vat_return_prev', selectedCompany?.id, prevYear, prevMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('vat_returns' as any)
        .select('id, total_payable_tax, total_deductible_tax, net_result')
        .eq('company_id', selectedCompany!.id)
        .eq('period_year', prevYear)
        .eq('period_month', prevMonth)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: prevLines = [] } = useQuery({
    queryKey: ['vat_return_lines_prev', prevReturn?.id],
    queryFn: async () => {
      if (!prevReturn?.id) return [];
      const { data } = await supabase.from('vat_return_lines' as any).select('row_number, base_amount_rounded, tax_amount_rounded').eq('vat_return_id', prevReturn.id);
      return (data || []) as ReturnLine[];
    },
    enabled: !!prevReturn?.id,
  });
  const prevLineMap: Record<string, ReturnLine> = {};
  prevLines.forEach(l => { prevLineMap[l.row_number] = l; });

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

  // ── Inline editing for detail rows ──
  const [editDrafts, setEditDrafts] = useState<Record<string, { base?: number; tax?: number }>>({}); 
  const editTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const saveDetailRow = React.useCallback(async (rowNumber: string, base: number, tax: number) => {
    if (!vatReturn?.id) return;
    const { error } = await supabase
      .from('vat_return_lines' as any)
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
      console.error('Detail row save error:', error);
      toast({ title: 'Mentési hiba', description: error.message, variant: 'destructive' });
    } else {
      qc.invalidateQueries({ queryKey: ['vat_return_lines', (vatReturn as any).id] });
    }
  }, [vatReturn, qc, toast]);

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
              <Button variant="outline" size="sm" onClick={async () => {
                await supabase.from('vat_returns' as any).update({ status: 'validated' } as any).eq('id', (vatReturn as any).id);
                qc.invalidateQueries({ queryKey: ['vat_return'] });
                toast({ title: 'Bevallás ellenőrzöttnek jelölve' });
              }}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Ellenőrzés kész
              </Button>
            )}
            {(vatReturn as any).status === 'validated' && (
              <Button size="sm" onClick={async () => {
                await supabase.from('vat_returns' as any).update({ status: 'finalized' } as any).eq('id', (vatReturn as any).id);
                qc.invalidateQueries({ queryKey: ['vat_return'] });
                toast({ title: 'Bevallás véglegesítve', description: 'Változtatás csak visszanyitás után lehetséges.' });
              }}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Véglegesítés
              </Button>
            )}
            {(vatReturn as any).status === 'finalized' && (
              <Button variant="outline" size="sm" onClick={async () => {
                await supabase.from('vat_returns' as any).update({ status: 'draft' } as any).eq('id', (vatReturn as any).id);
                qc.invalidateQueries({ queryKey: ['vat_return'] });
                toast({ title: 'Bevallás visszanyitva piszkozatba' });
              }}>
                Visszanyitás
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Fizetendő ÁFA (36.)', value: getVal('36','tax'), prev: getPrevVal('36','tax'), color: 'text-red-500', bg: 'bg-red-500/10', borderColor: 'border-red-500/20' },
          { label: 'Levonható ÁFA (76.)', value: getVal('76','tax'), prev: getPrevVal('76','tax'), color: 'text-emerald-600', bg: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
          { label: 'Egyenleg (83.)', value: getVal('83','tax'), prev: getPrevVal('83','tax'), color: getVal('83','tax') > 0 ? 'text-red-500' : 'text-emerald-600', bg: getVal('83','tax') > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10', borderColor: getVal('83','tax') > 0 ? 'border-red-500/20' : 'border-emerald-500/20' },
          { label: getVal('84','tax') ? 'Befizetendő (84.)' : 'Visszaigénylés (85.)', value: getVal('84','tax') || getVal('85','tax'), prev: getPrevVal('84','tax') || getPrevVal('85','tax'), color: getVal('84','tax') ? 'text-red-500' : 'text-emerald-600', bg: getVal('84','tax') ? 'bg-red-500/10' : 'bg-emerald-500/10', borderColor: getVal('84','tax') ? 'border-red-500/20' : 'border-emerald-500/20' },
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      className="w-40 h-8 text-sm tabular-nums"
                      placeholder="eFt"
                      defaultValue={getVal('82', 'tax') || prevLineMap['86']?.tax_amount_rounded || ''}
                      onBlur={async (e) => {
                        const newVal = Number(e.target.value) || 0;
                        const returnId = (vatReturn as any).id;
                        // Update row 82
                        const lineId = lines.find(l => l.row_number === '82');
                        if (lineId) {
                          await supabase.from('vat_return_lines' as any)
                            .update({ tax_amount_rounded: newVal, tax_amount: newVal * 1000 } as any)
                            .eq('vat_return_id', returnId)
                            .eq('row_number', '82');
                        } else {
                          await supabase.from('vat_return_lines' as any)
                            .insert({ vat_return_id: returnId, row_number: '82', tax_amount_rounded: newVal, tax_amount: newVal * 1000, is_calculated: false } as any);
                        }

                        // Recalculate 83-86 based on new carryforward
                        const payTax = getVal('36', 'tax');
                        const dedTax = getVal('76', 'tax');
                        const net83 = payTax - dedTax - newVal;
                        const upsertLine = async (row: string, taxEft: number) => {
                          const existing = lines.find(l => l.row_number === row);
                          if (existing) {
                            await supabase.from('vat_return_lines' as any)
                              .update({ tax_amount_rounded: taxEft, tax_amount: taxEft * 1000 } as any)
                              .eq('vat_return_id', returnId).eq('row_number', row);
                          } else {
                            await supabase.from('vat_return_lines' as any)
                              .insert({ vat_return_id: returnId, row_number: row, tax_amount_rounded: taxEft, tax_amount: taxEft * 1000, is_calculated: true } as any);
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
                        await supabase.from('vat_returns' as any)
                          .update({
                            prev_period_carryforward: newVal * 1000,
                            net_result: net83 * 1000,
                            amount_to_pay: net83 > 0 ? net83 * 1000 : 0,
                            amount_reclaimable: net83 < 0 ? Math.abs(net83) * 1000 : 0,
                            amount_carryforward: net83 < 0 ? Math.abs(net83) * 1000 : 0,
                          } as any)
                          .eq('id', returnId);

                        qc.invalidateQueries({ queryKey: ['vat_return_lines'] });
                        qc.invalidateQueries({ queryKey: ['vat_return'] });
                        toast({ title: 'Áthozat frissítve', description: `82. sor: ${newVal} eFt → 83. sor: ${net83} eFt` });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">eFt</span>
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
                      return (
                        <div
                          key={row.row_number}
                          className={cn(
                            "grid grid-cols-12 gap-2 px-4 py-1.5 text-sm items-center",
                            isSummary ? "bg-primary/5 font-semibold border-t-2 border-primary/20" : "hover:bg-muted/20",
                            !line && !isEditable && "opacity-40"
                          )}
                        >
                          <div className="col-span-1 font-mono text-xs text-muted-foreground">{row.row_number}.</div>
                          <div className={cn("text-xs leading-snug truncate", hasPrevData ? "col-span-3" : "col-span-7")} title={row.label}>{row.label}</div>
                          <div className="col-span-2 text-right tabular-nums text-xs">
                            {isEditable && row.has_base && !isSummary ? (
                              <input
                                type="number"
                                className="w-full text-right bg-muted/40 border border-border/80 rounded px-2 py-1 text-xs tabular-nums focus:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                value={editDrafts[row.row_number]?.base ?? (line?.base_amount_rounded || '')}
                                onChange={e => handleDetailEdit(row.row_number, 'base', e.target.value)}
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
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* M-Lap Partner Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center gap-2">
                M-Lap - Belföldi összesítő
                <Badge variant="secondary" className="text-xs">{mLines.length} partner</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {mLines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nincs belföldi levonható számla az időszakban</p>
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
                  {mLines.map(ml => (
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
/*  Return History Table                       */
/* ────────────────────────────────────────── */
type HistoryProps = { companyId: string; currentReturnId?: string; onNavigate: (y: number, m: number) => void };
function ReturnHistoryTable({ companyId, currentReturnId, onNavigate }: HistoryProps) {
  const { data: history = [] } = useQuery({
    queryKey: ['vat_return_history', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vat_returns' as any)
        .select('id, period_year, period_month, status, total_payable_tax, total_deductible_tax, net_result, amount_to_pay, amount_reclaimable, updated_at')
        .eq('company_id', companyId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(12);
      return (data || []) as any[];
    },
  });

  if (history.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-muted-foreground">Még nincs korábbi bevallás</div>;
  }

  const statusLabel = (s: string) => s === 'draft' ? 'Piszkozat' : s === 'validated' ? 'Ellenőrzött' : 'Végleges';
  const statusColor = (s: string) => s === 'draft' ? 'bg-amber-500/10 text-amber-600' : s === 'validated' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600';

  return (
    <div className="divide-y divide-border/30">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
        <div className="col-span-2">Időszak</div>
        <div className="col-span-2">Státusz</div>
        <div className="col-span-2 text-right">Fizetendő</div>
        <div className="col-span-2 text-right">Levonható</div>
        <div className="col-span-2 text-right">Egyenleg</div>
        <div className="col-span-2 text-right">Utoljára</div>
      </div>
      {history.map((ret: any) => (
        <button
          key={ret.id}
          className={cn(
            "grid grid-cols-12 gap-2 px-4 py-2.5 text-sm w-full text-left hover:bg-muted/30 transition-colors",
            ret.id === currentReturnId && "bg-primary/5 border-l-2 border-l-primary"
          )}
          onClick={() => onNavigate(ret.period_year, ret.period_month)}
        >
          <div className="col-span-2 font-medium">{ret.period_year}/{String(ret.period_month).padStart(2, '0')}</div>
          <div className="col-span-2"><Badge className={cn("text-[10px]", statusColor(ret.status))}>{statusLabel(ret.status)}</Badge></div>
          <div className="col-span-2 text-right tabular-nums text-red-500">{fmtEft(Math.round((ret.total_payable_tax || 0) / 1000))}</div>
          <div className="col-span-2 text-right tabular-nums text-emerald-600">{fmtEft(Math.round((ret.total_deductible_tax || 0) / 1000))}</div>
          <div className={cn("col-span-2 text-right tabular-nums font-medium", (ret.net_result || 0) > 0 ? 'text-red-500' : 'text-emerald-600')}>
            {fmtEft(Math.round((ret.net_result || 0) / 1000))}
          </div>
          <div className="col-span-2 text-right text-xs text-muted-foreground">{ret.updated_at?.substring(0, 10)}</div>
        </button>
      ))}
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

