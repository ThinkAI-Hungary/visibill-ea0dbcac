import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Settings2, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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
/*  VAT Code Configuration Tab                */
/* ────────────────────────────────────────── */
export function VatCodeConfigTab() {
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
      return (data || []) as unknown as FormRow[];
    },
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) throw new Error('No company');
      const { error } = await supabase.rpc('seed_default_vat_codes', { p_company_id: selectedCompany.id });
      if (error) throw error;
      // Also seed FAD-specific VAT codes
      const { error: fadError } = await supabase.rpc('seed_fad_vat_codes', { p_company_id: selectedCompany.id });
      if (fadError) console.warn('FAD seed warning:', fadError.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_codes'] });
      toast({ title: 'Alapértelmezett áfakódok betöltve', description: 'FAD (fordított adózás) kódok is hozzáadva' });
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
