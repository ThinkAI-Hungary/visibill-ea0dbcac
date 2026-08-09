import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Wrench, Plus, Trash2, GripVertical, Download, Eye,
  Save, Filter, Columns, CheckCircle, Table, BarChart3, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { usePayrollEmployees } from '@/hooks/usePayrollData';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

interface ColumnDef {
  id: string;
  label: string;
  category: string;
  selected: boolean;
}

// Column definitions are config/schema, not user data — they stay as constants
const AVAILABLE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Név', category: 'Személyes', selected: true },
  { id: 'taxId', label: 'Adóazonosító', category: 'Személyes', selected: false },
  { id: 'tajNumber', label: 'TAJ szám', category: 'Személyes', selected: true },
  { id: 'birthDate', label: 'Születési dátum', category: 'Személyes', selected: false },
  { id: 'age', label: 'Életkor', category: 'Személyes', selected: false },
  { id: 'jobCode', label: 'Jogviszonykód', category: 'Jogviszony', selected: true },
  { id: 'position', label: 'Munkakör', category: 'Jogviszony', selected: true },
  { id: 'feor', label: 'FEOR-kód', category: 'Jogviszony', selected: false },
  { id: 'startDate', label: 'Belépés dátuma', category: 'Jogviszony', selected: false },
  { id: 'weeklyHours', label: 'Heti munkaidő', category: 'Jogviszony', selected: false },
  { id: 'site', label: 'Telephely', category: 'Jogviszony', selected: false },
  { id: 'costCenter', label: 'Költséghely', category: 'Jogviszony', selected: false },
  { id: 'grossSalary', label: 'Bruttó bér', category: 'Bér', selected: true },
  { id: 'netSalary', label: 'Nettó bér', category: 'Bér', selected: true },
  { id: 'szja', label: 'SZJA', category: 'Bér', selected: false },
  { id: 'tbJarulék', label: 'TB járulék', category: 'Bér', selected: false },
  { id: 'szocho', label: 'SZOCHO', category: 'Bér', selected: false },
  { id: 'familyBenefit', label: 'Családi kedvezmény', category: 'Bér', selected: false },
  { id: 'totalCost', label: 'Teljes bérköltség', category: 'Bér', selected: false },
  { id: 'leaveTotal', label: 'Szabadság keret', category: 'Szabadság', selected: false },
  { id: 'leaveUsed', label: 'Felhasznált szabadság', category: 'Szabadság', selected: false },
  { id: 'leaveRemaining', label: 'Maradék szabadság', category: 'Szabadság', selected: false },
  { id: 'sickDays', label: 'Betegnapok', category: 'Szabadság', selected: false },
];

interface FilterDef {
  column: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains';
  value: string;
}

export default function CustomReportBuilderPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId;
  const [columns, setColumns] = useState(AVAILABLE_COLUMNS);
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [reportName, setReportName] = useState('Egyedi riport');
  const [showColumnPicker, setShowColumnPicker] = useState(true);
  const [generated, setGenerated] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: employees = [] } = usePayrollEmployees(id || '');

  const selectedColumns = columns.filter(c => c.selected);
  const categories = [...new Set(AVAILABLE_COLUMNS.map(c => c.category))];

  const toggleColumn = (colId: string) => setColumns(prev => prev.map(c => c.id === colId ? { ...c, selected: !c.selected } : c));

  const addFilter = () => setFilters(prev => [...prev, { column: columns[0].id, operator: 'eq', value: '' }]);
  const removeFilter = (idx: number) => setFilters(prev => prev.filter((_, i) => i !== idx));

  const handleGenerate = () => { setGenerated(true); setShowColumnPicker(false); };

  const COLUMN_ACCESSOR: Record<string, (e: any) => string> = {
    name: e => e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || '–',
    taxId: e => e.tax_id || '–',
    tajNumber: e => e.taj_number || '–',
    birthDate: e => e.birth_date ? new Date(e.birth_date).toLocaleDateString('hu-HU') : '–',
    age: e => e.birth_date ? String(new Date().getFullYear() - new Date(e.birth_date).getFullYear()) : '–',
    jobCode: e => e.job_code || '–',
    position: e => e.position || '–',
    feor: e => e.feor || '–',
    startDate: e => e.start_date ? new Date(e.start_date).toLocaleDateString('hu-HU') : '–',
    weeklyHours: e => e.weekly_hours != null ? String(e.weekly_hours) : '40',
    site: e => e.site || '–',
    costCenter: e => e.cost_center || '–',
    grossSalary: e => e.base_salary != null ? Number(e.base_salary).toLocaleString('hu-HU') + ' Ft' : '–',
    netSalary: e => e.base_salary != null ? Math.round(Number(e.base_salary) * 0.665).toLocaleString('hu-HU') + ' Ft' : '–',
    szja: e => e.base_salary != null ? Math.round(Number(e.base_salary) * 0.15).toLocaleString('hu-HU') + ' Ft' : '–',
    tbJarék: e => e.base_salary != null ? Math.round(Number(e.base_salary) * 0.185).toLocaleString('hu-HU') + ' Ft' : '–',
    szocho: e => e.base_salary != null ? Math.round(Number(e.base_salary) * 0.13).toLocaleString('hu-HU') + ' Ft' : '–',
    familyBenefit: e => '–',
    totalCost: e => e.base_salary != null ? Math.round(Number(e.base_salary) * 1.13).toLocaleString('hu-HU') + ' Ft' : '–',
    leaveTotal: e => e.leave_total != null ? String(e.leave_total) : '20',
    leaveUsed: e => e.leave_used != null ? String(e.leave_used) : '0',
    leaveRemaining: e => String((e.leave_total || 20) - (e.leave_used || 0)),
    sickDays: e => e.sick_days != null ? String(e.sick_days) : '0',
  };

  const reportRows = useMemo(() => {
    if (!generated) return [];
    return employees.map((emp: any) =>
      selectedColumns.map(col => (COLUMN_ACCESSOR[col.id] || (() => '–'))(emp))
    );
  }, [generated, employees, selectedColumns]);

  const totalItems = reportRows.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedReportRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reportRows.slice(start, start + pageSize);
  }, [reportRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportRows.length]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg"><Wrench className="w-5 h-5 text-white" /></div>
          <div>
            <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} className="text-2xl font-bold bg-transparent border-none outline-none focus:underline" />
            <p className="text-sm text-slate-500">Egyedi mezőválogatás és szűrők</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowColumnPicker(!showColumnPicker)} className="gap-1.5"><Columns className="w-4 h-4" /> Oszlopok ({selectedColumns.length})</Button>
          {generated && <ExportButton
            filename={reportName.replace(/\s+/g, '_')}
            headers={selectedColumns.map(c => c.label)}
            getRows={() => reportRows}
            size="sm"
          />}
          <Button onClick={handleGenerate} className="gap-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800">
            <Table className="w-4 h-4" /> Generálás
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr,auto] gap-4">
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Filter className="w-4 h-4" /> Szűrők</h3>
              <Button variant="outline" size="sm" onClick={addFilter} className="gap-1 text-xs"><Plus className="w-3 h-3" /> Szűrő</Button>
            </div>
            {filters.length === 0 && <p className="text-xs text-slate-400">Nincs szűrő — minden adat megjelenik</p>}
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={f.column} onChange={e => setFilters(prev => prev.map((ff, ii) => ii === i ? { ...ff, column: e.target.value } : ff))} className="px-2 py-1.5 rounded border border-border bg-background text-xs flex-1">
                  {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select value={f.operator} onChange={e => setFilters(prev => prev.map((ff, ii) => ii === i ? { ...ff, operator: e.target.value as any } : ff))} className="px-2 py-1.5 rounded border border-border bg-background text-xs w-24">
                  <option value="eq">egyenlő</option><option value="gt">nagyobb mint</option><option value="lt">kisebb mint</option><option value="contains">tartalmazza</option>
                </select>
                <input type="text" value={f.value} onChange={e => setFilters(prev => prev.map((ff, ii) => ii === i ? { ...ff, value: e.target.value } : ff))} placeholder="Érték" className="px-2 py-1.5 rounded border border-border bg-background text-xs flex-1" />
                <Button variant="ghost" size="sm" onClick={() => removeFilter(i)} className="h-7 w-7 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>

          {/* Generated report */}
          {generated && (
            reportRows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
                <Database className="w-12 h-12 mx-auto text-slate-300" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{reportName}</h3>
                <p className="text-sm text-slate-400">Nincs riport adat a kiválasztott oszlopokhoz ({selectedColumns.length} oszlop).</p>
                <p className="text-xs text-slate-400">A riport adatok a bérszámfejtés véglegesítése után állnak rendelkezésre.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{reportName} — {reportRows.length} sor</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border dark:bg-slate-900/30">
                        {selectedColumns.map(col => (
                          <th key={col.id} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginatedReportRows.map((row, ri) => (
                        <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="border-t border-border px-4 py-3 bg-card">
                    <UnifiedPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={setPageSize}
                      pageSizeOptions={[10, 25, 50]}
                    />
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Column picker */}
        {showColumnPicker && (
          <div className="w-64 bg-card rounded-xl border border-border p-4 h-fit sticky top-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Oszlopválasztó</h3>
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">{cat}</p>
                <div className="space-y-0.5">
                  {columns.filter(c => c.category === cat).map(col => (
                    <label key={col.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs">
                      <input type="checkbox" checked={col.selected} onChange={() => toggleColumn(col.id)} className="rounded" />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
