import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface LedgerItem {
  id: string; // Fők.szám
  name: string; // Megnevezés
  forgT: number; // Forgalom Tartozik
  forgK: number; // Forgalom Követel
  egyT: number; // Egyenleg Tartozik
  egyK: number; // Egyenleg Követel
  hasChildren?: boolean;
}

// Dummy data from the image with values divided by 10
const MOCK_DATA: LedgerItem[] = [
  { id: '0', name: 'NYILVÁNTARTÁSI SZÁMLÁK', forgT: 0, forgK: 9518.40, egyT: 0, egyK: 9518.40, hasChildren: true },
  { id: '04', name: 'KÖTELEZETTSÉGEK NYILV.SZ.-JA', forgT: 0, forgK: 9518.40, egyT: 0, egyK: 9518.40 },
  { id: '1', name: 'BEFEKTETETT ESZKÖZÖK', forgT: 5113925.50, forgK: 7336263.80, egyT: 0, egyK: 2222338.30, hasChildren: true },
  { id: '11', name: 'IMMATERIÁLIS JAVAK', forgT: 500000.00, forgK: 500000.00, egyT: 0, egyK: 0, hasChildren: true },
  { id: '114', name: 'Szellemi termékek', forgT: 500000.00, forgK: 0, egyT: 500000.00, egyK: 0 },
  { id: '116', name: 'Immat. javak átv. számla', forgT: 0, forgK: 500000.00, egyT: 0, egyK: 500000.00 },
  { id: '13', name: 'MŰS.BEREND.GÉPEK, JÁRMŰVEK', forgT: -15826.00, forgK: 141231.90, egyT: 0, egyK: 157057.90, hasChildren: true },
  { id: '131', name: 'Term.gépek,ber,szersz,gy.eszk', forgT: 5000.00, forgK: -155000.00, egyT: 160000.00, egyK: 0 },
  { id: '139', name: 'Műsz.ber,g,járm.tervszar. écs', forgT: -20826.00, forgK: 296231.90, egyT: 0, egyK: 317057.90, hasChildren: true },
  { id: '1391', name: 'Termelőg.tervszer. écs', forgT: -20826.00, forgK: 302.30, egyT: 0, egyK: 21128.30 },
  { id: '1392', name: 'Term.járm.tervszer. écs', forgT: 0, forgK: 295929.60, egyT: 0, egyK: 295929.60 },
  { id: '14', name: 'EGYÉB BER, FELSZ, JÁRMŰVEK', forgT: 4614751.50, forgK: 1334509.00, egyT: 3280242.50, egyK: 0, hasChildren: true },
  { id: '141', name: 'Üzemi (üzleti) g,ber,felszer', forgT: 540251.50, forgK: 0, egyT: 540251.50, egyK: 0 },
  { id: '142', name: 'Egyéb járművek', forgT: 5000.00, forgK: 0, egyT: 5000.00, egyK: 0 },
  { id: '143', name: 'Irodai,igazg.berend és felszerelés (14)', forgT: 4069500.00, forgK: 0, egyT: 4069500.00, egyK: 0, hasChildren: true },
  { id: '1431', name: 'szám.tech.eszk./iroda', forgT: 3999500.00, forgK: 0, egyT: 3999500.00, egyK: 0 },
  { id: '149', name: 'Egy.ber,felsz,járm tervsz écs', forgT: 0, forgK: 1334509.00, egyT: 0, egyK: 1334509.00, hasChildren: true },
  { id: '1491', name: 'Üzemi gépek, berendezések écs', forgT: 0, forgK: 6423.40, egyT: 0, egyK: 6423.40 },
  { id: '1493', name: 'Irodai ig. berendezések écs', forgT: 0, forgK: 1328085.60, egyT: 0, egyK: 1328085.60 },
  { id: '15', name: 'TENYÉSZÁLLATOK', forgT: 15000.00, forgK: 22.90, egyT: 14977.10, egyK: 0, hasChildren: true },
  { id: '151', name: 'Tenyészállatok', forgT: 15000.00, forgK: 0, egyT: 15000.00, egyK: 0 },
  { id: '159', name: 'Tenyészáll tervszerinti écs', forgT: 0, forgK: 22.90, egyT: 0, egyK: 22.90 },
  { id: '16', name: 'BERUHÁZÁSOK, FELÚJÍTÁSOK', forgT: 0, forgK: 5360500.00, egyT: 0, egyK: 5360500.00, hasChildren: true },
  { id: '161', name: 'Befejezetlen beruházások', forgT: 0, forgK: 5355500.00, egyT: 0, egyK: 5355500.00 },
  { id: '163', name: 'Forgó eszközből befektett eszköz', forgT: 0, forgK: 5000.00, egyT: 0, egyK: 5000.00 },
  { id: '2', name: 'KÉSZLETEK', forgT: 110501.40, forgK: 0, egyT: 110501.40, egyK: 0, hasChildren: true },
  { id: '25', name: 'KÉSZTERMÉKEK', forgT: 1998.30, forgK: 0, egyT: 1998.30, egyK: 0, hasChildren: true },
  { id: '251', name: 'Késztermék 1. cs.', forgT: 1998.30, forgK: 0, egyT: 1998.30, egyK: 0 },
  { id: '26', name: 'KERESKEDELMI ÁRUK', forgT: 108503.10, forgK: 0, egyT: 108503.10, egyK: 0, hasChildren: true },
  { id: '268', name: 'Belső átadátvét ütközőszámla', forgT: 108503.10, forgK: 0, egyT: 108503.10, egyK: 0 },
  { id: '3', name: 'KÖV,PÜ.ESZK,AKT IDŐB.ELH.', forgT: 2078554.90, forgK: 256460.20, egyT: 2277245.80, egyK: 0, hasChildren: true },
  { id: '31', name: 'VEVŐK', forgT: 1999512.10, forgK: 259037.40, egyT: 2279032.40, egyK: 0 },
];

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

const GeneralLedgerTable = forwardRef<GeneralLedgerTableRef>((props, ref) => {
  // By default, expanded top-level items (length 1) to show some data, 
  // but users can expand/collapse freely. Let's expand '1' to show the tree.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set(['1', '13', '14']));

  useImperativeHandle(ref, () => ({
    expandAllAndPrint: () => {
      // Save previous state to restore after print
      const previousState = new Set(expandedRowIds);
      
      // Expand all items that have children
      const allWithChildren = MOCK_DATA.filter(d => d.hasChildren).map(d => d.id);
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
    const allWithChildren = MOCK_DATA.filter(d => d.hasChildren).map(d => d.id);
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
    return MOCK_DATA.map(item => {
      // If it's a root item (1 char), it's always visible
      if (item.id.length <= 1) {
        return { ...item, isVisibleOnScreen: true };
      }
      
      let parentExpanded = true;
      let currentPrefix = "";
      
      for (let i = 1; i < item.id.length; i++) {
        currentPrefix = item.id.substring(0, i);
        const isParentInMap = MOCK_DATA.some(d => d.id === currentPrefix);
        if (isParentInMap && !expandedRowIds.has(currentPrefix)) {
          parentExpanded = false;
          break;
        }
      }
      return { ...item, isVisibleOnScreen: parentExpanded };
    });
  }, [expandedRowIds]);

  // Calculate totals from root items (id length === 1 or 04 which is special but let's just sum length === 1 for now, optionally add 04 iff 0 doesn't include it. Wait, 0 includes 04? The mock data has same value. Let's just sum length === 1)
  const totals = useMemo(() => {
    return MOCK_DATA.filter(item => item.id.length <= 1).reduce(
      (acc, item) => ({
        forgT: acc.forgT + item.forgT,
        forgK: acc.forgK + item.forgK,
        egyT: acc.egyT + item.egyT,
        egyK: acc.egyK + item.egyK,
      }),
      { forgT: 0, forgK: 0, egyT: 0, egyK: 0 }
    );
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full overflow-x-auto print:overflow-visible">
          <div className="min-w-[900px] print:min-w-0 w-full">
            {/* Modern Header - CSS Grid */}
        <div className="bg-muted/30 border-b border-border text-sm font-semibold sticky top-0 z-10 hidden md:block select-none">
          {/* Top Header Row for Spanning columns */}
          <div className="grid grid-cols-12 border-b border-border divide-x divide-border/50 text-muted-foreground">
            <div className="col-span-4 p-3 text-center tracking-wide">Számlainformáció</div>
            <div className="col-span-4 p-2 text-center bg-blue-500/5 tracking-wide">Forgalom</div>
            <div className="col-span-4 p-2 text-center bg-indigo-500/5 tracking-wide">Egyenleg</div>
          </div>
          
          {/* Secondary Header Row */}
          <div className="grid grid-cols-12 divide-x divide-border/50">
            <div className="col-span-1 p-3 text-center text-xs">Fők.szám</div>
            <div className="col-span-3 p-3 text-xs">Megnevezés</div>
            
            <div className="col-span-2 p-3 text-right text-xs bg-blue-500/5">Tartozik</div>
            <div className="col-span-2 p-3 text-right text-xs bg-blue-500/5">Követel</div>
            
            <div className="col-span-2 p-3 text-right text-xs bg-indigo-500/5">Tartozik</div>
            <div className="col-span-2 p-3 text-right text-xs bg-indigo-500/5">Követel</div>
          </div>
        </div>

        {/* List Body */}
        <div className="divide-y divide-border/30 bg-card">
          {processedRows.map((row) => {
            const isRoot = row.id.length <= 1;
            const isLevel2 = row.id.length === 2;
            const isLevel3 = row.id.length === 3;
            // Provide indentation levels based on id length
            const indentClass = isRoot ? '' : isLevel2 ? 'pl-6' : isLevel3 ? 'pl-12' : 'pl-16';
            const isExpanded = expandedRowIds.has(row.id);
            const isNegative = (val: number) => val < 0;

            return (
              <div 
                key={row.id} 
                className={cn(
                  "grid-cols-12 divide-x divide-border/10 transition-colors hover:bg-muted/40",
                  !row.isVisibleOnScreen ? "hidden print:grid" : "grid",
                  isRoot && "border-t border-border/50 bg-muted/10 font-medium", // Group separators
                  row.hasChildren ? "cursor-pointer" : ""
                )}
                onClick={() => toggleRow(row.id, row.hasChildren)}
              >
                {/* ID Column */}
                <div className="col-span-1 p-3 text-sm flex items-center justify-center font-mono text-muted-foreground">
                  {row.id}
                </div>
                
                {/* Name & Accordion Column */}
                <div className={cn("col-span-3 p-3 text-sm flex items-center gap-2", indentClass)}>
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {row.hasChildren && (
                      <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                         {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </div>
                  <span className={cn("truncate", isRoot ? "uppercase" : "")} title={row.name}>
                    {row.name}
                  </span>
                </div>
                
                {/* Valori */}
                <div className={cn("col-span-2 p-3 text-right text-sm tabular-nums", isNegative(row.forgT) ? "text-destructive" : "")}>
                  {formatCurrency(row.forgT)}
                </div>
                <div className={cn("col-span-2 p-3 text-right text-sm tabular-nums", isNegative(row.forgK) ? "text-destructive" : "")}>
                  {formatCurrency(row.forgK)}
                </div>
                <div className={cn("col-span-2 p-3 text-right text-sm tabular-nums font-medium", isNegative(row.egyT) ? "text-destructive" : "")}>
                  {row.egyT !== 0 ? formatCurrency(row.egyT) : ""}
                </div>
                <div className={cn("col-span-2 p-3 text-right text-sm tabular-nums font-medium", isNegative(row.egyK) ? "text-destructive" : "")}>
                  {row.egyK !== 0 ? formatCurrency(row.egyK) : ""}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Footer Sum */}
        <div className="grid grid-cols-12 border-t-2 border-border/60 bg-muted/30 p-1 font-semibold text-sm">
           <div className="col-span-4 p-2 text-right uppercase">Összesen:</div>
           <div className="col-span-2 p-2 text-right tabular-nums text-foreground/80">{formatCurrency(totals.forgT)}</div>
           <div className="col-span-2 p-2 text-right tabular-nums text-foreground/80">{formatCurrency(totals.forgK)}</div>
           <div className="col-span-2 p-2 text-right tabular-nums text-foreground/80">{formatCurrency(totals.egyT)}</div>
           <div className="col-span-2 p-2 text-right tabular-nums text-foreground/80">{formatCurrency(totals.egyK)}</div>
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
      </ContextMenuContent>
    </ContextMenu>
  );
});

export default GeneralLedgerTable;
