import React from 'react';
import { Menu, Bell, AlertTriangle, Clock, FileWarning, Calendar, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CompanySwitcher } from '@/components/accounty/CompanySwitcher';
import { GlobalDatePicker } from '@/components/GlobalDatePicker';

interface AccountyHeaderProps {
  setSidebarOpen: (v: boolean) => void;
  kpis: any;
  notifDismissed: boolean;
  setNotifDismissed: (v: boolean) => void;
  navigate: (path: string) => void;
  onHelpClick: () => void;
}

export default function AccountyHeader({
  setSidebarOpen,
  kpis,
  notifDismissed,
  setNotifDismissed,
  navigate,
  onHelpClick,
}: AccountyHeaderProps) {
  return (
    <div className="flex items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 relative z-10">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 ml-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-md"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <CompanySwitcher />
        <div className="flex-1">
          <GlobalDatePicker />
        </div>
      </div>
      <div className="flex items-center pr-4 lg:pr-6 gap-1">
        <button
          onClick={onHelpClick}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none rounded-md"
          title="Segítség és bemutató"
          data-tour="help-trigger"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md">
              <Bell className="w-5 h-5" />
              {!notifDismissed && ((kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 mt-2 border-border shadow-lg rounded-xl overflow-hidden dark:bg-card" align="end" sideOffset={8}>
            <div className="px-4 py-3 border-b border-border dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Értesítések</h3>
              {((kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0) && (
                <button
                  onClick={() => setNotifDismissed(true)}
                  className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Mind olvasott
                </button>
              )}
            </div>
            {(kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {(kpis?.criticalClients ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty')}>
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Kritikus ügyfelek</p>
                      <p className="text-xs text-slate-500 mt-0.5">{kpis?.criticalClients} ügyfélnél kritikus elmaradás</p>
                    </div>
                  </div>
                )}
                {(kpis?.todayDeadlines ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/tax-calendar')}>
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mai határidők</p>
                      <p className="text-xs text-slate-500 mt-0.5">{kpis?.todayDeadlines} deadline ma lejár</p>
                    </div>
                  </div>
                )}
                {(kpis?.missingItems ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/missing-invoices')}>
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0 mt-0.5">
                      <FileWarning className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Hiányzó dokumentumok</p>
                      <p className="text-xs text-slate-500 mt-0.5">{kpis?.missingItems} tétel vár bekérésre</p>
                    </div>
                  </div>
                )}
                {(kpis?.upcomingDeadlines ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/accounty/tax-calendar')}>
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Közelgő határidők</p>
                      <p className="text-xs text-slate-500 mt-0.5">{kpis?.upcomingDeadlines} deadline 7 napon belül</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 flex items-center justify-center">
                <span className="text-sm text-slate-500">Nincs új értesítés</span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
