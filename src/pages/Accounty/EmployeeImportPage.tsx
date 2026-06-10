import React, { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, XCircle,
  AlertTriangle, Loader2, Trash2, Users, Eye, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const SAMPLE_DATA: ImportRow[] = [
  { id: 1, surname: 'Nagy', firstName: 'Anna', birthDate: '1985-03-15', tajNumber: '123 456 789', taxId: '8765432109', jobCode: '1101', startDate: '2026-01-02', feor: '2411', weeklyHours: '40', baseSalary: '450000', valid: true, errors: [] },
  { id: 2, surname: 'Kiss', firstName: 'Béla', birthDate: '1990-07-22', tajNumber: '987 654 321', taxId: '1234567890', jobCode: '1101', startDate: '2026-02-01', feor: '3312', weeklyHours: '40', baseSalary: '380000', valid: true, errors: [] },
  { id: 3, surname: 'Tóth', firstName: 'Éva', birthDate: '', tajNumber: '111 222 333', taxId: '5555555555', jobCode: '1101', startDate: '2026-03-01', feor: '4110', weeklyHours: '20', baseSalary: '200000', valid: false, errors: ['Születési dátum hiányzik'] },
  { id: 4, surname: 'Szabó', firstName: 'Péter', birthDate: '1978-11-30', tajNumber: '444 555 666', taxId: '9999888877', jobCode: '1115', startDate: '2026-01-15', feor: '2412', weeklyHours: '36', baseSalary: '520000', valid: true, errors: [] },
  { id: 5, surname: 'Horváth', firstName: '', birthDate: '1995-05-10', tajNumber: '777 888', taxId: '3334445556', jobCode: '1101', startDate: '2026-04-01', feor: '3119', weeklyHours: '40', baseSalary: '322800', valid: false, errors: ['Keresztnév hiányzik', 'TAJ szám formátum hibás (9 jegy szükséges)'] },
];

const TEMPLATE_HEADERS = ['Vezetéknév', 'Keresztnév', 'Születési dátum', 'TAJ-szám', 'Adóazonosító jel', 'Jogviszonykód', 'Belépés dátuma', 'FEOR', 'Heti óraszám', 'Alapbér (Ft)'];

export default function EmployeeImportPage() {
  const { id } = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragging, setDragging] = useState(false);

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.filter(r => !r.valid).length;

  const handleFileSelect = useCallback(() => {
    // Simulate parsing — use SAMPLE_DATA
    setRows(SAMPLE_DATA);
    setPhase('preview');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect();
  }, [handleFileSelect]);

  const handleImport = () => {
    setPhase('importing');
    setTimeout(() => setPhase('done'), 2500);
  };

  const handleDownloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(';') + '\n' + 
      'Nagy;Anna;1985-03-15;123 456 789;8765432109;1101;2026-01-02;2411;40;450000\n' +
      'Kiss;Béla;1990-07-22;987 654 321;1234567890;1101;2026-02-01;3312;40;380000\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foglalkoztatott_import_sablon.csv';
    a.click();
    URL.revokeObjectURL(url);
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
        <Button onClick={handleDownloadTemplate} variant="outline" className="gap-1.5">
          <Download className="w-4 h-4" /> Sablon letöltése
        </Button>
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
            <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
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
                  <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
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
