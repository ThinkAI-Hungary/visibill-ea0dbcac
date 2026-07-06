import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Landmark, ArrowLeft, FileText, TrendingUp, Calculator, Shield,
  Globe, ChevronRight, BarChart2, Scale, CheckCircle, AlertTriangle,
  Briefcase, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';
import { useTaoYearly } from '@/hooks/useAdminData';

// 11-step year-end wizard steps
const WIZARD_STEPS = [
  { num: 1,  label: 'Beszámoló', icon: FileText },
  { num: 2,  label: 'AEE',       icon: Calculator },
  { num: 3,  label: '7.§ csökk.', icon: TrendingUp },
  { num: 4,  label: '8.§ növ.',  icon: TrendingUp },
  { num: 5,  label: 'Kamatkorlát', icon: Scale },
  { num: 6,  label: 'CFC',       icon: Globe },
  { num: 7,  label: 'Adóalap',   icon: Calculator },
  { num: 8,  label: 'Kedvezm.',  icon: Shield },
  { num: 9,  label: 'Felajánlás', icon: Briefcase },
  { num: 10, label: 'Fizetendő', icon: Calculator },
  { num: 11, label: 'Beküldés',  icon: CheckCircle },
];

interface TaoTab {
  id: string;
  label: string;
  icon: React.ElementType;
  to: string;
}

export default function ClientTaoMainPage() {
  const { id } = useParams<{ id: string }>();
  const { data: clients = [] } = useAccountyClients();
  const client = clients.find((c: any) => c.companyId === id);
  const [taxYear] = useState(2025);

  // Load real data from DB
  const companyUuid = client?.id;
  const { data: taoData } = useTaoYearly(companyUuid, taxYear);

  const currentStep = taoData?.current_step || 1;
  const aee = taoData?.aee || 0;
  const taxBase = taoData?.tax_base || 0;
  const calculatedTax = taoData?.calculated_tax || Math.round(taxBase * 0.09);
  const payableTax = taoData?.payable_tax || 0;
  const creditAmount = taoData?.tax_credits_total || 0;

  const tabs: TaoTab[] = [
    { id: 'overview',  label: 'Áttekintés',     icon: Landmark,    to: `/accounty/client/${id}/tao` },
    { id: 'status',    label: 'Adóalany',       icon: Shield,      to: `/accounty/client/${id}/tao/setup` },
    { id: 'master',    label: 'Törzsadatok',     icon: FileText,    to: `/accounty/client/${id}/tao/master-data` },
    { id: 'year-end',  label: 'Éves zárás',     icon: Calculator,  to: `/accounty/client/${id}/tao/year-end/${taxYear}` },
    { id: 'lifecycle', label: 'Életciklus',      icon: Clock,       to: `/accounty/client/${id}/tao/lifecycle` },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/accounty/tao" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
          <Landmark className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {client?.name || 'Ügyfél'} — TAO
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Belföldi Kft. (GFO 113)
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Általános 6.§
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{taxYear}. adóév</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">AEE</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {(aee / 1_000_000).toFixed(1)} M Ft
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Adóalap</p>
          <p className="text-xl font-bold text-emerald-600">
            {(taxBase / 1_000_000).toFixed(1)} M Ft
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Számított adó (9%)</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {(calculatedTax / 1_000_000).toFixed(2)} M Ft
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Fizetendő adó</p>
          <p className="text-xl font-bold text-emerald-600">
            {(payableTax / 1_000_000).toFixed(2)} M Ft
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Kedvezmény</p>
          <p className="text-xl font-bold text-blue-600">
            {(creditAmount / 1_000_000).toFixed(2)} M Ft
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab.id === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Year-end wizard progress */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {taxYear}. adóévi TAO-zárás
          </h2>
          <Link to={`/accounty/client/${id}/tao/year-end/${taxYear}?step=${currentStep}`}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Folytatás — {currentStep}. lépés
            </Button>
          </Link>
        </div>

        {/* 11-step stepper */}
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((step, i) => {
            const isDone = step.num < currentStep;
            const isCurrent = step.num === currentStep;
            return (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center min-w-[72px]">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isDone ? 'bg-emerald-500 text-white' :
                    isCurrent ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  )}>
                    {isDone ? <CheckCircle className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={cn(
                    'text-[10px] mt-1.5 text-center whitespace-nowrap',
                    isDone ? 'text-emerald-600 font-medium' :
                    isCurrent ? 'text-emerald-700 dark:text-emerald-300 font-bold' :
                    'text-slate-400'
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 min-w-4 mt-[-12px]',
                    step.num < currentStep ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link
          to={`/accounty/client/${id}/tao/master-data`}
          className="bg-card rounded-xl border border-border p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Törzsadatok</p>
              <p className="text-xs text-slate-500">GFO-kód, KKV-besorolás, Pillar Two</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          to={`/accounty/client/${id}/tao/setup`}
          className="bg-card rounded-xl border border-border p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Adóalany-státusz</p>
              <p className="text-xs text-slate-500">Besorolás wizard, adóalap-rezsim</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          to={`/accounty/client/${id}/tao/lifecycle`}
          className="bg-card rounded-xl border border-border p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Életciklus</p>
              <p className="text-xs text-slate-500">Keletkezés, megszűnés, KIVA-váltás</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          to={`/accounty/client/${id}/tao/kiva`}
          className="bg-card rounded-xl border border-border p-5 shadow-soft hover:shadow-md hover:border-orange-400/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calculator className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">KIVA kalkulátor</p>
              <p className="text-xs text-slate-500">Kisvállalati adó szimuláció (10%)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
          </div>
        </Link>
        <Link
          to={`/accounty/client/${id}/tao/compare`}
          className="bg-card rounded-xl border border-border p-5 shadow-soft hover:shadow-md hover:border-violet-400/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <BarChart2 className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">TAO vs KIVA</p>
              <p className="text-xs text-slate-500">Összehasonlító elemzés</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
