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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Save, Banknote, Plus, Trash2, Edit2, Star, MapPin, Loader2, Settings2, CheckCircle2, ShieldAlert, FileText, CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import type { PettyCashRegister, OpeningBalance } from './types';
import { fmtBalance, roundHuf } from './types';
import { useTranslation } from 'react-i18next';
import { RegisterDialog } from './RegisterDialog';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REGISTER MANAGEMENT TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function RegistersTab() {
  const { t } = useTranslation(['pettyCash', 'common']);
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
      const payload: any = {
        name: reg.name,
        location: reg.location,
        currencies: reg.currencies || ['HUF'],
        closing_mode: reg.closing_mode || 'monthly',
        custom_days: reg.custom_days || 30,
        cash_limit: reg.cash_limit ?? 1500000,
        limit_action: reg.limit_action || 'warn',
        receipt_policy: reg.receipt_policy || 'when_no_document',
        approval_threshold: reg.approval_threshold ?? 200000,
        gl_account: reg.gl_account || '381',
        is_single_person_mode: reg.is_single_person_mode ?? false,
      };

      if (reg.id) {
        const { error } = await supabase.from('petty_cash_registers')
          .update(payload)
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
            ...payload,
            company_id: companyId,
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
      toast({ title: t('pettyCash:registers_tab.toast_saved', 'Pénztár mentve') });
    },
    onError: (e: any) => toast({ title: t('common:error', 'Hiba'), description: e.message, variant: 'destructive' }),
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
      toast({ title: t('pettyCash:registers_tab.toast_default_updated', 'Alapértelmezett pénztár módosítva') });
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
      toast({ title: t('pettyCash:registers_tab.toast_deleted', 'Pénztár törölve') });
    },
    onError: (e: any) => toast({ title: t('common:error', 'Hiba'), description: e.message, variant: 'destructive' }),
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
          <h2 className="text-lg font-semibold">{t('pettyCash:registers.title', 'Pénztárak')}</h2>
          <p className="text-sm text-muted-foreground">{t('pettyCash:registers.subtitle', 'Házipénztárak kezelése, valuták és helyszínek')}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
          <Plus className="w-4 h-4 mr-2" /> {t('pettyCash:registers.new_register', 'Új pénztár')}
        </Button>
      </div>

      {registers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Banknote className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">{t('pettyCash:registers.no_registers', 'Nincs még pénztár létrehozva')}</p>
            <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
              <Plus className="w-4 h-4 mr-2" /> {t('pettyCash:registers.first_register', 'Első pénztár létrehozása')}
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
                    <Star className="w-3 h-3" /> {t('pettyCash:default_badge', 'Alapértelmezett')}
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
                <div className="flex flex-wrap gap-1.5 items-center">
                  {reg.currencies.map(c => (
                    <Badge key={c} variant="outline" className="text-xs font-semibold">{c}</Badge>
                  ))}
                  <Badge variant="secondary" className="text-[10px] bg-muted/60 text-muted-foreground">
                    {reg.closing_mode === 'daily' ? 'Napi zárás' :
                     reg.closing_mode === 'weekly' ? 'Heti zárás' :
                     reg.closing_mode === 'decade' ? 'Dekád zárás' :
                     reg.closing_mode === 'custom' ? `${reg.custom_days || 30} napos zárás` : 'Havi zárás'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground font-mono">
                    Keret: {fmtBalance(reg.cash_limit ?? 1500000, 'HUF')}
                  </Badge>
                  {reg.gl_account && (
                    <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground font-mono">
                      Főkönyv: {reg.gl_account}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {!reg.is_default && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setDefault.mutate(reg.id)}>
                      <Star className="w-3 h-3 mr-1" /> {t('pettyCash:registers.make_default', 'Alapértelmezetté')}
                    </Button>
                  )}
                  {/* U3: Green badge if opening balances are set */}
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingBalances(editingBalances === reg.id ? null : reg.id)}>
                    <Settings2 className="w-3 h-3 mr-1" /> {t('pettyCash:registers.opening_balances', 'Nyitó egyenlegek')}
                    {registersWithBalances.has(reg.id) && (
                      <CheckCircle2 className="w-3 h-3 ml-1 text-emerald-500" />
                    )}
                  </Button>
                </div>
                {editingBalances === reg.id && (
                  <OpeningBalancesEditor registerId={reg.id} currencies={reg.currencies} companyId={companyId} />
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


// U3: Opening balances editor with visual feedback
function OpeningBalancesEditor({ registerId, currencies, companyId }: { registerId: string; currencies: string[]; companyId: string }) {
  const { t } = useTranslation(['pettyCash', 'common']);
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
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: ['petty-cash-entries-opening-balances', companyId] });
      qc.invalidateQueries({ queryKey: ['petty-cash-all-opening-balances', companyId] });
      toast({ title: t('pettyCash:registers_tab.opening_balances_saved', 'Nyitó egyenlegek mentve') });
      // U3: Show saved feedback briefly
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: any) => toast({ title: t('common:error', 'Hiba'), description: e.message, variant: 'destructive' }),
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
                {cur} {t('pettyCash:registers_tab.opening_label', 'nyitó')}
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
              <Label className="text-xs text-muted-foreground">{t('pettyCash:registers_tab.start_date_label', 'Kezdő dátum')}</Label>
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
          {t('pettyCash:registers_tab.save', 'Mentés')}
        </Button>
        {/* U3: Brief "Saved" feedback */}
        {saved && (
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1 animate-in fade-in duration-200">
            <CheckCircle2 className="w-3 h-3" /> {t('common:saved', 'Mentve')}
          </span>
        )}
      </div>
    </div>
  );
}
