import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  generateAuditorGlExcel,
  generateAuditorGlCsv,
  computeSha256Hex,
  saveAuditExportSnapshot,
  downloadFile,
  type AuditorGlExportData,
  type AuditorGlLine,
} from '@/services/auditorExportService';
import {
  generateMkvkAuditXml,
  downloadMkvkAuditXml,
  getMkvkAuditXmlFileName,
  type MkvkAuditXmlRawData,
} from '@/services/mkvkAuditXmlGenerator';
import { supabase } from '@/integrations/supabase/client';

interface GlJournalExportCardProps {
  data: AuditorGlExportData | undefined;
  isLoading: boolean;
  companyId: string;
  fiscalYear: number;
  onSnapshotSaved?: () => void;
}

export function GlJournalExportCard({
  data,
  isLoading,
  companyId,
  fiscalYear,
  onSnapshotSaved,
}: GlJournalExportCardProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXml, setIsExportingXml] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/40 shadow-sm p-8 text-center bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Főkönyvi tételek és 20-oszlopos karton betöltése...</p>
        </div>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, lines, company, period } = data;

  // Filter lines by search term (account number, partner, description, document)
  const filteredLines = lines.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.gl_account_number.toLowerCase().includes(term) ||
      l.gl_account_name.toLowerCase().includes(term) ||
      (l.partner_name && l.partner_name.toLowerCase().includes(term)) ||
      (l.partner_tax_number && l.partner_tax_number.includes(term)) ||
      l.description.toLowerCase().includes(term) ||
      l.journal_code.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredLines.length / pageSize) || 1;
  const paginatedLines = filteredLines.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handle Excel (.xlsx) export
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const blob = await generateAuditorGlExcel(company.name, company.tax_number, { from: period.date_from, to: period.date_to }, lines, summary);
      const safeCompName = company.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const fileName = `Fokonyvi_Karton_${safeCompName}_${period.date_from}_${period.date_to}.xlsx`;
      downloadFile(blob, fileName);

      toast({
        title: 'Sikeres Excel exportálás',
        description: `${lines.length} tétel letöltve 20 formázott oszloppal és ellenőrző összegzőkkel.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Hiba az Excel exportálás során',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Handle CSV export
  const handleExportCsv = () => {
    try {
      setIsExportingCsv(true);
      const csvContent = generateAuditorGlCsv(lines);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const safeCompName = company.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const fileName = `Fokonyvi_Karton_${safeCompName}_${period.date_from}_${period.date_to}.csv`;
      downloadFile(blob, fileName);

      toast({
        title: 'Sikeres CSV exportálás',
        description: 'Excel-kompatibilis UTF-8 BOM pontosvesszős CSV fájl generálva.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Hiba a CSV generálásakor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Handle MKVK Audit XML Export (reusing existing generator)
  const handleExportMkvkXml = async () => {
    try {
      setIsExportingXml(true);
      const { data: rawXmlData, error } = await supabase.rpc('get_mkvk_audit_xml_data', {
        p_company_id: companyId,
        p_date_from: period.date_from,
        p_date_to: period.date_to,
        p_include_opening: period.include_opening,
        p_include_closing: period.include_closing,
      });

      if (error) throw error;
      if (!rawXmlData) throw new Error('Nem érkezett MKVK adat az adatbázisból.');

      const xmlRawData = rawXmlData as unknown as MkvkAuditXmlRawData;
      if (!xmlRawData.tetelek || xmlRawData.tetelek.length === 0) {
        toast({
          title: 'Nincs exportálható MKVK tétel',
          description: 'A megadott időszakra vonatkozóan nem található könyvelt főkönyvi tétel.',
          variant: 'destructive',
        });
        return;
      }

      const xmlContent = generateMkvkAuditXml(xmlRawData);
      const companyName = xmlRawData.cegadatok?.nev || company.name || 'Ceg';
      const fileName = getMkvkAuditXmlFileName(companyName, period.date_from, period.date_to, 'zip');

      await downloadMkvkAuditXml({
        xmlContent,
        fileName,
        asZip: true,
      });

      toast({
        title: 'Sikeres MKVK AuditXML exportálás',
        description: `Hivatalos MKVK v1.0.23.0 XML zip csomag letöltve (${fileName}).`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Hiba az MKVK export során',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsExportingXml(false);
    }
  };

  // Handle Snapshot creation (SHA-256 hash, DB record saving & XLSX download)
  const handleSaveSnapshot = async () => {
    try {
      setIsSavingSnapshot(true);
      const csvContent = generateAuditorGlCsv(lines);
      const hash = await computeSha256Hex(csvContent);
      const versionLabel = `v1.${new Date().getMonth() + 1} (${new Date().toLocaleDateString('hu-HU')} Zárási export)`;
      const fileName = `Fokonyv_${fiscalYear}_${hash.slice(0, 8)}.xlsx`;

      // 1. Generate and trigger download of snapshot Excel file
      const blob = await generateAuditorGlExcel(
        company.name,
        company.tax_number,
        { from: period.date_from, to: period.date_to },
        lines,
        summary
      );
      downloadFile(blob, fileName);

      // 2. Persist audit snapshot trail in database
      await saveAuditExportSnapshot(companyId, {
        fiscalYear,
        periodFrom: period.date_from,
        periodTo: period.date_to,
        versionLabel,
        exportFormat: 'XLSX',
        packageType: 'GL_JOURNAL',
        fileName,
        fileHashSha256: hash,
        totalLines: lines.length,
        totalDebit: summary.total_debit,
        totalCredit: summary.total_credit,
      });

      toast({
        title: 'Audit Pillanatkép rögzítve és letöltve',
        description: `${fileName} letöltve | SHA-256 lenyomat: ${hash.slice(0, 16)}...`,
      });

      if (onSnapshotSaved) {
        onSnapshotSaved();
      }
    } catch (err: unknown) {
      toast({
        title: 'Hiba a pillanatkép mentésekor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
      <CardHeader className="bg-muted/10 border-b border-border/40 p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-xl font-bold tracking-tight">
                20-Oszlopos Könyvvizsgálói Főkönyvi Kivonat és Karton
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                MKVK & ISA Konform
              </Badge>
            </div>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              Standardizált kettős könyvviteli adatszolgáltatás Alteryx, IDEA, CaseWare és Excel elemzők részére
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExportingCsv || lines.length === 0}
              className="text-xs h-9 font-medium"
            >
              <FileText className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
              CSV (UTF-8 BOM)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMkvkXml}
              disabled={isExportingXml || lines.length === 0}
              className="text-xs h-9 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <FileCode className="h-4 w-4 mr-1.5" />
              MKVK AuditXML (.zip)
            </Button>

            <Button
              size="sm"
              onClick={handleExportExcel}
              disabled={isExportingExcel || lines.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs h-9 font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              {isExportingExcel ? 'Generálás...' : 'Excel letöltése (.xlsx)'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSnapshot}
              disabled={isSavingSnapshot || lines.length === 0}
              className="text-xs h-9 border-purple-500/30 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10"
            >
              <Camera className="h-4 w-4 mr-1.5" />
              {isSavingSnapshot ? 'Mentés...' : 'Pillanatkép (SHA-256)'}
            </Button>
          </div>
        </div>

        {/* Balanced status & KPI cards bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/30">
          <div className="bg-background/80 p-3 rounded-xl border border-border/30">
            <div className="text-xs text-muted-foreground">Tételek száma</div>
            <div className="text-lg font-bold tracking-tight text-foreground">{lines.length.toLocaleString('hu-HU')} db</div>
          </div>

          <div className="bg-background/80 p-3 rounded-xl border border-border/30">
            <div className="text-xs text-muted-foreground">Tartozik forgalom</div>
            <div className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {summary.total_debit.toLocaleString('hu-HU')} Ft
            </div>
          </div>

          <div className="bg-background/80 p-3 rounded-xl border border-border/30">
            <div className="text-xs text-muted-foreground">Követel forgalom</div>
            <div className="text-lg font-bold tracking-tight text-red-600 dark:text-red-400">
              {summary.total_credit.toLocaleString('hu-HU')} Ft
            </div>
          </div>

          <div className="bg-background/80 p-3 rounded-xl border border-border/30">
            <div className="text-xs text-muted-foreground">Mérlegegyezőség</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {summary.is_balanced ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-600">0 Ft diff (Egyezik)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-600">
                    {summary.imbalance_diff.toLocaleString('hu-HU')} Ft eltérés
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-4">
        {/* Search and preview filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szűrés számlaszámra, partnerre, leírásra..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Megjelenítve:{' '}
            <strong className="text-foreground">
              {Math.min(filteredLines.length, (currentPage - 1) * pageSize + 1)}–
              {Math.min(filteredLines.length, currentPage * pageSize)}
            </strong>{' '}
            / {filteredLines.length} sor
          </div>
        </div>

        {/* 20-Column Responsive Data Table */}
        <div className="rounded-xl border border-border/40 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10 backdrop-blur-md uppercase tracking-wider font-semibold border-b border-border/40">
                <tr>
                  <th className="py-2.5 px-3">Napló</th>
                  <th className="py-2.5 px-3 text-center">Sorszám</th>
                  <th className="py-2.5 px-3">Könyvelés</th>
                  <th className="py-2.5 px-3">Bizonylat kelte</th>
                  <th className="py-2.5 px-3">Esedékesség</th>
                  <th className="py-2.5 px-3">Főkönyvi szám</th>
                  <th className="py-2.5 px-3">Számla neve</th>
                  <th className="py-2.5 px-2 text-center">T/K</th>
                  <th className="py-2.5 px-3 text-right">Összeg (HUF)</th>
                  <th className="py-2.5 px-2 text-center">Pénznem</th>
                  <th className="py-2.5 px-3">Partner adószám</th>
                  <th className="py-2.5 px-3">Partner név</th>
                  <th className="py-2.5 px-3">Költséghely</th>
                  <th className="py-2.5 px-3">Projekt</th>
                  <th className="py-2.5 px-3">Szöveges leírás</th>
                  <th className="py-2.5 px-3">Rögzítő</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedLines.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-8 text-center text-muted-foreground">
                      Nincs megjeleníthető könyvelési tétel a megadott szűrési feltételekkel.
                    </td>
                  </tr>
                ) : (
                  paginatedLines.map((l, idx) => (
                    <tr
                      key={l.line_id || idx}
                      className="hover:bg-muted/30 transition-colors duration-150 odd:bg-transparent even:bg-muted/10"
                    >
                      <td className="py-2 px-3 font-semibold text-foreground">{l.journal_code}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">{l.journal_number || '-'}</td>
                      <td className="py-2 px-3 font-mono">{l.accounting_date}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">{l.document_date}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">{l.due_date || '-'}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-foreground">{l.gl_account_number}</td>
                      <td className="py-2 px-3 max-w-[180px] truncate" title={l.gl_account_name}>
                        {l.gl_account_name}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            l.dc_type === 'T'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {l.dc_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-foreground">
                        {l.amount.toLocaleString('hu-HU', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{l.currency}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">{l.partner_tax_number || '-'}</td>
                      <td className="py-2 px-3 max-w-[160px] truncate" title={l.partner_name || ''}>
                        {l.partner_name || '-'}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{l.cost_center || '-'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{l.project_id || '-'}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={l.description}>
                        {l.description}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate">{l.created_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="text-xs h-8"
            >
              Előző oldal
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage} / {totalPages} oldal
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs h-8"
            >
              Következő oldal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
