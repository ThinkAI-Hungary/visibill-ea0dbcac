import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, UploadCloud, Database, Bot, Loader2 } from 'lucide-react';
import GeneralLedgerTable from '@/components/general-ledger/GeneralLedgerTable';
import { UploadChartOfAccountsModal } from '@/components/general-ledger/UploadChartOfAccountsModal';
import { ManagePresetsModal } from '@/components/general-ledger/ManagePresetsModal';
import { Settings2 } from 'lucide-react';
import { useActivePreset } from '@/hooks/useActivePreset';

export default function GeneralLedgerPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear().toString();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [partnerBreakdown, setPartnerBreakdown] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [isAIRunning, setIsAIRunning] = useState(false);

  const { activePresetId, setActivePresetId, presets } = useActivePreset(selectedCompany?.id);

  const toggleActivePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!selectedCompany?.id) throw new Error("Cég nincs kiválasztva.");
      
      const isGeneric = presets?.find(p => p.id === presetId)?.type === 'generic';
      
      // Deactivate all custom presets for this company
      await supabase
        .from('chart_of_accounts_presets')
        .update({ is_active: false })
        .eq('company_id', selectedCompany.id)
        .eq('type', 'custom');

      if (!isGeneric) {
        // Activate the selected custom one
        const { error } = await supabase
          .from('chart_of_accounts_presets')
          .update({ is_active: true })
          .eq('id', presetId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
    },
    onError: (error: any) => {
      toast({ title: "Hiba", description: error.message, variant: "destructive" });
    }
  });

  const handleSelectPreset = (val: string) => {
    setActivePresetId(val);
    toggleActivePresetMutation.mutate(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRunAI = async () => {
    if (!selectedCompany?.id) return;
    setIsAIRunning(true);
    try {
      const response = await fetch('https://n8n.thinkaikontir.hu/webhook-test/gl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          company_id: selectedCompany.id,
          target_preset_id: activePresetId 
        }),
      });
      if (!response.ok) throw new Error('A webhook hívás sikertelen volt.');
      toast({ title: 'Sikeres indítás', description: 'Az AI besorolás elindult a paramétereknek megfelelően.' });
    } catch (error: any) {
      toast({ title: 'Hiba történt', description: error.message, variant: 'destructive' });
    } finally {
      setIsAIRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Print-only beautifully formatted header */}
      <div className="hidden print:flex flex-col items-center justify-center mb-8 w-full border-b-2 border-primary/20 pb-6">
        <h1 className="text-5xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight print:text-black mb-2">Visibill</h1>
        <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground mt-2">Főkönyvi Kivonat</h2>
        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span>Adóév: {taxYear}</span>
          <span>•</span>
          <span>Időszak: {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Főkönyv</h1>
          <p className="text-sm text-muted-foreground mt-1">Hierarchikus főkönyvi kivonat és kategóriák</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Preset Selector & Action */}
          <div className="flex items-center justify-end gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <Label className="whitespace-nowrap font-medium text-xs">Aktív Számlatükör:</Label>
              <Select value={activePresetId} onValueChange={handleSelectPreset} disabled={toggleActivePresetMutation.isPending}>
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue placeholder="Sablon kiválasztása" />
                </SelectTrigger>
                <SelectContent>
                  {presets?.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} {preset.type === 'generic' ? '(Beépített)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2 text-muted-foreground font-medium"
                onClick={() => setManageModalOpen(true)}
              >
                <Settings2 className="w-4 h-4" />
                <span>Sablonok kezelése</span>
              </Button>
            </div>
            <div className="border-l pl-3 border-border/60 flex items-center gap-2">
              <Button onClick={() => setUploadModalOpen(true)} size="sm" className="h-9 gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>Új feltöltése</span>
              </Button>
              <Button 
                onClick={handleRunAI} 
                disabled={isAIRunning}
                size="sm" 
                variant="secondary"
                className="h-9 gap-2"
              >
                {isAIRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                <span>AI Besorolás</span>
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="tax-year" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Adóév</Label>
                <Select value={taxYear} onValueChange={setTaxYear}>
                  <SelectTrigger id="tax-year" className="w-[100px] h-9 text-sm relative">
                    <SelectValue placeholder="Év" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = (parseInt(currentYear) - 5 + i).toString();
                      return <SelectItem key={year} value={year}>{year}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date-from" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Dátumtól</Label>
                <Input 
                  id="date-from" 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="date-to" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Dátumig</Label>
                <Input 
                  id="date-to" 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 border-l pl-4 border-border/60">
                <Checkbox 
                  id="partner-breakdown" 
                  checked={partnerBreakdown}
                  onCheckedChange={(checked) => setPartnerBreakdown(checked as boolean)}
                />
                <Label htmlFor="partner-breakdown" className="whitespace-nowrap font-medium text-xs cursor-pointer select-none">
                  Partner bontásban
                </Label>
              </div>
              <div className="border-l pl-4 border-border/60">
                <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handlePrint}>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF Export</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-md print:border-none print:shadow-none print:bg-transparent">
        <CardHeader className="py-4 border-b border-border/40 bg-muted/30 relative overflow-hidden print:hidden">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"></div>
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            Főkönyvi Kivonat
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <GeneralLedgerTable presetId={activePresetId} />
        </CardContent>
      </Card>

      <UploadChartOfAccountsModal 
        open={uploadModalOpen} 
        onOpenChange={setUploadModalOpen} 
        onSuccess={(id) => {
          queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
          setActivePresetId(id);
        }}
      />

      <ManagePresetsModal
        open={manageModalOpen}
        onOpenChange={setManageModalOpen}
        presets={presets || []}
        companyId={selectedCompany?.id}
      />
    </div>
  );
}
