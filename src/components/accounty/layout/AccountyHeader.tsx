import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, AlertTriangle, Clock, FileWarning, Calendar, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GlobalDatePicker } from '@/components/GlobalDatePicker';
import { useAccountyShellOptional } from '@/pages/Accounty/AccountyShellContext';

export interface AccountyHeaderProps {
  setSidebarOpen?: (v: boolean) => void;
  kpis?: any;
  notifDismissed?: boolean;
  setNotifDismissed?: (v: boolean) => void;
  onHelpClick?: () => void;
}

function AccountyHeaderComponent(props: AccountyHeaderProps) {
  const navigate = useNavigate();
  const shell = useAccountyShellOptional();

  const setSidebarOpen = props.setSidebarOpen ?? shell?.setSidebarOpen ?? (() => {});
  const kpis = props.kpis ?? shell?.kpis ?? {};
  const notifDismissed = props.notifDismissed ?? shell?.notifDismissed ?? false;
  const setNotifDismissed = props.setNotifDismissed ?? shell?.setNotifDismissed ?? (() => {});
  const onHelpClick = props.onHelpClick ?? (() => shell?.setHelpDrawerOpen(true));

  return (
    <div className="flex items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 relative z-10">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 ml-2 text-muted-foreground hover:text-foreground rounded-md"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <GlobalDatePicker />
      </div>
      <div className="flex items-center pr-4 lg:pr-6 gap-1 shrink-0">
        <button
          onClick={onHelpClick}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none rounded-md"
          title="Segítség és bemutató"
          data-tour="help-trigger"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md">
              <Bell className="w-5 h-5" />
              {!notifDismissed && ((kpis?.criticalClients ?? 0) > 0 || (kpis?.missingItems ?? 0) > 0 || (kpis?.todayDeadlines ?? 0) > 0 || (kpis?.upcomingDeadlines ?? 0) > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full ring-2 ring-background"></span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 mt-2 border-border shadow-md rounded-lg overflow-hidden bg-card" align="end" sideOffset={8}>
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">Értesítések</h3>
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
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {(kpis?.criticalClients ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/eaisybooks')}>
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Kritikus ügyfelek</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{kpis?.criticalClients} ügyfélnél kritikus elmaradás</p>
                    </div>
                  </div>
                )}
                {(kpis?.todayDeadlines ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/eaisybooks/tax-calendar')}>
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Mai határidők</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{kpis?.todayDeadlines} deadline ma lejár</p>
                    </div>
                  </div>
                )}
                {(kpis?.missingItems ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/eaisybooks/missing-invoices')}>
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileWarning className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Hiányzó dokumentumok</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{kpis?.missingItems} tétel vár bekérésre</p>
                    </div>
                  </div>
                )}
                {(kpis?.upcomingDeadlines ?? 0) > 0 && (
                  <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/eaisybooks/tax-calendar')}>
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Közelgő határidők</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{kpis?.upcomingDeadlines} deadline 7 napon belül</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Nincs új értesítés</span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default React.memo(AccountyHeaderComponent);
