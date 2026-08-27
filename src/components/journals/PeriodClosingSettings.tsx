import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Lock, Unlock } from 'lucide-react';

interface PeriodClosingSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS_HUN = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

export default function PeriodClosingSettings({ open, onOpenChange }: PeriodClosingSettingsProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch closed periods for selected year
  const { data: closedPeriods = [], isLoading: loadingPeriods, refetch: refetchPeriods } = useQuery({
    queryKey: ['acc-accounting-periods-lock', selectedCompany?.id, selectedYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('acc_accounting_periods')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('year', selectedYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && open,
  });

  // Toggle closed period mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ month, currentClosed }: { month: number; currentClosed: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      if (!currentClosed) {
        // Verify drafts in selected month
        const startDate = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, month, 0).getDate();
        const endDate = `${selectedYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { count, error: countErr } = await supabase
          .from('acc_journal_headers')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', selectedCompany!.id)
          .in('status', ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'])
          .gte('posting_date', startDate)
          .lte('posting_date', endDate);

        if (countErr) throw countErr;
        if (count && count > 0) {
          throw new Error(`A hónapban ${count} függő/piszkozat könyvelési tétel található. Kérjük könyvelje le vagy törölje őket a lezárás előtt!`);
        }

        // Lock period
        const { error } = await supabase
          .from('acc_accounting_periods')
          .upsert({
            company_id: selectedCompany!.id,
            year: selectedYear,
            month: month,
            is_closed: true,
            closed_at: new Date().toISOString(),
            closed_by: user.id
          }, { onConflict: 'company_id, year, month' });

        if (error) throw error;
      } else {
        // Unlock period
        const { error } = await supabase
          .from('acc_accounting_periods')
          .update({
            is_closed: false,
            closed_at: null,
            closed_by: null
          })
          .eq('company_id', selectedCompany!.id)
          .eq('year', selectedYear)
          .eq('month', month);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchPeriods();
      toast({ title: "Időszak lezárási állapota sikeresen módosítva" });
    },
    onError: (err) => {
      toast({ title: "Hiba az időszak zárásakor", description: err.message, variant: "destructive" });
    }
  });

  const handleToggle = (month: number, currentClosed: boolean) => {
    toggleMutation.mutate({ month, currentClosed });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Időszakok lezárása
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Kiválasztott üzleti év</span>
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[120px] h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = currentYear - 2 + i;
                  return <SelectItem key={y} value={y.toString()}>{y} év</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border my-2" />

          {loadingPeriods ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {MONTHS_HUN.map((name, index) => {
                const monthNum = index + 1;
                const period = closedPeriods.find((p: any) => p.month === monthNum);
                const isClosed = period ? period.is_closed : false;
                
                return (
                  <div key={monthNum} className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/10 transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      {isClosed ? <Lock className="w-3.5 h-3.5 text-rose-500" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {isClosed ? 'Lezárva' : 'Nyitva'}
                      </span>
                      <Switch
                        checked={isClosed}
                        onCheckedChange={() => handleToggle(monthNum, isClosed)}
                        disabled={toggleMutation.isPending}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
