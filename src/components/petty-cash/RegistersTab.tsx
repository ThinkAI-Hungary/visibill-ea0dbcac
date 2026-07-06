import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Save, Banknote, Plus, Trash2, Edit2, Star, MapPin, Loader2, Settings2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import type { PettyCashRegister, OpeningBalance } from './types';
import { COMMON_CURRENCIES, roundHuf } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REGISTER MANAGEMENT TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function RegistersTab() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('petty_cash');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PettyCashRegister | null>(null);
  const [editingBalances, setEditingBalances] = useState<string | null>(null);

  const companyId = selectedCompany?.id || '';

  const { data: registers = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers')
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  const saveRegister = useMutation({
    mutationFn: async (reg: Partial<PettyCashRegister>) => {
      if (reg.id) {
        const { error } = await supabase.from('petty_cash_registers')
          .update({ name: reg.name, location: reg.location, currencies: reg.currencies })
          .eq('id', reg.id);
        if (error) throw error;
      } else {
        // Check if there's already a default register for this company
        const { count } = await supabase.from('petty_cash_registers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_default', true);
        const hasDefault = (count ?? 0) > 0;

        const { error } = await supabase.from('petty_cash_registers')
          .insert({
            company_id: companyId,
            name: reg.name,
            location: reg.location,
            currencies: reg.currencies || ['HUF'],
            is_default: !hasDefault,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      setShowDialog(false);
      setEditing(null);
      toast({ title: 'Pénztár mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const setDefault = useMutation({
    mutationFn: async (registerId: string) => {
      // Remove old default
      const { error: e1 } = await supabase.from('petty_cash_registers')
        .update({ is_default: false })
        .eq('company_id', companyId)
        .eq('is_default', true);
      if (e1) throw e1;
      // Set new default
      const { error: e2 } = await supabase.from('petty_cash_registers')
        .update({ is_default: true })
        .eq('id', registerId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      toast({ title: 'Alapértelmezett pénztár módosítva' });
    },
  });

  const deleteRegister = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('petty_cash_registers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      toast({ title: 'Pénztár törölve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  // U3: Check which registers have opening balances set
  const { data: allBalances = [] } = useQuery({
    queryKey: ['petty-cash-all-opening-balances', companyId],
    queryFn: async () => {
      const regIds = registers.map(r => r.id);
      if (regIds.length === 0) return [];
      const { data } = await supabase
        .from('petty_cash_opening_balances')
        .select('register_id, currency, amount')
        .in('register_id', regIds);
      return (data || []) as { register_id: string; currency: string; amount: number }[];
    },
    enabled: registers.length > 0,
    staleTime: 60_000,
  });

  const registersWithBalances = useMemo(() => {
    const set = new Set<string>();
    for (const b of allBalances) {
      if (b.amount !== 0) set.add(b.register_id);
    }
    return set;
  }, [allBalances]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pénztárak</h2>
          <p className="text-sm text-muted-foreground">Házipénztárak kezelése, valuták és helyszínek</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
          <Plus className="w-4 h-4 mr-2" /> Új pénztár
        </Button>
      </div>

      {registers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Banknote className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nincs még pénztár létrehozva</p>
            <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
              <Plus className="w-4 h-4 mr-2" /> Első pénztár létrehozása
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registers.map(reg => (
            <Card key={reg.id} className={cn(
              'relative transition-all hover:shadow-md',
              reg.is_default && 'ring-2 ring-primary/30 border-primary/40'
            )}>
              {reg.is_default && (
                <div className="absolute -top-2.5 left-4">
                  <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                    <Star className="w-3 h-3" /> Alapértelmezett
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{reg.name}</CardTitle>
                    {reg.location && (
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {reg.location}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(reg); setShowDialog(true); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!reg.is_default && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRegister.mutate(reg.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {reg.currencies.map(c => (
                    <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  {!reg.is_default && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setDefault.mutate(reg.id)}>
                      <Star className="w-3 h-3 mr-1" /> Alapértelmezetté
                    </Button>
                  )}
                  {/* U3: Green badge if opening balances are set */}
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingBalances(editingBalances === reg.id ? null : reg.id)}>
                    <Settings2 className="w-3 h-3 mr-1" /> Nyitó egyenlegek
                    {registersWithBalances.has(reg.id) && (
                      <CheckCircle2 className="w-3 h-3 ml-1 text-emerald-500" />
                    )}
                  </Button>
                </div>
                {editingBalances === reg.id && (
                  <OpeningBalancesEditor registerId={reg.id} currencies={reg.currencies} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Register Edit Dialog */}
      <RegisterDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        register={editing}
        onSave={(r) => saveRegister.mutate(r)}
        saving={saveRegister.isPending}
      />
    </div>
  );
}

function RegisterDialog({ open, onOpenChange, register, onSave, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  register: PettyCashRegister | null;
  onSave: (r: Partial<PettyCashRegister>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['HUF']);

  React.useEffect(() => {
    if (register) {
      setName(register.name);
      setLocation(register.location || '');
      setCurrencies(register.currencies);
    } else {
      setName('');
      setLocation('');
      setCurrencies(['HUF']);
    }
  }, [register, open]);

  const toggleCurrency = (cur: string) => {
    setCurrencies(prev => prev.includes(cur) ? prev.filter(c => c !== cur) : [...prev, cur]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{register ? 'Pénztár szerkesztése' : 'Új pénztár'}</DialogTitle>
          <DialogDescription>Add meg a pénztár nevét, helyszínét és az elfogadott valutákat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Név</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Központi pénztár" />
          </div>
          <div>
            <Label>Helyszín (opcionális)</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Budapest, Fő u. 1." />
          </div>
          <div>
            <Label className="mb-2 block">Valuták</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_CURRENCIES.map(cur => (
                <button
                  key={cur}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    currencies.includes(cur)
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                  )}
                  onClick={() => toggleCurrency(cur)}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => onSave({ ...(register ? { id: register.id } : {}), name, location: location || null, currencies })}
            disabled={saving || !name || currencies.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// U3: Opening balances editor with visual feedback
function OpeningBalancesEditor({ registerId, currencies }: { registerId: string; currencies: string[] }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: balances = [] } = useQuery({
    queryKey: queryKeys.pettyCashOpeningBalances(registerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_opening_balances')
        .select('*')
        .eq('register_id', registerId);
      if (error) throw error;
      return (data || []) as unknown as OpeningBalance[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, { amount: string; startDate: string }>>({});

  React.useEffect(() => {
    const d: typeof drafts = {};
    currencies.forEach(cur => {
      const existing = balances.find(b => b.currency === cur);
      d[cur] = {
        amount: existing ? String(existing.amount) : '0',
        startDate: existing?.start_date || '',
      };
    });
    setDrafts(d);
  }, [balances, currencies]);

  const save = useMutation({
    mutationFn: async () => {
      for (const cur of currencies) {
        const draft = drafts[cur];
        if (!draft) continue;
        const amount = parseFloat(draft.amount) || 0;
        const rounded = roundHuf(amount, cur);
        const { error } = await supabase.from('petty_cash_opening_balances')
          .upsert({
            register_id: registerId,
            currency: cur,
            amount: rounded,
            start_date: draft.startDate || null,
          } as any, { onConflict: 'register_id,currency' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashOpeningBalances(registerId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary('') }); // broad invalidation
      qc.invalidateQueries({ queryKey: ['petty-cash-all-opening-balances'] });
      toast({ title: 'Nyitó egyenlegek mentve' });
      // U3: Show saved feedback briefly
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
      {currencies.map(cur => {
        const existing = balances.find(b => b.currency === cur);
        const hasValue = existing && existing.amount !== 0;
        return (
          <div key={cur} className="grid grid-cols-3 gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                {cur} nyitó
                {/* U3: Status indicator */}
                {hasValue && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              </Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={drafts[cur]?.amount || ''}
                onChange={e => setDrafts(prev => ({ ...prev, [cur]: { ...prev[cur], amount: e.target.value } }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Kezdő dátum</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={drafts[cur]?.startDate || ''}
                onChange={e => setDrafts(prev => ({ ...prev, [cur]: { ...prev[cur], startDate: e.target.value } }))}
              />
            </div>
            <div />
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Mentés
        </Button>
        {/* U3: Brief "Saved" feedback */}
        {saved && (
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1 animate-in fade-in duration-200">
            <CheckCircle2 className="w-3 h-3" /> Mentve
          </span>
        )}
      </div>
    </div>
  );
}
