import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  legacy_code?: string | null;
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
    code: '',
    legacy_code: '',
    label: '',
    vat_percent: 27,
    direction: 'INBOUND' as 'OUTBOUND' | 'INBOUND',
    is_deductible: true,
    is_reverse_charge: false,
    is_eu: false,
    target_rows: [] as { row: string; col: 'base' | 'tax' }[],
    sort_order: 0,
  });

  React.useEffect(() => {
    if (code) {
      setForm({
        code: code.code,
        legacy_code: code.legacy_code || '',
        label: code.label,
        vat_percent: code.vat_percent,
        direction: code.direction,
        is_deductible: code.is_deductible,
        is_reverse_charge: code.is_reverse_charge,
        is_eu: code.is_eu,
        target_rows: code.target_rows || [],
        sort_order: code.sort_order,
      });
    } else {
      setForm({
        code: '',
        legacy_code: '',
        label: '',
        vat_percent: 27,
        direction: 'INBOUND',
        is_deductible: true,
        is_reverse_charge: false,
        is_eu: false,
        target_rows: [],
        sort_order: 0,
      });
    }
  }, [code, open]);

  const addRow = () => setForm(f => ({ ...f, target_rows: [...f.target_rows, { row: '07', col: 'base' }] }));
  const removeRow = (i: number) => setForm(f => ({ ...f, target_rows: f.target_rows.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
        <DialogHeader>
          <DialogTitle>{code ? 'Áfakód szerkesztése' : 'Új áfakód'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>NAV 2665 Kód *</Label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="pl. KIM_27, BE_27_LEV"
              />
            </div>
            <div>
              <Label>Könyvelői Kód (technikai)</Label>
              <Input
                value={form.legacy_code}
                onChange={e => setForm(f => ({ ...f, legacy_code: e.target.value }))}
                placeholder="pl. 25, FAD, TAM, 05"
              />
            </div>
          </div>
          <div>
            <Label>Megnevezés / Leírás (Számla Tooltip) *</Label>
            <Input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="pl. Kimenő 27% (belföldi értékesítés)"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Ez a megnevezés jelenik meg a számlatételek áfakód badge-ének tooltipjében.
            </p>
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
          <div className="flex flex-wrap gap-4 sm:gap-6">
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
            <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-hidden pr-1">
              {form.target_rows.map((tr, i) => (
                <div key={i} className="flex gap-2 items-center min-w-0 bg-muted/20 p-1.5 rounded-md border border-border/40">
                  <Select value={tr.row} onValueChange={v => setForm(f => ({ ...f, target_rows: f.target_rows.map((r, idx) => idx === i ? { ...r, row: v } : r) }))}>
                    <SelectTrigger className="w-24 shrink-0 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {formRows.map(fr => (
                        <SelectItem key={fr.row_number} value={fr.row_number}>
                          {fr.row_number}. sor
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={tr.col} onValueChange={v => setForm(f => ({ ...f, target_rows: f.target_rows.map((r, idx) => idx === i ? { ...r, col: v as 'base' | 'tax' } : r) }))}>
                    <SelectTrigger className="w-20 shrink-0 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Adóalap</SelectItem>
                      <SelectItem value="tax">Adó</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate" title={formRows.find(fr => fr.row_number === tr.row)?.label}>
                    {formRows.find(fr => fr.row_number === tr.row)?.label || ''}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={() =>
              onSave({
                ...(code ? { id: code.id } : {}),
                ...form,
                legacy_code: form.legacy_code.trim() || null,
              })
            }
            disabled={saving || !form.code || !form.label}
          >
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
  const { effectiveSettings, saveMutation: saveSettingsMutation } = useCompanySettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingCode, setEditingCode] = useState<VatCode | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const displayMode = effectiveSettings?.vat_code_display_mode || 'legacy';

  const { data: vatCodes = [], isLoading } = useQuery({
    queryKey: ['vat_codes', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('vat_codes')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as VatCode[];
    },
    enabled: !!selectedCompany?.id,
  });

  const companyCountry = selectedCompany?.country_code || 'HU';
  const { data: formRows = [] } = useQuery({
    queryKey: ['vat_form_rows', companyCountry],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vat_form_rows')
        .select('*')
        .eq('country_code', companyCountry)
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
      // Also seed FAD-specific VAT codes for Hungarian companies
      if (companyCountry === 'HU') {
        const { error: fadError } = await supabase.rpc('seed_fad_vat_codes', { p_company_id: selectedCompany.id });
        if (fadError) console.warn('FAD seed warning:', fadError.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat_codes'] });
      toast({ title: 'Alapértelmezett áfakódok betöltve', description: 'FAD (fordított adózás) kódok is hozzáadva' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vat_codes').delete().eq('id', id);
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
        const { error } = await supabase.from('vat_codes').update(code as any).eq('id', code.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vat_codes').insert({ ...code, company_id: selectedCompany!.id } as any);
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
          <p className="text-sm text-muted-foreground">Párosítsd össze az áfakódokat a 2665-ös nyomtatvány soraival és a számlázási kódokkal</p>
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

      {/* Display Mode Switcher */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span>Számlákon megjelenő áfakód rendszer</span>
                <Badge variant="outline" className="text-[11px] font-normal">
                  {displayMode === 'legacy' ? 'Könyvelői kódok aktív' : 'NAV 2665 kódok aktív'}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Válaszd ki, hogy a számla tételeknél a konvencionális könyvelői kódok (pl. 25, FAD, TAM) vagy a hivatalos NAV 2665 kódok jelenjenek meg.
              </p>
            </div>
            <RadioGroup
              value={displayMode}
              onValueChange={(val: 'legacy' | 'nav') => {
                saveSettingsMutation.mutate(
                  { vat_code_display_mode: val },
                  {
                    onSuccess: () => {
                      toast({
                        title: 'Megjelenítési mód elmentve',
                        description: val === 'legacy'
                          ? 'A számlákon ezentúl a konvencionális könyvelői kódok (pl. 25, FAD, TAM) jelennek meg.'
                          : 'A számlákon ezentúl a hivatalos NAV 2665 kódok (pl. KIM_27, BE_27_LEV) jelennek meg.',
                      });
                    },
                  }
                );
              }}
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="legacy" id="mode-legacy" />
                <Label htmlFor="mode-legacy" className="cursor-pointer text-sm font-medium">
                  Könyvelői kódok <span className="text-xs text-muted-foreground font-normal">(pl. 25, FAD, TAM)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nav" id="mode-nav" />
                <Label htmlFor="mode-nav" className="cursor-pointer text-sm font-medium">
                  NAV 2665 kódok <span className="text-xs text-muted-foreground font-normal">(pl. KIM_27, BE_27_LEV)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

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
              <div>
                {/* Structured Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-muted/50 border-y border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider items-center">
                  <div className={cn("col-span-2 flex items-center gap-1.5", displayMode === 'nav' && "text-primary font-bold")}>
                    <span>NAV 2665 Kód</span>
                    {displayMode === 'nav' && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20 normal-case font-medium">
                        Aktív
                      </Badge>
                    )}
                  </div>
                  <div className={cn("col-span-2 flex items-center gap-1.5", displayMode === 'legacy' && "text-primary font-bold")}>
                    <span>Könyvelői Kód</span>
                    {displayMode === 'legacy' && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20 normal-case font-medium">
                        Aktív
                      </Badge>
                    )}
                  </div>
                  <div className="col-span-3">Megnevezés / Leírás (Tooltip)</div>
                  <div className="col-span-1 text-center">Kulcs</div>
                  <div className="col-span-2">2665-ös Sorok</div>
                  <div className="col-span-1">Jelleg</div>
                  <div className="col-span-1 text-right">Műveletek</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/40">
                  {group.codes.map(code => (
                    <div key={code.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm hover:bg-muted/30 transition-colors">
                      <div className={cn("col-span-2 font-mono font-medium truncate", displayMode === 'nav' && "text-primary font-semibold")}>
                        {code.code}
                      </div>
                      <div className="col-span-2 font-mono">
                        {code.legacy_code ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono text-xs font-medium",
                              displayMode === 'legacy' ? "border-primary/40 bg-primary/5 text-primary font-semibold" : "text-muted-foreground"
                            )}
                          >
                            {code.legacy_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </div>
                      <div className="col-span-3 text-sm truncate" title={code.label}>
                        {code.label}
                      </div>
                      <div className="col-span-1 text-center">
                        <Badge variant="outline" className="text-xs">{code.vat_percent}%</Badge>
                      </div>
                      <div className="col-span-2 flex flex-wrap gap-1">
                        {code.target_rows && code.target_rows.length > 0 ? (
                          code.target_rows.map((tr, i) => (
                            <Badge key={i} variant="secondary" className="text-[11px] font-mono">
                              {tr.row}.sor {tr.col === 'base' ? '(alap)' : '(adó)'}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </div>
                      <div className="col-span-1 flex flex-wrap gap-1">
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
