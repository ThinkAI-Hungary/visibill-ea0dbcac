import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Gift, Loader2, Sparkles, AlertCircle } from 'lucide-react';
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
      
      await createItemMutation.mutateAsync({
        employment_id: employmentId,
        cycle_id: null,
        benefit_type: benefitType,
        amount: numAmount,
        provider: benefitType === 'szep_recreation' ? provider : null,
        card_number: benefitType === 'szep_recreation' && cardNumber ? cardNumber : null,
        tax_rate: 0.28, // Default 28% employer tax
        status: 'pending',
        sub_type: isHousing ? 'basic' : (isSzepActive ? 'recreation' : subType),
        is_housing_allowance: isHousing
      });

      toast({ title: 'Siker', description: 'Cafeteria juttatás sikeresen hozzáadva.' });
      setAmount('');
      setCardNumber('');
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
      <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
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
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SZÉP Kártya Keretek</h4>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Vendéglátás', used: szepHospitality, limit: 450000, color: 'bg-amber-500' },
              { label: 'Szabadidő', used: szepLeisure, limit: 450000, color: 'bg-green-500' },
              { label: 'Szálláshely', used: szepAccom, limit: 450000, color: 'bg-blue-500' },
            ].map((p, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-medium mb-1">
                  <span>{p.label}</span>
                  <span className="font-mono text-slate-500">{p.used.toLocaleString('hu-HU')} / {p.limit.toLocaleString('hu-HU')} Ft</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all', p.color)} style={{ width: `${Math.min(100, (p.used / p.limit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rekreáció Progress */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Rekreációs Keret</h4>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span>Éves limit</span>
              <span className="font-mono text-slate-500">{recreation.toLocaleString('hu-HU')} / 120 000 Ft</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, (recreation / 120000) * 100)}%` }} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Évi 120 000 Ft-ig kedvezményes (28%) adózású.
          </p>
        </div>

        {/* Lakhatási Támogatás Summary */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lakhatási Támogatás</h4>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">{housingAllowance.toLocaleString('hu-HU')}</span>
              <span className="text-xs text-slate-500">Ft / hó</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">
            35 év alatti dolgozónál havi 150 000 Ft-ig a munkáltatót 28% közteher terheli, a dolgozónak teljesen adómentes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="lg:col-span-1 border border-border rounded-xl p-5 bg-card shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-primary" /> Új cafeteria elem rögzítése
          </h3>
          <form onSubmit={handleAdd} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Típus</label>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Zseb / Altípus</label>
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Kibocsátó</label>
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
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Kártyaszám (opcionális)</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-border bg-background text-xs"
                    placeholder="pl. 1234-5678-..."
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Összeg (Ft)</label>
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
        <div className="lg:col-span-2 border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col justify-start">
          <div className="bg-slate-50 dark:bg-slate-900/40 px-4 py-3 border-b border-border flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-indigo-500" /> Rögzített Juttatások
            </h3>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 font-semibold px-2 py-0.5 rounded-full">
              {cafeteriaItems.length} juttatás
            </span>
          </div>

          {cafeteriaItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 italic">
              Nincs rögzített cafeteria juttatás ehhez a dolgozóhoz.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-slate-500 font-semibold text-xs uppercase bg-slate-50/50 dark:bg-slate-900/10">
                    <th className="px-4 py-2.5 text-left">Típus</th>
                    <th className="px-4 py-2.5 text-left">Zseb/Provider</th>
                    <th className="px-4 py-2.5 text-right">Összeg</th>
                    <th className="px-4 py-2.5 text-center">Művelet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cafeteriaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30">
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                        {item.benefit_type === 'szep_recreation' ? 'SZÉP Kártya' :
                         item.benefit_type === 'housing' ? 'Lakhatási támogatás' :
                         item.benefit_type === 'szep_active' ? 'Rekreációs keret' : item.benefit_type}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {item.benefit_type === 'szep_recreation' ? (
                          <div className="flex flex-col">
                            <span className="capitalize">{item.sub_type}</span>
                            <span className="text-[10px]">{item.provider} {item.card_number ? `(${item.card_number})` : ''}</span>
                          </div>
                        ) : (
                          <span>–</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
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
