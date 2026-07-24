import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShieldAlert, Check, Calculator } from 'lucide-react';
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
  case_number?: string | null;
  total_amount?: number | null;
  remaining_amount?: number | null;
  monthly_deduction?: number | null;
  max_deduction_pct: number;
  priority: number;
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditorName.trim()) {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Hitelező neve kötelező!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('accounty_garnishments').insert({
        employee_id: empId,
        garnishment_type: type,
        creditor_name: creditorName,
        creditor_bank_account: creditorAccount || null,
        case_number: caseNumber || null,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        remaining_amount: totalAmount ? parseFloat(totalAmount) : null,
        monthly_deduction: monthlyDeduction ? parseFloat(monthlyDeduction) : null,
        max_deduction_pct: parseFloat(maxPct) / 100,
        priority: parseInt(priority) || 1,
        is_active: true,
      });

      if (error) throw error;

      toast({ title: 'Siker', description: 'Letiltás sikeresen hozzáadva.' });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'garnishments', empId] });
      
      // Reset Form
      setCreditorName('');
      setCreditorAccount('');
      setCaseNumber('');
      setTotalAmount('');
      setMonthlyDeduction('');
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
      {/* Informative banner on Vht. 65.§ rules */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-bold">Bírósági letiltások szabályai (Vht. 65. §):</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Gyermektartásdíj és egyéb köztartozás esetén a levonás a nettó bér maximum <strong>50%-áig</strong> terjedhet.</li>
            <li>Magánjogi tartozások (pl. hitelhátralék) esetén a levonás maximum <strong>33%</strong> lehet.</li>
            <li>Több letiltás egyidejű érvényesítése a megadott <strong>Prioritási sorrend</strong> és a törvényi sorrend alapján történik.</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Dolgozói Letiltások</h3>
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-3 h-3" /> {showAddForm ? 'Mégse' : 'Új letiltás'}
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/10 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-3 duration-200">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Letiltás típusa</label>
            <select
              value={type}
              onChange={(e: any) => {
                setType(e.target.value);
                setMaxPct(e.target.value === 'child_support' ? '50' : '33');
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="child_support">Tartásdíj (max 50%)</option>
              <option value="public_debt">Köztartozás (max 50%)</option>
              <option value="private_debt">Magánjogi követelés (max 33%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Hitelező neve *</label>
            <Input size={30} value={creditorName} onChange={e => setCreditorName(e.target.value)} placeholder="pl. OTP Bank Nyrt." required className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Hitelező bankszámlaszáma</label>
            <Input size={30} value={creditorAccount} onChange={e => setCreditorAccount(e.target.value)} placeholder="00000000-00000000-00000000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Ügyiratszám / Ügyszám</label>
            <Input size={30} value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="pl. 123.V.456/2026" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Teljes tartozás összege (Ft)</label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="pl. 1500000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Havi vonandó fix összeg (Ft)</label>
            <Input type="number" value={monthlyDeduction} onChange={e => setMonthlyDeduction(e.target.value)} placeholder="pl. 45000" className="bg-background" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Max levonási limit (%)</label>
            <select
              value={maxPct}
              onChange={e => setMaxPct(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="33">33%</option>
              <option value="50">50%</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Prioritási sorrend</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="1">1 (Legmagasabb)</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4 (Legalacsonyabb)</option>
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95">
              <Check className="w-4 h-4" /> Letiltás mentése
            </Button>
          </div>
        </form>
      )}

      {garnishments.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 border border-dashed rounded-xl">
          Nincs rögzített aktív letiltás ehhez a dolgozóhoz.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-border text-slate-500 font-medium text-xs uppercase">
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
                <tr key={g.id} className="hover:bg-slate-50/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                      {g.garnishment_type === 'child_support' ? 'Gyermektartás' : g.garnishment_type === 'public_debt' ? 'Köztartozás' : 'Magánjogi letiltás'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{g.case_number || 'Ügyszám nélkül'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700 dark:text-slate-300">{g.creditor_name}</p>
                    {g.creditor_bank_account && <p className="text-xs text-slate-500 font-mono mt-0.5">{g.creditor_bank_account}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {g.total_amount ? `${formatAmount(g.total_amount)}` : 'Változó'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {g.monthly_deduction ? `${formatAmount(g.monthly_deduction)}` : '33% v. 50% alapú'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
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
