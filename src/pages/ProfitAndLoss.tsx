import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Loader2, Save, ChevronRight, ChevronDown, Download, ReceiptText, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDateRange } from '@/contexts/DateRangeContext';
import { exportPnlExcel } from '@/lib/pnlExport';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, isSameDay } from 'date-fns';

function PnlMappingTab({ presetId }: { presetId?: string }) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  // Fetch PnL Structure
  const { data: pnlStructure, isLoading: isLoadingStructure } = useQuery({
    queryKey: ['pnl_structure'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pnl_structure').select('*').order('order_num');
      if (error) throw error;
      return data;
    }
  });

  // Fetch GL Accounts
  const { data: glAccounts, isLoading: isLoadingGlAccounts } = useQuery({
    queryKey: ['gl_accounts', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      const { data, error } = await supabase.from('gl_accounts').select('*').eq('preset_id', presetId).order('gl_number');
      if (error) throw error;
      return data;
    },
    enabled: !!presetId
  });

  // Fetch Existing Mappings
  const { data: existingMappings, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['pnl_mapping', selectedCompany?.id, presetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase
        .from('pnl_mapping')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('preset_id', presetId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  useEffect(() => {
    if (existingMappings) {
      const map: Record<string, string> = {};
      existingMappings.forEach(m => {
        map[m.gl_account_id] = m.pnl_structure_id;
      });
      setMappings(map);
      setHasChanges(false);
    }
  }, [existingMappings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !presetId) throw new Error("Missing company or preset");
      
      const payload = Object.entries(mappings).map(([gl_account_id, pnl_structure_id]) => ({
        gl_account_id,
        pnl_structure_id
      }));

      const { error } = await supabase.rpc('save_pnl_mappings', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_mappings: payload
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres mentés', description: 'A hozzárendelések sikeresen frissítve lettek.' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['pnl_mapping'] });
      queryClient.invalidateQueries({ queryKey: ['pnl_report'] });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a mentés során', description: err.message, variant: 'destructive' });
    }
  });

  const handleSelectChange = (glAccountId: string, structureId: string) => {
    setMappings(prev => {
      const next = { ...prev };
      if (structureId === 'none') {
        delete next[glAccountId];
      } else {
        next[glAccountId] = structureId;
      }
      return next;
    });
    setHasChanges(true);
  };

  const toggleRow = (id: string, hasChildren: boolean) => {
    if (!hasChildren) return;
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const processedAccounts = React.useMemo(() => {
    if (!glAccounts) return [];
    
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    
    const rawData = glAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const hasChildren = glAccounts.some(d => 
        cleanId(d.gl_number).startsWith(cid) && 
        cleanId(d.gl_number) !== cid
      );
      return {
        ...dbItem,
        cid,
        hasChildren
      };
    });

    return rawData.map(item => {
      const ancestors = rawData.filter(a => item.cid.startsWith(a.cid) && a.cid !== item.cid);
      const isRoot = ancestors.length === 0;
      const depth = ancestors.length;
      const isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));
      
      return { ...item, isRoot, depth, isVisibleOnScreen };
    });
  }, [glAccounts, expandedRowIds]);

  if (isLoadingStructure || isLoadingGlAccounts || isLoadingMappings) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  const assignableRows = pnlStructure?.filter(row => row.type === 'roman') || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium">Főkönyvi számok párosítása</h3>
          <p className="text-sm text-muted-foreground">Rendeld hozzá az aktuális számlatükör elemeit az Eredménykimutatás hivatalos soraihoz.</p>
        </div>
        <Button 
          onClick={() => saveMutation.mutate()} 
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </Button>
      </div>

      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
          <div className="col-span-3">Főkönyvi Szám</div>
          <div className="col-span-4">Megnevezés</div>
          <div className="col-span-5">Eredménykimutatás Sor</div>
        </div>
        <ScrollArea className="h-[600px]">
          {processedAccounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nincsenek főkönyvi számok a kiválasztott sablonban.</div>
          ) : (
            processedAccounts.map(gl => {
              if (!gl.isVisibleOnScreen) return null;
              
              const isExpanded = expandedRowIds.has(gl.id);
              const indentPadding = `${0.75 + (gl.depth * 1.5)}rem`;
              
              return (
                <div 
                  key={gl.id} 
                  className={cn(
                    "grid grid-cols-12 gap-4 p-3 border-b items-center hover:bg-muted/20 transition-colors",
                    gl.isRoot ? "bg-muted/10 font-medium" : "",
                    gl.hasChildren ? "cursor-pointer" : ""
                  )}
                  onClick={() => toggleRow(gl.id, gl.hasChildren)}
                >
                  <div className="col-span-3 flex items-center font-mono text-sm" style={{ paddingLeft: indentPadding }}>
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center mr-1">
                      {gl.hasChildren && (
                        <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                           {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </div>
                    {gl.gl_number}
                  </div>
                  <div className={cn("col-span-4 text-sm truncate", gl.isRoot ? "uppercase" : "")} title={gl.short_name}>
                    {gl.short_name}
                  </div>
                  <div className="col-span-5" onClick={e => e.stopPropagation()}>
                    <Select 
                      value={mappings[gl.id] || 'none'} 
                      onValueChange={(val) => handleSelectChange(gl.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Válassz sort..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-muted-foreground italic">Nincs besorolva</SelectItem>
                        {assignableRows.map(row => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.row_code} {row.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function PnlViewTab({ presetId }: { presetId?: string }) {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();
  const [inThousands, setInThousands] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedGl, setExpandedGl] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: pnlData, isLoading } = useQuery({
    queryKey: ['pnl_report', selectedCompany?.id, presetId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_pnl_report', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  const { data: dbItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ['glItems', selectedCompany?.id, presetId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_gl_categorized_items', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGl = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGl(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllPnl = () => {
    if (!pnlData) return;
    const romanIds = pnlData.filter(r => r.type === 'roman').map(r => r.pnl_structure_id);
    setExpandedRows(new Set(romanIds));
    // Also expand all GL accounts within roman rows
    const glIds = pnlData.filter(r => r.type === 'roman' && ((r.gl_accounts as any[]) || []).length > 0)
      .flatMap(r => ((r.gl_accounts as any[]) || []).map((gl: any) => gl.gl_account_id));
    setExpandedGl(new Set(glIds));
  };

  const collapseAllPnl = () => {
    setExpandedRows(new Set());
    setExpandedGl(new Set());
  };

  const formatValue = (val: number) => {
    const finalVal = inThousands ? Math.round(val / 1000) : val;
    if (finalVal === 0) return '0';
    return new Intl.NumberFormat('hu-HU').format(finalVal);
  };

  // Calculate totals
  const processedData = React.useMemo(() => {
    if (!pnlData) return [];

    const rawBalances: Record<string, number> = {};

    // First pass: store raw balances for roman rows
    pnlData.forEach(row => {
      if (row.type === 'roman') {
        rawBalances[row.row_code] = Number(row.balance) || 0;
      }
    });

    // Helper to sum raw balances by order_num ranges
    const sumRaw = (min: number, max: number) => {
      return pnlData
        .filter(r => r.type === 'roman' && r.order_num >= min && r.order_num < max)
        .reduce((sum, r) => sum + (Number(r.balance) || 0), 0);
    };

    return pnlData.map(row => {
      let rawBalance = 0;

      if (row.type === 'roman') {
        rawBalance = Number(row.balance) || 0;
      } else if (row.row_code === 'A.') {
        rawBalance = sumRaw(0, 80);
      } else if (row.row_code === 'B.') {
        rawBalance = sumRaw(90, 110);
      } else if (row.row_code === 'C.') {
        rawBalance = sumRaw(0, 130);
      } else if (row.row_code === 'D.') {
        rawBalance = sumRaw(0, 150);
      }

      // Display balance applies the multiplier (e.g., costs are positive in P&L)
      const displayBalance = rawBalance * (row.multiplier || 1);

      return { ...row, displayBalance };
    });
  }, [pnlData]);

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  const handleExport = async () => {
    if (!processedData || processedData.length === 0) {
      toast({ title: 'Hiba', description: 'Nincs mit exportálni.', variant: 'destructive' });
      return;
    }

    try {
      await exportPnlExcel(processedData, dbItems, inThousands, selectedCompany?.name);
      toast({ title: 'Sikeres exportálás', description: 'Az eredménykimutatás letöltése megkezdődött.' });
    } catch (err) {
      toast({ title: 'Hiba történt', description: 'Nem sikerült legenerálni az Excel fájlt.', variant: 'destructive' });
      console.error(err);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-4 content-animate">
      <div className="flex justify-between items-center mb-6 bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="view-mode" checked={inThousands} onCheckedChange={setInThousands} />
            <Label htmlFor="view-mode" className="font-medium cursor-pointer">
              Hivatalos nézet (Ezer Ft)
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handlePrintPdf}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <FileText className="h-4 w-4 mr-2" />
                Export XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div className="border rounded-md shadow-sm overflow-hidden bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/80 backdrop-blur-sm border-b border-border text-sm font-bold tracking-wide uppercase text-muted-foreground select-none">
          <div className="col-span-1 text-center">Sor</div>
          <div className="col-span-7">Megnevezés</div>
          <div className="col-span-2 text-right">Előző Év</div>
          <div className="col-span-2 text-right text-foreground">Tárgyidőszak</div>
        </div>
        
        <div className="divide-y divide-border/40">
          {processedData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nem találhatók P&L adatok.</div>
          ) : (
            processedData.map(row => {
              const isRoman = row.type === 'roman';
              const isCapital = row.type === 'capital';
              const glAccounts = (row.gl_accounts as any[]) || [];
              const hasGl = glAccounts.length > 0;
              const isExpanded = expandedRows.has(row.pnl_structure_id);

              return (
                <React.Fragment key={row.pnl_structure_id}>
                  <div 
                    className={cn(
                      "grid grid-cols-12 gap-4 p-3 items-center transition-colors hover:bg-muted/30",
                      isCapital ? "bg-primary/5 font-bold border-t-2 border-border/80" : "font-medium",
                      isRoman && hasGl ? "cursor-pointer" : ""
                    )}
                    onClick={() => isRoman && hasGl && toggleRow(row.pnl_structure_id)}
                  >
                    <div className="col-span-1 text-center font-bold text-muted-foreground">
                      {row.row_code}
                    </div>
                    <div className="col-span-7 flex items-center gap-2">
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {isRoman && hasGl && (
                          <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        )}
                      </div>
                      <span className={cn(isCapital && "uppercase tracking-wide")}>{row.name}</span>
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground/50 tabular-nums">
                      -
                    </div>
                    <div className={cn(
                      "col-span-2 text-right tabular-nums",
                      isCapital ? "text-primary text-base" : ""
                    )}>
                      {formatValue(row.displayBalance)}
                    </div>
                  </div>

                  {/* Level 1: GL Accounts */}
                  {isRoman && (
                    <div className={cn("bg-muted/10 border-b border-border/50 pb-2 shadow-inner", !isExpanded && "hidden print:block")}>
                      {glAccounts.map((gl: any) => {
                        const isGlExpanded = expandedGl.has(gl.gl_account_id);
                        const items = dbItems?.filter(i => i.gl_account_id === gl.gl_account_id) || [];
                        const hasItems = items.length > 0;

                        return (
                          <React.Fragment key={gl.gl_account_id}>
                            <div 
                              className={cn(
                                "grid grid-cols-12 gap-4 py-2 px-3 items-center text-sm hover:bg-muted/40 border-l-4 border-l-transparent",
                                hasItems ? "cursor-pointer hover:border-l-primary/40" : ""
                              )}
                              onClick={(e) => hasItems && toggleGl(gl.gl_account_id, e)}
                            >
                              <div className="col-span-1"></div>
                              <div className="col-span-7 flex items-center gap-2 pl-4 text-muted-foreground">
                                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                                  {hasItems && (
                                    <div className="text-muted-foreground/50">
                                      {isGlExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/70">{gl.gl_number}</span>
                                <span className="truncate">{gl.short_name}</span>
                              </div>
                              <div className="col-span-2"></div>
                              <div className="col-span-2 text-right text-muted-foreground tabular-nums">
                                {formatValue(gl.balance * (row.multiplier || 1))}
                              </div>
                            </div>

                            {/* Level 2: Transactions */}
                            {hasItems && (
                              <div className={cn("bg-background/50 py-1 shadow-inner pl-12 pr-4 border-y border-border/20", !isGlExpanded && "hidden print:block")}>
                                {items.map((item: any) => (
                                  <div key={item.item_id} className="grid grid-cols-12 gap-4 py-1.5 items-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2 rounded-md transition-colors">
                                    <div className="col-span-2 flex items-center gap-2">
                                      <ReceiptText className="w-3 h-3 opacity-50" />
                                      {item.item_date?.substring(0, 10).replace(/-/g, '.')}
                                    </div>
                                    <div className="col-span-6 flex items-center gap-2 truncate" title={item.description || item.partner}>
                                      {item.partner && <span className="font-medium text-foreground/80 mr-2">{item.partner}</span>}
                                      <span className="truncate">{item.description}</span>
                                      {item.document_url && (
                                        <a 
                                          href={item.document_url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          onClick={(e) => e.stopPropagation()} 
                                          className="ml-auto flex shrink-0 items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors text-[10px] font-medium"
                                          title="Eredeti bizonylat megtekintése"
                                        >
                                          <FileText className="w-3 h-3" />
                                          PDF
                                        </a>
                                      )}
                                    </div>
                                    <div className="col-span-2 text-right opacity-70">
                                      {item.item_type}
                                    </div>
                                    <div className="col-span-2 text-right tabular-nums">
                                      {formatValue(item.amount * (row.multiplier || 1))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={expandAllPnl} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
          <ContextMenuItem onClick={collapseAllPnl} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

export default function ProfitAndLoss() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'view';
  
  const setActiveTab = (val: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', val);
      return next;
    }, { replace: true });
  };

  const { activePresetId, setActivePresetId, presets } = useActivePreset(selectedCompany?.id);
  const { dateFrom, dateTo, setDateFrom, setDateTo } = useDateRange();
  
  const isThisMonth = isSameDay(dateFrom, startOfMonth(new Date())) && isSameDay(dateTo, endOfMonth(new Date()));
  const isThisQuarter = isSameDay(dateFrom, startOfQuarter(new Date())) && isSameDay(dateTo, endOfQuarter(new Date()));
  const isThisYear = isSameDay(dateFrom, startOfYear(new Date())) && isSameDay(dateTo, endOfYear(new Date()));
  
  const activeDatePreset = isThisYear ? 'year' : isThisQuarter ? 'quarter' : isThisMonth ? 'month' : 'custom';

  const handleDatePresetChange = (val: string) => {
    if (!val || val === 'custom') return;
    const now = new Date();
    if (val === 'year') {
      setDateFrom(startOfYear(now));
      setDateTo(endOfYear(now));
    } else if (val === 'quarter') {
      setDateFrom(startOfQuarter(now));
      setDateTo(endOfQuarter(now));
    } else if (val === 'month') {
      setDateFrom(startOfMonth(now));
      setDateTo(endOfMonth(now));
    }
  };

  const toggleActivePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!selectedCompany?.id) throw new Error("Cég nincs kiválasztva.");
      
      const isGeneric = presets?.find(p => p.id === presetId)?.type === 'generic';
      
      await supabase
        .from('chart_of_accounts_presets')
        .update({ is_active: false })
        .eq('company_id', selectedCompany.id)
        .eq('type', 'custom');

      if (!isGeneric) {
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

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 page-animate">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Eredménykimutatás</h1>
          <p className="text-sm text-muted-foreground mt-1">Sztv. "A" változat szerinti eredménykimutatás és beállítások</p>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-lg border border-border/50">
          <span className="text-sm font-medium text-muted-foreground ml-2">Időszak:</span>
          <ToggleGroup type="single" value={activeDatePreset} onValueChange={handleDatePresetChange} className="bg-background border rounded-md p-0.5 shadow-sm">
            <ToggleGroupItem value="year" className="h-8 px-4 text-xs font-medium">Év</ToggleGroupItem>
            <ToggleGroupItem value="quarter" className="h-8 px-4 text-xs font-medium">Negyedév</ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-8 px-4 text-xs font-medium">Hónap</ToggleGroupItem>
            <ToggleGroupItem value="custom" className="h-8 px-4 text-xs font-medium" disabled>Egyedi</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 h-12 w-full md:w-auto p-1 bg-muted/50">
          <TabsTrigger value="view" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-6">
            Eredménykimutatás
          </TabsTrigger>
          <TabsTrigger value="mapping" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm px-6">
            Hozzárendelési Mátrix
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="view" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Eredménykimutatás</CardTitle>
                  <CardDescription>
                    Sztv. szerinti "A" változat (Összköltség eljárás)
                  </CardDescription>
                </div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={handleSelectPreset} disabled={toggleActivePresetMutation.isPending}>
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-muted/50 border-0 font-semibold">
                        <SelectValue placeholder="Sablon kiválasztása" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map(preset => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name} {preset.type === 'generic' ? '(Beépített)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <PnlViewTab presetId={activePresetId} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mapping" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Hozzárendelési Mátrix</CardTitle>
                  <CardDescription>
                    Párosítsd a főkönyvi számlákat az Eredménykimutatás soraihoz.
                  </CardDescription>
                </div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={handleSelectPreset} disabled={toggleActivePresetMutation.isPending}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Sablon kiválasztása" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.map(preset => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name} {preset.type === 'generic' ? '(Beépített)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <PnlMappingTab presetId={activePresetId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
