import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Coins, HelpCircle, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SzochoAdvisorProps {
  companyId: string;
}

export function SzochoAdvisor({ companyId }: SzochoAdvisorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. Fetch all employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['payroll', 'employees', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_employees')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch all employments
  const { data: employments = [], isLoading: employmentsLoading } = useQuery({
    queryKey: ['payroll', 'all-employments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_employments')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Mutation to update szocho discount state on employment
  const updateSzochoMutation = useMutation({
    mutationFn: async ({ employmentId, type }: { employmentId: string; type: string }) => {
      const { error } = await supabase
        .from('accounty_employments')
        .update({
          is_szocho_discount: true,
          szocho_discount_type: type,
          szocho_discount_start: new Date().toISOString().slice(0, 10),
        })
        .eq('id', employmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'all-employments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'employments'] });
      toast({
        title: 'Adókedvezmény aktiválva',
        description: 'A SZOCHO kedvezmény sikeresen rögzítve a jogviszony adataihoz.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült elmenteni a kedvezményt.',
        variant: 'destructive',
      });
    }
  });

  const getAge = (birthDateStr: string | null) => {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 4. Advisor calculations
  const recommendations = useMemo(() => {
    if (employees.length === 0 || employments.length === 0) return [];

    const list: any[] = [];

    employments.forEach((emp) => {
      const staff = employees.find((e) => e.id === emp.employee_id);
      if (!staff || emp.status !== 'active') return;

      const age = getAge(staff.birth_date);
      const isUnder25 = age !== null && age < 25;
      const isOver55 = age !== null && age >= 55;
      const isUnskilled = emp.feor_code && emp.feor_code.startsWith('9');

      let eligibleType = '';
      let eligibleLabel = '';
      let savingsAmount = 0; // Simulated monthly SZOCHO savings based on base_salary (or min wage of 322,800 Ft)
      const baseSalary = emp.base_salary || 322800;
      const limitBase = Math.min(baseSalary, 322800); // capped at minimum wage

      if (isUnder25) {
        eligibleType = 'fiatalkoru';
        eligibleLabel = '25 év alatti fiatalok kedvezménye (100%)';
        savingsAmount = limitBase * 0.13; // 13% szocho relief
      } else if (isOver55) {
        eligibleType = '55_feletti';
        eligibleLabel = '55 év felettiek munkatapasztalat kedvezménye (50%)';
        savingsAmount = limitBase * 0.065; // 6.5% szocho relief
      } else if (isUnskilled) {
        eligibleType = 'szakkepzetlen';
        eligibleLabel = 'Szakképzettséget nem igénylő munkakör (FEOR 9) kedvezmény (50%)';
        savingsAmount = limitBase * 0.065;
      }

      if (eligibleType) {
        const isApplied = emp.is_szocho_discount === true;
        list.push({
          employmentId: emp.id,
          employeeName: `${staff.last_name} ${staff.first_name}`,
          age,
          feorCode: emp.feor_code,
          jobTitle: emp.job_title || 'Nincs megadva',
          eligibleLabel,
          eligibleType,
          savingsAmount,
          isApplied,
        });
      }
    });

    return list;
  }, [employees, employments]);

  const pendingRecommendations = useMemo(() => recommendations.filter(r => !r.isApplied), [recommendations]);
  const totalPotentialSavings = recommendations.reduce((acc, r) => acc + (r.isApplied ? 0 : r.savingsAmount), 0);
  const totalActiveSavings = recommendations.reduce((acc, r) => acc + (r.isApplied ? r.savingsAmount : 0), 0);

  if (employeesLoading || employmentsLoading) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-900/10 rounded-2xl border border-border animate-pulse">
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/60 dark:border-emerald-900/30 flex items-start gap-4 animate-in fade-in duration-300">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 shrink-0">
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">SZOCHO optimalizáció</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Minden foglalkoztatott optimális adózási kategóriába van sorolva. Nincs észlelhető további SZOCHO adókedvezmény-lehetőség.
          </p>
        </div>
      </div>
    );
  }

  // If recommendations exist but all are active
  if (pendingRecommendations.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50/40 via-teal-50/20 to-card dark:from-emerald-950/10 dark:via-teal-950/5 dark:to-card border border-emerald-100 dark:border-emerald-950 rounded-2xl p-5 shadow-soft flex items-start justify-between flex-wrap gap-4 animate-in fade-in duration-300">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Minden kedvezmény érvényesítve</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Az összes jogosult munkavállaló után sikeresen érvényesítve van a SZOCHO adókedvezmény.
            </p>
          </div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-right">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Aktív adómegtakarítás</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
            <CheckCircle className="w-4 h-4" />
            {new Intl.NumberFormat('hu-HU').format(Math.round(totalActiveSavings))} Ft/hó
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/30 to-card dark:from-indigo-950/10 dark:via-purple-950/5 dark:to-card border border-indigo-100 dark:border-indigo-950 rounded-2xl p-5 shadow-soft space-y-4 animate-in fade-in duration-300">
      {/* Advisor Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Bérszámfejtési SZOCHO Tanácsadó</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Automatikus kedvezmény-detektálás FEOR és életkor alapján</p>
          </div>
        </div>

        <div className="flex gap-4">
          {totalPotentialSavings > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">Kiaknázatlan megtakarítás</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center justify-end gap-1">
                <Coins className="w-4 h-4" />
                +{new Intl.NumberFormat('hu-HU').format(Math.round(totalPotentialSavings))} Ft/hó
              </span>
            </div>
          )}
          {totalActiveSavings > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Aktív adómegtakarítás</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                <CheckCircle className="w-4 h-4" />
                {new Intl.NumberFormat('hu-HU').format(Math.round(totalActiveSavings))} Ft/hó
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Roster of suggestions */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {pendingRecommendations.map((rec) => (
          <div key={rec.employmentId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{rec.employeeName}</span>
                <span className="text-xs text-slate-400">({rec.jobTitle} - FEOR {rec.feorCode || '–'})</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                Javasolt kedvezmény: <strong className="text-indigo-600 dark:text-indigo-400">{rec.eligibleLabel}</strong>
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600 font-bold font-mono">
                  ~{new Intl.NumberFormat('hu-HU').format(Math.round(rec.savingsAmount))} Ft/hó megtakarítás
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white hover:text-white border-none font-semibold px-4 rounded-lg"
                  onClick={() => updateSzochoMutation.mutate({ employmentId: rec.employmentId, type: rec.eligibleType })}
                  disabled={updateSzochoMutation.isPending}
                >
                  Aktivál
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
