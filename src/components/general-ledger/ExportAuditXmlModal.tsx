import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import {
  FileCode,
  Download,
  Loader2,
  CheckCircle2,
  Calendar,
  FileArchive,
  Receipt,
  AlertCircle,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import {
  MkvkAuditXmlRawData,
  generateMkvkAuditXml,
  getMkvkAuditXmlFileName,
  downloadMkvkAuditXml,
} from '@/services/mkvkAuditXmlGenerator';

interface ExportAuditXmlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}

export function ExportAuditXmlModal({
  open,
  onOpenChange,
  defaultDateFrom,
  defaultDateTo,
}: ExportAuditXmlModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState<string>(() => defaultDateFrom || `${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState<string>(() => defaultDateTo || `${new Date().getFullYear()}-12-31`);
  const [includeOpening, setIncludeOpening] = useState<boolean>(true);
  const [includeClosing, setIncludeClosing] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'zip' | 'xml'>('zip');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const companyId = selectedCompany?.id;

  const {
    data: previewData,
    isLoading: isLoadingPreview,
    error: previewQueryError,
  } = useQuery({
    queryKey: ['mkvkAuditPreview', companyId, dateFrom, dateTo, includeOpening, includeClosing],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc('get_mkvk_audit_xml_data', {
        p_company_id: companyId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_include_opening: includeOpening,
        p_include_closing: includeClosing,
      });

      if (error) {
        throw error;
      }

      return data as unknown as MkvkAuditXmlRawData;
    },
    enabled: open && !!companyId,
    staleTime: 1000 * 30,
  });

  const previewError = previewQueryError
    ? (previewQueryError as Error).message || 'Nem sikerült betölteni az export előnézetet.'
    : null;

  // Handle export generation and file download
  const handleExport = async () => {
    if (!selectedCompany?.id) return;

    setIsExporting(true);
    try {
      let data = previewData;

      // If previewData is not yet loaded, load it fresh
      if (!data) {
        const { data: freshData, error } = await supabase.rpc('get_mkvk_audit_xml_data', {
          p_company_id: selectedCompany.id,
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_include_opening: includeOpening,
          p_include_closing: includeClosing,
        });

        if (error) throw error;
        data = freshData as unknown as MkvkAuditXmlRawData;
      }

      if (!data || !data.tetelek || data.tetelek.length === 0) {
        toast({
          title: 'Nincs exportálható adat',
          description: 'A megadott időszakban és szűrőfeltételekkel nem található könyvelt tétel.',
          variant: 'destructive',
        });
        setIsExporting(false);
        return;
      }

      const xmlContent = generateMkvkAuditXml(data);
      const companyName = data.cegadatok?.nev || selectedCompany.name || 'Ceg';
      const fileName = getMkvkAuditXmlFileName(companyName, dateFrom, dateTo, exportFormat);

      await downloadMkvkAuditXml({
        xmlContent,
        fileName,
        asZip: exportFormat === 'zip',
      });

      toast({
        title: 'Audit XML sikeresen elkészült',
        description: `${fileName} (${data.tetelek.length} könyvelési tétel) letöltve.`,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Error exporting MKVK Audit XML:', err);
      toast({
        title: 'Hiba az XML export során',
        description: err?.message || 'Váratlan hiba történt az XML előállítása közben.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const totalAmount = previewData?.tetelek?.reduce((acc, t) => acc + (Number(t.osszeg) || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 flex flex-col overflow-hidden max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                  <span>Könyvelői Audit XML Készítése</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold tracking-wider text-primary border-primary/30 bg-primary/5">
                    MKVK v1.0.23.0
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Magyar Könyvvizsgálói Kamara szabványos főkönyvi adatexport (AuditXML_FkTet_export)
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Cégadatok összefoglaló kártya */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/60 text-xs">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold text-foreground">{selectedCompany?.name}</span>
                {selectedCompany?.tax_number && (
                  <span className="text-muted-foreground ml-2">Adószám: {selectedCompany.tax_number}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Hivatalos formátum</span>
            </div>
          </div>

          {/* Időszak és Opciók szekció */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom" className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Időszak kezdete
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo" className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Időszak vége
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Tételek bevonása opciók */}
          <div className="rounded-lg border border-border/60 p-3.5 bg-muted/10 space-y-2.5">
            <span className="text-xs font-semibold text-foreground block">Könyvelési szűrési paraméterek</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeOpening"
                  checked={includeOpening}
                  onCheckedChange={(checked) => setIncludeOpening(!!checked)}
                />
                <label
                  htmlFor="includeOpening"
                  className="text-xs font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Nyitó tételek bevonása (Ajánlott)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeClosing"
                  checked={includeClosing}
                  onCheckedChange={(checked) => setIncludeClosing(!!checked)}
                />
                <label
                  htmlFor="includeClosing"
                  className="text-xs font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Záró tételek bevonása
                </label>
              </div>
            </div>
          </div>

          {/* Formátum választás */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Export formátum</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(val: 'zip' | 'xml') => setExportFormat(val)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div
                onClick={() => setExportFormat('zip')}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportFormat === 'zip'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 bg-card hover:bg-muted/30'
                }`}
              >
                <RadioGroupItem value="zip" id="format-zip" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <FileArchive className="w-3.5 h-3.5 text-primary" />
                    <Label htmlFor="format-zip" className="text-xs font-semibold cursor-pointer">
                      ZIP archívum (.zip)
                    </Label>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      Ajánlott
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tömörített archívum az MKVK adatexport ajánlásának megfelelően.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setExportFormat('xml')}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  exportFormat === 'xml'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 bg-card hover:bg-muted/30'
                }`}
              >
                <RadioGroupItem value="xml" id="format-xml" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                    <Label htmlFor="format-xml" className="text-xs font-semibold cursor-pointer">
                      Nyers XML fájl (.xml)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Közvetlen UTF-8 kódolású XML fájl egyedi feldolgozóknak.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Adatok élő előnézete / Validáció */}
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Receipt className="w-3.5 h-3.5 text-primary" />
                Export előnézet és ellenőrzés
              </span>
              {isLoadingPreview ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>Adatok összesítése...</span>
                </div>
              ) : previewData ? (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Kész az exportra
                </Badge>
              ) : null}
            </div>

            {previewError ? (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{previewError}</span>
              </div>
            ) : previewData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground block">Bizonylatok</span>
                  <span className="text-sm font-bold text-foreground">
                    {previewData.bizonylatok?.length || 0} db
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground block">Főkönyvi tételek</span>
                  <span className="text-sm font-bold text-foreground">
                    {previewData.tetelek?.length || 0} db
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground block">Érintett partnerek</span>
                  <span className="text-sm font-bold text-foreground">
                    {previewData.partnerek?.length || 0} db
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground block">Főkönyvi számlák</span>
                  <span className="text-sm font-bold text-foreground">
                    {previewData.szamlaszamok?.length || 0} db
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-4 p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-xs px-3">
                  <span className="text-muted-foreground font-medium">Tételek összesített forgalma:</span>
                  <span className="text-sm font-bold text-primary font-mono">
                    {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(totalAmount)}
                  </span>
                </div>
              </div>
            ) : !isLoadingPreview ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                Nincs elérhető adat a megadott időszakra.
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/50 bg-muted/20 shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="text-xs"
          >
            Mégse
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isLoadingPreview || !previewData || previewData.tetelek?.length === 0}
            className="gap-2 text-xs font-semibold shadow-xs"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exportálás folyamatban...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Audit XML Export Letöltése</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
