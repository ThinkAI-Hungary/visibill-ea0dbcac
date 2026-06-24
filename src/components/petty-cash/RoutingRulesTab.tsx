import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Save, Plus, Trash2, Edit2, Zap, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { PettyCashRegister, RoutingRule } from './types';
import { COMMON_CURRENCIES, SOURCE_LABELS } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ROUTING RULES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function RoutingRulesTab() {
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = selectedCompany?.id || '';
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);

  const { data: registers = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase.from('petty_cash_registers' as any).select('*').eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashRoutingRules(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_routing_rules' as any).select('*').eq('company_id', companyId).order('priority', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RoutingRule[];
    },
    enabled: !!companyId,
  });

  const registerMap = useMemo(() => {
    const m: Record<string, string> = {};
    registers.forEach(r => { m[r.id] = r.name; });
    return m;
  }, [registers]);

  const saveRule = useMutation({
    mutationFn: async (rule: Partial<RoutingRule>) => {
      if (rule.id) {
        const { error } = await supabase.from('petty_cash_routing_rules' as any)
          .update(rule as any).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('petty_cash_routing_rules' as any)
          .insert({ ...rule, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) });
      setShowDialog(false);
      setEditing(null);
      toast({ title: 'Szabály mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('petty_cash_routing_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) });
      toast({ title: 'Szabály törölve' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('petty_cash_routing_rules' as any)
        .update({ is_active: active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Routing szabályok</h2>
          <p className="text-sm text-muted-foreground">Automatikus hozzárendelés szabályok — a magasabb prioritású fut előbb</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={registers.length < 2}>
          <Plus className="w-4 h-4 mr-2" /> Új szabály
        </Button>
      </div>

      {registers.length < 2 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Zap className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Legalább 2 pénztár szükséges a routing szabályokhoz</p>
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Zap className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nincs routing szabály — minden tétel a default pénztárba kerül</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Prioritás</TableHead>
                  <TableHead>Feltétel</TableHead>
                  <TableHead>Cél pénztár</TableHead>
                  <TableHead className="w-20">Aktív</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.match_currency && <Badge variant="secondary" className="text-[10px]">Valuta: {rule.match_currency}</Badge>}
                        {rule.match_source_type && <Badge variant="secondary" className="text-[10px]">Típus: {SOURCE_LABELS[rule.match_source_type] || rule.match_source_type}</Badge>}
                        {rule.match_description_pattern && <Badge variant="secondary" className="text-[10px]">Leírás: {rule.match_description_pattern}</Badge>}
                        {rule.match_partner_pattern && <Badge variant="secondary" className="text-[10px]">Partner: {rule.match_partner_pattern}</Badge>}
                        {!rule.match_currency && !rule.match_source_type && !rule.match_description_pattern && !rule.match_partner_pattern && (
                          <span className="text-xs text-muted-foreground italic">Nincs feltétel (mindent elkapó)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{registerMap[rule.target_register_id] || '?'}</TableCell>
                    <TableCell>
                      <Switch checked={rule.is_active} onCheckedChange={v => toggleActive.mutate({ id: rule.id, active: v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(rule); setShowDialog(true); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rule Dialog */}
      <RoutingRuleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        rule={editing}
        registers={registers}
        onSave={r => saveRule.mutate(r)}
        saving={saveRule.isPending}
      />
    </div>
  );
}

function RoutingRuleDialog({ open, onOpenChange, rule, registers, onSave, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: RoutingRule | null;
  registers: PettyCashRegister[];
  onSave: (r: Partial<RoutingRule>) => void;
  saving: boolean;
}) {
  const nonDefault = registers.filter(r => !r.is_default);
  const [form, setForm] = useState({
    target_register_id: nonDefault[0]?.id || '',
    priority: 10,
    match_currency: '',
    match_source_type: '',
    match_description_pattern: '',
    match_partner_pattern: '',
    is_active: true,
  });

  React.useEffect(() => {
    if (rule) {
      setForm({
        target_register_id: rule.target_register_id,
        priority: rule.priority,
        match_currency: rule.match_currency || '',
        match_source_type: rule.match_source_type || '',
        match_description_pattern: rule.match_description_pattern || '',
        match_partner_pattern: rule.match_partner_pattern || '',
        is_active: rule.is_active,
      });
    } else {
      setForm({
        target_register_id: nonDefault[0]?.id || '',
        priority: 10,
        match_currency: '',
        match_source_type: '',
        match_description_pattern: '',
        match_partner_pattern: '',
        is_active: true,
      });
    }
  }, [rule, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? 'Szabály szerkesztése' : 'Új routing szabály'}</DialogTitle>
          <DialogDescription>Ha egy tétel megfelel a feltételeknek, automatikusan a cél pénztárba kerül.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cél pénztár</Label>
              <Select value={form.target_register_id} onValueChange={v => setForm(f => ({ ...f, target_register_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.is_default ? ' ⭐' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioritás</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} />
            </div>
          </div>
          <div className="border-t border-border/40 pt-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider mb-2 block">Feltételek (üres = nem szűr)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valuta</Label>
                <Select value={form.match_currency || '_none'} onValueChange={v => setForm(f => ({ ...f, match_currency: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Bármelyik</SelectItem>
                    {COMMON_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Forrás típus</Label>
                <Select value={form.match_source_type || '_none'} onValueChange={v => setForm(f => ({ ...f, match_source_type: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Bármelyik</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Leírás minta</Label>
                <Input className="h-8 text-xs" value={form.match_description_pattern} onChange={e => setForm(f => ({ ...f, match_description_pattern: e.target.value }))} placeholder="%euró%" />
              </div>
              <div>
                <Label className="text-xs">Partner minta</Label>
                <Input className="h-8 text-xs" value={form.match_partner_pattern} onChange={e => setForm(f => ({ ...f, match_partner_pattern: e.target.value }))} placeholder="%GmbH%" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => onSave({
            ...(rule ? { id: rule.id } : {}),
            target_register_id: form.target_register_id,
            priority: form.priority,
            match_currency: form.match_currency || null,
            match_source_type: form.match_source_type || null,
            match_description_pattern: form.match_description_pattern || null,
            match_partner_pattern: form.match_partner_pattern || null,
            is_active: form.is_active,
          })} disabled={saving || !form.target_register_id}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
