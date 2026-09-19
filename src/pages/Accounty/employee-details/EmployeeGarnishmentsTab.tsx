import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldAlert, Check, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatAmount } from '@/lib/payroll/validators';

interface Garnishment {
  id: string;
  employee_id: string;
  garnishment_type: string;
  creditor_name?: string | null;
  creditor_bank_account?: string | null;
  creditor_account?: string | null;
  case_number?: string | null;
  decree_number?: string | null;
  total_amount?: number | null;
  original_amount?: number | null;
  remaining_amount?: number | null;
  monthly_deduction?: number | null;
  max_deduction_pct: number;
  priority: number;
  interest_rate_pct?: number | null;
  interest_start_date?: string | null;
  execution_costs?: number | null;
  calculated_interest?: number | null;
  is_active: boolean;
}

interface EmployeeGarnishmentsTabProps {
  garnishments: Garnishment[];
  empId: string;
}

export function EmployeeGarnishmentsTab({ garnishments, empId }: EmployeeGarnishmentsTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [type, setType] = useState<'child_support' | 'public_debt' | 'private_debt'>('private_debt');
  const [creditorName, setCreditorName] = useState('');
  const [creditorAccount, setCreditorAccount] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [maxPct, setMaxPct] = useState('33');
  const [priority, setPriority] = useState('1');
  const [interestRate, setInterestRate] = useState('');
  const [interestStartDate, setInterestStartDate] = useState('');
  const [executionCosts, setExecutionCosts] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditorName.trim()) {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Hitelező neve kötelező!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTotal = totalAmount ? parseFloat(totalAmount) : null;
      const parsedRate = interestRate ? parseFloat(interestRate) : 0;
      const parsedCosts = executionCosts ? parseFloat(executionCosts) : 0;

      // Safe payload providing both legacy and modern columns
      const payload: Record<string, any> = {
        employee_id: empId,
        garnishment_type: type,
        creditor_name: creditorName,
        creditor_account: creditorAccount || null,
        creditor_bank_account: creditorAccount || null,
        decree_number: caseNumber || null,
        case_number: caseNumber || null,
        original_amount: parsedTotal,
        total_amount: parsedTotal,
        remaining_amount: parsedTotal,
        monthly_deduction: monthlyDeduction ? parseFloat(monthlyDeduction) : null,
        max_deduction_pct: parseFloat(maxPct) / 100,
        priority: parseInt(priority) || 1,
        interest_rate_pct: parsedRate,
        interest_start_date: interestStartDate || null,
        execution_costs: parsedCosts,
        is_active: true,
      };

      const { error } = await supabase.from('accounty_garnishments').insert(payload);

      if (error) throw error;

      toast({ title: 'Siker', description: 'Letiltás sikeresen hozzáadva.' });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'garnishments', empId] });
      
      // Reset Form
      setCreditorName('');
      setCreditorAccount('');
      setCaseNumber('');
      setTotalAmount('');
      setMonthlyDeduction('');
      setInterestRate('');
      setInterestStartDate('');
      setExecutionCosts('');
      setShowAddForm(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a letiltást?')) return;

    try {
      const { error } = await supabase
        .from('accounty_garnishments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Siker', description: 'Letiltás sikeresen törölve.' });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'garnishments', empId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Dolgozói Letiltások</h3>
          <p className="text-xs text-muted-foreground">Végrehajtói határozatok, gyermektartásdíj és letiltási sorrend (Vht. 65. §)</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5"
          variant={showAddForm ? 'outline' : 'default'}
        >
          {showAddForm ? 'Mégse' : <><Plus className="w-4 h-4" /> Új letiltás</>}
        </Button>
      </div>

      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-xs space-y-1.5 text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-200">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <span>Bírósági letiltások szabályai (Vht. 65. §):</span>
        </div>
        <ul className="list-disc pl-6 space-y-1">
          <li>Gyermektartásdíj és egyéb köztartozás esetén a levonás a nettó bér maximum 50%-áig terjedhet.</li>
          <li>Magánjogi tartozások (pl. hitelhátralék) esetén a levonás maximum 33% lehet.</li>
          <li>Több letiltás egyidejű érvényesítése a megadott prioritási sorrend és a törvényi sorrend alapján történik.</li>
          <li><strong>Kamatszámítás:</strong> Kamatozó követelésnél a levonás először a felmerült költségre és kamatra, majd a tőketartozásra számolódik el.</li>
        </ul>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="p-5 border-2 border-primary/20 bg-card rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4 shadow-sm page-animate">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Letiltás típusa</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="child_support">Tartásdíj (max 50%)</option>
              <option value="public_debt">Köztartozás (max 50%)</option>
              <option value="private_debt">Magánjogi követelés (max 33%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Hitelező / Végrehajtó neve *</label>
            <Input size={30} value={creditorName} onChange={e => setCreditorName(e.target.value)} placeholder="pl. OTP Faktoring Zrt. / Önálló Bírósági Végrehajtó" required className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Hitelező bankszámlaszáma</label>
            <Input size={30} value={creditorAccount} onChange={e => setCreditorAccount(e.target.value)} placeholder="00000000-00000000-00000000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Ügyiratszám / Ügyszám</label>
            <Input size={30} value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="pl. 123.V.456/2026" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Főtartozás / Tőke összege (Ft)</label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="pl. 1500000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Havi vonandó fix összeg (Ft, opcionális)</label>
            <Input type="number" value={monthlyDeduction} onChange={e => setMonthlyDeduction(e.target.value)} placeholder="Üresen hagyva % alapú levonás" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Éves kamatláb (% / év)</label>
            <Input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="pl. 5.5 (0 ha nem kamatozik)" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Kamat kezdő dátuma</label>
            <Input type="date" value={interestStartDate} onChange={e => setInterestStartDate(e.target.value)} className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Végrehajtási költségek (Ft)</label>
            <Input type="number" value={executionCosts} onChange={e => setExecutionCosts(e.target.value)} placeholder="pl. 45000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Max levonási limit (%)</label>
            <select
              value={maxPct}
              onChange={e => setMaxPct(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="33">33% (Magánjogi alapeset)</option>
              <option value="50">50% (Tartásdíj vagy több letiltás)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Prioritási sorrend</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="1">1 (Legmagasabb - pl. gyermektartás)</option>
              <option value="2">2 (Köztartozás)</option>
              <option value="3">3 (Közüzemi követelés)</option>
              <option value="4">4 (Magánjogi követelés)</option>
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95">
              <Check className="w-4 h-4" /> Letiltás mentése
            </Button>
          </div>
        </form>
      )}

      {garnishments.length > 1 && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1.5 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Több párhuzamos letiltás van érvényben ({garnishments.length} db):</span>
          </div>
          <p className="leading-relaxed">
            Alkalmazandó a Vht. 165. § szerinti törvényi kielégítési sorrend (1. Gyermektartásdíj → 2. Egyéb tartásdíj → 3. Munkavállalói munkabér → 4. Köztartozás → 5. Egyéb követelés).
          </p>
          <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 bg-amber-500/15 p-1.5 rounded border border-amber-500/20">
            Törvényi korlát: Több letiltás esetén a havi levonás a nettó munkabér legfeljebb 50%-áig terjedhet (Vht. 65. §)!
          </div>
        </div>
      )}

      {garnishments.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          Nincs rögzített aktív letiltás ehhez a dolgozóhoz.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background/50 border-b border-border text-muted-foreground font-medium text-xs uppercase">
                <th className="px-4 py-2.5 text-left">Jogcím / Ügyszám</th>
                <th className="px-4 py-2.5 text-left">Hitelező</th>
                <th className="px-4 py-2.5 text-right">Teljes összeg</th>
                <th className="px-4 py-2.5 text-right">Havi részlet</th>
                <th className="px-4 py-2.5 text-center">Prioritás</th>
                <th className="px-4 py-2.5 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {garnishments.map((g) => (
                <tr key={g.id} className="hover:bg-muted/40/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground capitalize">
                      {g.garnishment_type === 'child_support' ? 'Gyermektartás' : g.garnishment_type === 'public_debt' ? 'Köztartozás' : 'Magánjogi letiltás'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {g.case_number || g.decree_number || 'Ügyszám nélkül'}
                    </p>
                    {Number(g.interest_rate_pct) > 0 && (
                      <span className="inline-block text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium mt-1">
                        +{g.interest_rate_pct}% kamat/év
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground/90">{g.creditor_name}</p>
                    {(g.creditor_bank_account || g.creditor_account) && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{g.creditor_bank_account || g.creditor_account}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {(g.total_amount || g.original_amount) ? `${formatAmount((g.total_amount || g.original_amount)!)}` : 'Változó'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {g.monthly_deduction ? `${formatAmount(g.monthly_deduction)}` : '33% v. 50% alapú'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground dark:text-foreground/90">
                      {g.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(g.id)}
                      className="h-8 w-8 text-red-500 hover:bg-red-50"
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
  );
}
