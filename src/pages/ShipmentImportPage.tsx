import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  FileSpreadsheet, 
  Upload, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  History,
  Trash2,
  FolderOpen,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useScopedBasePath } from '@/lib/navigation';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { reportError } from '@/lib/errorReporter';

interface ParsedRow {
  position_number: string;
  pickup_date: string | null;
  delivery_date: string | null;
  carrier_name: string | null;
  calculated_amount_huf: number | null;
  calculated_amount_eur: number | null;
}

interface ImportBatch {
  id: string;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  status: string;
  created_at: string;
}

export default function ShipmentImportPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const basePath = useScopedBasePath();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isMatching, setIsMatching] = useState(false); // EF retroaktív matching fut
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<ImportBatch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Import History
  const { data: importHistory = [], isLoading: historyLoading } = useQuery<ImportBatch[]>({
    queryKey: ['shipment-import-batches', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('shipment_import_batches' as any)
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    
    // Check if it's a number (serial date in excel)
    if (typeof val === 'number') {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        return new Date(date.y, date.m - 1, date.d).toISOString();
      }
    }

    // Try parsing string
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  };

  const handleFile = (uploadedFile: File) => {
    const isExcel = 
      uploadedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      uploadedFile.type === "application/vnd.ms-excel" ||
      uploadedFile.name.endsWith(".xlsx") ||
      uploadedFile.name.endsWith(".xls");

    if (!isExcel) {
      toast({
        variant: "destructive",
        title: "Hibás fájlformátum",
        description: "Kérlek csak .xlsx vagy .xls fájlt tölts fel!"
      });
      return;
    }

    setFile(uploadedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length <= 1) {
          throw new Error("Az Excel fájl üres vagy csak fejlécet tartalmaz!");
        }

        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        
        // Find column indices
        const posIdx = headers.findIndex(h => h.includes('pozíció') || h.includes('position') || h.includes('pozicioszam'));
        const pickupIdx = headers.findIndex(h => h.includes('felrakás') || h.includes('pickup') || h.includes('felrakas'));
        const deliveryIdx = headers.findIndex(h => h.includes('lerakás') || h.includes('delivery') || h.includes('lerakas') || h.includes('teljesítés') || h.includes('teljesites'));
        const carrierIdx = headers.findIndex(h => h.includes('fuvaros') || h.includes('carrier') || h.includes('partner') || h.includes('szállító'));
        const hufIdx = headers.findIndex(h => h.includes('huf') || h.includes('kalk. bejövő huf') || h.includes('költség huf'));
        const eurIdx = headers.findIndex(h => h.includes('eur') || h.includes('kalk. bejövő eur') || h.includes('költség eur'));

        if (posIdx === -1) {
          throw new Error("A 'Pozíciószám' oszlop nem található a fájlban!");
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[posIdx]) continue; // Skip empty rows

          // Parse values
          const position_number = String(row[posIdx]).trim();
          const pickup_date = parseExcelDate(row[pickupIdx]);
          const delivery_date = parseExcelDate(row[deliveryIdx]);
          const carrier_name = carrierIdx !== -1 && row[carrierIdx] ? String(row[carrierIdx]).trim() : null;
          
          let hufVal = hufIdx !== -1 && row[hufIdx] !== undefined ? parseFloat(row[hufIdx]) : null;
          let eurVal = eurIdx !== -1 && row[eurIdx] !== undefined ? parseFloat(row[eurIdx]) : null;

          // Excel cost export may contain negative values, keep them absolute or keep them as is (PRD says we should match on absolute value)
          // We will store absolute values in calculated_amount to make matching comparison simpler
          const calculated_amount_huf = hufVal !== null && !isNaN(hufVal) ? Math.abs(hufVal) : null;
          const calculated_amount_eur = eurVal !== null && !isNaN(eurVal) ? Math.abs(eurVal) : null;

          rows.push({
            position_number,
            pickup_date,
            delivery_date,
            carrier_name,
            calculated_amount_huf,
            calculated_amount_eur
          });
        }

        // Deduplicate within the file: last occurrence wins per position_number
        const deduped = new Map<string, ParsedRow>();
        for (const row of rows) {
          deduped.set(row.position_number, row);
        }
        const uniqueRows = Array.from(deduped.values());
        const duplicatesInFile = rows.length - uniqueRows.length;

        setParsedRows(uniqueRows);
        toast({
          title: "Sikeres beolvasás",
          description: duplicatesInFile > 0
            ? `${uniqueRows.length} egyedi fuvar sor feldolgozásra kész (${duplicatesInFile} duplikált sor összevonva).`
            : `${uniqueRows.length} fuvar sor feldolgozásra kész.`,
        });
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Beolvasási hiba",
          description: err.message || "Nem sikerült feldolgozni az Excel fájlt."
        });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleImport = async () => {
    if (!selectedCompany?.id || parsedRows.length === 0 || !file) return;

    setIsImporting(true);
    setImportProgress(10);

    try {
      // 1. Create Import Batch entry
      const { data: batch, error: batchError } = await supabase
        .from('shipment_import_batches' as any)
        .insert({
          company_id: selectedCompany.id,
          file_name: file.name,
          file_path: 'client-side-parsed',
          total_rows: parsedRows.length,
          imported_rows: 0,
          skipped_rows: 0,
          errors: [],
          status: 'processing'
        })
        .select()
        .single();

      if (batchError) throw batchError;
      setImportProgress(20);

      // 2. Check which position_numbers already exist for this company
      const positionNumbers = parsedRows.map(r => r.position_number);
      const { data: existingShipments, error: existingError } = await supabase
        .from('shipments' as any)
        .select('position_number, match_status, matched_invoice_id')
        .eq('company_id', selectedCompany.id)
        .in('position_number', positionNumbers);

      if (existingError) throw existingError;
      setImportProgress(40);

      // Build lookup: position_number → existing shipment state
      const existingMap = new Map<string, { match_status: string; matched_invoice_id: string | null }>();
      for (const s of (existingShipments || [])) {
        existingMap.set(s.position_number, {
          match_status: s.match_status,
          matched_invoice_id: s.matched_invoice_id,
        });
      }

      // 3. Separate into new inserts vs updates (preserve matched state)
      const newRows: any[] = [];
      const updateRows: any[] = [];

      for (const r of parsedRows) {
        const existing = existingMap.get(r.position_number);
        
        const baseRow = {
          company_id: selectedCompany.id,
          position_number: r.position_number,
          pickup_date: r.pickup_date,
          delivery_date: r.delivery_date,
          carrier_name: r.carrier_name,
          calculated_amount_huf: r.calculated_amount_huf,
          calculated_amount_eur: r.calculated_amount_eur,
          import_batch_id: batch.id,
        };

        if (!existing) {
          // New record — set initial match_status
          newRows.push({
            ...baseRow,
            match_status: 'unmatched',
          });
        } else {
          // Existing record — update data fields but PRESERVE match state
          updateRows.push({
            ...baseRow,
            // Keep existing match_status and matched_invoice_id
            match_status: existing.match_status,
            matched_invoice_id: existing.matched_invoice_id,
          });
        }
      }

      setImportProgress(60);

      // 4. Batch insert new rows
      let insertedCount = 0;
      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from('shipments' as any)
          .insert(newRows);
        if (insertError) throw insertError;
        insertedCount = newRows.length;
      }

      // 5. Batch upsert updated rows (updates existing by unique constraint)
      let updatedCount = 0;
      if (updateRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('shipments' as any)
          .upsert(updateRows, { onConflict: 'company_id,position_number' });
        if (upsertError) throw upsertError;
        updatedCount = updateRows.length;
      }

      setImportProgress(80);

      // 6. Update batch status to completed with breakdown
      await supabase
        .from('shipment_import_batches' as any)
        .update({
          status: 'completed',
          imported_rows: insertedCount,
          skipped_rows: updatedCount,  // "skipped" = updated (not duplicated)
        })
        .eq('id', batch.id);

      setImportProgress(100);

      // Show detailed result
      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} új fuvar rögzítve`);
      if (updatedCount > 0) parts.push(`${updatedCount} meglévő frissítve`);

      toast({
        title: "Sikeres importálás!",
        description: parts.join(', ') + '.',
      });

      // Reset states
      setFile(null);
      setParsedRows([]);
      
      // Invalidate queries — 'shipments-matching' is the key used by ShipmentMatchingDashboard
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['shipment-import-batches', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['escalations', selectedCompany.id] });

      // DR-031: Retroaktív matching — invoice-first életciklus kezelés
      // FONTOS: await-eljük az EF hívást a navigate() ELŐTT.
      // isMatching=true alatt a gomb disabled és a progress szöveg változik.
      setIsMatching(true);
      try {
        const efPromise = supabase.functions.invoke('shipment-retroactive-match', {
          body: { company_id: selectedCompany.id, import_session_id: batch.id },
        });
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10000));
        const { error: efError } = await Promise.race([efPromise, timeout.then(() => ({ error: null, data: null }))]);
        if (efError) {
          reportError({ type: 'edge_function', component: 'ShipmentImportPage', action: 'warn', message: 'Retroactive match EF error (non-critical)', error: efError });
        } else {
          queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany.id] });
        }
      } catch (efErr) {
        reportError({ type: 'edge_function', component: 'ShipmentImportPage', action: 'warn', message: 'Retroactive match call failed (non-critical)', error: efErr });
      } finally {
        setIsMatching(false);
      }

      // Navigálás csak az EF befejezése (vagy timeout) után
      navigate(`${basePath}/shipments`);


    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Importálási hiba",
        description: err.message || "Hiba történt az importálás során."
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <>
    <div className="container mx-auto px-4 py-8 page-animate">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/shipments`)}>
              Mégse
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Selexped Excel Import</h1>
              <p className="text-muted-foreground font-medium text-sm">Selexped fuvaradatok importálása Excel fájlból</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBatchModalOpen(true)}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Feltöltött fájlok
            {importHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {importHistory.length}
              </Badge>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left / Upload side */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border/50 shadow-sm bg-card">
              <CardContent className="p-6">
                {!file ? (
                  <div 
                    className={`border-2 border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={handleChange}
                    />
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">Húzd ide az Excel fájlt, vagy kattints a tallózáshoz</h3>
                    <p className="text-xs text-muted-foreground max-w-md">
                      Támogatott formátum: .xlsx, .xls — Selexped export. Az importáláshoz legalább a "Pozíciószám" oszlop jelenléte kötelező.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                          <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB | {parsedRows.length} sor beolvasva</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => { setFile(null); setParsedRows([]); }} disabled={isImporting}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    {(isImporting || isMatching) && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>
                            {isMatching
                              ? '⚡ Párosítás folyamatban...'
                              : 'Feltöltés és mentés...'}
                          </span>
                          <span>{isMatching ? '100%' : `${importProgress}%`}</span>
                        </div>
                        <Progress value={isMatching ? 100 : importProgress} className="h-2" />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setFile(null); setParsedRows([]); }} disabled={isImporting || isMatching}>
                        Mégse
                      </Button>
                      <Button onClick={handleImport} disabled={isImporting || isMatching || parsedRows.length === 0}>
                        <Check className="h-4 w-4 mr-2" />
                        {isMatching ? 'Párosítás...' : `Importálás indítása (${parsedRows.length} sor)`}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Section */}
            {parsedRows.length > 0 && (
              <Card className="border border-border/50 shadow-sm bg-card">
                <CardHeader className="p-6 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Beolvasott adatok előnézete</CardTitle>
                      <CardDescription>Az első 10 beolvasott sor mintája az Excel fájlból</CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                      {parsedRows.length} sor OK
                    </Badge>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm compact-table min-w-max">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs">
                        <th className="h-10 px-4 text-left font-semibold text-muted-foreground">#</th>
                        <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Pozíciószám</th>
                        <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Felrakás</th>
                        <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Lerakás</th>
                        <th className="h-10 px-4 text-left font-semibold text-muted-foreground">Fuvaros</th>
                        <th className="h-10 px-4 text-right font-semibold text-muted-foreground">Kalk. HUF</th>
                        <th className="h-10 px-4 text-right font-semibold text-muted-foreground">Kalk. EUR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-border/30">
                          <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold">{row.position_number}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {row.pickup_date ? format(new Date(row.pickup_date), 'yyyy. MM. dd.') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {row.delivery_date ? format(new Date(row.delivery_date), 'yyyy. MM. dd.') : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{row.carrier_name || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">
                            {row.calculated_amount_huf !== null ? formatCurrency(row.calculated_amount_huf, 'HUF') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">
                            {row.calculated_amount_eur !== null ? formatCurrency(row.calculated_amount_eur, 'EUR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Right side - Import History */}
          <div className="space-y-6">
            <Card className="border border-border/50 shadow-sm bg-card">
              <CardHeader className="p-6 border-b border-border/50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Importálási Előzmények
                </CardTitle>
                <CardDescription>Cég szintű korábbi Selexped importok</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {historyLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : importHistory.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground italic py-6">
                    Nem volt korábbi importálás.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {importHistory.map((batch) => (
                      <div key={batch.id} className="border border-border/50 rounded-lg p-3 space-y-2 hover:border-primary/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold truncate max-w-[180px]">{batch.file_name}</p>
                          <Badge 
                            variant={batch.status === 'completed' ? 'default' : batch.status === 'failed' ? 'destructive' : 'outline'}
                            className={batch.status === 'completed' ? 'bg-success/10 text-success border-success/20 font-semibold' : ''}
                          >
                            {batch.status === 'completed' ? 'Sikeres' : batch.status === 'failed' ? 'Hiba' : 'Feldolgozás'}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>
                            {batch.imported_rows > 0 && batch.skipped_rows > 0
                              ? `${batch.imported_rows} új + ${batch.skipped_rows} frissítve`
                              : batch.skipped_rows > 0
                              ? `${batch.skipped_rows} frissítve (${batch.total_rows} sorból)`
                              : `${batch.total_rows} sor`
                            }
                          </span>
                          <span>
                            {format(new Date(batch.created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>

    {/* ── Uploaded Files Modal ─────────────────────────────────── */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              Feltöltött Import Fájlok
            </DialogTitle>
            <DialogDescription>
              Az összes korábbi Selexped import. Törléskor a fájlhoz tartozó fuvar sorok is törlődnek.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {historyLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : importHistory.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="italic">Nincs korábbi importálás.</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {importHistory.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center gap-3 border border-border/50 rounded-lg p-3 hover:border-border transition-colors group"
                  >
                    <div className="p-2 bg-muted/50 rounded-lg shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{batch.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mt-0.5">
                        <span>
                          {batch.imported_rows > 0 && batch.skipped_rows > 0
                            ? `${batch.imported_rows} új + ${batch.skipped_rows} frissítve`
                            : batch.skipped_rows > 0
                            ? `${batch.skipped_rows} frissítve`
                            : `${batch.total_rows} sor`
                          }
                        </span>
                        <span>·</span>
                        <span>{format(new Date(batch.created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={batch.status === 'completed' ? 'default' : batch.status === 'failed' ? 'destructive' : 'outline'}
                        className={batch.status === 'completed' ? 'bg-success/10 text-success border-success/20 text-xs' : 'text-xs'}
                      >
                        {batch.status === 'completed' ? 'Sikeres' : batch.status === 'failed' ? 'Hiba' : 'Feldolgozás'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteBatch(batch)}
                      >
                        {deletingBatchId === batch.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation AlertDialog ────────────────────────── */}
      <AlertDialog open={!!confirmDeleteBatch} onOpenChange={(open) => !open && setConfirmDeleteBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törlöd a(z) <span className="font-semibold text-foreground">{confirmDeleteBatch?.file_name}</span> importot?
              <br />
              <span className="text-destructive font-medium">
                Ez törli az importhoz tartozó összes fuvar sort is ({confirmDeleteBatch?.total_rows} sor).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmDeleteBatch) return;

                setIsDeleting(true);
                setDeletingBatchId(confirmDeleteBatch.id);

                try {
                  // 1. Delete all shipments that belong to this batch
                  const { error: shipmentsError } = await supabase
                    .from('shipments' as any)
                    .delete()
                    .eq('import_batch_id', confirmDeleteBatch.id);

                  if (shipmentsError) throw shipmentsError;

                  // 2. Delete the batch record itself
                  const { error: batchError } = await supabase
                    .from('shipment_import_batches' as any)
                    .delete()
                    .eq('id', confirmDeleteBatch.id);

                  if (batchError) throw batchError;

                  toast({
                    title: 'Import törölve',
                    description: `${confirmDeleteBatch.file_name} és a hozzá tartozó fuvar sorok sikeresen törölve.`,
                  });

                  // Invalidate queries — 'shipments-matching' is the key used by ShipmentMatchingDashboard
                  queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany?.id] });
                  queryClient.invalidateQueries({ queryKey: ['shipment-import-batches', selectedCompany?.id] });
                } catch (err: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Törlési hiba',
                    description: err.message || 'Nem sikerült törölni az importot.',
                  });
                } finally {
                  setIsDeleting(false);
                  setDeletingBatchId(null);
                  setConfirmDeleteBatch(null);
                }
              }}
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Törlés...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Végleges törlés</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
