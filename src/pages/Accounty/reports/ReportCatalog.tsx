import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';

export interface ReportTypeConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

interface ReportCatalogProps {
  reportTypes: ReportTypeConfig[];
  onSelect: (type: ReportType) => void;
}

export function ReportCatalog({ reportTypes, onSelect }: ReportCatalogProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reportTypes.map((report) => (
        <button 
          key={report.id}
          onClick={() => onSelect(report.id as ReportType)}
          className="flex flex-col text-left bg-card border border-border rounded-xl p-5 hover:border-slate-300 hover:shadow-soft transition-all group relative overflow-hidden"
        >
          <div className="flex justify-between items-start w-full mb-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", report.bg)}>
              <report.icon className={cn("w-5 h-5", report.color)} />
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 dark:text-slate-400 transition-colors" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{report.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{report.description}</p>
        </button>
      ))}
    </div>
  );
}
