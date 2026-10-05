import { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useAssetGlAccounts } from '@/hooks/useFixedAssets';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { reportError } from '@/lib/errorReporter';
import {
  parseAssetImportData,
  generateSampleAssetImportExcel,
  AssetImportParseResult,
  ParsedAssetImportItem,
} from '@/lib/fixed-assets/assetImportParser';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Layers,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface AssetImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

const PREVIEW_PAGE_SIZE = 10;
const BATCH_CHUNK_SIZE = 100;

export function AssetImportModal({
  open,
  onOpenChange,
  onSuccess,
}: AssetImportModalProps) {
  const { t } = useTranslation(['hr', 'common']);
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { data: glAccounts = [] } = useAssetGlAccounts(selectedCompany?.id, activePresetId);

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawBuffer, setRawBuffer] = useState<ArrayBuffer | null>(null);
  const [parseResult, setParseResult] = useState<AssetImportParseResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Configuration options
  const [includeDisposed, setIncludeDisposed] = useState(true);
  const [autoGenInventoryNums, setAutoGenInventoryNums] = useState(true);
  const [autoResolveCollisions, setAutoResolveCollisions] = useState(true);
  const [defaultGlAccountId, setDefaultGlAccountId] = useState<string>('');

  // Collision detection state
  const [existingInvNumbers, setExistingInvNumbers] = useState<Set<string>>(new Set());

  // Partial import tracking state (to safely resume on network error without duplicate inserts)
  const importedItemIdsRef = useRef<Set<string>>(new Set());
  const accumulatedStatsRef = useRef({ inserted: 0, disposed: 0, totalValue: 0 });
  const [importedItemCount, setImportedItemCount] = useState(0);

  // Preview filtering & pagination
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewPage, setPreviewPage] = useState(1);

  // Progress state
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [importSummary, setImportSummary] = useState<{
    total: number;
    inserted: number;
    disposed: number;
    totalValue: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset dialog state
  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawBuffer(null);
    setParseResult(null);
    setParsing(false);
    setProgressPercent(0);
    setProgressStatus('');
    setImportSummary(null);
    setPreviewSearch('');
    setPreviewPage(1);
    setExistingInvNumbers(new Set());
    importedItemIdsRef.current.clear();
    accumulatedStatsRef.current = { inserted: 0, disposed: 0, totalValue: 0 };
    setImportedItemCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && step === 'importing') {
      // Don't close mid-import
      return;
    }
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  }, [step, handleReset, onOpenChange]);

  // Process file buffer
  const processBuffer = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      setParsing(true);
      const result = parseAssetImportData(buffer, {
        includeDisposed,
        autoGenerateMissingInventoryNumbers: autoGenInventoryNums,
        inventoryNumberPrefix: 'TE',
        knownGlAccounts: glAccounts,
      });

      // Pre-check DB collision with existing inventory numbers for this company
      let collisionCount = 0;
      if (selectedCompany?.id) {
        const { data: existingRows } = await supabase
          .from('fixed_assets')
          .select('inventory_number')
          .eq('company_id', selectedCompany.id);

        const invSet = new Set((existingRows || []).map(r => String(r.inventory_number || '').trim()));
        setExistingInvNumbers(invSet);

        result.items.forEach(item => {
          if (invSet.has(item.inventoryNumber)) {
            item.hasDbCollision = true;
            collisionCount++;
            item.warnings.push(`Leltári szám (${item.inventoryNumber}) már létezik az adatbázisban`);
          }
        });
      }

      setRawBuffer(buffer);
      setParseResult(result);
      setPreviewPage(1);
      importedItemIdsRef.current.clear();
      accumulatedStatsRef.current = { inserted: 0, disposed: 0, totalValue: 0 };
      setImportedItemCount(0);
      setStep('preview');

      toast({
        title: 'Fájl sikeresen beolvasva',
        description: `${result.formatName} — ${result.totalRows.toLocaleString('hu-HU')} eszköz azonosítva${
          collisionCount > 0 ? ` (${collisionCount} ütköző leltári szám)` : ''
        }.`,
      });
    } catch (err: any) {
      reportError({
        type: 'custom',
        component: 'AssetImportModal',
        action: 'processBuffer',
        message: err?.message || 'Hiba a fájl feldolgozása közben',
        error: err,
      });
      toast({
        title: 'Feldolgozási hiba',
        description: err?.message || 'Nem sikerült beolvasni a táblázatot. Kérjük ellenőrizd a formátumot.',
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  }, [includeDisposed, autoGenInventoryNums, glAccounts, selectedCompany?.id, toast]);

  // Handle file select
  const handleFileChange = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        processBuffer(buffer, selectedFile.name);
      }
    };
    reader.onerror = () => {
      toast({
        title: 'Fájl olvasási hiba',
        description: 'Nem sikerült beolvasni a kiválasztott fájlt.',
        variant: 'destructive',
      });
    };
    reader.readAsArrayBuffer(selectedFile);
  }, [processBuffer, toast]);

  // Re-run parsing when toggles change in preview mode
  const handleToggleIncludeDisposed = useCallback((checked: boolean) => {
    setIncludeDisposed(checked);
    if (rawBuffer) {
      const result = parseAssetImportData(rawBuffer, {
        includeDisposed: checked,
        autoGenerateMissingInventoryNumbers: autoGenInventoryNums,
        inventoryNumberPrefix: 'TE',
        knownGlAccounts: glAccounts,
      });
      result.items.forEach(item => {
        if (existingInvNumbers.has(item.inventoryNumber)) {
          item.hasDbCollision = true;
          item.warnings.push(`Leltári szám (${item.inventoryNumber}) már létezik az adatbázisban`);
        }
      });
      setParseResult(result);
    }
  }, [rawBuffer, autoGenInventoryNums, glAccounts, existingInvNumbers]);

  const handleToggleAutoGen = useCallback((checked: boolean) => {
    setAutoGenInventoryNums(checked);
    if (rawBuffer) {
      const result = parseAssetImportData(rawBuffer, {
        includeDisposed,
        autoGenerateMissingInventoryNumbers: checked,
        inventoryNumberPrefix: 'TE',
        knownGlAccounts: glAccounts,
      });
      result.items.forEach(item => {
        if (existingInvNumbers.has(item.inventoryNumber)) {
          item.hasDbCollision = true;
          item.warnings.push(`Leltári szám (${item.inventoryNumber}) már létezik az adatbázisban`);
        }
      });
      setParseResult(result);
    }
  }, [rawBuffer, includeDisposed, glAccounts, existingInvNumbers]);

  // Download sample template
  const handleDownloadSample = useCallback(() => {
    try {
      const bytes = generateSampleAssetImportExcel();
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'targyi_eszkozok_import_minta.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Minta sablon letöltve',
        description: 'A minta Excel fájl letöltése megkezdődött.',
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a letöltés során',
        description: err?.message || 'Nem sikerült generálni a mintát.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Filtered preview items
  const filteredPreviewItems = useMemo(() => {
    if (!parseResult) return [];
    let items = parseResult.items;
    if (!includeDisposed) {
      items = items.filter(i => i.status !== 'disposed');
    }
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase().trim();
      items = items.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.inventoryNumber.toLowerCase().includes(q) ||
          (i.glAccountNumber && i.glAccountNumber.includes(q)) ||
          (i.notes && i.notes.toLowerCase().includes(q))
      );
    }
    return items;
  }, [parseResult, includeDisposed, previewSearch]);

  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewItems.length / PREVIEW_PAGE_SIZE));
  const currentPageItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewItems.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewItems, previewPage]);

  // Execute batch import
  const handleExecuteImport = async () => {
    if (!selectedCompany || !user || !parseResult) return;

    const allValidItems = parseResult.items.filter(
      item => item.isValid && (includeDisposed || item.status !== 'disposed')
    );

    // Filter out already imported items in case of safe resume
    const itemsToImport = allValidItems.filter(
      item => !importedItemIdsRef.current.has(item.id)
    );

    if (itemsToImport.length === 0) {
      if (allValidItems.length > 0 && importedItemIdsRef.current.size === allValidItems.length) {
        setStep('complete');
        return;
      }
      toast({
        title: 'Nincs importálható tétel',
        description: 'A megadott beállítások mellett egyetlen érvényes eszköz sem található a fájlban.',
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');
    const totalItems = allValidItems.length;
    const initialProgress = Math.round((importedItemIdsRef.current.size / totalItems) * 100);
    setProgressPercent(initialProgress);
    setProgressStatus(`Importálás előkészítése (${itemsToImport.length} eszköz)...`);

    const companyId = selectedCompany.id;
    const userId = user.id;
    const profileName = user.user_metadata?.full_name || user.email || 'Adminisztrátor';

    // Track assigned inventory numbers across all chunks to guarantee zero duplicates
    const usedInvNumbers = new Set<string>(existingInvNumbers);

    try {
      // Chunk processing
      const pendingCountToImport = itemsToImport.length;
      for (let i = 0; i < pendingCountToImport; i += BATCH_CHUNK_SIZE) {
        const chunk = itemsToImport.slice(i, i + BATCH_CHUNK_SIZE);

        setProgressStatus(
          `Eszközök rögzítése (${importedItemIdsRef.current.size + 1} - ${Math.min(
            importedItemIdsRef.current.size + chunk.length,
            totalItems
          )} / ${totalItems})...`
        );

        // Prepare fixed_assets rows with collision auto-resolution and falsy-zero fix
        const assetRows = chunk.map(item => {
          const isDisposed = item.status === 'disposed';
          const resolvedGl = item.glAccountId || (defaultGlAccountId && defaultGlAccountId !== 'none' ? defaultGlAccountId : null);

          let finalInvNumber = item.inventoryNumber;
          if (autoResolveCollisions && usedInvNumbers.has(finalInvNumber)) {
            let suffixIdx = 1;
            let candidate = `${finalInvNumber}-IMP`;
            while (usedInvNumbers.has(candidate)) {
              suffixIdx++;
              candidate = `${finalInvNumber}-IMP${suffixIdx}`;
            }
            finalInvNumber = candidate;
          }
          usedInvNumbers.add(finalInvNumber);

          return {
            company_id: companyId,
            user_id: userId,
            inventory_number: finalInvNumber,
            name: item.name,
            description: item.notes || (item.costCenter ? `Költséghely: ${item.costCenter}` : null),
            acquisition_value: item.acquisitionValue,
            residual_value: item.residualValue || 0,
            currency: 'HUF',
            purchase_date: item.purchaseDate || item.activationDate,
            activation_date: item.activationDate,
            disposal_date: isDisposed ? item.disposalDate : null,
            useful_life_months: item.usefulLifeMonths !== undefined && item.usefulLifeMonths !== null ? item.usefulLifeMonths : 36,
            depreciation_method: item.depreciationMethod || 'linear',
            status: item.status,
            gl_account_id: resolvedGl,
            activated_by_user_id: userId,
            activated_by_name: profileName,
            documents: [],
          };
        });

        // Batch insert into fixed_assets
        const { data: insertedChunk, error: insertErr } = await supabase
          .from('fixed_assets')
          .insert(assetRows)
          .select('id, name, activation_date, status, disposal_date, acquisition_value, inventory_number');

        if (insertErr) throw insertErr;

        // Batch insert corresponding historical asset_events
        if (insertedChunk && insertedChunk.length > 0) {
          const eventRows = insertedChunk.map(asset => {
            const isDisposed = asset.status === 'disposed';
            return {
              asset_id: asset.id,
              company_id: companyId,
              user_id: userId,
              event_type: isDisposed ? 'disposal' : 'activation',
              event_date: isDisposed
                ? (asset.disposal_date || asset.activation_date)
                : asset.activation_date,
              description: isDisposed
                ? `Előzmény / nyitó kivezetett eszköz importálva: ${asset.name}`
                : `Előzmény / nyitó eszköz importálva: ${asset.name}`,
              new_values: {
                acquisition_value: asset.acquisition_value,
                activation_date: asset.activation_date,
                is_opening_historical: true,
                imported_from_excel: true,
                status: asset.status,
              },
            };
          });

          const { error: eventErr } = await supabase
            .from('asset_events')
            .insert(eventRows);

          if (eventErr) {
            console.warn('Batch event insert note:', eventErr);
          }

          // Record successful items in ref and state for resume protection
          chunk.forEach(item => importedItemIdsRef.current.add(item.id));
          accumulatedStatsRef.current.inserted += insertedChunk.length;
          accumulatedStatsRef.current.disposed += insertedChunk.filter(a => a.status === 'disposed').length;
          accumulatedStatsRef.current.totalValue += insertedChunk.reduce((s, a) => s + (a.acquisition_value || 0), 0);
          setImportedItemCount(importedItemIdsRef.current.size);

          // Update existingInvNumbers with inserted ones
          setExistingInvNumbers(prev => {
            const updated = new Set(prev);
            insertedChunk.forEach(r => {
              if (r.inventory_number) updated.add(r.inventory_number);
            });
            return updated;
          });
        }

        const pct = Math.round((importedItemIdsRef.current.size / totalItems) * 100);
        setProgressPercent(pct);
      }

      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', companyId] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail'] });

      const finalInserted = accumulatedStatsRef.current.inserted;
      setImportSummary({
        total: totalItems,
        inserted: finalInserted,
        disposed: accumulatedStatsRef.current.disposed,
        totalValue: accumulatedStatsRef.current.totalValue,
      });

      setStep('complete');
      toast({
        title: 'Importálás sikeres!',
        description: `${finalInserted.toLocaleString('hu-HU')} tárgyi eszköz sikeresen rögzítve a nyilvántartásban.`,
      });
      onSuccess?.();
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'AssetImportModal',
        action: 'handleExecuteImport',
        message: err?.message || 'Hiba történt a tömeges rögzítés közben',
        error: err,
      });

      // Invalidate query caches so already committed chunks are reflected in UI
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', companyId] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail'] });

      const alreadyInserted = accumulatedStatsRef.current.inserted;
      const remainingCount = totalItems - importedItemIdsRef.current.size;

      if (alreadyInserted > 0) {
        toast({
          title: 'Részleges hiba az importálás során',
          description: `${alreadyInserted} eszköz sikeresen rögzítve lett. ${remainingCount} eszköz rögzítése megszakadt: ${err?.message || 'Hiba'}. Az "Importálás folytatása" gombbal folytathatod a kimaradt tételeket.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Hiba a rögzítés során',
          description: err?.message || 'Nem sikerült az összes tételt rögzíteni az adatbázisban.',
          variant: 'destructive',
        });
      }
      setStep('preview');
    }
  };

  // Pending items count remaining to be imported (for safe resume)
  const pendingCount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.items.filter(
      item => item.isValid && (includeDisposed || item.status !== 'disposed') && !importedItemIdsRef.current.has(item.id)
    ).length;
  }, [parseResult, includeDisposed, importedItemCount]);

  const isResuming = importedItemCount > 0 && pendingCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/60 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Tárgyi eszközök és nyitó állomány importálása
                  {parseResult && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {parseResult.formatName}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Tömeges Excel / CSV kartonlista és összesítő tábla betöltése (RLB60, Teny vagy egyedi sablon)
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSample}
              className="gap-2 text-xs h-8"
              disabled={step === 'importing'}
            >
              <Download className="h-3.5 w-3.5" />
              Minta sablon letöltése
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[350px]">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleFileChange(droppedFile);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full max-w-xl border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border/60 hover:border-primary/50 hover:bg-muted/20'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-base mb-1">
                  Húzd ide az Excel vagy CSV fájlt, vagy kattints a tallózáshoz
                </h3>
                <p className="text-xs text-muted-foreground text-center max-w-md mb-4">
                  Támogatott formátumok: RLB60 MyTargyi kartonlista, RLB60 TE Összesítő tábla (.xlsx, .xls) vagy szabványos CSV.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFileChange(selected);
                  }}
                />

                <Button variant="secondary" size="sm" className="gap-2 pointer-events-none">
                  <FileSpreadsheet className="h-4 w-4" />
                  Tallózás a számítógépről
                </Button>
              </div>

              {/* Format features helper card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-xl text-left">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2 font-medium text-xs mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Automatikus felismerés
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A fejléc alapján a rendszer automatikusan észleli az RLB60 és egyéb exportokat.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2 font-medium text-xs mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Nyitó állomány védelem
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A betöltött előzmény eszközök nem duplikálják a főkönyvi nyitó naplótételeket.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-2 font-medium text-xs mb-1">
                    <Layers className="h-3.5 w-3.5 text-amber-500" />
                    Nagy állományok
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Több ezer eszközös kartonlisták (2000+ tétel) villámgyors kötegelt mentése.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CONFIGURATION */}
          {step === 'preview' && parseResult && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <span className="text-[11px] text-muted-foreground font-medium block">Összes sor</span>
                  <span className="text-lg font-bold tabular-nums">
                    {parseResult.totalRows.toLocaleString('hu-HU')}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-emerald-500/10 border-emerald-500/20">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                    Érvényes eszközök
                  </span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {parseResult.validRowsCount.toLocaleString('hu-HU')}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-amber-500/10 border-amber-500/20">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium block">
                    Kivezetett / Selejtezett
                  </span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {parseResult.disposedRowsCount.toLocaleString('hu-HU')}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-blue-500/10 border-blue-500/20">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium block">
                    Auto-generált leltári sz.
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {parseResult.generatedInventoryNumbersCount.toLocaleString('hu-HU')}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-muted-foreground font-medium block">Össz. bekerülési érték</span>
                  <span className="text-lg font-bold tabular-nums truncate block">
                    {parseResult.totalAcquisitionValue.toLocaleString('hu-HU')} Ft
                  </span>
                </div>
              </div>

              {/* Import Options Controls */}
              <div className="p-4 rounded-lg border border-border/60 bg-card/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="opt-disposed"
                      checked={includeDisposed}
                      onCheckedChange={(c) => handleToggleIncludeDisposed(!!c)}
                    />
                    <Label htmlFor="opt-disposed" className="text-xs font-medium cursor-pointer">
                      Kivezetett / selejtezett eszközök importálása (történeti megőrzéssel)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="opt-autogen"
                      checked={autoGenInventoryNums}
                      onCheckedChange={(c) => handleToggleAutoGen(!!c)}
                    />
                    <Label htmlFor="opt-autogen" className="text-xs font-medium cursor-pointer">
                      Hiányzó leltári számok automatikus generálása (TE-ÉV-XXXX)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="opt-autoresolve"
                      checked={autoResolveCollisions}
                      onCheckedChange={(c) => setAutoResolveCollisions(!!c)}
                    />
                    <Label htmlFor="opt-autoresolve" className="text-xs font-medium cursor-pointer">
                      Létező leltári számok automatikus feloldása (-IMP utótaggal)
                    </Label>
                  </div>
                </div>

                {/* Default GL Account Fallback */}
                {glAccounts.length > 0 && (
                  <div className="pt-2 border-t border-border/40 flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      Alapértelmezett főkönyvi számla a fel nem ismert tételekhez (1xx):
                    </Label>
                    <Select
                      value={defaultGlAccountId}
                      onValueChange={setDefaultGlAccountId}
                    >
                      <SelectTrigger className="h-8 text-xs max-w-xs">
                        <SelectValue placeholder="Válassz számlaszámot (opcionális)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs alapértelmezett</SelectItem>
                        {glAccounts.map((gl) => (
                          <SelectItem key={gl.id} value={gl.id}>
                            {gl.gl_number} - {gl.short_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Safe Resume Alert Banner */}
              {isResuming && (
                <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>Részleges importálás aktív:</strong> {accumulatedStatsRef.current.inserted} eszköz már sikeresen rögzítve az adatbázisban. {pendingCount} eszköz maradt hátra az importálás folytatásához.
                    </span>
                  </div>
                </div>
              )}

              {/* Preview Table Header & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Előnézet ({filteredPreviewItems.length} eszköz megjelenítve)
                    </h4>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Keresés a listában..."
                      value={previewSearch}
                      onChange={(e) => {
                        setPreviewSearch(e.target.value);
                        setPreviewPage(1);
                      }}
                      className="h-8 pl-8 text-xs bg-secondary/30"
                    />
                  </div>
                </div>

                {/* Data Table */}
                <div className="rounded-md border border-border/50 overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="h-8">
                        <TableHead className="text-[11px] py-1.5 w-24">Leltári szám</TableHead>
                        <TableHead className="text-[11px] py-1.5">Eszköz megnevezése</TableHead>
                        <TableHead className="text-[11px] py-1.5 text-right w-28">Bekerülési érték</TableHead>
                        <TableHead className="text-[11px] py-1.5 w-24">Aktiválás</TableHead>
                        <TableHead className="text-[11px] py-1.5 text-center w-20">Leírás (%)</TableHead>
                        <TableHead className="text-[11px] py-1.5 w-24">Főkönyv</TableHead>
                        <TableHead className="text-[11px] py-1.5 w-24 text-center">Státusz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentPageItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                            Nincs a szűrésnek megfelelő eszköz az előnézetben.
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentPageItems.map((item) => (
                          <TableRow key={item.id} className="h-9 hover:bg-muted/20">
                            <TableCell className="text-xs font-mono py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span>{item.inventoryNumber}</span>
                                {importedItemIdsRef.current.has(item.id) ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
                                  >
                                    Rögzítve
                                  </Badge>
                                ) : (
                                  <>
                                    {item.isInventoryNumberGenerated && (
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                        Auto
                                      </Badge>
                                    )}
                                    {item.hasDbCollision && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 bg-amber-500/10"
                                        title="Ez a leltári szám már szerepel az adatbázisban"
                                      >
                                        Létezik
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium py-1.5 truncate max-w-[260px]">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-xs text-right py-1.5 font-medium tabular-nums">
                              {item.acquisitionValue.toLocaleString('hu-HU')} Ft
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-muted-foreground font-mono">
                              {item.activationDate}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-center tabular-nums">
                              {item.depreciationRatePercent > 0
                                ? `${item.depreciationRatePercent.toFixed(1)}%`
                                : '-'}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {item.glAccountNumber ? (
                                <Badge variant="outline" className="text-[10px] font-mono h-5">
                                  {item.glAccountNumber}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-center">
                              {item.status === 'disposed' ? (
                                <Badge variant="secondary" className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10">
                                  Kivezetve
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                                  Aktív
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination footer */}
                  {totalPreviewPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 text-xs text-muted-foreground bg-muted/10">
                      <span>
                        Oldal: {previewPage} / {totalPreviewPages} ({filteredPreviewItems.length} tétel)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={previewPage <= 1}
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={previewPage >= totalPreviewPages}
                          onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING PROGRESS */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-6 max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <RotateCcw className="h-8 w-8 animate-spin" />
              </div>

              <div className="space-y-2 w-full">
                <h3 className="text-lg font-bold">Tárgyi eszközök mentése folyamatban...</h3>
                <p className="text-xs text-muted-foreground">{progressStatus}</p>
              </div>

              <div className="w-full space-y-2">
                <Progress value={progressPercent} className="h-2.5" />
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>Haladás</span>
                  <span className="font-semibold text-foreground">{progressPercent}%</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Kérjük, ne zárd be az ablakot, amíg a folyamat be nem fejeződik.
              </p>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === 'complete' && importSummary && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] space-y-6 max-w-lg mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold">Importálás sikeresen befejeződött!</h3>
                <p className="text-xs text-muted-foreground">
                  A feltöltött eszközök mostantól elérhetők a Tárgyi Eszköz Nyilvántartóban.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full text-left">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block">Rögzített eszközök</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {importSummary.inserted.toLocaleString('hu-HU')} db
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block">Ebből kivezetett</span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {importSummary.disposed.toLocaleString('hu-HU')} db
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 col-span-2">
                  <span className="text-[11px] text-muted-foreground block">Összesített bekerülési érték</span>
                  <span className="text-lg font-bold tabular-nums">
                    {importSummary.totalValue.toLocaleString('hu-HU')} Ft
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/50 shrink-0 flex items-center justify-between sm:justify-between">
          <div>
            {step === 'preview' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Másik fájl választása
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                Mégse
              </Button>
            )}

            {step === 'preview' && parseResult && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                  Mégse
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecuteImport}
                  className={cn(
                    "gap-2 min-w-[160px] font-medium",
                    isResuming
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                  {isResuming
                    ? `Importálás folytatása (${pendingCount} hátralévő)`
                    : `Importálás indítása (${filteredPreviewItems.length})`}
                </Button>
              </>
            )}

            {step === 'complete' && (
              <Button
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="min-w-[120px]"
              >
                Bezárás
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
