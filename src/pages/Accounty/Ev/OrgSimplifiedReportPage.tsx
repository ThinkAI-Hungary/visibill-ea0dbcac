import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, FileText, Download, Printer,
  CheckCircle2, AlertTriangle, Info, Calendar, Scale,
  ArrowRight, Eye, Lock, BarChart2, TrendingUp, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useOrgReportLines } from '@/hooks/useEvData';

// ─── Report Section types ───────────────────────────────────────────────────

interface BalanceSheetRow {
  name: string;
  currentYear: number;
  previousYear: number;
  indent?: boolean;
}

interface IncomeStatementRow {
  name: string;
  currentYear: number;
  previousYear: number;
  indent?: boolean;
  bold?: boolean;
}

interface ReportStep {
  id: number;
  name: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
}

export default function OrgSimplifiedReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [activeView, setActiveView] = useState<'balance' | 'income'>('balance');
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');

  // Fetch report lines from DB
  const { data: dbReportLines = [] } = useOrgReportLines(id, taxYear);

  // Map DB lines to component-level arrays
  const ASSETS = useMemo<BalanceSheetRow[]>(() =>
    dbReportLines
      .filter(l => l.report_type === 'balance_asset')
      .map(l => ({ name: l.line_name, currentYear: Number(l.current_year_amount) || 0, previousYear: Number(l.previous_year_amount) || 0, indent: l.indent_level > 0 })),
    [dbReportLines]
  );

  const LIABILITIES = useMemo<BalanceSheetRow[]>(() =>
    dbReportLines
      .filter(l => l.report_type === 'balance_liability')
      .map(l => ({ name: l.line_name, currentYear: Number(l.current_year_amount) || 0, previousYear: Number(l.previous_year_amount) || 0, indent: l.indent_level > 0 })),
    [dbReportLines]
  );

  const INCOME_STATEMENT = useMemo<IncomeStatementRow[]>(() =>
    dbReportLines
      .filter(l => l.report_type === 'income_statement')
      .map(l => ({ name: l.line_name, currentYear: Number(l.current_year_amount) || 0, previousYear: Number(l.previous_year_amount) || 0, indent: l.indent_level > 0, bold: l.is_bold })),
    [dbReportLines]
  );

  const steps: ReportStep[] = [
    { id: 1, name: 'Adatok ellenőrzése', description: 'Főkönyvi és analitikus adatok egyeztetése', status: 'completed' },
    { id: 2, name: 'Mérleg összeállítása', description: 'Egyszerűsített mérleg sorai', status: 'completed' },
    { id: 3, name: 'Eredménykimutatás', description: 'Összköltség eljárással', status: 'current' },
    { id: 4, name: 'Kiegészítő melléklet', description: 'Számszaki tájékoztató rész', status: 'pending' },
    { id: 5, name: 'Véglegesítés & Export', description: 'PDF generálás és letétbe helyezés', status: 'pending' },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Egyszerűsített beszámoló</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Egyszerűsített éves beszámoló</h1>
            <p className="text-sm text-slate-500">
              {client?.name || 'Szervezet'} · {taxYear}. üzleti év · Szt. 96-98. §
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Eye className="w-3 h-3" /> Előnézet
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Printer className="w-3 h-3" /> Nyomtatás
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
            <Download className="w-3 h-3" /> PDF Export
          </button>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Beszámoló készítés állapota</h3>
        <div className="flex items-center gap-0">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                  step.status === 'completed' ? 'bg-green-500 text-white'
                    : step.status === 'current' ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                )}>
                  {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <div className="text-center">
                  <p className={cn('text-[10px] font-semibold',
                    step.status === 'current' ? 'text-primary' : step.status === 'completed' ? 'text-green-600' : 'text-slate-400'
                  )}>{step.name}</p>
                  <p className="text-[9px] text-slate-400 hidden md:block">{step.description}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-1 mx-1 rounded-full mt-[-20px]',
                  step.status === 'completed' ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: 'balance' as const, label: 'Egyszerűsített mérleg', icon: BarChart2 },
          { id: 'income' as const, label: 'Eredménykimutatás', icon: TrendingUp },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px]',
              activeView === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Balance Sheet */}
      {activeView === 'balance' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Assets */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-blue-50 dark:bg-blue-900/10">
              <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Eszközök (Aktívák)</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-left w-1/2">Megnevezés</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Tárgyév (Ft)</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Előző év (Ft)</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Változás</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {ASSETS.map((row, i) => {
                  const isTotal = row.name.includes('ÖSSZESEN');
                  const change = row.previousYear !== 0 ? ((row.currentYear - row.previousYear) / row.previousYear * 100) : 0;
                  return (
                    <tr key={i} className={cn(
                      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                      isTotal && 'bg-slate-50 dark:bg-slate-900/30 font-bold'
                    )}>
                      <td className={cn('px-4 py-2 text-sm', row.indent ? 'pl-8 text-slate-500' : 'font-semibold text-slate-900 dark:text-slate-100', isTotal && 'font-bold')}>
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">{formatHuf(row.currentYear)}</td>
                      <td className="px-4 py-2 text-sm font-mono tabular-nums text-right text-slate-400">{formatHuf(row.previousYear)}</td>
                      <td className={cn('px-4 py-2 text-xs font-mono tabular-nums text-right', change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-400')}>
                        {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Liabilities */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-violet-50 dark:bg-violet-900/10">
              <h3 className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">Források (Passzívák)</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-left w-1/2">Megnevezés</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Tárgyév (Ft)</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Előző év (Ft)</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Változás</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {LIABILITIES.map((row, i) => {
                  const isTotal = row.name.includes('ÖSSZESEN');
                  const change = row.previousYear !== 0 ? ((row.currentYear - row.previousYear) / row.previousYear * 100) : 0;
                  return (
                    <tr key={i} className={cn(
                      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                      isTotal && 'bg-slate-50 dark:bg-slate-900/30 font-bold'
                    )}>
                      <td className={cn('px-4 py-2 text-sm', row.indent ? 'pl-8 text-slate-500' : 'font-semibold text-slate-900 dark:text-slate-100', isTotal && 'font-bold')}>
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">{formatHuf(row.currentYear)}</td>
                      <td className="px-4 py-2 text-sm font-mono tabular-nums text-right text-slate-400">{formatHuf(row.previousYear)}</td>
                      <td className={cn('px-4 py-2 text-xs font-mono tabular-nums text-right', change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-400')}>
                        {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Income Statement */}
      {activeView === 'income' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden animate-in fade-in duration-300">
          <div className="px-4 py-3 border-b border-border bg-emerald-50 dark:bg-emerald-900/10">
            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Eredménykimutatás (összköltség eljárás)</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-left w-1/2">Megnevezés</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Tárgyév (Ft)</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Előző év (Ft)</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">Változás</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {INCOME_STATEMENT.map((row, i) => {
                const change = row.previousYear !== 0 ? ((row.currentYear - row.previousYear) / row.previousYear * 100) : 0;
                return (
                  <tr key={i} className={cn(
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                    row.bold && 'bg-slate-50 dark:bg-slate-900/30'
                  )}>
                    <td className={cn('px-4 py-2 text-sm',
                      row.indent ? 'pl-8 text-slate-500 italic' : row.bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'
                    )}>
                      {row.name}
                    </td>
                    <td className={cn('px-4 py-2 text-sm font-mono tabular-nums text-right', row.bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300')}>
                      {formatHuf(row.currentYear)}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono tabular-nums text-right text-slate-400">{formatHuf(row.previousYear)}</td>
                    <td className={cn('px-4 py-2 text-xs font-mono tabular-nums text-right', change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-400')}>
                      {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legal info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Számviteli törvény 96-98. § — Egyszerűsített éves beszámoló</p>
            <p>Egyszerűsített éves beszámolót készíthet a kettős könyvvitelt vezető vállalkozó, ha két egymást követő üzleti évben az alábbi 3 mutatóérték közül bármelyik kettő nem haladja meg a határértéket: mérlegfőösszeg 1.200 M Ft, nettó árbevétel 2.400 M Ft, létszám 50 fő.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
