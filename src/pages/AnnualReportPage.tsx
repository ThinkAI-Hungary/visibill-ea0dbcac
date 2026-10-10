import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, FileSpreadsheet } from 'lucide-react';
import { AnnualReportContainer } from '@/features/annual-report';
import { AuditorExportWorkspace } from '@/components/accounty/audit-export/AuditorExportWorkspace';
import { YearEndClosingChecklist } from '@/components/accounty/audit-export/YearEndClosingChecklist';

export * from '@/features/annual-report/types';
export * from '@/features/annual-report/core/annualReportEngine';
export { useAnnualReportData } from '@/features/annual-report/hooks/useAnnualReportData';

const CURRENT_YEAR = new Date().getFullYear();

export default function AnnualReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'report';
  const defaultClosingYear = CURRENT_YEAR - 1;

  const handleTabChange = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Level Sub-Tabs Bar */}
      <div className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar">
            <button
              type="button"
              onClick={() => handleTabChange('closing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 ${
                currentTab === 'closing'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <ListChecks className="h-4 w-4" />
              <span>Éves Zárlat</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('report')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 ${
                currentTab === 'report'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Beszámoló & Melléklet</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('audit-export')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 ${
                currentTab === 'audit-export'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Könyvvizsgálói Export</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  currentTab === 'audit-export'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                MKVK / ISA
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="pt-6">
        {currentTab === 'closing' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <YearEndClosingChecklist
              fiscalYear={defaultClosingYear}
              onNavigateTab={handleTabChange}
            />
          </div>
        )}

        {currentTab === 'audit-export' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <AuditorExportWorkspace />
          </div>
        )}

        {(currentTab === 'report' || (currentTab !== 'closing' && currentTab !== 'audit-export')) && (
          <AnnualReportContainer />
        )}
      </div>
    </div>
  );
}
