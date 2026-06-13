import React, { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, XCircle,
  AlertTriangle, Loader2, Trash2, Users, Eye, RefreshCw, ChevronDown,
  FileText, Table
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCreateEmployee } from '@/hooks/usePayrollData';

interface ImportRow {
  id: number;
  surname: string;
  firstName: string;
  birthDate: string;
  tajNumber: string;
  taxId: string;
  jobCode: string;
  startDate: string;
  feor: string;
  weeklyHours: string;
  baseSalary: string;
  valid: boolean;
  errors: string[];
}


const TEMPLATE_HEADERS = ['Vezetéknév', 'Keresztnév', 'Születési dátum', 'TAJ-szám', 'Adóazonosító jel', 'Jogviszonykód', 'Belépés dátuma', 'FEOR', 'Heti óraszám', 'Alapbér (Ft)'];

const SAMPLE_ROWS = [
  ['Nagy', 'Anna', '1985-03-15', '123 456 789', '8765432109', '1101', '2026-01-02', '2411', '40', '450000'],
  ['Kiss', 'Béla', '1990-07-22', '987 654 321', '1234567890', '1101', '2026-02-01', '3312', '40', '380000'],
];

export default function EmployeeImportPage() {
  const { id } = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.filter(r => !r.valid).length;

  const parseCSVContent = useCallback((text: string) => {
    // Remove BOM if present
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return []; // header only or empty

    // Detect delimiter (semicolon or comma)
    const header = lines[0];
    const delimiter = header.includes(';') ? ';' : ',';

    // Skip header row
    const dataLines = lines.slice(1);
    return dataLines.map((line, idx) => {
      const cols = line.split(delimiter).map(c => c.trim());
      const surname = cols[0] || '';
      const firstName = cols[1] || '';
      const birthDate = cols[2] || '';
      const tajNumber = cols[3] || '';
      const taxId = cols[4] || '';
      const jobCode = cols[5] || '';
      const startDate = cols[6] || '';
      const feor = cols[7] || '';
      const weeklyHours = cols[8] || '';
      const baseSalary = cols[9] || '';

      const errors: string[] = [];
      if (!surname) errors.push('Vezetéknév hiányzik');
      if (!firstName) errors.push('Keresztnév hiányzik');
      if (!birthDate) errors.push('Születési dátum hiányzik');
      const tajClean = tajNumber.replace(/[\s-]/g, '');
      if (tajClean && tajClean.length !== 9) errors.push('TAJ szám formátum hibás (9 jegy szükséges)');
      if (!tajClean) errors.push('TAJ-szám hiányzik');
      if (!taxId) errors.push('Adóazonosító hiányzik');
      if (!startDate) errors.push('Belépés dátuma hiányzik');

      return {
        id: idx + 1,
        surname,
        firstName,
        birthDate,
        tajNumber,
        taxId,
        jobCode,
        startDate,
        feor,
        weeklyHours,
        baseSalary,
        valid: errors.length === 0,
        errors,
      } as ImportRow;
    });
  }, []);

  const parseExcelXML = useCallback((text: string): ImportRow[] => {
    // Parse XML Spreadsheet 2003 format
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const rowElements = doc.querySelectorAll('Row');
    if (rowElements.length < 2) return [];

    const dataRows: ImportRow[] = [];
    // Skip first row (header)
    for (let i = 1; i < rowElements.length; i++) {
      const cells = rowElements[i].querySelectorAll('Data');
      const cols = Array.from(cells).map(c => c.textContent?.trim() || '');

      const surname = cols[0] || '';
      const firstName = cols[1] || '';
      const birthDate = cols[2] || '';
      const tajNumber = cols[3] || '';
      const taxId = cols[4] || '';
      const jobCode = cols[5] || '';
      const startDate = cols[6] || '';
      const feor = cols[7] || '';
      const weeklyHours = cols[8] || '';
      const baseSalary = cols[9] || '';

      // Skip completely empty rows
      if (!surname && !firstName && !tajNumber) continue;

      const errors: string[] = [];
      if (!surname) errors.push('Vezetéknév hiányzik');
      if (!firstName) errors.push('Keresztnév hiányzik');
      if (!birthDate) errors.push('Születési dátum hiányzik');
      const tajClean = tajNumber.replace(/[\s-]/g, '');
      if (tajClean && tajClean.length !== 9) errors.push('TAJ szám formátum hibás (9 jegy szükséges)');
      if (!tajClean) errors.push('TAJ-szám hiányzik');
      if (!taxId) errors.push('Adóazonosító hiányzik');
      if (!startDate) errors.push('Belépés dátuma hiányzik');

      dataRows.push({
        id: i,
        surname,
        firstName,
        birthDate,
        tajNumber,
        taxId,
        jobCode,
        startDate,
        feor,
        weeklyHours,
        baseSalary,
        valid: errors.length === 0,
        errors,
      });
    }
    return dataRows;
  }, []);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      let parsed: ImportRow[];
      if (file.name.endsWith('.xls') || file.name.endsWith('.xml')) {
        parsed = parseExcelXML(text);
      } else {
        parsed = parseCSVContent(text);
      }

      if (parsed.length === 0) {
        alert('A fájl üres vagy nem megfelelő formátumú. Kérjük használja a sablont.');
        return;
      }

      setRows(parsed);
      setPhase('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }, [parseCSVContent, parseExcelXML]);

  const handleFileSelect = useCallback((e?: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0] || fileRef.current?.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const createEmployee = useCreateEmployee();

  const handleImport = async () => {
    if (!id) return;
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setPhase('importing');
    try {
      for (const row of validRows) {
        await createEmployee.mutateAsync({
          company_id: id,
          first_name: row.firstName,
          last_name: row.surname,
          birth_name: null,
          birth_place: null,
          birth_date: row.birthDate || null,
          mothers_name: null,
          gender: null,
          nationality: 'magyar',
          taj_number: row.tajNumber || null,
          tax_id: row.taxId || null,
          id_card_number: null,
          address: null,
          temp_address: null,
          email: null,
          phone: null,
          bank_account: null,
          iban: null,
          status: 'active',
          avatar_url: null,
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
    // Generate XML Spreadsheet 2003 format (.xlsx compatible)
    const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headerCells = TEMPLATE_HEADERS.map(h =>
      `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
    ).join('');
    const dataRows = SAMPLE_ROWS.map(row => {
      const cells = row.map((val, i) => {
        const isNumber = i >= 8; // weeklyHours, baseSalary
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

  const removeRow = (rowId: number) => setRows(prev => prev.filter(r => r.id !== rowId));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/employees`} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/25">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Excel importálás</h1>
            <p className="text-sm text-slate-500">Foglalkoztatottak tömeges felvitele CSV/Excel fájlból</p>
          </div>
        </div>
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
                    <p className="text-[11px] text-slate-400">Pontosvesszővel elválasztva, UTF-8</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload phase */}
      {phase === 'upload' && (
        <div className="space-y-4">
          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer',
              dragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 scale-[1.01]' : 'border-border hover:border-emerald-400'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
              Húzd ide a fájlt vagy kattints a tallózáshoz
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Támogatott formátumok: .csv, .xlsx, .xls — Max. 500 sor
            </p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Instructions */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Importálási útmutató</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>1.</strong> Töltse le a sablont a fenti gombbal
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>2.</strong> Töltse ki az adatokat a megfelelő oszlopokba
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>3.</strong> Töltse fel a kitöltött fájlt
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  <strong>4.</strong> Ellenőrizze az adatokat, majd importáljon
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {TEMPLATE_HEADERS.map(h => (
                <div key={h} className="text-xs bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-center text-slate-600 dark:text-slate-400 font-mono">{h}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview phase */}
      {phase === 'preview' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{rows.length}</p>
                <p className="text-xs text-slate-500">Összes sor</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-600">{validCount}</p>
                <p className="text-xs text-slate-500">Érvényes</p>
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

          {/* Data table */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Importálandó adatok előnézete</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPhase('upload'); setRows([]); }} className="gap-1 text-xs">
                  <RefreshCw className="w-3 h-3" /> Új fájl
                </Button>
              </div>
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
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-left">Belépés</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">FEOR</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-right">Alapbér</th>
                    <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">Státusz</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className={cn(
                      'border-b border-border/50 transition-colors',
                      row.valid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-red-50/50 dark:bg-red-500/5'
                    )}>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-400">{row.id}</td>
                      <td className="px-3 py-2.5 font-medium">{row.surname} {row.firstName}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.birthDate || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.tajNumber}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">{row.taxId}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">{row.jobCode}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{row.startDate}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{row.feor}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-mono">{Number(row.baseSalary).toLocaleString('hu-HU')} Ft</td>
                      <td className="px-3 py-2.5 text-center">
                        {row.valid ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <div className="group relative">
                            <AlertTriangle className="w-4 h-4 text-red-500 mx-auto cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-red-900 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {row.errors.join(' | ')}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button */}
          <div className="flex justify-between items-center">
            {errorCount > 0 && (
              <div className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {errorCount} hibás sor nem kerül importálásra
              </div>
            )}
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={() => { setPhase('upload'); setRows([]); }}>Mégse</Button>
              <Button onClick={handleImport} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={validCount === 0}>
                <Upload className="w-4 h-4" /> {validCount} foglalkoztatott importálása
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Importing phase */}
      {phase === 'importing' && (
        <div className="bg-card rounded-xl border border-border p-16 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 animate-spin" />
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Importálás folyamatban...</p>
          <p className="text-sm text-slate-400 mt-2">{validCount} foglalkoztatott hozzáadása a rendszerhez</p>
        </div>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <div className="bg-card rounded-xl border border-border p-16 text-center space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-full inline-block">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import sikeres!</h2>
          <p className="text-sm text-slate-500">{validCount} foglalkoztatott sikeresen hozzáadva a rendszerhez.</p>
          {errorCount > 0 && (
            <p className="text-sm text-yellow-600">{errorCount} sor kihagyva hibák miatt.</p>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <Button variant="outline" onClick={() => { setPhase('upload'); setRows([]); }}>Új importálás</Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link to={`/accounty/payroll/${id}/employees`}>Vissza a listához</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
