import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Save, Loader2, Info, CheckCircle2, Percent } from 'lucide-react';
import { VatProRataSettings } from '../types';

export function VatProRataSettingsCard({ year }: { year: number }) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [method, setMethod] = useState<'PREVIOUS_YEAR_9A' | 'CUMULATIVE_9B'>('CUMULATIVE_9B');
  const [prevYearRatio, setPrevYearRatio] = useState<number>(1.0);

  // Fetch settings for current company & year
  const { data: settings, isLoading } = useQuery<VatProRataSettings | null>({
    queryKey: ['vat-pro-rata-settings', selectedCompany?.id, year],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase
        .from('vat_pro_rata_settings' as any)
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('accounting_year', year)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching pro-rata settings:', error);
      }
      return data as any;
    },
    enabled: !!selectedCompany?.id,
  });

  useEffect(() => {
    if (settings) {
      setMethod(settings.method || 'CUMULATIVE_9B');
      setPrevYearRatio(settings.prev_year_ratio ?? 1.0);
    }
  }, [settings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) return;
      const payload = {
        company_id: selectedCompany.id,
        accounting_year: year,
        method,
        prev_year_ratio: prevYearRatio,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('vat_pro_rata_settings' as any)
        .upsert(payload, { onConflict: 'company_id,accounting_year' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vat-pro-rata-settings', selectedCompany?.id, year] });
      toast({
        title: "Beállítások elmentve",
        description: "Az ÁFA arányosítási paraméterek sikeresen frissültek.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Mentési hiba",
        description: err.message || "Nem sikerült menteni a beállításokat.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-border/60 shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>ÁFA Arányosítási Paraméterek (Áfa tv. 123. §)</span>
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[10px]">
                  {year}. év
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Levonási hányados L(H) és évközi számítási módszertan felvétele (5. sz. melléklet).
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs font-semibold"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Mentés
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Évközi Számítási Módszertan</span>
            </Label>
            <Select
              value={method}
              onValueChange={(v: any) => setMethod(v)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUMULATIVE_9B">
                  9. b) Göngyölítéses módszer (Időszakok közötti halmozott bevételekből)
                </SelectItem>
                <SelectItem value="PREVIOUS_YEAR_9A">
                  9. a) Előző évi végleges hányados (Év végén 12. hóban korrigálva)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-normal">
              {method === 'CUMULATIVE_9B'
                ? 'A levonható ÁFA minden bevallási időszakban az év elejétől göngyölített bevételekből kerül újraszámításra.'
                : 'Év közben a tavalyi végleges hányadossal számol, az év utolsó bevallásában a tárgyévi végleges bevételekből rendezve.'}
            </p>
          </div>

          {/* Previous year final ratio */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <span>Előző Évi Végleges Levonási Hányados L(H)</span>
            </Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={prevYearRatio}
                onChange={(e) => setPrevYearRatio(Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="h-9 font-mono text-xs pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                ({(prevYearRatio * 100).toFixed(0)}%)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Abszolút szám 0.00 és 1.00 között (pl. 0.84 = 84% levonható). Felfelé kerekítve az Áfa tv. szerint.
            </p>
          </div>
        </div>

        {/* Informational alert */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2.5 text-xs">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Kerekítési szabály (Áfa tv. 5. sz. melléklet):</span> A kiszámított levonási hányadost 2 tizedesjegyre, <strong className="text-foreground">mindig felfelé</strong> kell kerekíteni. A Modulátor Worker és az ÁFA kalkulátor automatikusan érvényesíti ezt a törvényi szabályt.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
