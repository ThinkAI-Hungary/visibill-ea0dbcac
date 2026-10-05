import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Gift, Loader2, Sparkles, AlertCircle, CreditCard, Save, Check, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  usePayrollCafeteria,
  useCreateCafeteriaItem,
  useDeleteCafeteriaItem,
  type PayrollCafeteriaItem
} from '@/hooks/usePayrollData';

interface EmployeeCafeteriaTabProps {
  employmentId: string;
}

export function EmployeeCafeteriaTab({ employmentId }: EmployeeCafeteriaTabProps) {
  const { toast } = useToast();
  const { data: cafeteriaItems = [], isLoading, refetch } = usePayrollCafeteria(employmentId);
  const createItemMutation = useCreateCafeteriaItem();
  const deleteItemMutation = useDeleteCafeteriaItem();

  // Form states
  const [benefitType, setBenefitType] = useState<string>('szep_recreation');
  const [subType, setSubType] = useState<string>('vendeglatas');
  const [provider, setProvider] = useState<string>('OTP');
  const [amount, setAmount] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permanent card states
  const [permanentProvider, setPermanentProvider] = useState<string>('OTP');
  const [permanentCardNumber, setPermanentCardNumber] = useState<string>('');
  const [isSavingPermanent, setIsSavingPermanent] = useState(false);
  const [isPermanentCardSaved, setIsPermanentCardSaved] = useState(false);

  // Load permanent card details from employment metadata or existing items
  useEffect(() => {
    if (!employmentId) return;
    supabase
      .from('accounty_employments')
      .select('metadata')
      .eq('id', employmentId)
      .maybeSingle()
      .then(({ data }) => {
        const meta = (data?.metadata as any) || {};
        if (meta.szep_card_number) {
          setPermanentCardNumber(meta.szep_card_number);
          setPermanentProvider(meta.szep_provider || 'OTP');
          setProvider(meta.szep_provider || 'OTP');
          setCardNumber(meta.szep_card_number);
          setIsPermanentCardSaved(true);
        } else {
          // Check if any existing cafeteria items have card_number
          const existingWithCard = cafeteriaItems.find(i => i.card_number);
          if (existingWithCard) {
            setPermanentCardNumber(existingWithCard.card_number);
            setPermanentProvider(existingWithCard.provider || 'OTP');
            setProvider(existingWithCard.provider || 'OTP');
            setCardNumber(existingWithCard.card_number);
            setIsPermanentCardSaved(true);
          }
        }
      });
  }, [employmentId, cafeteriaItems]);

  const handleSavePermanentCard = async () => {
    if (!employmentId || !permanentCardNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Hiányzó kártyaszám',
        description: 'Kérjük, add meg a kártyaszámot az állandó mentéshez!',
      });
      return;
    }
    setIsSavingPermanent(true);
    try {
      const { data: empData, error: empFetchErr } = await supabase
        .from('accounty_employments')
        .select('metadata')
        .eq('id', employmentId)
        .maybeSingle();

      if (empFetchErr) throw empFetchErr;

      const currentMeta = (empData?.metadata as any) || {};
      const updatedMeta = {
        ...currentMeta,
        szep_provider: permanentProvider,
        szep_card_number: permanentCardNumber.trim(),
      };

      const { error: updateErr } = await supabase
        .from('accounty_employments')
        .update({ metadata: updatedMeta })
        .eq('id', employmentId);

      if (updateErr) throw updateErr;

      // Update existing szep_recreation records for this employment
      await supabase
        .from('accounty_cafeteria')
        .update({
          card_number: permanentCardNumber.trim(),
          provider: permanentProvider,
        })
        .eq('employment_id', employmentId)
        .eq('benefit_type', 'szep_recreation');

      setIsPermanentCardSaved(true);
      setCardNumber(permanentCardNumber.trim());
      setProvider(permanentProvider);

      toast({
        title: 'Állandó SZÉP Kártya elmentve!',
        description: `${permanentProvider} (${permanentCardNumber.trim()}) elmentve a dolgozóhoz. Ezentúl nem kell minden alkalommal újra beírni a kártyaszámot!`,
      });

      refetch();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba a mentés során',
        description: err.message,
      });
    } finally {
      setIsSavingPermanent(false);
    }
  };

  // Totals & limits (2026 rules)
  const szepHospitality = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'vendeglatas')
    .reduce((sum, i) => sum + i.amount, 0);

  const szepLeisure = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'szabadido')
    .reduce((sum, i) => sum + i.amount, 0);

  const szepAccom = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'szallashely')
    .reduce((sum, i) => sum + i.amount, 0);

  const recreation = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_active' || i.sub_type === 'recreation')
    .reduce((sum, i) => sum + i.amount, 0);

  const housingAllowance = cafeteriaItems
    .filter(i => i.benefit_type === 'housing' || i.is_housing_allowance)
    .reduce((sum, i) => sum + i.amount, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Kérjük, érvényes összeget adj meg!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const isHousing = benefitType === 'housing';
      const isSzepActive = benefitType === 'szep_active';
      const isSzep = benefitType === 'szep_recreation';

      const effectiveProvider = isSzep ? (provider || permanentProvider || 'OTP') : null;
      const effectiveCardNumber = isSzep ? (cardNumber.trim() || permanentCardNumber.trim() || null) : null;
      
      await createItemMutation.mutateAsync({
        employment_id: employmentId,
        cycle_id: null,
        benefit_type: benefitType,
        amount: numAmount,
        provider: effectiveProvider,
        card_number: effectiveCardNumber,
        tax_rate: 0.28, // Default 28% employer tax
        status: 'pending',
        sub_type: isHousing ? 'basic' : (isSzepActive ? 'recreation' : subType),
        is_housing_allowance: isHousing
      });

      // If user typed a card number and there was no permanent card saved yet, save it as permanent!
      if (isSzep && effectiveCardNumber && !isPermanentCardSaved) {
        setPermanentCardNumber(effectiveCardNumber);
        setPermanentProvider(effectiveProvider || 'OTP');
        setIsPermanentCardSaved(true);

        const { data: empData } = await supabase
          .from('accounty_employments')
          .select('metadata')
          .eq('id', employmentId)
          .maybeSingle();

        const currentMeta = (empData?.metadata as any) || {};
        await supabase
          .from('accounty_employments')
          .update({
            metadata: {
              ...currentMeta,
              szep_provider: effectiveProvider,
              szep_card_number: effectiveCardNumber,
            }
          })
          .eq('id', employmentId);
      }

      toast({ title: 'Siker', description: 'Cafeteria juttatás sikeresen hozzáadva.' });
      setAmount('');
      // Keep card number prefilled from permanent!
      setCardNumber(effectiveCardNumber || '');
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba a mentés során', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a juttatást?')) return;
    try {
      await deleteItemMutation.mutateAsync({ id, employmentId });
      toast({ title: 'Siker', description: 'Juttatás sikeresen törölve.' });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba a törlés során', description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 font-medium">Cafeteria adatok betöltése...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 2026 Tax Rules Summary Banner */}
      <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
          <p className="font-bold">2026. évi Cafeteria és Juttatási szabályok:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>SZÉP Kártya zsebek</strong>: Szálláshely, Vendéglátás és Szabadidő zsebenként max. 450 000 Ft/év limit. 28%-os adózás (15% SZJA + 13% SZOCHO) 1.0x-es alapon. A limit feletti rész 33.04%-os teherrel adózik.</li>
            <li><strong>Rekreációs keret (Aktív Magyarok)</strong>: Évi max. 120 000 Ft-ig (havi 10 000 Ft) 28%-os adózás, afelett szintén egyes meghatározott juttatásként 33.04%.</li>
            <li><strong>Lakhatási támogatás (35 év alattiaknak)</strong>: Havi max. 150 000 Ft-ig adómentes juttatás a dolgozónak, a cégnek 28% munkáltatói közteher (SZJA + SZOCHO). 35 év felett a támogatás teljes mértékben bérként adózik.</li>
          </ul>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SZÉP Kártya Progress */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SZÉP Kártya Keretek</h4>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Vendéglátás', used: szepHospitality, limit: 450000, color: 'bg-amber-500' },
              { label: 'Szabadidő', used: szepLeisure, limit: 450000, color: 'bg-green-500' },
              { label: 'Szálláshely', used: szepAccom, limit: 450000, color: 'bg-blue-500' },
            ].map((p, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-medium mb-1">
                  <span>{p.label}</span>
                  <span className="font-mono text-muted-foreground">{p.used.toLocaleString('hu-HU')} / {p.limit.toLocaleString('hu-HU')} Ft</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all', p.color)} style={{ width: `${Math.min(100, (p.used / p.limit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rekreáció Progress */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Rekreációs Keret</h4>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span>Éves limit</span>
              <span className="font-mono text-muted-foreground">{recreation.toLocaleString('hu-HU')} / 120 000 Ft</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, (recreation / 120000) * 100)}%` }} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Évi 120 000 Ft-ig kedvezményes (28%) adózású.
          </p>
        </div>

        {/* Lakhatási Támogatás Summary */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Lakhatási Támogatás</h4>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-primary dark:text-primary">{housingAllowance.toLocaleString('hu-HU')}</span>
              <span className="text-xs text-muted-foreground">Ft / hó</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            35 év alatti dolgozónál havi 150 000 Ft-ig a munkáltatót 28% közteher terheli, a dolgozónak teljesen adómentes.
          </p>
        </div>
      </div>

      {/* Állandó SZÉP Kártya Törzsadat Rögzítése */}
      <div className="p-4 rounded-lg border border-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Dolgozó Állandó SZÉP Kártya Adatai</span>
                {isPermanentCardSaved && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Állandóra rögzítve
                  </Badge>
                )}
              </h4>
              <p className="text-xs text-muted-foreground">
                Itt egyszer kell rögzítened a dolgozó SZÉP kártyáját. A rendszer elmenti a törzsadatok közé, és minden juttatásnál, számfejtésnél és bérlapon automatikusan ezt használja.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
          <div className="sm:col-span-3 space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground">Kibocsátó Bank</label>
            <select
              value={permanentProvider}
              onChange={e => {
                setPermanentProvider(e.target.value);
                setProvider(e.target.value);
              }}
              className="w-full h-8 px-2.5 rounded border border-border bg-background text-xs font-semibold"
            >
              <option value="OTP">OTP Bank</option>
              <option value="MBH">MBH Bank</option>
              <option value="K&H">K&H Bank</option>
            </select>
          </div>

          <div className="sm:col-span-6 space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground">Állandó Kártyaszám / Számlaszám</label>
            <input
              type="text"
              value={permanentCardNumber}
              onChange={e => {
                setPermanentCardNumber(e.target.value);
                setCardNumber(e.target.value);
              }}
              placeholder="pl. 20080004-99910000-35181659"
              className="w-full h-8 px-2.5 rounded border border-border bg-background text-xs font-mono font-medium"
            />
          </div>

          <div className="sm:col-span-3">
            <Button
              type="button"
              size="sm"
              onClick={handleSavePermanentCard}
              disabled={isSavingPermanent || !permanentCardNumber.trim()}
              className="w-full h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              {isSavingPermanent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Állandó Kártya Mentése
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="lg:col-span-1 border border-border rounded-lg p-5 bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-primary" /> Új cafeteria elem rögzítése
          </h3>
          <form onSubmit={handleAdd} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">Típus</label>
              <select
                value={benefitType}
                onChange={e => {
                  setBenefitType(e.target.value);
                  if (e.target.value === 'housing') {
                    setSubType('basic');
                  } else if (e.target.value === 'szep_recreation') {
                    setSubType('vendeglatas');
                  } else {
                    setSubType('recreation');
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
              >
                <option value="szep_recreation">SZÉP Kártya</option>
                <option value="housing">Lakhatási támogatás (Housing)</option>
                <option value="szep_active">Rekreációs keret (Aktív Magyarok)</option>
              </select>
            </div>

            {benefitType === 'szep_recreation' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">Zseb / Altípus</label>
                    <select
                      value={subType}
                      onChange={e => setSubType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
                    >
                      <option value="vendeglatas">Vendéglátás</option>
                      <option value="szabadido">Szabadidő</option>
                      <option value="szallashely">Szálláshely</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">Kibocsátó</label>
                    <select
                      value={provider}
                      onChange={e => setProvider(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
                    >
                      <option value="OTP">OTP</option>
                      <option value="MBH">MBH</option>
                      <option value="K&H">K&H</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-muted-foreground">Kártyaszám</label>
                    {isPermanentCardSaved && (
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Állandó kártyából
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs font-mono font-medium"
                    placeholder={permanentCardNumber || "pl. 20080004-99910000-35181659"}
                  />
                  {isPermanentCardSaved && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Automatikusan kitöltve a dolgozó állandó kártyájából.
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">Összeg (Ft)</label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Összeg Ft-ban"
                className="h-8 text-xs font-mono"
                required
              />
            </div>

            <Button type="submit" size="sm" className="w-full mt-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Juttatás Hozzáadása
            </Button>
          </form>
        </div>

        {/* List panel */}
        <div className="lg:col-span-2 border border-border rounded-lg overflow-hidden bg-card shadow-sm flex flex-col justify-start">
          <div className="bg-background/40 px-4 py-3 border-b border-border flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-primary" /> Rögzített Juttatások
            </h3>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 font-semibold px-2 py-0.5 rounded-full">
              {cafeteriaItems.length} juttatás
            </span>
          </div>

          {cafeteriaItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              Nincs rögzített cafeteria juttatás ehhez a dolgozóhoz.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold text-xs uppercase bg-muted/40/50 dark:bg-card/10">
                    <th className="px-4 py-2.5 text-left">Típus</th>
                    <th className="px-4 py-2.5 text-left">Zseb/Provider</th>
                    <th className="px-4 py-2.5 text-right">Összeg</th>
                    <th className="px-4 py-2.5 text-center">Művelet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cafeteriaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/40/30">
                      <td className="px-4 py-2.5 font-medium text-foreground/90">
                        {item.benefit_type === 'szep_recreation' ? 'SZÉP Kártya' :
                         item.benefit_type === 'housing' ? 'Lakhatási támogatás' :
                         item.benefit_type === 'szep_active' ? 'Rekreációs keret' : item.benefit_type}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {item.benefit_type === 'szep_recreation' ? (
                          <div className="flex flex-col">
                            <span className="capitalize">{item.sub_type}</span>
                            <span className="text-[10px]">
                              {item.provider || permanentProvider} {(item.card_number || permanentCardNumber) ? `(${item.card_number || permanentCardNumber})` : ''}
                            </span>
                          </div>
                        ) : (
                          <span>–</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                        {item.amount.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
