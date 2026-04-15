import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Loader2, RefreshCw } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { useCompany } from '@/contexts/CompanyContext';

interface LedgerItem {
  id: string; // Fők.szám
  name: string; // Megnevezés
  balance: number; // Összesített Egyenleg
  hasChildren?: boolean;
}

const formatCurrency = (value: number) => {
  if (value === 0) return '0,00';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export interface GeneralLedgerTableRef {
  expandAllAndPrint: () => void;
}

interface GeneralLedgerTableProps {
  presetId?: string;
}

const GeneralLedgerTable = forwardRef<GeneralLedgerTableRef, GeneralLedgerTableProps>((props, ref) => {
  const { presetId } = props;
  const { selectedCompany } = useCompany();

  // By default, expanded top-level items (length 1) to show some data, 
  // but users can expand/collapse freely. Let's expand '1' to show the tree.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set(['1', '13', '14']));

  // Fetch real data for the preset and company using the new RPC
  const { data: dbData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['glBalances', presetId, selectedCompany?.id],
    queryFn: async () => {
      if (!presetId || !selectedCompany?.id) return [];
      
      // Hit the RPC we created
      const { data, error } = await supabase.rpc('get_gl_balances', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId
      });
      
      if (error) {
        console.error("Error fetching GL balances:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!presetId && !!selectedCompany?.id
  });

  // Calculate actual table data
  const tableData = useMemo(() => {
    const cleanId = (id: any) => id ? String(id).replace(/\./g, '') : '';
    
    if (dbData && dbData.length > 0) {
      // Step 1: Pre-calculate hasChildren and clean IDs
      const rawData = dbData.map(dbItem => {
         const cid = cleanId(dbItem.gl_number);
         const hasChildren = dbData.some(d => 
            cleanId(d.gl_number).startsWith(cid) && 
            cleanId(d.gl_number) !== cid
         );
         
         return {
           id: String(dbItem.gl_number),
           name: dbItem.short_name,
           balance: Number(dbItem.total_balance) || 0,
           hasChildren,
           cid
         };
      });

      // Now roll up sums for all parent (non-leaf) nodes
      return rawData.map(item => {
        if (!item.hasChildren) return item;

        // Find all leaf descendants ignoring dots
        const leaves = rawData.filter(d => !d.hasChildren && d.cid.startsWith(item.cid));
        const childBalance = leaves.reduce((acc, d) => acc + d.balance, 0);
        
        // Sum includes parent's own balance just in case transactions were booked to parent!
        const totalBalance = childBalance + item.balance;

        return { ...item, balance: totalBalance };
      });
    }
    return [];
  }, [dbData]);

  useImperativeHandle(ref, () => ({
    expandAllAndPrint: () => {
      // Save previous state to restore after print
      const previousState = new Set(expandedRowIds);
      
      // Expand all items that have children
      const allWithChildren = tableData.filter(d => d.hasChildren).map(d => d.id);
      setExpandedRowIds(new Set(allWithChildren));

      // Wait for DOM update then print
      setTimeout(() => {
        window.print();
        
        // Restore state after print dialog closes
        const afterPrintHandler = () => {
          setExpandedRowIds(previousState);
          window.removeEventListener('afterprint', afterPrintHandler);
        };
        window.addEventListener('afterprint', afterPrintHandler);
      }, 300);
    }
  }));

  const handleExpandAll = () => {
    const allWithChildren = tableData.filter(d => d.hasChildren).map(d => d.id);
    setExpandedRowIds(new Set(allWithChildren));
  };

  const handleCollapseAll = () => {
    setExpandedRowIds(new Set([])); // Collapse to only root items
  };

  const toggleRow = (id: string, hasChildren?: boolean) => {
    if (!hasChildren) return;
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Determine if a row should be visible based on expanded state of its ancestors
  const processedRows = useMemo(() => {
    const cleanId = (id: any) => id ? String(id).replace(/\./g, '') : '';
    
    return tableData.map(item => {
      const itemCid = cleanId(item.id);
      // Find all ancestors (any node whose cleaned id is a prefix of this node's cleaned id)
      const ancestors = tableData.filter(d => {
        const dCid = cleanId(d.id);
        return itemCid.startsWith(dCid) && dCid !== itemCid;
      });
      
      // The item is a root if it has no ancestors
      const isRoot = ancestors.length === 0;
      
      // The item is visible ONLY if ALL its ancestors are currently expanded
      const isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));

      // Calculate depth based on the number of ancestors for visual indentation
      const depth = ancestors.length;
      
      return { ...item, isVisibleOnScreen, isRoot, depth };
    });
  }, [expandedRowIds, tableData]);

  // Calculate generic footer totals by summing root level items
  const footerTotals = useMemo(() => {
    const cleanId = (id: any) => id ? String(id).replace(/\./g, '') : '';
    
    return tableData.reduce((acc, current) => {
      // Find if this item has any ancestors
      const isRoot = !tableData.some(d => 
        cleanId(current.id).startsWith(cleanId(d.id)) && 
        cleanId(d.id) !== cleanId(current.id)
      );
      
      // we sum only root elements because they already include all children sums
      if (isRoot) {
        acc += current.balance;
      }
      return acc;
    }, 0);
  }, [tableData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[500px] text-muted-foreground w-full">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 font-medium">Főkönyvi adatok betöltése...</span>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full flex flex-col print:block h-[65vh] max-h-[800px] bg-card overflow-hidden rounded-md border border-border">
          <div className="flex-1 overflow-auto w-full relative print:overflow-visible">
            <div className="w-full flex flex-col min-h-full pb-8">
              
              {/* Header */}
              <div className="bg-muted/80 backdrop-blur-md border-b border-border text-sm font-semibold sticky top-0 z-20 hidden md:block select-none shadow-sm">
                <div className="grid grid-cols-12 divide-x divide-border/50">
                  <div className="col-span-2 p-3 text-center text-xs text-foreground uppercase tracking-wider">Fők. szám</div>
                  <div className="col-span-7 p-3 text-xs text-foreground uppercase tracking-wider">Megnevezés</div>
                  <div className="col-span-3 p-3 text-right text-xs bg-indigo-500/5 text-foreground uppercase tracking-wider">Összesített Egyenleg</div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 divide-y divide-border/30">
                {processedRows.length === 0 ? (
                   <div className="p-8 text-center text-muted-foreground">Nem találhatók adatok ehhez a könyvelési sablonhoz.</div>
                ) : processedRows.map((row) => {
                  const isRoot = row.isRoot;
                  const isExpanded = expandedRowIds.has(row.id);
                  const isNegative = row.balance < 0;
                  const indentPadding = `${0.75 + (row.depth * 1.5)}rem`;

                  return (
                    <div 
                      key={row.id} 
                      className={cn(
                        "grid-cols-12 divide-x divide-border/10 transition-colors hover:bg-muted/40",
                        !row.isVisibleOnScreen ? "hidden print:grid" : "grid",
                        isRoot && "border-t border-border/50 bg-muted/10 font-medium",
                        row.hasChildren ? "cursor-pointer" : ""
                      )}
                      onClick={() => toggleRow(row.id, row.hasChildren)}
                    >
                      <div className="col-span-2 p-3 text-sm flex items-center justify-center font-mono text-muted-foreground border-r border-border/20">
                        {row.id}
                      </div>
                      <div className="col-span-7 py-3 pr-3 text-sm flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                          {row.hasChildren && (
                            <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                               {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </div>
                        <span className={cn("truncate", isRoot ? "uppercase" : "")} title={row.name}>{row.name}</span>
                      </div>
                      
                      <div className={cn("col-span-3 p-3 text-right text-sm tabular-nums font-medium", isNegative ? "text-destructive" : "")}>
                        {row.balance !== 0 ? formatCurrency(row.balance) : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 z-20 grid grid-cols-12 border-t border-border/60 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur font-bold text-sm">
                 <div className="col-span-9 p-3 text-right uppercase tracking-wider text-muted-foreground">Összesen:</div>
                 <div className="col-span-3 p-3 text-right tabular-nums text-foreground flex items-center justify-end gap-2">
                    {formatCurrency(footerTotals)}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => refetch()} 
                      disabled={isFetching}
                      className="h-6 w-6 rounded-full"
                      title="Frissítés"
                    >
                      <RefreshCw className={cn("h-3 w-3", isFetching ? "animate-spin" : "")} />
                    </Button>
                 </div>
              </div>

            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleExpandAll} className="gap-2 cursor-pointer">
          <Maximize2 className="h-4 w-4" />
          <span>Minden lenyitása</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCollapseAll} className="gap-2 cursor-pointer">
          <Minimize2 className="h-4 w-4" />
          <span>Minden összecsukása</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => refetch()} disabled={isFetching} className="gap-2 cursor-pointer">
          <RefreshCw className={cn("h-4 w-4", isFetching ? "animate-spin text-muted-foreground" : "")} />
          <span>{isFetching ? 'Frissítés folyamatban...' : 'Adatok frissítése'}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

export default GeneralLedgerTable;
