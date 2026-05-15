import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Loader2, Save, ChevronRight, ChevronDown, Download, FileText, CheckCircle2, AlertTriangle, Lock, Maximize2, Minimize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ─── Mapping Tab ───
function BsMappingTab({ presetId }: { presetId?: string }) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const { data: bsStructure } = useQuery({
    queryKey: ['bs_structure'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bs_structure').select('*').order('order_num');
      if (error) throw error;
      return data;
    }
  });

  const { data: glAccounts } = useQuery({
    queryKey: ['gl_accounts_bs', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      const { data, error } = await supabase.from('gl_accounts').select('*').eq('preset_id', presetId).order('gl_number');
      if (error) throw error;
      // Filter to 1-4 account classes only
      return (data || []).filter(a => /^[1-4]/.test(a.gl_number));
    },
    enabled: !!presetId
  });

  const { data: existingMappings } = useQuery({
    queryKey: ['bs_mapping', selectedCompany?.id, presetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.from('bs_mapping').select('*').eq('company_id', selectedCompany.id).eq('preset_id', presetId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  useEffect(() => {
    if (existingMappings) {
      const map: Record<string, string> = {};
      existingMappings.forEach(m => { map[m.gl_account_id] = m.bs_structure_id; });
      setMappings(map);
      setHasChanges(false);
    }
  }, [existingMappings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !presetId) throw new Error("Missing company or preset");
      const payload = Object.entries(mappings).map(([gl_account_id, bs_structure_id]) => ({ gl_account_id, bs_structure_id }));
      const { error } = await supabase.rpc('save_bs_mappings', { p_company_id: selectedCompany.id, p_preset_id: presetId, p_mappings: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres mentés', description: 'A mérleg hozzárendelések frissítve.' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['bs_mapping'] });
      queryClient.invalidateQueries({ queryKey: ['bs_report'] });
    },
    onError: (err: any) => { toast({ title: 'Hiba', description: err.message, variant: 'destructive' }); }
  });

  const handleSelectChange = (glAccountId: string, structureId: string) => {
    setMappings(prev => {
      const next = { ...prev };
      if (structureId === 'none') delete next[glAccountId]; else next[glAccountId] = structureId;
      return next;
    });
    setHasChanges(true);
  };

  const toggleRow = (id: string, hasChildren: boolean) => {
    if (!hasChildren) return;
    setExpandedRowIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const expandAll = () => {
    if (!glAccounts) return;
    const allParents = glAccounts.filter(a => {
      const cid = a.gl_number ? String(a.gl_number).replace(/\./g, '') : '';
      return glAccounts.some(d => { const did = d.gl_number ? String(d.gl_number).replace(/\./g, '') : ''; return did.startsWith(cid) && did !== cid; });
    });
    setExpandedRowIds(new Set(allParents.map(a => a.id)));
  };

  const collapseAll = () => setExpandedRowIds(new Set());

  const processedAccounts = React.useMemo(() => {
    if (!glAccounts) return [];
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    const rawData = glAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const hasChildren = glAccounts.some(d => cleanId(d.gl_number).startsWith(cid) && cleanId(d.gl_number) !== cid);
      return { ...dbItem, cid, hasChildren };
    });
    return rawData.map(item => {
      const ancestors = rawData.filter(a => item.cid.startsWith(a.cid) && a.cid !== item.cid);
      const isRoot = ancestors.length === 0;
      const depth = ancestors.length;
      const isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));
      return { ...item, isRoot, depth, isVisibleOnScreen };
    });
  }, [glAccounts, expandedRowIds]);

  // Build grouped dropdown items: letter sections as headers, only leaf rows selectable
  const dropdownGroups = React.useMemo(() => {
    if (!bsStructure) return { assets: [] as any[], liabilities: [] as any[] };
    const letterRows = bsStructure.filter(r => r.type === 'letter');
    const buildGroup = (section: string) => {
      return letterRows.filter(l => l.section === section).map(letter => {
        // Find leaf rows under this letter (arabic, or roman without children)
        const romanRows = bsStructure.filter(r => r.parent_id === letter.id && r.type === 'roman');
        const leafRows: any[] = [];
        romanRows.forEach(roman => {
          const arabicChildren = bsStructure.filter(r => r.parent_id === roman.id && r.type === 'arabic');
          if (arabicChildren.length > 0) {
            arabicChildren.forEach(a => leafRows.push({ ...a, label: `${roman.row_code}/${a.row_code} ${a.name}` }));
          } else {
            leafRows.push({ ...roman, label: `${roman.row_code} ${roman.name}` });
          }
        });
        // Direct arabic children of letter (e.g., C. → 1., 2., 3.)
        const directArabic = bsStructure.filter(r => r.parent_id === letter.id && r.type === 'arabic');
        directArabic.forEach(a => leafRows.push({ ...a, label: `${a.row_code} ${a.name}` }));
        return { letter, leafRows };
      });
    };
    return { assets: buildGroup('assets'), liabilities: buildGroup('liabilities') };
  }, [bsStructure]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </Button>
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
          <div className="col-span-3">Főkönyvi Szám</div>
          <div className="col-span-4">Megnevezés</div>
          <div className="col-span-5">Mérleg Sor</div>
        </div>
        <ScrollArea className="h-[600px]">
          {processedAccounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nincsenek 1-4. számlaosztályú főkönyvi számok.</div>
          ) : (
            processedAccounts.map(gl => {
              if (!gl.isVisibleOnScreen) return null;
              const isExpanded = expandedRowIds.has(gl.id);
              const indentPadding = `${0.75 + (gl.depth * 1.5)}rem`;
              return (
                <div key={gl.id} className={cn("grid grid-cols-12 gap-4 p-3 border-b items-center hover:bg-muted/20 transition-colors", gl.isRoot ? "bg-muted/10 font-medium" : "", gl.hasChildren ? "cursor-pointer" : "")} onClick={() => toggleRow(gl.id, gl.hasChildren)}>
                  <div className="col-span-3 flex items-center font-mono text-sm" style={{ paddingLeft: indentPadding }}>
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center mr-1">
                      {gl.hasChildren && <div className="text-muted-foreground/70">{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</div>}
                    </div>
                    {gl.gl_number}
                  </div>
                  <div className={cn("col-span-4 text-sm truncate", gl.isRoot ? "uppercase" : "")} title={gl.short_name}>{gl.short_name}</div>
                  <div className="col-span-5" onClick={e => e.stopPropagation()}>
                    <Select value={mappings[gl.id] || 'none'} onValueChange={(val) => handleSelectChange(gl.id, val)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Válassz sort..." /></SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <SelectItem value="none" className="text-muted-foreground italic">Nincs besorolva</SelectItem>
                        {dropdownGroups.assets.map(group => (
                          <React.Fragment key={group.letter.id}>
                            <SelectItem disabled value={`__h_${group.letter.id}`} className="font-bold text-xs uppercase tracking-wide text-emerald-500 dark:text-emerald-400 mt-1">
                              {group.letter.row_code} {group.letter.name}
                            </SelectItem>
                            {group.leafRows.map((row: any) => (
                              <SelectItem key={row.id} value={row.id} className="pl-6 text-xs">
                                {row.label}
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                        {dropdownGroups.liabilities.map(group => (
                          <React.Fragment key={group.letter.id}>
                            <SelectItem disabled value={`__h_${group.letter.id}`} className="font-bold text-xs uppercase tracking-wide text-blue-500 dark:text-blue-400 mt-1">
                              {group.letter.row_code} {group.letter.name}
                            </SelectItem>
                            {group.leafRows.map((row: any) => (
                              <SelectItem key={row.id} value={row.id} className="pl-6 text-xs" disabled={row.is_pnl_bridge}>
                                {row.is_pnl_bridge ? '🔒 ' : ''}{row.label}
                              </SelectItem>
                            ))}
                          </React.Fragment>
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={expandAll} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
          <ContextMenuItem onClick={collapseAll} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

// ─── View Tab ───
function BsViewTab({ presetId }: { presetId?: string }) {
  const { selectedCompany } = useCompany();
  const [inThousands, setInThousands] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: bsData, isLoading } = useQuery({
    queryKey: ['bs_report', selectedCompany?.id, presetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_bs_report', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_to: null,
        p_fiscal_year: null
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  const formatValue = (val: number) => {
    const finalVal = inThousands ? Math.round(val / 1000) : val;
    if (finalVal === 0) return '0';
    return new Intl.NumberFormat('hu-HU').format(finalVal);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // Hierarchical sum calculation
  const processedData = React.useMemo(() => {
    if (!bsData) return { assets: [] as any[], liabilities: [] as any[], totalAssets: 0, totalLiabilities: 0 };
    const balanceMap: Record<string, number> = {};

    // First pass: leaf balances
    bsData.forEach(row => {
      if (row.type === 'arabic' || (row.type === 'roman' && !bsData.some(r => r.parent_id === row.bs_structure_id))) {
        balanceMap[row.bs_structure_id] = Number(row.current_balance) || 0;
      }
    });

    // Aggregate up: roman = sum of arabic children
    bsData.filter(r => r.type === 'roman').forEach(roman => {
      const children = bsData.filter(r => r.parent_id === roman.bs_structure_id);
      if (children.length > 0) {
        balanceMap[roman.bs_structure_id] = children.reduce((s, c) => s + (balanceMap[c.bs_structure_id] || 0), 0);
      } else {
        balanceMap[roman.bs_structure_id] = Number(roman.current_balance) || 0;
      }
    });

    // Letter = sum of roman children
    bsData.filter(r => r.type === 'letter').forEach(letter => {
      const children = bsData.filter(r => r.parent_id === letter.bs_structure_id);
      balanceMap[letter.bs_structure_id] = children.reduce((s, c) => s + (balanceMap[c.bs_structure_id] || 0), 0);
    });

    // Totals
    const totalAssets = bsData.filter(r => r.type === 'letter' && r.section === 'assets').reduce((s, r) => s + (balanceMap[r.bs_structure_id] || 0), 0);
    const totalLiabilities = bsData.filter(r => r.type === 'letter' && r.section === 'liabilities').reduce((s, r) => s + (balanceMap[r.bs_structure_id] || 0), 0);

    // Total rows
    bsData.filter(r => r.type === 'total').forEach(t => {
      balanceMap[t.bs_structure_id] = t.section === 'assets' ? totalAssets : totalLiabilities;
    });

    const enriched = bsData.map(row => ({ ...row, computedBalance: balanceMap[row.bs_structure_id] || 0 }));
    return {
      assets: enriched.filter(r => r.section === 'assets'),
      liabilities: enriched.filter(r => r.section === 'liabilities'),
      totalAssets,
      totalLiabilities,
    };
  }, [bsData]);

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  const { assets, liabilities, totalAssets, totalLiabilities } = processedData;
  const isBalanced = Math.abs(totalAssets - totalLiabilities) < 0.01;
  const difference = totalAssets - totalLiabilities;

  const renderRow = (row: any) => {
    const isLetter = row.type === 'letter';
    const isRoman = row.type === 'roman';
    const isArabic = row.type === 'arabic';
    const isTotal = row.type === 'total';
    const glAccounts = (row.gl_accounts as any[]) || [];
    const hasGl = glAccounts.length > 0;
    const isExpanded = expandedRows.has(row.bs_structure_id);

    const indent = isRoman ? 'pl-6' : isArabic ? 'pl-12' : '';

    return (
      <React.Fragment key={row.bs_structure_id}>
        <div
          className={cn(
            "grid grid-cols-12 gap-4 p-3 items-center transition-colors hover:bg-muted/30",
            isTotal ? "bg-primary/10 font-bold border-t-2 border-b-2 border-border/80 text-base" : "",
            isLetter ? "bg-primary/5 font-bold border-t border-border/60" : "",
            isRoman ? "font-semibold" : "",
            isArabic && hasGl ? "cursor-pointer" : ""
          )}
          onClick={() => isArabic && hasGl && toggleRow(row.bs_structure_id)}
        >
          <div className={cn("col-span-1 text-center font-bold text-muted-foreground text-sm", indent)}>
            {row.row_code}
          </div>
          <div className={cn("col-span-5 flex items-center gap-2", indent)}>
            {isArabic && hasGl && (
              <div className="w-4 h-4 shrink-0 text-muted-foreground/70">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            )}
            <span className={cn(isTotal && "uppercase tracking-wide", isLetter && "uppercase")}>
              {row.name}
            </span>
            {row.is_pnl_bridge && <Lock className="w-3.5 h-3.5 text-amber-500 ml-1" title="Automatikusan az Eredménykimutatásból" />}
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground/50">
            {formatValue(Number(row.prior_year_balance) || 0)}
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground/50">
            {formatValue(Number(row.prior_year_adjustment) || 0)}
          </div>
          <div className={cn("col-span-2 text-right tabular-nums", isTotal ? "text-primary text-base" : "", isLetter ? "font-bold" : "")}>
            {formatValue(row.computedBalance)}
          </div>
        </div>

        {/* GL Drill-down */}
        {isArabic && isExpanded && (
          <div className="bg-muted/10 border-b border-border/50 pb-2 shadow-inner">
            {glAccounts.map((gl: any) => (
              <div key={gl.gl_account_id} className="grid grid-cols-12 gap-4 py-2 px-3 items-center text-sm hover:bg-muted/40 border-l-4 border-l-transparent">
                <div className="col-span-1"></div>
                <div className="col-span-5 flex items-center gap-2 pl-16 text-muted-foreground">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/70">{gl.gl_number}</span>
                  <span className="truncate">{gl.short_name}</span>
                </div>
                <div className="col-span-2"></div>
                <div className="col-span-2"></div>
                <div className="col-span-2 text-right text-muted-foreground tabular-nums">{formatValue(gl.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* Balance Validator */}
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
        isBalanced
          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
          : "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
      )}>
        {isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        <span className="font-bold">
          {isBalanced ? '✓ A mérleg egyezik' : `✗ Eltérés: ${formatValue(difference)} ${inThousands ? 'E Ft' : 'Ft'}`}
        </span>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center space-x-2">
          <Switch id="bs-view-mode" checked={inThousands} onCheckedChange={setInThousands} />
          <Label htmlFor="bs-view-mode" className="font-medium cursor-pointer">Hivatalos nézet (Ezer Ft)</Label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 h-9 bg-card" onClick={() => window.print()}>
            <FileText className="w-4 h-4 text-indigo-500" /><span className="font-medium">PDF</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md shadow-sm overflow-hidden bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 bg-muted/80 border-b text-sm font-bold uppercase text-muted-foreground select-none">
          <div className="col-span-1 text-center">Sor</div>
          <div className="col-span-5">Megnevezés</div>
          <div className="col-span-2 text-right">Előző év</div>
          <div className="col-span-2 text-right">Módosítások</div>
          <div className="col-span-2 text-right text-foreground">Tárgyév</div>
        </div>
        <div className="divide-y divide-border/40">
          {assets.map(renderRow)}
          <div className="h-4 bg-muted/30" /> {/* Separator */}
          {liabilities.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function BalanceSheet() {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'view';
  const setActiveTab = (val: string) => { setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', val); return next; }, { replace: true }); };
  const { activePresetId, setActivePresetId, presets } = useActivePreset(selectedCompany?.id);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Mérleg</h1>
          <p className="text-sm text-muted-foreground mt-1">Sztv. "A" változat szerinti mérleg és beállítások</p>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 h-12 w-full md:w-auto p-1 bg-muted/50">
          <TabsTrigger value="view" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6">Mérleg</TabsTrigger>
          <TabsTrigger value="mapping" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6">Hozzárendelési Mátrix</TabsTrigger>
        </TabsList>
        <TabsContent value="view" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div><CardTitle className="text-xl">Mérleg</CardTitle><CardDescription>Sztv. szerinti "A" változat</CardDescription></div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={setActivePresetId}>
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-muted/50 border-0 font-semibold"><SelectValue placeholder="Sablon" /></SelectTrigger>
                      <SelectContent>{presets.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} {p.type === 'generic' ? '(Beépített)' : ''}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6"><BsViewTab presetId={activePresetId} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mapping" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div><CardTitle className="text-xl">Hozzárendelési Mátrix</CardTitle><CardDescription>Párosítsd az 1-4. számlaosztály főkönyvi számait a Mérleg soraihoz.</CardDescription></div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={setActivePresetId}>
                      <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Sablon" /></SelectTrigger>
                      <SelectContent>{presets.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} {p.type === 'generic' ? '(Beépített)' : ''}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6"><BsMappingTab presetId={activePresetId} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
