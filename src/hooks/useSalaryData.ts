import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useRealtimeInvalidation } from '@/hooks/useRealtimeInvalidation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { SalaryItem } from '@/lib/salary-helpers';

export function useSalaryData() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();
  const queryClient = useQueryClient();
  useRealtimeInvalidation(selectedCompany?.id);

  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr = dateTo.toISOString().slice(0, 10);

  const { data: salaryItems = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.salaries(selectedCompany?.id || '', dateFromStr, dateToStr),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary')
        .select('id, név, összeg, dátum, tipus, statusz, kifizetes_ideje, fizetesi_mod, megjegyzes, munkavallalo_neve, transaction_id, created_at, updated_at')
        .eq('company_id', selectedCompany!.id)
        .gte('dátum', dateFromStr)
        .lte('dátum', dateToStr)
        .order('dátum', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data as unknown as SalaryItem[]) || [];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidateSalaries = () => {
    queryClient.invalidateQueries({ queryKey: ['salaries', selectedCompany?.id] });
  };

  const { employeeGroups, navItems } = useMemo(() => {
    const groups: Record<string, SalaryItem[]> = {};
    const nav: SalaryItem[] = [];
    salaryItems.forEach((item) => {
      if (item.munkavallalo_neve) {
        if (!groups[item.munkavallalo_neve]) groups[item.munkavallalo_neve] = [];
        groups[item.munkavallalo_neve].push(item);
      } else {
        nav.push(item);
      }
    });
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'hu'));
    return { employeeGroups: sortedGroups, navItems: nav };
  }, [salaryItems]);

  const metrics = useMemo(() => {
    const totalPayments = salaryItems
      .filter((item) => !!item.transaction_id)
      .reduce((sum, item) => sum + Number(item.összeg), 0);
    const employeeCount = new Set(
      salaryItems.filter((item) => item.munkavallalo_neve).map((item) => item.munkavallalo_neve)
    ).size;
    const netSalary = salaryItems
      .filter((item) => item.tipus === 'bér')
      .reduce((sum, item) => sum + Number(item.összeg), 0);
    const employeeNetTotal = salaryItems
      .filter((item) => item.munkavallalo_neve && item.tipus === 'bér')
      .reduce((sum, item) => sum + Number(item.összeg), 0);
    const navTotal = salaryItems
      .filter((item) => !item.munkavallalo_neve)
      .reduce((sum, item) => sum + Number(item.összeg), 0);
    const grossSalary = employeeNetTotal + navTotal;
    return { totalPayments, employeeCount, netSalary, grossSalary };
  }, [salaryItems]);

  const allNavPaid = useMemo(() => {
    if (navItems.length === 0) return false;
    return navItems.every((item) => !!item.transaction_id);
  }, [navItems]);

  const addMutation = useMutation({
    mutationFn: async (form: { megnevezes: string; osszeg: string; datum: string }) => {
      if (!user || !selectedCompany) throw new Error('No user/company');
      const now = new Date().toISOString();
      const { error } = await supabase.from('salary').insert([{
        user_id: user.id, company_id: selectedCompany.id,
        név: form.megnevezes, összeg: parseFloat(form.osszeg),
        dátum: form.datum || null, statusz: 'Kifizetve',
        fizetesi_mod: 'készpénz', tipus: 'bér', kifizetes_ideje: now,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Siker', description: 'KP kifizetés rögzítve.' });
      invalidateSalaries();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült rögzíteni a kifizetést.' });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: { megnevezes: string; megjegyzes: string } }) => {
      const { error } = await supabase.from('salary')
        .update({ név: form.megnevezes, megjegyzes: form.megjegyzes || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Siker', description: 'Bejegyzés frissítve.' });
      invalidateSalaries();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült frissíteni a bejegyzést.' });
    },
  });

  return {
    user, selectedCompany, salaryItems, loading,
    employeeGroups, navItems, metrics, allNavPaid,
    addMutation, editMutation, invalidateSalaries,
  };
}
