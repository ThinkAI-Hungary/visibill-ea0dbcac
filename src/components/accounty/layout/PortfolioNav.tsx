import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  MailCheck, 
  AlertTriangle, 
  Rocket, 
  Settings, 
  TicketCheck, 
  HelpCircle, 
  Bot, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown, 
  Calculator, 
  Search, 
  Users 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAccountyShell } from '@/pages/Accounty/AccountyShellContext';
import { PATH_TO_MODULE } from '@/hooks/useAccountyPermissions';
import { Input } from '@/components/ui/input';

export default function PortfolioNav() {
  const {
    isCollapsed,
    handlePrefetch,
    isPathActive,
    isActive,
    kpis,
    unreadTicketCount,
    canAccess,
    expandedSections,
    toggleSection,
    expandedSubSections,
    toggleSubSection,
    subGroups,
    hoveredHelpSection,
    allClients,
    expandedPayroll,
    togglePayrollClient,
    payrollSearch,
    setPayrollSearch,
    showAllPayroll,
    setShowAllPayroll,
  } = useAccountyShell();

  if (isCollapsed) {
    return (
      <ul className="flex w-full min-w-0 flex-col gap-1">
        {[
          { path: '/eaisybooks', name: 'Portfólió', icon: Briefcase },
          { path: '/eaisybooks/missing-invoices', name: 'Hiányzó számlák', icon: FileWarning, badge: kpis?.missingItems },
          { path: '/eaisybooks/tax-calendar', name: 'Naptár & Határidők', icon: Calendar },
          { path: '/eaisybooks/reports', name: 'Riportok', icon: BarChart2 },
          { path: '/eaisybooks/approval-queue', name: 'Jóváhagyó rendszer', icon: MailCheck },
          { path: '/eaisybooks/alerts', name: 'Riasztások', icon: AlertTriangle },
          { path: '/eaisybooks/onboarding', name: 'Onboarding', icon: Rocket },
          { type: 'divider' as const },
          { path: '/eaisybooks/settings', name: 'Beállítások', icon: Settings },
          { path: '/eaisybooks/tickets', name: 'Hibajegyek', icon: TicketCheck, badge: unreadTicketCount },
          { path: '/eaisybooks/help', name: 'Segítség', icon: HelpCircle },
          { path: '/eaisybooks/ai-assistant', name: 'AI Asszisztens', icon: Bot },
          { path: '/eaisybooks/admin/audit', name: 'Audit', icon: ShieldCheck },
        ].filter(item => {
          if ('type' in item) return true;
          const cleanPath = (item as any).path.split('?')[0];
          const module = PATH_TO_MODULE[cleanPath];
          return !module || canAccess(module);
        }).map((item, idx) => {
          if ('type' in item) return <li key={`div-${idx}`} className="my-1 mx-2 h-px bg-border/50" />;
          const navItem = item as { path: string; name: string; icon: any; badge?: number };
          return (
            <li key={navItem.path} className="relative flex justify-center">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={navItem.path}
                    onMouseEnter={() => handlePrefetch(navItem.path)}
                    onFocus={() => handlePrefetch(navItem.path)}
                    onTouchStart={() => handlePrefetch(navItem.path)}
                    className={cn(
                      "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                      isPathActive(navItem.path) ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                    )}
                  >
                    <navItem.icon className="h-4 w-4 shrink-0" />
                    {navItem.badge && navItem.badge > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {navItem.badge > 9 ? '9+' : navItem.badge}
                      </span>
                    ) : null}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{navItem.name}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Portfolio Items */}
      <ul className="flex w-full min-w-0 flex-col gap-1">
        {[
          { to: '/eaisybooks', icon: Briefcase, label: 'Portfólió', exact: true },
          { to: '/eaisybooks/missing-invoices', icon: FileWarning, label: 'Hiányzó számlák', badge: kpis?.missingItems },
          { to: '/eaisybooks/tax-calendar', icon: Calendar, label: 'Adó naptár' },
          { to: '/eaisybooks/reports', icon: BarChart2, label: 'Riportok' },
          { to: '/eaisybooks/approval-queue', icon: MailCheck, label: 'Jóváhagyó rendszer' },
          { to: '/eaisybooks/alerts', icon: AlertTriangle, label: 'Riasztások' },
          { to: '/eaisybooks/onboarding', icon: Rocket, label: 'Onboarding' },
        ].filter(item => {
          const cleanPath = item.to.split('?')[0];
          const module = PATH_TO_MODULE[cleanPath];
          return !module || canAccess(module);
        }).map(item => {
          const active = isPathActive(item.to, item.exact);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onMouseEnter={() => handlePrefetch(item.to)}
                onFocus={() => handlePrefetch(item.to)}
                onTouchStart={() => handlePrefetch(item.to)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/20"
                    : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-5 text-center tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bérszámfejtés Portfólió Accordion */}
      {(() => {
        const groupKey = 'payroll';
        const isOpen = expandedSections.has(groupKey);
        const hasClients = allClients && allClients.length > 0;
        const filteredPayrollClients = (allClients || []).filter(c => 
          !payrollSearch || c.name.toLowerCase().includes(payrollSearch.toLowerCase())
        );

        return (
          <div className="border-t border-border/50 pt-2">
            <button
              onClick={() => toggleSection(groupKey)}
              className={cn(
                "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                isOpen ? "text-primary font-semibold" : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Calculator className="h-4 w-4 shrink-0 text-muted-foreground group-hover/trigger:text-primary" />
              <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">Bérszámfejtés</span>
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? 'rotate-90' : '')} />
            </button>
            {isOpen && (
              <div className="mt-1 flex flex-col gap-1 pb-1">
                <Link
                  to="/eaisybooks?tab=payroll"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-6 text-left text-xs font-semibold transition-colors",
                    isPathActive('/eaisybooks?tab=payroll')
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-sidebar-foreground/70 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">Portfólió Áttekintés</span>
                </Link>

                {hasClients && (
                  <div className="px-2 pt-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={payrollSearch}
                        onChange={(e) => setPayrollSearch(e.target.value)}
                        placeholder="Ügyfél keresése..."
                        className="h-6 text-[11px] pl-6 bg-sidebar-foreground/5 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/40"
                      />
                    </div>
                  </div>
                )}

                <ul className="mt-1 flex flex-col gap-0.5">
                  {(showAllPayroll ? filteredPayrollClients : filteredPayrollClients.slice(0, 5)).map(c => {
                    const isExpanded = expandedPayroll.has(c.companyId);
                    return (
                      <li key={c.companyId} className="space-y-0.5">
                        <button
                          onClick={() => togglePayrollClient(c.companyId)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 pl-6 text-left text-xs text-sidebar-foreground/80 hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{c.name}</span>
                          <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", isExpanded ? 'rotate-90' : '')} />
                        </button>
                        {isExpanded && (
                          <div className="pl-9 space-y-0.5 py-0.5 border-l border-border/40 ml-6">
                            <Link
                              to={`/eaisybooks/payroll/${c.companyId}`}
                              className="block px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                            >
                              Irányítópult
                            </Link>
                            <Link
                              to={`/eaisybooks/payroll/${c.companyId}/employees`}
                              className="block px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                            >
                              Dolgozók
                            </Link>
                            <Link
                              to={`/eaisybooks/payroll/${c.companyId}/cycle/new`}
                              className="block px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                            >
                              Új bérszámfejtési ciklus
                            </Link>
                            <Link
                              to={`/eaisybooks/payroll/${c.companyId}/filings`}
                              className="block px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary rounded transition-colors"
                            >
                              NAV 08 bevallások
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {filteredPayrollClients.length > 5 && !showAllPayroll && (
                    <button
                      onClick={() => setShowAllPayroll(true)}
                      className="text-[11px] text-primary hover:underline px-6 py-1 text-left font-medium"
                    >
                      + még {filteredPayrollClients.length - 5} cég megjelenítése
                    </button>
                  )}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* Adminisztráció Csoport */}
      {(() => {
        const groupKey = 'admin';
        const isOpen = expandedSections.has(groupKey);
        const visibleSubGroups = subGroups.filter(g => g.items.length > 0);
        const groupHasActive = visibleSubGroups.some(g => g.items.some(i => isActive(i.to)));

        if (visibleSubGroups.length === 0) return null;

        return (
          <div className="border-t border-border/50 pt-2">
            <button
              onClick={() => toggleSection(groupKey)}
              className={cn(
                "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                !isOpen && groupHasActive
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Settings className={cn("h-4 w-4 shrink-0 transition-colors", !isOpen && groupHasActive ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary")} />
              <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">Adminisztráció</span>
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? 'rotate-90' : '', !isOpen && groupHasActive ? 'text-primary' : 'text-muted-foreground')} />
              {!isOpen && groupHasActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />}
            </button>
            {isOpen && (
              <div className="mt-1 flex flex-col gap-1 pb-1">
                {visibleSubGroups.map(subGroup => {
                  const subGroupOpen = expandedSubSections.has(subGroup.id);
                  const subGroupActive = subGroup.items.some(i => isActive(i.to));
                  return (
                    <div key={subGroup.id} className="space-y-0.5">
                      <button
                        onClick={() => toggleSubSection(subGroup.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 pl-6 text-left text-xs font-semibold transition-colors select-none group/subtrigger",
                          subGroupActive ? "text-primary" : "text-sidebar-foreground/60 hover:text-primary hover:bg-primary/5"
                        )}
                      >
                        <subGroup.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{subGroup.label}</span>
                        <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", subGroupOpen ? 'rotate-90' : '')} />
                      </button>
                      {subGroupOpen && (
                        <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                          {subGroup.items.map(item => {
                            const active = isActive(item.to);
                            return (
                              <li key={item.to}>
                                <Link
                                  to={item.to}
                                  onMouseEnter={() => handlePrefetch(item.to)}
                                  onFocus={() => handlePrefetch(item.to)}
                                  onTouchStart={() => handlePrefetch(item.to)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-1 pl-10 text-left text-sm transition-all duration-200",
                                    hoveredHelpSection === (item as any).id
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/30 animate-help-glow"
                                      : active
                                        ? "bg-primary/10 font-semibold text-primary scale-[1.02] shadow-sm ring-1 ring-primary/20"
                                        : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                                  )}
                                >
                                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate flex-1">{item.label}</span>
                                  {item.badge && item.badge > 0 ? (
                                    <span className={cn(
                                      "h-4.5 min-w-4.5 px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground",
                                      item.to.includes('tickets') && "animate-pulse shadow-[0_0_8px_rgba(20,212,184,0.5)]"
                                    )}>
                                      {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
