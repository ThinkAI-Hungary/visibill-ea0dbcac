import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Users,
  BookOpen
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAccountyShell } from '@/pages/Accounty/AccountyShellContext';
import { PATH_TO_MODULE } from '@/hooks/useAccountyPermissions';
import { Input } from '@/components/ui/input';
import AccountyCompanySelector from './AccountyCompanySelector';

export default function PortfolioNav() {
  const { t } = useTranslation('accounty');
  const location = useLocation();
  const prefix = location.pathname.startsWith('/hr') ? '/hr' : '';

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
        <li className="relative flex justify-center">
          <AccountyCompanySelector isCollapsed />
        </li>
        <li className="my-1 mx-2 h-px bg-border/50" />
        {[
          // 1. Teendők
          { path: `${prefix}/eaisybooks/missing-invoices`, name: t('nav.items.missing_invoices', 'Hiányzó számlák'), icon: FileWarning, badge: kpis?.missingItems },
          { path: `${prefix}/eaisybooks/approval-queue`, name: t('nav.items.approval_queue', 'Jóváhagyási sor'), icon: MailCheck },
          { path: `${prefix}/eaisybooks/alerts`, name: t('nav.items.alerts', 'Riasztások'), icon: AlertTriangle },
          { path: `${prefix}/eaisybooks/tax-calendar`, name: t('nav.items.tax_calendar', 'Adónaptár & Határidők'), icon: Calendar },
          { type: 'divider' as const },
          // 2. Portfólió & Szakmai Törzsadatok
          { path: `${prefix}/eaisybooks`, name: t('nav.items.portfolio', 'Portfólió'), icon: Briefcase },
          { path: `${prefix}/eaisybooks?tab=payroll`, name: t('nav.items.payroll_cycles', 'Bérszámfejtés Ciklusok'), icon: Calculator },
          { path: `${prefix}/eaisybooks/reports`, name: t('nav.items.reports', 'Riportok'), icon: BarChart2 },
          { path: `${prefix}/eaisybooks/onboarding`, name: t('nav.items.onboarding', 'Onboarding'), icon: Rocket },
          { path: `${prefix}/eaisybooks/admin/tax-parameters`, name: t('nav.items.tax_parameters', 'Szakmai Törzsadatok'), icon: BookOpen },
          { type: 'divider' as const },
          // 3. Segítség
          { path: `${prefix}/eaisybooks/ai-assistant`, name: t('nav.items.ai_assistant', 'AI Asszisztens'), icon: Bot },
          { path: `${prefix}/eaisybooks/tickets`, name: t('nav.items.tickets', 'Hibajegyek'), icon: TicketCheck, badge: unreadTicketCount },
          { path: `${prefix}/eaisybooks/help`, name: t('nav.items.help', 'Segítség'), icon: HelpCircle },
          { type: 'divider' as const },
          // 4. Beállítások
          { path: `${prefix}/eaisybooks/settings`, name: t('nav.items.settings', 'Beállítások'), icon: Settings },
          { path: `${prefix}/eaisybooks/admin/audit`, name: t('nav.items.audit', 'Audit'), icon: ShieldCheck },
        ].filter(item => {
          if ('type' in item) return true;
          const cleanPath = (item as any).path.replace(/^\/hr/, '').split('?')[0];
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
      {/* Portfólió / Cégnézet Választó */}
      <div className="px-1" data-tour="company-selector">
        <AccountyCompanySelector />
      </div>

      {/* 1. Csoport: Teendők */}
      <div>
        <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {t('nav.sections.todos', 'Teendők')}
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {[
            { to: `${prefix}/eaisybooks/missing-invoices`, icon: FileWarning, label: t('nav.items.missing_invoices', 'Hiányzó számlák'), badge: kpis?.missingItems, isDangerBadge: true },
            { to: `${prefix}/eaisybooks/approval-queue`, icon: MailCheck, label: t('nav.items.approval_queue', 'Jóváhagyási sor') },
            { to: `${prefix}/eaisybooks/alerts`, icon: AlertTriangle, label: t('nav.items.alerts', 'Riasztások') },
            { to: `${prefix}/eaisybooks/tax-calendar`, icon: Calendar, label: t('nav.items.tax_calendar', 'Adónaptár & Határidők') },
          ].filter(item => {
            const cleanPath = item.to.replace(/^\/hr/, '').split('?')[0];
            const module = PATH_TO_MODULE[cleanPath];
            return !module || canAccess(module);
          }).map(item => {
            const active = isPathActive(item.to);
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
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-5 text-center tabular-nums shadow-sm">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 2. Csoport: Portfólió */}
      <div className="border-t border-border/50 pt-3">
        <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {t('nav.sections.portfolio', 'Portfólió')}
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {[
            { to: `${prefix}/eaisybooks`, icon: Briefcase, label: t('nav.items.portfolio', 'Portfólió'), exact: true },
            { to: `${prefix}/eaisybooks?tab=payroll`, icon: Calculator, label: t('nav.items.payroll_cycles', 'Bérszámfejtés Ciklusok') },
            { to: `${prefix}/eaisybooks/reports`, icon: BarChart2, label: t('nav.items.reports', 'Irodai Riportok') },
            { to: `${prefix}/eaisybooks/onboarding`, icon: Rocket, label: t('nav.items.onboarding', 'Onboarding') },
          ].filter(item => {
            const cleanPath = item.to.replace(/^\/hr/, '').split('?')[0];
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
                </Link>
              </li>
            );
          })}

          {/* Szakmai Törzsadatok almenü közvetlenül a Portfólió alatt */}
          {(() => {
            const professionalGroup = subGroups.find(g => g.id === 'professional');
            if (!professionalGroup || professionalGroup.items.length === 0) return null;
            const isProfOpen = expandedSubSections.has(professionalGroup.id);
            const isProfActive = professionalGroup.items.some(i => isActive(i.to));

            return (
              <li className="mt-0.5">
                <button
                  type="button"
                  onClick={() => toggleSubSection(professionalGroup.id)}
                  style={{ outline: 'none' }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-all duration-200 select-none group/prof",
                    "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
                    "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
                    "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]",
                    isProfActive
                      ? "text-primary font-semibold bg-primary/5"
                      : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                  )}
                >
                  <professionalGroup.icon className={cn("h-4 w-4 shrink-0 transition-colors", isProfActive ? "text-primary" : "text-muted-foreground group-hover/prof:text-primary")} />
                  <span className="truncate flex-1">{professionalGroup.label}</span>
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isProfOpen ? "rotate-90" : "", isProfActive ? "text-primary" : "text-muted-foreground")} />
                </button>
                {isProfOpen && (
                  <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                    {professionalGroup.items.map(item => {
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
                              active
                                ? "bg-primary/10 font-semibold text-primary scale-[1.02] shadow-sm ring-1 ring-primary/20"
                                : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                            )}
                          >
                            <item.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate flex-1">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })()}
        </ul>
      </div>

      {/* 3. Csoport: Segítség */}
      <div className="border-t border-border/50 pt-3">
        <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {t('nav.sections.help', 'Segítség')}
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {[
            { to: `${prefix}/eaisybooks/ai-assistant`, icon: Bot, label: t('nav.items.ai_assistant', 'AI Asszisztens'), isAi: true },
            { to: `${prefix}/eaisybooks/tickets`, icon: TicketCheck, label: t('nav.items.tickets', 'Hibajegyek'), badge: unreadTicketCount },
            { to: `${prefix}/eaisybooks/help`, icon: HelpCircle, label: t('nav.items.help', 'Segítség') },
          ].filter(item => {
            const cleanPath = item.to.replace(/^\/hr/, '').split('?')[0];
            const module = PATH_TO_MODULE[cleanPath];
            return !module || canAccess(module);
          }).map(item => {
            const active = isPathActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onMouseEnter={() => handlePrefetch(item.to)}
                  onFocus={() => handlePrefetch(item.to)}
                  onTouchStart={() => handlePrefetch(item.to)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-all duration-200",
                    item.isAi && !active && "text-sidebar-foreground hover:text-primary hover:bg-primary/5 group/ai",
                    active
                      ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/20"
                      : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                    {item.isAi && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                      </span>
                    )}
                  </div>
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className={cn(
                      "h-4.5 min-w-4.5 px-1.5 py-0.5 flex items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground tabular-nums",
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
      </div>

      {/* 4. Csoport: Beállítások */}
      {(() => {
        const groupKey = 'admin';
        const isOpen = expandedSections.has(groupKey) || expandedSections.has('settings');
        const visibleSubGroups = subGroups.filter(g => g.id !== 'professional' && g.items.length > 0);
        const groupHasActive = visibleSubGroups.some(g => g.items.some(i => isActive(i.to)));

        if (visibleSubGroups.length === 0) return null;

        return (
          <div className="border-t border-border/50 pt-3">
            <button
              onClick={() => toggleSection(groupKey)}
              className={cn(
                "relative flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                !isOpen && groupHasActive
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
              )}
            >
              <Settings className={cn("h-4 w-4 shrink-0 transition-colors", !isOpen && groupHasActive ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary")} />
              <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider">{t('nav.sections.settings', 'Beállítások')}</span>
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
                                    <span className="h-4.5 min-w-4.5 px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
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
