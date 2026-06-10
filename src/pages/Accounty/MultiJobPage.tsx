import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Plus, Briefcase, Shield, CheckCircle, AlertTriangle,
  Clock, Calendar, Hash, ChevronRight, Eye, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JobRelation {
  id: string;
  jobCode: string;
  jobCodeLabel: string;
  seqNum: number; // Jogviszonysorszám
  position: string;
  feor: string;
  weeklyHours: number;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  status: 'active' | 'terminated' | 'suspended';
  insured: boolean;
  minimumBase: boolean;
  employer?: string; // For multi-employer
}

interface InsuranceResult {
  totalHours: number;
  insuredJobs: number;
  minimumBaseApplies: boolean;
  combinedMinBase: number;
  notes: string[];
}

const MOCK_JOBS: JobRelation[] = [
  {
    id: 'j1', jobCode: '1101', jobCodeLabel: 'Munkaviszony (általános)', seqNum: 1,
    position: 'Pénzügyi elemző', feor: '2411', weeklyHours: 40, startDate: '2024-01-02',
    endDate: null, baseSalary: 450000, status: 'active', insured: true, minimumBase: true,
  },
  {
    id: 'j2', jobCode: '1115', jobCodeLabel: 'Tartós megbízási jogviszony', seqNum: 2,
    position: 'Adótanácsadó', feor: '2412', weeklyHours: 10, startDate: '2025-06-01',
    endDate: null, baseSalary: 150000, status: 'active', insured: true, minimumBase: false,
    employer: 'Másik Cég Kft.',
  },
  {
    id: 'j3', jobCode: '1101', jobCodeLabel: 'Munkaviszony (határozott)', seqNum: 3,
    position: 'Junior asszisztens', feor: '4110', weeklyHours: 40, startDate: '2022-03-15',
    endDate: '2023-12-31', baseSalary: 322800, status: 'terminated', insured: false, minimumBase: false,
  },
];

function calculateInsurance(jobs: JobRelation[]): InsuranceResult {
  const activeJobs = jobs.filter(j => j.status === 'active');
  const totalHours = activeJobs.reduce((s, j) => s + j.weeklyHours, 0);
  const insuredCount = activeJobs.filter(j => j.insured).length;
  const hasFullTime = activeJobs.some(j => j.weeklyHours >= 36);
  const notes: string[] = [];

  if (totalHours >= 36 && insuredCount > 1) {
    notes.push('Heti 36 órás foglalkoztatás eléri a minimum járulékalap alóli mentesülés küszöbét a mellékállásban.');
  }
  if (activeJobs.some(j => j.employer)) {
    notes.push('Több munkáltatós jogviszony: összevont nyilatkozat szükséges a biztosítási elbíráláshoz.');
  }

  return {
    totalHours,
    insuredJobs: insuredCount,
    minimumBaseApplies: !hasFullTime,
    combinedMinBase: hasFullTime ? 0 : 322800,
    notes,
  };
}

export default function MultiJobPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const [jobs] = useState(MOCK_JOBS);
  const [showInsurance, setShowInsurance] = useState(false);

  const activeJobs = jobs.filter(j => j.status === 'active');
  const terminatedJobs = jobs.filter(j => j.status === 'terminated');
  const insurance = calculateInsurance(jobs);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    active: { label: 'Aktív', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    terminated: { label: 'Megszűnt', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
    suspended: { label: 'Szünetelő', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  };

  const renderJobCard = (job: JobRelation) => (
    <div key={job.id} className={cn(
      'bg-card rounded-xl border shadow-soft overflow-hidden transition-all hover:shadow-lg',
      job.status === 'active' ? 'border-border' : 'border-border/50 opacity-70'
    )}>
      <div className={cn(
        'px-5 py-3 border-b flex items-center justify-between',
        job.status === 'active' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 border-blue-200/50 dark:border-blue-500/20' :
        'bg-slate-50 dark:bg-slate-900/30 border-border'
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{job.seqNum}</span>
          </div>
          <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">{job.jobCode}</span>
          <span className="text-sm font-medium">{job.jobCodeLabel}</span>
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', STATUS_LABELS[job.status].color)}>
          {STATUS_LABELS[job.status].label}
        </span>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Munkakör</p>
          <p className="font-medium mt-0.5">{job.position}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">FEOR</p>
          <p className="font-mono mt-0.5">{job.feor}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Heti óra</p>
          <p className="font-medium mt-0.5">{job.weeklyHours} óra</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Alapbér</p>
          <p className="font-medium font-mono mt-0.5">{job.baseSalary.toLocaleString('hu-HU')} Ft</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Kezdete</p>
          <p className="mt-0.5">{job.startDate}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Vége</p>
          <p className="mt-0.5">{job.endDate || 'Határozatlan'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold">Biztosított</p>
          <p className="mt-0.5 flex items-center gap-1">
            {job.insured ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <span className="text-slate-400">—</span>}
            {job.insured ? 'Igen' : 'Nem'}
          </p>
        </div>
        {job.employer && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold">Munkáltató</p>
            <p className="mt-0.5 text-xs text-violet-600 dark:text-violet-400 font-medium">{job.employer}</p>
          </div>
        )}
      </div>
      <div className="px-5 pb-4 flex gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
          <Link to={`/accounty/payroll/${id}/employees/${empId}/modification`}>
            <Eye className="w-3 h-3" /> Módosítás
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Több jogviszony kezelése</h1>
            <p className="text-sm text-slate-500">Nagy Anna — {activeJobs.length} aktív jogviszony</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInsurance(!showInsurance)} className="gap-1.5 text-sm">
            <Shield className="w-4 h-4" /> Biztosítási elbírálás
          </Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" /> Új jogviszony
          </Button>
        </div>
      </div>

      {/* Insurance assessment panel */}
      {showInsurance && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-500/10 dark:to-blue-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/20 p-6 space-y-4">
          <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Biztosítási elbírálás eredménye
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{insurance.totalHours}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Heti össz. óra</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{insurance.insuredJobs}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Biztosított jogv.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{insurance.minimumBaseApplies ? 'Igen' : 'Nem'}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Min. alap köt.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold font-mono">{insurance.combinedMinBase.toLocaleString('hu-HU')}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Min. járulékalap</p>
            </div>
          </div>
          {insurance.notes.length > 0 && (
            <div className="space-y-1.5">
              {insurance.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active jobs */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Aktív jogviszonyok ({activeJobs.length})
        </h2>
        {activeJobs.map(renderJobCard)}
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Jogviszony idősor</h3>
        <div className="relative pl-6 space-y-3">
          {jobs.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map((job, i) => (
            <div key={job.id} className="relative flex items-start gap-3">
              <div className={cn(
                'absolute -left-6 w-3 h-3 rounded-full border-2 mt-1.5',
                job.status === 'active' ? 'bg-emerald-500 border-emerald-300' : 'bg-slate-300 border-slate-200'
              )} />
              {i < jobs.length - 1 && (
                <div className="absolute -left-[19px] top-5 w-0.5 h-full bg-slate-200 dark:bg-slate-700" />
              )}
              <div className="text-sm">
                <p className="font-medium">
                  <span className="font-mono text-xs text-blue-600">[{job.seqNum}]</span>{' '}
                  {job.jobCodeLabel}
                </p>
                <p className="text-xs text-slate-500">
                  {job.startDate} → {job.endDate || 'jelenlegi'} | {job.position} | {job.weeklyHours} óra/hét
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminated jobs */}
      {terminatedJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-400">Megszűnt jogviszonyok ({terminatedJobs.length})</h2>
          {terminatedJobs.map(renderJobCard)}
        </div>
      )}
    </div>
  );
}
