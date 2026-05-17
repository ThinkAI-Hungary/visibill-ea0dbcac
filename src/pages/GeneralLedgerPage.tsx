import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, UploadCloud, Database, Bot, Loader2, Search, FileText, ChevronDown, Eye, Printer } from 'lucide-react';
import GeneralLedgerTable, { GeneralLedgerTableRef } from '@/components/general-ledger/GeneralLedgerTable';
import { UploadChartOfAccountsModal } from '@/components/general-ledger/UploadChartOfAccountsModal';
import { ManagePresetsModal } from '@/components/general-ledger/ManagePresetsModal';
import { Settings2 } from 'lucide-react';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useDateRange } from '@/contexts/DateRangeContext';
import { PageHeader } from '@/components/ui/page-header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function GeneralLedgerPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();
  const taxYear = dateFrom ? dateFrom.substring(0, 4) : new Date().getFullYear().toString();
  
  const [partnerBreakdown, setPartnerBreakdown] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [glStats, setGlStats] = useState<{ accountCount: number; leafCount: number; totalDebit: number; totalCredit: number; classifiedItems: number; totalItems: number } | null>(null);
  const tableRef = useRef<GeneralLedgerTableRef>(null);
  const handleStatsChange = useCallback((stats: typeof glStats) => setGlStats(stats), []);

  // ── URL deep-linking for modals ──
  const [searchParams, setSearchParams] = useSearchParams();
  const setActionParam = useCallback((action: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (action) next.set('action', action);
      else next.delete('action');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenUpload = useCallback(() => { setUploadModalOpen(true); setActionParam('upload'); }, [setActionParam]);
  const handleOpenManage = useCallback(() => { setManageModalOpen(true); setActionParam('manage'); }, [setActionParam]);
  const handleCloseUpload = useCallback((v: boolean) => { setUploadModalOpen(v); if (!v) setActionParam(null); }, [setActionParam]);
  const handleCloseManage = useCallback((v: boolean) => { setManageModalOpen(v); if (!v) setActionParam(null); }, [setActionParam]);

  // Auto-open from URL
  const actionFromUrl = searchParams.get('action');
  useEffect(() => {
    if (actionFromUrl === 'upload' && !uploadModalOpen) setUploadModalOpen(true);
    if (actionFromUrl === 'manage' && !manageModalOpen) setManageModalOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const { activePresetId, setActivePresetId, presets } = useActivePreset(selectedCompany?.id);

  useEffect(() => {
    if (!selectedCompany?.id) return;

    const channel = supabase.channel('ai_notifications')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'gl_upload_notifications',
        filter: `company_id=eq.${selectedCompany.id}`
      }, (payload) => {
        const row = payload.new as { processing_status: string; message: string };
        if (row.processing_status !== 'completed' && row.processing_status !== 'error') return;
        
        setIsAIRunning(false);
        queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        queryClient.invalidateQueries({ queryKey: ['glItems'] });
        
        if (row.processing_status === 'error') {
          toast({ title: 'Hiba történt', description: row.message || 'Az AI feldolgozás sikertelen.', variant: 'destructive' });
        } else {
          toast({ 
            title: 'Kész!', 
            description: row.message || 'Az AI feldolgozás sikeresen befejeződött.',
            className: "bg-green-50 text-green-900 border-green-200"
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompany?.id, toast]);

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

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    if (tableRef.current) {
      tableRef.current.expandAllAndPrint();
    } else {
      window.print();
    }
  };

  const handleRunAI = async () => {
    if (!selectedCompany?.id) return;
    setIsAIRunning(true);
    try {
      // PGMQ: INSERT into gl_upload_notifications triggers the DB trigger
      // which enqueues the job to the gl_classification_jobs PGMQ queue.
      const { error } = await supabase
        .from('gl_upload_notifications')
        .insert({
          company_id: selectedCompany.id,
          target_preset_id: activePresetId,
          processing_status: 'pending',
          message: 'AI besorolás indítva a felhasználó által'
        } as any);

      if (error) throw new Error(error.message);
      toast({ title: 'Sikeres indítás', description: 'Az AI besorolás elindult a paramétereknek megfelelően.' });
    } catch (error: any) {
      toast({ title: 'Hiba történt', description: error.message, variant: 'destructive' });
      setIsAIRunning(false);
    }
  };

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: handlePrint, description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 page-animate">
      {/* Print-only header */}
      <div className="hidden print:flex flex-col items-center justify-center mb-8 w-full border-b-2 border-primary/20 pb-6">
        <h1 className="text-5xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight print:text-black mb-2">Visibill</h1>
        <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground mt-2">Főkönyvi Kivonat</h2>
        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span>Adóév: {taxYear}</span>
          <span>•</span>
          <span>Időszak: {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}</span>
        </div>
      </div>

      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb="Főkönyv"
        title="Főkönyv"
        description="Hierarchikus főkönyvi kivonat és kategóriák"
      />

      <div className="flex flex-col gap-3 print:hidden">
          {/* Preset Selector & Action */}
          <div className="flex items-center justify-end gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <Label className="whitespace-nowrap font-medium text-xs">Aktív Számlatükör:</Label>
              <Select value={activePresetId || ''} onValueChange={handleSelectPreset} disabled={toggleActivePresetMutation.isPending}>
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
                onClick={handleOpenManage}
              >
                <Settings2 className="w-4 h-4" />
                <span>Sablonok kezelése</span>
              </Button>
            </div>
            <div className="border-l pl-3 border-border/60 flex items-center gap-2">
              <Button onClick={handleOpenUpload} size="sm" className="h-9 gap-2">
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
              <div className="border-l pl-3 border-border/60 ml-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setShowPrintPreview(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Nyomtatási előnézet
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2" />
                      Nyomtatás / PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => tableRef.current?.exportExcel(selectedCompany?.name)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
      </div>

      {/* ── KPI Summary Bar (F1) ── */}
      {glStats && glStats.accountCount > 0 && (() => {
        const fmtHuf = (v: number) => new Intl.NumberFormat('hu-HU').format(Math.round(v));
        return (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2 rounded-lg"><Database className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums">{glStats.accountCount}</div><div className="text-[11px] text-muted-foreground">Összes számla</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-600 p-2 rounded-lg"><FileText className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums">{glStats.leafCount}</div><div className="text-[11px] text-muted-foreground">Analitikus számlák</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg"><Download className="w-4 h-4 rotate-180" /></div>
              <div><div className="text-lg font-bold tabular-nums text-emerald-600">{fmtHuf(glStats.totalDebit)}</div><div className="text-[11px] text-muted-foreground">Tartozik (Ft)</div></div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-red-500/10 text-red-500 p-2 rounded-lg"><Download className="w-4 h-4" /></div>
              <div><div className="text-lg font-bold tabular-nums text-red-500">{fmtHuf(glStats.totalCredit)}</div><div className="text-[11px] text-muted-foreground">Követel (Ft)</div></div>
            </div>
          </div>
          {/* ── Classification Progress Bar (F2) ── */}
          {glStats.totalItems > 0 && (() => {
            const pct = Math.round((glStats.classifiedItems / glStats.totalItems) * 100);
            return (
              <div className="mt-3 print:hidden">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Besorolás: {glStats.classifiedItems}/{glStats.totalItems} tétel</span>
                  <span className={pct === 100 ? 'text-emerald-600 font-semibold' : ''}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
          </>
        );
      })()}

      <Card className="border-border/60 shadow-md print:border-none print:shadow-none print:bg-transparent content-animate">
        <CardHeader className="py-4 border-b border-border/40 bg-muted/30 relative overflow-hidden print:hidden">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"></div>
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            Főkönyvi Kivonat
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Keresés a főkönyvben..." 
                  className="w-[250px] h-9 pl-9 text-xs bg-background"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <GeneralLedgerTable ref={tableRef} presetId={activePresetId} dateFrom={dateFrom} dateTo={dateTo} globalSearch={globalSearch} onStatsChange={handleStatsChange} />
        </CardContent>
      </Card>

      <UploadChartOfAccountsModal 
        open={uploadModalOpen} 
        onOpenChange={handleCloseUpload} 
        onSuccess={(id) => {
          queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
          setActivePresetId(id);
        }}
      />

      <ManagePresetsModal
        open={manageModalOpen}
        onOpenChange={handleCloseManage}
        presets={presets || []}
        companyId={selectedCompany?.id}
      />

      {/* F5: Print Preview Dialog */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-primary" />
              Főkönyv nyomtatási előnézet
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 bg-white dark:bg-background">
            <div className="text-center mb-6 border-b-2 border-primary/20 pb-4">
              <h1 className="text-2xl font-bold text-foreground">{selectedCompany?.name || 'Vállalkozás'}</h1>
              <p className="text-sm text-muted-foreground mt-1">Főkönyvi kivonat — Nyomtatási előnézet</p>
            </div>
            <div className="border rounded-md shadow-sm bg-card">
              <GeneralLedgerTable
                presetId={activePresetId}
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t border-border/40 bg-muted/30 shrink-0 gap-2">
            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>Bezárás</Button>
            <Button className="gap-2" onClick={() => { setShowPrintPreview(false); handlePrint(); }}>
              <Printer className="w-4 h-4" /> Nyomtatás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
