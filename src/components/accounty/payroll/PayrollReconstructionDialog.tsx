import React, { useState, useCallback, useRef } from 'react';
import {
  FileCode, Upload, CheckCircle2, AlertTriangle, Loader2,
  Calendar, Users, ArrowRight, Trash2, Sparkles, Building2,
  Check, RefreshCw, Layers
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseFiling08Xml, readTextFileWithEncoding, type Parsed08Document } from '@/lib/payroll/nav08XmlParser';
import { useBulkImportPayroll } from '@/hooks/useBulkImportPayroll';
import { usePayrollCycles } from '@/hooks/usePayrollData';

interface PayrollReconstructionDialogProps {
  companyId: string;
  companyName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialFiles?: File[] | FileList;
}

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

export function PayrollReconstructionDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
  onSuccess,
  initialFiles,
}: PayrollReconstructionDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Parsed08Document[]>([]);
  const [dragging, setDragging] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  const { data: existingCycles = [] } = usePayrollCycles(companyId);
  const { reconstructCycles, isProcessing, progress } = useBulkImportPayroll();

  // Sort documents chronologically
  const sortedDocs = [...documents].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const totalEmployeesCombined = sortedDocs.reduce((acc, d) => acc + d.employeeCount, 0);
  const totalGrossCombined = sortedDocs.reduce((acc, d) => acc + d.totalGrossSalary, 0);
  const totalNetCombined = sortedDocs.reduce((acc, d) => acc + d.totalNetSalary, 0);
  const totalTaxesCombined = sortedDocs.reduce(
    (acc, d) => acc + d.totalSzja + d.totalTb + d.totalSzocho,
    0
  );

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;

    const newDocs: Parsed08Document[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.xml')) continue;
      try {
        const text = await readTextFileWithEncoding(file);
        if (text) {
          const parsed = parseFiling08Xml(text);
          if (parsed.employees.length > 0) {
            newDocs.push(parsed);
          }
        }
      } catch {
        // Hiba esetén kihagyjuk
      }
    }

    setDocuments((prev) => {
      // Kerüljük az azonos év/hónap duplikációt
      const combined = [...prev];
      newDocs.forEach((nd) => {
        const existingIdx = combined.findIndex(
          (c) => c.year === nd.year && c.month === nd.month
        );
        if (existingIdx >= 0) {
          combined[existingIdx] = nd;
        } else {
          combined.push(nd);
        }
      });
      return combined;
    });
  }, []);

  React.useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
  }, [open, initialFiles, handleFiles]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeDoc = (idx: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExecute = async () => {
    if (documents.length === 0) return;

    try {
      await reconstructCycles({
        companyId,
        documents: sortedDocs,
        overwriteExisting,
      });
      onOpenChange(false);
      setDocuments([]);
      onSuccess?.();
    } catch {
      // Hiba a hookban már toast-olva van
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Bérszámfejtés Gyors Rekonstrukció (NAV 08 XML)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Korábban beadott NAV 08 (2608 / 2508 / 2408) ÁNYK XML fájlok tömeges beolvasása és havi bérszámfejtési ciklusok felépítése
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="space-y-5 py-3">
          {/* Drag and Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-900/30',
              dragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-blue-500" />
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              Húzd ide a havi 08-as ÁNYK XML fájlokat (egyszerre akár több hónapot is)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Támogatott: 2608, 2508, 2408 ÁNYK és szoftver-export XML fájlok
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.XML"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (e.target) e.target.value = '';
              }}
            />
          </div>

          {/* Detected Months / Documents */}
          {sortedDocs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Beolvasott Havi Bevallások ({sortedDocs.length} hónap)
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocuments([])}
                  className="h-7 text-xs text-slate-500 hover:text-red-600"
                >
                  Összes törlése
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {sortedDocs.map((doc, idx) => {
                  const hasConflict = existingCycles.some(
                    (c) => c.year === doc.year && c.month === doc.month
                  );

                  return (
                    <div
                      key={idx}
                      className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {doc.year}. {MONTH_NAMES[doc.month - 1] || `${doc.month}. hónap`}
                            </span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                              NAV {doc.filingType}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {doc.employeeCount} biztosított dolgozó
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDoc(idx)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400">Bruttó Bér:</span>
                          <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {doc.totalGrossSalary.toLocaleString('hu-HU')} Ft
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Kifizetendő Nettó:</span>
                          <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {doc.totalNetSalary.toLocaleString('hu-HU')} Ft
                          </p>
                        </div>
                      </div>

                      {hasConflict && (
                        <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          Meglévő ciklus frissítésre kerül
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Aggregated Totals Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-md mt-4">
                <div className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                  Összesített Rekonstrukciós Hatás ({sortedDocs.length} hónap)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Összesített Bruttó:</span>
                    <p className="text-sm font-bold font-mono text-white">
                      {totalGrossCombined.toLocaleString('hu-HU')} Ft
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Összes Levont Közteher:</span>
                    <p className="text-sm font-bold font-mono text-blue-300">
                      {totalTaxesCombined.toLocaleString('hu-HU')} Ft
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Kifizetett Nettó:</span>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {totalNetCombined.toLocaleString('hu-HU')} Ft
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Biztosítottak:</span>
                    <p className="text-sm font-bold text-white">
                      {totalEmployeesCombined} havi tétel
                    </p>
                  </div>
                </div>
              </div>

              {/* Overwrite checkbox */}
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  id="overwriteCycles"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="overwriteCycles" className="cursor-pointer">
                  Meglévő bérszámfejtési ciklusok felülírása és újraszámolása a 08-as XML adatai alapján
                </label>
              </div>
            </div>
          )}

          {/* Progress loader while processing */}
          {isProcessing && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                {progress.message || 'Bérszámfejtési ciklusok felépítése...'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Mégse
          </Button>
          <Button
            onClick={handleExecute}
            disabled={sortedDocs.length === 0 || isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Check className="w-4 h-4" />
            {sortedDocs.length > 0
              ? `${sortedDocs.length} Havi Ciklus Rekonstrukciója`
              : 'Rekonstrukció Indítása'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
