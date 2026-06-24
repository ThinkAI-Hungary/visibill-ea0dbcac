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
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Loader2, Save, ChevronRight, ChevronDown, Download, ReceiptText, FileText, Maximize2, Minimize2, ClipboardCopy, ExternalLink, AlertTriangle, Wand2, BarChart3 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDateRange } from '@/contexts/DateRangeContext';
import { exportPnlExcel } from '@/lib/pnlExport';
import { isSameDay, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

import { useScopedNavigate } from '@/lib/navigation';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { reportError } from '@/lib/errorReporter';
import PnlChart from '@/components/pnl/PnlChart'; // F9
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';


// ── Default PnL mapping rules based on Hungarian Sztv. "A" variant ──
const DEFAULT_PNL_RULES: Array<{ prefix: string; pnlId: string; label: string }> = [
  // 5. Költségnemek
  { prefix: '51', pnlId: '00000000-0000-0000-0000-000000000400', label: 'IV. Anyagjellegű' },
  { prefix: '52', pnlId: '00000000-0000-0000-0000-000000000400', label: 'IV. Anyagjellegű' },
  { prefix: '53', pnlId: '00000000-0000-0000-0000-000000000400', label: 'IV. Anyagjellegű' },
  { prefix: '54', pnlId: '00000000-0000-0000-0000-000000000500', label: 'V. Személyi' },
  { prefix: '55', pnlId: '00000000-0000-0000-0000-000000000500', label: 'V. Személyi' },
  { prefix: '56', pnlId: '00000000-0000-0000-0000-000000000500', label: 'V. Személyi' },
  { prefix: '57', pnlId: '00000000-0000-0000-0000-000000000600', label: 'VI. ÉCS' },
  { prefix: '58', pnlId: '00000000-0000-0000-0000-000000000200', label: 'II. Aktivált saját' },
  // 8. Értékesítés elszámolt önköltsége és ráfordítások
  { prefix: '81', pnlId: '00000000-0000-0000-0000-000000000400', label: 'IV. Anyagjellegű' },
  { prefix: '82', pnlId: '00000000-0000-0000-0000-000000000500', label: 'V. Személyi' },
  { prefix: '83', pnlId: '00000000-0000-0000-0000-000000000600', label: 'VI. ÉCS' },
  { prefix: '84', pnlId: '00000000-0000-0000-0000-000000000700', label: 'VII. Egyéb ráford.' },
  { prefix: '85', pnlId: '00000000-0000-0000-0000-000000000700', label: 'VII. Egyéb ráford.' },
  { prefix: '86', pnlId: '00000000-0000-0000-0000-000000000700', label: 'VII. Egyéb ráford.' },
  { prefix: '87', pnlId: '00000000-0000-0000-0000-000000001000', label: 'IX. Pénzügyi ráford.' },
  { prefix: '88', pnlId: '00000000-0000-0000-0000-000000000700', label: 'VII. Egyéb ráford.' },
  { prefix: '89', pnlId: '00000000-0000-0000-0000-000000001300', label: 'X. Adófizetési' },
  // 9. Értékesítés árbevétele és bevételek
  { prefix: '91', pnlId: '00000000-0000-0000-0000-000000000100', label: 'I. Árbevétel' },
  { prefix: '92', pnlId: '00000000-0000-0000-0000-000000000100', label: 'I. Árbevétel' },
  { prefix: '93', pnlId: '00000000-0000-0000-0000-000000000100', label: 'I. Árbevétel' },
  { prefix: '94', pnlId: '00000000-0000-0000-0000-000000000100', label: 'I. Árbevétel' },
  { prefix: '95', pnlId: '00000000-0000-0000-0000-000000000100', label: 'I. Árbevétel' },
  { prefix: '96', pnlId: '00000000-0000-0000-0000-000000000300', label: 'III. Egyéb bevétel' },
  { prefix: '97', pnlId: '00000000-0000-0000-0000-000000000900', label: 'VIII. Pénzügyi bev.' },
  // 98. Rendkívüli bevételek (2016 után → III. Egyéb bevételek)
  { prefix: '98', pnlId: '00000000-0000-0000-0000-000000000300', label: 'III. Egyéb bevétel' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PnlMappingTab (P5: receives glAccounts as prop, P6: split memo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PnlMappingTab({ presetId, isGenericPreset, glAccounts, isLoadingGlAccounts }: { 
  presetId?: string; 
  isGenericPreset?: boolean;
  glAccounts?: any[];       // P5: passed from parent
  isLoadingGlAccounts?: boolean;
}) {
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

  const handleAutoAssign = () => {
    if (!glAccounts) return;
    const newMappings: Record<string, string> = { ...mappings };
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    let assignedCount = 0;

    glAccounts.forEach(gl => {
      const clean = cleanId(gl.gl_number);
      // Only map leaf accounts (no children)
      const hasChildren = glAccounts.some(other => {
        const otherClean = cleanId(other.gl_number);
        return otherClean.startsWith(clean) && otherClean !== clean;
      });
      if (hasChildren) return;

      // Find matching rule (longest prefix match)
      let bestRule: typeof DEFAULT_PNL_RULES[0] | null = null;
      for (const rule of DEFAULT_PNL_RULES) {
        if (clean.startsWith(rule.prefix)) {
          if (!bestRule || rule.prefix.length > bestRule.prefix.length) {
            bestRule = rule;
          }
        }
      }
      if (bestRule) {
        newMappings[gl.id] = bestRule.pnlId;
        assignedCount++;
      }
    });

    setMappings(newMappings);
    setHasChanges(true);
    toast({ title: 'Automatikus hozzárendelés kész', description: `${assignedCount} főkönyvi szám hozzárendelve a Sztv. "A" változat szerint. Ellenőrizd és mentsd el!` });
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

  // P6: Split memo — expensive tree build vs cheap visibility filter
  const treeData = React.useMemo(() => {
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
      const ancestorIds = ancestors.map(a => a.id);
      const isRoot = ancestors.length === 0;
      const depth = ancestors.length;
      
      return { ...item, isRoot, depth, ancestorIds };
    });
  }, [glAccounts]);

  // P6: Cheap visibility filter (only depends on expandedRowIds)
  const processedAccounts = React.useMemo(() => {
    return treeData.map(item => ({
      ...item,
      isVisibleOnScreen: item.isRoot || item.ancestorIds.every((id: string) => expandedRowIds.has(id))
    }));
  }, [treeData, expandedRowIds]);

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
        <div className="flex items-center gap-2">
          {isGenericPreset && (
            <Button
              variant="outline"
              onClick={handleAutoAssign}
              className="gap-2"
            >
              <Wand2 className="w-4 h-4" />
              Alapértelmezett hozzárendelés
            </Button>
          )}
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={!hasChanges || saveMutation.isPending}
            className="gap-2"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Mentés
          </Button>
        </div>
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
                  <div className={cn("col-span-4 text-sm truncate flex items-center gap-1.5", gl.isRoot ? "uppercase" : "")} title={gl.short_name}>
                    {!gl.hasChildren && (
                      mappings[gl.id]
                        ? <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Besorolva" />
                        : <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Nincs besorolva" />
                    )}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PnlViewTab (U7, U8, F8, F9, F10)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PnlViewTab({ presetId }: { presetId?: string }) {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();
  const [inThousands, setInThousands] = useState(true);
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [showChart, setShowChart] = useState(false); // F9
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedGl, setExpandedGl] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const scopedNavigate = useScopedNavigate();
  const { data: exchangeRates } = useExchangeRates();

  // F10: Determine previous fiscal year
  const currentFiscalYear = dateFrom ? parseInt(dateFrom.substring(0, 4)) : new Date().getFullYear();
  const previousFiscalYear = currentFiscalYear - 1;

  const { data: pnlData, isLoading } = useQuery({
    queryKey: ['pnl_report', selectedCompany?.id, presetId, dateFrom, dateTo, exchangeRates],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_pnl_report', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  const { data: dbItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ['glItems', selectedCompany?.id, presetId, dateFrom, dateTo, exchangeRates],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_gl_categorized_items', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  // U7+F10: Load previous year frozen data from annual_reports
  const { data: previousYearFrozen } = useQuery({
    queryKey: ['frozen_pnl', selectedCompany?.id, previousFiscalYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data } = await supabase
        .from('annual_reports')
        .select('frozen_pnl_data')
        .eq('company_id', selectedCompany.id)
        .eq('fiscal_year', previousFiscalYear)
        .maybeSingle();
      return data?.frozen_pnl_data || null;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 60_000,
  });

  // Build previous year lookup map
  const prevYearMap = React.useMemo(() => {
    if (!previousYearFrozen || !Array.isArray(previousYearFrozen)) return {};
    const map: Record<string, number> = {};
    previousYearFrozen.forEach((row: any) => {
      if (row.row_code && row.balance != null) {
        map[row.row_code] = Number(row.balance) || 0;
      }
    });
    return map;
  }, [previousYearFrozen]);

  const hasPreviousYear = Object.keys(prevYearMap).length > 0;

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

      // F10: Previous year value from frozen data
      const previousYear = prevYearMap[row.row_code] || 0;

      return { ...row, displayBalance, previousYear };
    });
  }, [pnlData, prevYearMap]);

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
      reportError({ type: 'db_query', component: 'ProfitAndLoss', action: 'error', message: String(err), error: err });
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-4 content-animate">
      {/* ── KPI Summary Bar (E1) ── */}
      {processedData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
          {[
            { code: 'A.', label: 'Üzemi eredmény' },
            { code: 'B.', label: 'Pénzügyi eredmény' },
            { code: 'C.', label: 'Adózás előtti eredmény' },
            { code: 'D.', label: 'Adózott eredmény' },
          ].map(kpi => {
            const row = processedData.find(r => r.row_code === kpi.code);
            const val = row?.displayBalance || 0;
            const prev = row?.previousYear || 0;
            const isPositive = val >= 0;
            return (
              <div key={kpi.code} className="bg-card border border-border/60 rounded-xl p-3.5">
                <div className="text-[11px] text-muted-foreground mb-1">{kpi.label}</div>
                <div className={cn(
                  "text-lg font-bold tabular-nums",
                  isPositive ? "text-emerald-600" : "text-red-500"
                )}>
                  {isPositive ? '+' : ''}{formatValue(val)} <span className="text-xs font-normal text-muted-foreground">{inThousands ? 'E Ft' : 'Ft'}</span>
                  {/* U8: Only show % change badge if previous year data exists */}
                  {hasPreviousYear && prev !== 0 && (() => {
                    const pctChange = Math.round(((val - prev) / Math.abs(prev)) * 100);
                    if (pctChange === 0) return null;
                    const isUp = pctChange > 0;
                    return (
                      <span className={cn("ml-1.5 text-[10px] font-semibold", isUp ? "text-emerald-500" : "text-red-400")}>
                        {isUp ? '▲' : '▼'}{Math.abs(pctChange)}%
                      </span>
                    );
                  })()}
                </div>
                {hasPreviousYear && prev !== 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">Előző év: {formatValue(prev)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* F9: Waterfall chart (toggle) */}
      {showChart && processedData.length > 0 && (
        <PnlChart processedData={processedData} inThousands={inThousands} />
      )}

      <div className="flex justify-between items-center mb-6 bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Switch id="view-mode" checked={inThousands} onCheckedChange={setInThousands} />
            <Label htmlFor="view-mode" className="font-medium cursor-pointer">
              Hivatalos nézet (Ezer Ft)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="hide-zero" checked={hideZeroRows} onCheckedChange={setHideZeroRows} />
            <Label htmlFor="hide-zero" className="font-medium cursor-pointer">
              Nullás sorok elrejtése
            </Label>
          </div>
          {/* F9: Chart toggle */}
          <div className="flex items-center space-x-2">
            <Switch id="show-chart" checked={showChart} onCheckedChange={setShowChart} />
            <Label htmlFor="show-chart" className="font-medium cursor-pointer flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Grafikon
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
      <div className="border rounded-md shadow-sm overflow-auto max-h-[70vh] bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/80 backdrop-blur-sm border-b border-border text-sm font-bold tracking-wide uppercase text-muted-foreground select-none sticky top-0 z-10">
          <div className="col-span-1 text-center">Sor</div>
          <div className="col-span-7">Megnevezés</div>
          <div className="col-span-2 text-right flex items-center justify-end gap-1">
            Előző Év
            {/* U7: Tooltip if no previous year data */}
            {!hasPreviousYear && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="w-3 h-3 text-amber-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Nincs lezárt {previousFiscalYear}. éves beszámoló</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="col-span-2 text-right text-foreground">Tárgyidőszak</div>
        </div>
        
        <div className="divide-y divide-border/40">
          {processedData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nem találhatók P&L adatok.</div>
          ) : (
            processedData.map(row => {
              const isRoman = row.type === 'roman';
              const isCapital = row.type === 'capital';

              if (hideZeroRows && !isCapital && row.displayBalance === 0 && row.previousYear === 0) {
                return null;
              }
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
                    {/* F10: Previous year column — show real data or dash */}
                    <div className={cn(
                      "col-span-2 text-right tabular-nums",
                      hasPreviousYear ? "text-muted-foreground" : "text-muted-foreground/50"
                    )}>
                      {hasPreviousYear ? formatValue(row.previousYear) : '—'}
                    </div>
                    <div className={cn(
                      "col-span-2 text-right tabular-nums",
                      isCapital ? "text-primary text-base" : ""
                    )}>
                      {formatValue(row.displayBalance)}
                      {/* U8: Only show ▲/▼ badge if previous year data exists and is non-zero */}
                      {hasPreviousYear && row.previousYear !== 0 && (() => {
                        const prev = row.previousYear;
                        const curr = row.displayBalance;
                        if (curr === prev) return null;
                        const pctChange = Math.round(((curr - prev) / Math.abs(prev)) * 100);
                        const isUp = pctChange > 0;
                        return (
                          <span className={cn("ml-1 text-[9px] font-medium", isUp ? "text-emerald-500" : "text-red-400")}>
                            {isUp ? '▲' : '▼'}{Math.abs(pctChange)}%
                          </span>
                        );
                      })()}
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
                                      {item.partner && (
                                        <button
                                          className="font-medium text-foreground/80 mr-2 hover:text-primary hover:underline underline-offset-2 transition-colors flex items-center gap-1 cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            scopedNavigate(`/invoices?search=${encodeURIComponent(item.partner)}`);
                                          }}
                                          title={`Számlák szűrése: ${item.partner}`}
                                        >
                                          {item.partner}
                                          <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                        </button>
                                      )}
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
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2" onClick={() => {
            const csv = 'Sor;Megnevezés;Előző év;Tárgyév\n' + processedData.map(r => `${r.row_code};${r.name};${r.previousYear || 0};${r.displayBalance || 0}`).join('\n');
            navigator.clipboard.writeText(csv);
          }}><ClipboardCopy className="w-4 h-4" /> Másolás CSV-ként</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Main ProfitAndLoss component (P5: single GL query)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  // P5: Single GL accounts query — shared between main component and PnlMappingTab
  const { data: glAccounts, isLoading: isLoadingGlAccounts } = useQuery({
    queryKey: ['gl_accounts', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const { data, error } = await supabase.from('gl_accounts').select('*').eq('preset_id', activePresetId).order('gl_number');
      if (error) throw error;
      return data;
    },
    enabled: !!activePresetId
  });

  const { data: existingMappings } = useQuery({
    queryKey: ['pnl_mapping', selectedCompany?.id, activePresetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return [];
      const { data, error } = await supabase.from('pnl_mapping').select('*').eq('company_id', selectedCompany.id).eq('preset_id', activePresetId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!activePresetId
  });

  const unassignedCount = React.useMemo(() => {
    if (!glAccounts) return 0;
    
    // Find leaf nodes
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    const rawData = glAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const hasChildren = glAccounts.some(d => 
        cleanId(d.gl_number).startsWith(cid) && 
        cleanId(d.gl_number) !== cid
      );
      return { ...dbItem, hasChildren };
    });

    const leafAccounts = rawData.filter(gl => !gl.hasChildren && !/^[1-4]/.test(gl.gl_number));
    const mappedIds = new Set(existingMappings?.map(m => m.gl_account_id) || []);
    return leafAccounts.filter(a => !mappedIds.has(a.id)).length;
  }, [glAccounts, existingMappings]);
  
  let isThisMonth = false, isThisQuarter = false, isThisYear = false;
  try {
    isThisMonth = isSameDay(dateFrom, startOfMonth(new Date())) && isSameDay(dateTo, endOfMonth(new Date()));
    isThisQuarter = isSameDay(dateFrom, startOfQuarter(new Date())) && isSameDay(dateTo, endOfQuarter(new Date()));
    isThisYear = isSameDay(dateFrom, startOfYear(new Date())) && isSameDay(dateTo, endOfYear(new Date()));
  } catch (e) {
    reportError({ type: 'db_query', component: 'ProfitAndLoss', action: 'error', message: 'Date comparison error:', error: e });
  }
  
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

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 page-animate">
      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb="Eredménykimutatás"
        title="Eredménykimutatás"
        description="Sztv. 'A' változat szerinti eredménykimutatás és beállítások"
        actions={
          <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-lg border border-border/50">
            <span className="text-sm font-medium text-muted-foreground ml-2">Időszak:</span>
            <ToggleGroup type="single" value={activeDatePreset} onValueChange={handleDatePresetChange} className="bg-background border rounded-md p-0.5 shadow-sm">
              <ToggleGroupItem value="year" className="h-8 px-4 text-xs font-medium">Év</ToggleGroupItem>
              <ToggleGroupItem value="quarter" className="h-8 px-4 text-xs font-medium">Negyedév</ToggleGroupItem>
              <ToggleGroupItem value="month" className="h-8 px-4 text-xs font-medium">Hónap</ToggleGroupItem>
              <ToggleGroupItem value="custom" className="h-8 px-4 text-xs font-medium" disabled>Egyedi</ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />

      {unassignedCount > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-800 dark:text-amber-400 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm print:hidden">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Figyelmeztetés az Eredménykimutatás összeállításában</p>
              <p className="text-xs mt-1 opacity-90">
                Jelenleg {unassignedCount} db nem besorolt eredménykimutatás főkönyvi szám található.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveTab('mapping')}
            className="border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold shrink-0 text-xs gap-1.5 h-8 bg-transparent"
          >
            <span>Hozzárendelési Mátrix megnyitása</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

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
              {/* P5: Pass glAccounts as prop instead of re-querying */}
              <PnlMappingTab 
                presetId={activePresetId} 
                isGenericPreset={presets?.find(p => p.id === activePresetId)?.type === 'generic'} 
                glAccounts={glAccounts}
                isLoadingGlAccounts={isLoadingGlAccounts}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
