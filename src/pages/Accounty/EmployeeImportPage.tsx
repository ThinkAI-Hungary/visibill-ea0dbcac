import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, XCircle,
  AlertTriangle, Loader2, Trash2, Users, Eye, RefreshCw, ChevronDown,
  FileText, Table, FileCode, CheckSquare, Calendar, Building2, Sparkles, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useBulkImportPayroll } from '@/hooks/useBulkImportPayroll';
import { parseFiling08Xml, normalizeDate, readTextFileWithEncoding, type Parsed08Document, type Parsed08Employee } from '@/lib/payroll/nav08XmlParser';
import { buildReconstructionPlan } from '@/lib/payroll/payrollReconstructionEngine';
import { usePayrollEmployees, useCompanyEmployments, usePayrollCycles } from '@/hooks/usePayrollData';
import { PayrollReconstructionDialog } from '@/components/accounty/payroll/PayrollReconstructionDialog';

const TEMPLATE_HEADERS = ['Vezetéknév', 'Keresztnév', 'Születési dátum', 'TAJ-szám', 'Adóazonosító jel', 'Jogviszonykód', 'Belépés dátuma', 'FEOR', 'Heti óraszám', 'Alapbér (Ft)'];

const SAMPLE_ROWS = [
  ['Nagy', 'Anna', '1985-03-15', '123 456 789', '8765432109', '1101', '2026-01-02', '2411', '40', '450000'],
  ['Kiss', 'Béla', '1990-07-22', '987 654 321', '1234567890', '1101', '2026-02-01', '3312', '40', '380000'],
];

function parseCleanNumber(val: string | null | undefined): number {
  if (!val) return 0;
  const clean = val.replace(/\s/g, '').replace(/Ft/gi, '').replace(/,/g, '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

export default function EmployeeImportPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId || '';
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const xmlFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'excel' | 'nav08'>('excel');
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [reconstructionModalOpen, setReconstructionModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Excel parsed rows converted to standard Parsed08Employee
  const [parsedEmployees, setParsedEmployees] = useState<Parsed08Employee[]>([]);
  // NAV 08 Document if active
  const [parsed08Doc, setParsed08Doc] = useState<Parsed08Document | null>(null);
  const [createCycleOption, setCreateCycleOption] = useState(true);

  const { data: existingEmployees = [] } = usePayrollEmployees(id);
  const { data: existingEmployments = [] } = useCompanyEmployments(id);
  const { data: existingCycles = [] } = usePayrollCycles(id);

  const { importEmployees, reconstructCycles, isProcessing, progress } = useBulkImportPayroll();

  const validCount = parsedEmployees.filter(r => r.valid).length;
  const errorCount = parsedEmployees.filter(r => !r.valid).length;

  // Reconstruction plan summary if NAV 08 doc is available
  const plan = useMemo(() => {
    if (!parsed08Doc) return null;
    return buildReconstructionPlan(parsed08Doc, existingEmployees, existingEmployments, existingCycles);
  }, [parsed08Doc, existingEmployees, existingEmployments, existingCycles]);

  // CSV parsing
  const parseCSVContent = useCallback((text: string): Parsed08Employee[] => {
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const header = lines[0];
    const delimiter = header.includes(';') ? ';' : ',';
    const dataLines = lines.slice(1);

    const headerCols = header.split(delimiter).map(c =>
      c.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_\-]/g, '')
    );

    const findCol = (keywords: string[], fallbackIdx: number): number => {
      const idx = headerCols.findIndex(h => keywords.some(k => h.includes(k)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const lastNameIdx = findCol(['vezetek', 'csalad', 'surname', 'lastname'], 0);
    const firstNameIdx = findCol(['kereszt', 'firstname', 'utonev'], 1);
    const birthDateIdx = findCol(['szulet', 'birth'], 2);
    const tajIdx = findCol(['taj'], 3);
    const taxIdIdx = findCol(['adoazon', 'adokartya', 'taxid'], 4);
    const jobCodeIdx = findCol(['jogviszony', 'jobcode', 't1041'], 5);
    const startDateIdx = findCol(['belep', 'start', 'kezdet'], 6);
    const feorIdx = findCol(['feor'], 7);
    const weeklyHoursIdx = findCol(['ora', 'hours', 'munkaido'], 8);
    const baseSalaryIdx = findCol(['alapber', 'ber', 'salary', 'brutto'], 9);

    return dataLines.map((line) => {
      const cols = line.split(delimiter).map(c => c.trim());
      const surname = cols[lastNameIdx] || '';
      const firstName = cols[firstNameIdx] || '';
      const birthDate = normalizeDate(cols[birthDateIdx]);
      const tajNumber = (cols[tajIdx] || '').replace(/[\s-]/g, '');
      const taxId = (cols[taxIdIdx] || '').replace(/[\s-]/g, '');
      const jobCode = cols[jobCodeIdx] || '1101';
      const startDate = normalizeDate(cols[startDateIdx]) || `${new Date().getFullYear()}-01-01`;
      const feor = cols[feorIdx] || '';
      const weeklyHours = parseCleanNumber(cols[weeklyHoursIdx]) || 40;
      const baseSalary = parseCleanNumber(cols[baseSalaryIdx]) || 0;

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!surname) errors.push('Vezetéknév hiányzik');
      if (!firstName) errors.push('Keresztnév hiányzik');
      if (tajNumber && tajNumber.length !== 9) warnings.push('TAJ formátum nem 9 számjegy');
      if (!tajNumber && !taxId) errors.push('TAJ-szám vagy adóazonosító megadása kötelező');

      return {
        lastName: surname,
        firstName,
        birthDate,
        tajNumber,
        taxId,
        jobCode,
        employmentType: 'munkaviszony',
        startDate,
        feorCode: feor,
        weeklyHours,
        baseSalary,
        grossSalary: baseSalary,
        taxBase: baseSalary,
        szjaAmount: Math.round(baseSalary * 0.15),
        tbBase: baseSalary,
        tbAmount: Math.round(baseSalary * 0.185),
        szochoBase: baseSalary,
        szochoAmount: Math.round(baseSalary * 0.13),
        totalDeductions: Math.round(baseSalary * 0.335),
        netSalary: Math.max(0, Math.round(baseSalary * 0.665)),
        valid: errors.length === 0,
        errors,
        warnings,
      };
    });
  }, []);

  // Excel XML 2003 parsing
  const parseExcelXML = useCallback((text: string): Parsed08Employee[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const rowElements = doc.querySelectorAll('Row');
    if (rowElements.length < 2) return [];

    // Header matching from first row
    const headerCells = rowElements[0].querySelectorAll('Data');
    const headerCols = Array.from(headerCells).map(c =>
      (c.textContent || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_\-]/g, '')
    );

    const findCol = (keywords: string[], fallbackIdx: number): number => {
      const idx = headerCols.findIndex(h => keywords.some(k => h.includes(k)));
      return idx >= 0 ? idx : fallbackIdx;
    };

    const lastNameIdx = findCol(['vezetek', 'csalad', 'surname', 'lastname'], 0);
    const firstNameIdx = findCol(['kereszt', 'firstname', 'utonev'], 1);
    const birthDateIdx = findCol(['szulet', 'birth'], 2);
    const tajIdx = findCol(['taj'], 3);
    const taxIdIdx = findCol(['adoazon', 'adokartya', 'taxid'], 4);
    const jobCodeIdx = findCol(['jogviszony', 'jobcode', 't1041'], 5);
    const startDateIdx = findCol(['belep', 'start', 'kezdet'], 6);
    const feorIdx = findCol(['feor'], 7);
    const weeklyHoursIdx = findCol(['ora', 'hours', 'munkaido'], 8);
    const baseSalaryIdx = findCol(['alapber', 'ber', 'salary', 'brutto'], 9);

    const result: Parsed08Employee[] = [];
    for (let i = 1; i < rowElements.length; i++) {
      const cells = rowElements[i].querySelectorAll('Data');
      const cols = Array.from(cells).map(c => c.textContent?.trim() || '');

      const surname = cols[lastNameIdx] || '';
      const firstName = cols[firstNameIdx] || '';
      const birthDate = normalizeDate(cols[birthDateIdx]);
      const tajNumber = (cols[tajIdx] || '').replace(/[\s-]/g, '');
      const taxId = (cols[taxIdIdx] || '').replace(/[\s-]/g, '');
      const jobCode = cols[jobCodeIdx] || '1101';
      const startDate = normalizeDate(cols[startDateIdx]) || `${new Date().getFullYear()}-01-01`;
      const feor = cols[feorIdx] || '';
      const weeklyHours = parseCleanNumber(cols[weeklyHoursIdx]) || 40;
      const baseSalary = parseCleanNumber(cols[baseSalaryIdx]) || 0;

      if (!surname && !firstName && !tajNumber) continue;

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!surname) errors.push('Vezetéknév hiányzik');
      if (!firstName) errors.push('Keresztnév hiányzik');
      if (!tajNumber && !taxId) errors.push('TAJ-szám vagy adóazonosító kötelező');

      result.push({
        lastName: surname,
        firstName,
        birthDate,
        tajNumber,
        taxId,
        jobCode,
        employmentType: 'munkaviszony',
        startDate,
        feorCode: feor,
        weeklyHours,
        baseSalary,
        grossSalary: baseSalary,
        taxBase: baseSalary,
        szjaAmount: Math.round(baseSalary * 0.15),
        tbBase: baseSalary,
        tbAmount: Math.round(baseSalary * 0.185),
        szochoBase: baseSalary,
        szochoAmount: Math.round(baseSalary * 0.13),
        totalDeductions: Math.round(baseSalary * 0.335),
        netSalary: Math.max(0, Math.round(baseSalary * 0.665)),
        valid: errors.length === 0,
        errors,
        warnings,
      });
    }
    return result;
  }, []);

  // Process Excel / CSV file
  const processExcelFile = useCallback(async (file: File) => {
    try {
      const text = await readTextFileWithEncoding(file);
      if (!text) return;

      let parsed: Parsed08Employee[];
      if (file.name.endsWith('.xls') || file.name.endsWith('.xml')) {
        parsed = parseExcelXML(text);
      } else {
        parsed = parseCSVContent(text);
      }

      if (parsed.length === 0) {
        toast({ title: 'Hiba', description: 'A fájl üres vagy nem megfelelő formátumú. Kérjük használja a sablont.', variant: 'destructive' });
        return;
      }

      setParsedEmployees(parsed);
      setParsed08Doc(null);
      setPhase('preview');
    } catch (err: any) {
      toast({ title: 'Fájlolvasási hiba', description: err.message, variant: 'destructive' });
    }
  }, [parseCSVContent, parseExcelXML, toast]);

  // Process NAV 08 XML file
  const processNav08File = useCallback(async (file: File) => {
    try {
      const text = await readTextFileWithEncoding(file);
      if (!text) return;

      const doc = parseFiling08Xml(text);
      if (doc.parseErrors.length > 0 && doc.employees.length === 0) {
        toast({
          variant: 'destructive',
          title: '08-as XML feldolgozási hiba',
          description: doc.parseErrors.join(', '),
        });
        return;
      }

      setParsed08Doc(doc);
      setParsedEmployees(doc.employees);
      setPhase('preview');
    } catch (err: any) {
      toast({ title: 'XML olvasási hiba', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (activeTab === 'nav08') {
      if (files.length > 1) {
        setPendingFiles(Array.from(files));
        setReconstructionModalOpen(true);
        return;
      }
      processNav08File(files[0]);
    } else {
      processExcelFile(files[0]);
    }
  }, [activeTab, processNav08File, processExcelFile]);

  // Execute Import
  const handleExecuteImport = async () => {
    if (!id) return;
    const validRows = parsedEmployees.filter(r => r.valid);
    if (validRows.length === 0) return;

    setPhase('importing');

    try {
      if (activeTab === 'nav08' && parsed08Doc && createCycleOption) {
        // Rekonstruáljuk a bérszámfejtési ciklust is
        await reconstructCycles({
          companyId: id,
          documents: [parsed08Doc],
          overwriteExisting: true,
        });
      } else {
        // Csak a dolgozókat és jogviszonyaikat importáljuk
        await importEmployees({
          companyId: id,
          employees: validRows,
        });
      }
      setPhase('done');
    } catch {
      setPhase('preview');
    }
  };

  const downloadCSV = () => {
    const csv = TEMPLATE_HEADERS.join(';') + '\n' +
      SAMPLE_ROWS.map(r => r.join(';')).join('\n') + '\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foglalkoztatott_import_sablon.csv';
    a.click();
    URL.revokeObjectURL(url);
    setShowTemplateMenu(false);
  };

  const downloadExcel = () => {
    const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headerCells = TEMPLATE_HEADERS.map(h =>
      `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
    ).join('');
    const dataRows = SAMPLE_ROWS.map(row => {
      const cells = row.map((val, i) => {
        const isNumber = i >= 8;
        return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2E7D32" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Foglalkoztatottak">
    <Table>
      ${TEMPLATE_HEADERS.map(h => `<Column ss:AutoFitWidth="1" ss:Width="120"/>`).join('\n      ')}
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foglalkoztatott_import_sablon.xls';
    a.click();
    URL.revokeObjectURL(url);
    setShowTemplateMenu(false);
  };

  const removeRow = (idx: number) => {
    setParsedEmployees(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/eaisybooks/payroll/${id}/employees`} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dolgozói Tömeges Import Központ</h1>
            <p className="text-sm text-slate-500">Munkavállalók, jogviszonyok és havi bérszámfejtések betöltése</p>
          </div>
        </div>

        {activeTab === 'excel' && (
          <div className="relative">
            <Button
              onClick={() => setShowTemplateMenu(p => !p)}
              variant="outline"
              className="gap-1.5"
            >
              <Download className="w-4 h-4" /> Sablon letöltése <ChevronDown className="w-3 h-3 ml-0.5" />
            </Button>
            {showTemplateMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTemplateMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={downloadExcel}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg">
                      <Table className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Excel sablon (.xls)</p>
                      <p className="text-[11px] text-slate-400">Megnyitható Excelben</p>
                    </div>
                  </button>
                  <div className="border-t border-border" />
                  <button
                    onClick={downloadCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">CSV sablon (.csv)</p>
                      <p className="text-[11px] text-slate-400">Pontosvesszővel elválasztva</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'nav08' && (
          <Button
            onClick={() => setReconstructionModalOpen(true)}
            variant="outline"
            className="gap-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            Többhavi Rekonstrukció (Kötegelt)
          </Button>
        )}
      </div>

      {/* Tabs */}
      {phase === 'upload' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md mx-auto mb-6">
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Excel / CSV Sablon
            </TabsTrigger>
            <TabsTrigger value="nav08" className="gap-2">
              <FileCode className="w-4 h-4" /> NAV 08 (2608 / 2508 / 2408) XML
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Excel / CSV */}
          <TabsContent value="excel" className="space-y-4">
            <div
              className={cn(
                'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer bg-card',
                dragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 scale-[1.01]' : 'border-border hover:border-emerald-400'
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                Húzd ide az Excel vagy CSV fájlt
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Támogatott: .xlsx, .xls, .csv — Automatikusan létrehozza a dolgozót és az aktív jogviszonyt
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processExcelFile(f);
                  if (e.target) e.target.value = '';
                }}
              />
            </div>
          </TabsContent>

          {/* Tab 2: NAV 08 XML */}
          <TabsContent value="nav08" className="space-y-4">
            <div
              className={cn(
                'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer bg-card',
                dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.01]' : 'border-border hover:border-blue-400'
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => xmlFileRef.current?.click()}
            >
              <FileCode className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                Húzd ide a NAV 08 (2608 / 2508 / 2408) ÁNYK XML fájlt
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Kinyeri az összes dolgozót (08M lapok), jogviszonyt és a lejelentett havi bérszámfejtési adatokat
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span>Több havi XML fájl egyidejű feldolgozásához húzz be több fájlt egyszerre vagy kattints a fenti gombra</span>
              </div>
              <input
                ref={xmlFileRef}
                type="file"
                accept=".xml,.XML"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  if (files.length > 1) {
                    setPendingFiles(Array.from(files));
                    setReconstructionModalOpen(true);
                  } else {
                    processNav08File(files[0]);
                  }
                  if (e.target) e.target.value = '';
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Preview Phase */}
      {phase === 'preview' && (
        <div className="space-y-6">
          {/* NAV 08 Banner / Info if applicable */}
          {parsed08Doc && plan && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white font-mono">
                      NAV {parsed08Doc.filingType}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {parsed08Doc.companyName || 'Beolvasott cégadatok'} — {parsed08Doc.year}. {parsed08Doc.month}. hónap
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Adószám: {parsed08Doc.companyTaxNumber || 'Nincs megadva'} | {parsed08Doc.employeeCount} biztosított M-lapja feldolgozva
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200/60 dark:border-blue-800/40">
                  <input
                    type="checkbox"
                    id="createCycleCheck"
                    checked={createCycleOption}
                    onChange={e => setCreateCycleOption(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="createCycleCheck" className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                    Havi számfejtési ciklus felépítése erre a hónapra ({parsed08Doc.year}/{parsed08Doc.month})
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-blue-200/60 dark:border-blue-800/40 text-xs">
                <div>
                  <span className="text-slate-500">Összes Bruttó Bér:</span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{parsed08Doc.totalGrossSalary.toLocaleString('hu-HU')} Ft</p>
                </div>
                <div>
                  <span className="text-slate-500">Levont SZJA (15%):</span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{parsed08Doc.totalSzja.toLocaleString('hu-HU')} Ft</p>
                </div>
                <div>
                  <span className="text-slate-500">Levont TB (18,5%):</span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{parsed08Doc.totalTb.toLocaleString('hu-HU')} Ft</p>
                </div>
                <div>
                  <span className="text-slate-500">Fizetendő SZOCHO (13%):</span>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{parsed08Doc.totalSzocho.toLocaleString('hu-HU')} Ft</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{parsedEmployees.length}</p>
                <p className="text-xs text-slate-500">Összes dolgozó</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-600">{validCount}</p>
                <p className="text-xs text-slate-500">Érvényes & menthető</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                <p className="text-xs text-slate-500">Hibás sor</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between dark:bg-slate-900/30">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Importálandó Dolgozók és Jogviszonyok</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhase('upload');
                  setParsedEmployees([]);
                  setParsed08Doc(null);
                }}
                className="gap-1 text-xs"
              >
                <RefreshCw className="w-3 h-3" /> Új fájl választása
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:bg-slate-900/20">
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">#</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">Név</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">Szül. dátum</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">TAJ</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">Adóaz.</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">Jogv.</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">Kezdés</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">FEOR</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-right">Bruttó Bér</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-right">Nettó</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">Státusz</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {parsedEmployees.map((row, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        'border-b border-border/50 transition-colors',
                        row.valid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-red-50/50 dark:bg-red-500/5'
                      )}
                    >
                      <td className="px-3 py-2.5 text-center text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium">{row.lastName} {row.firstName}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.birthDate || '–'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.tajNumber || '–'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.taxId || '–'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">{row.jobCode}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{row.startDate}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{row.feorCode || '–'}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono font-semibold">
                        {(row.baseSalary || row.grossSalary).toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        {row.netSalary.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.valid ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <div className="group relative inline-block">
                            <AlertTriangle className="w-4 h-4 text-red-500 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-red-900 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {row.errors.join(' | ')}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(idx)}
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-between items-center">
            {errorCount > 0 && (
              <div className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {errorCount} hibás sor nem kerül importálásra
              </div>
            )}
            <div className="flex gap-3 ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setPhase('upload');
                  setParsedEmployees([]);
                  setParsed08Doc(null);
                }}
              >
                Mégse
              </Button>
              <Button
                onClick={handleExecuteImport}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                disabled={validCount === 0 || isProcessing}
              >
                <Upload className="w-4 h-4" />
                {parsed08Doc && createCycleOption
                  ? `${validCount} dolgozó & ${parsed08Doc.year}/${parsed08Doc.month}. számfejtés rekonstruálása`
                  : `${validCount} dolgozó és jogviszony importálása`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Importing Phase */}
      {phase === 'importing' && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Importálás és Rekonstrukció folyamatban...</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {progress.message || `${validCount} dolgozó és kapcsolódó adatok rögzítése a rendszerben...`}
          </p>
        </div>
      )}

      {/* Done Phase */}
      {phase === 'done' && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center space-y-5">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-full inline-block">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sikeres Betöltés!</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            A dolgozói törzsadatok és az aktív jogviszonyok (alapbér, jogviszonykód, FEOR) sikeresen elmentve.
            {parsed08Doc && createCycleOption && ' A havi bérszámfejtési ciklus és a kalkulációs adatok is felépültek.'}
          </p>

          <div className="flex gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setPhase('upload');
                setParsedEmployees([]);
                setParsed08Doc(null);
              }}
            >
              Új importálás
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Link to={`/eaisybooks/payroll/${id}/employees`}>
                Tovább a dolgozókhoz <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Kötegelt többhavi bérszámfejtés rekonstrukciós modál */}
      <PayrollReconstructionDialog
        companyId={id}
        open={reconstructionModalOpen}
        onOpenChange={(isOpen) => {
          setReconstructionModalOpen(isOpen);
          if (!isOpen) setPendingFiles([]);
        }}
        initialFiles={pendingFiles}
      />
    </div>
  );
}
