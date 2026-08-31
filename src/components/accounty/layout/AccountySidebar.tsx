import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  Settings, 
  HelpCircle,
  Search,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Clock,
  MailCheck,
  Calculator,
  FileText,
  TrendingUp,
  Building2,
  Users,
  PanelLeft,
  TicketCheck,
  ShieldCheck,
  BookOpen,
  Scale,
  Sparkles,
  Rocket,
  Landmark,
  Shield,
  Coins,
  ArrowLeft,
  ClipboardList,
  Brain
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AppModeSwitcher from '@/components/AppModeSwitcher';
import { PATH_TO_MODULE } from '@/hooks/useAccountyPermissions';
import { useAccountyTaxProfile } from '@/hooks/accounty';
import { useEvClientSettings } from '@/hooks/useEvData';
import { useDateRange } from '@/contexts/DateRangeContext';

interface AccountySidebarProps {
  isCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  hasEaisybillAccess: boolean;
  kpis: any;
  unreadTicketCount: number;
  canAccess: (module: string) => boolean;
  pathname: string;
  user: any;
  signOut: () => Promise<void>;
  setCmdOpen: (v: boolean) => void;
  theme: string;
  setTheme: (t: string) => void;
  allClients: any[] | null;
  expandedPayroll: Set<string>;
  togglePayrollClient: (id: string) => void;
  payrollSearch: string;
  setPayrollSearch: (s: string) => void;
  showAllPayroll: boolean;
  setShowAllPayroll: (v: boolean) => void;
  expandedSections: Set<string>;
  toggleSection: (key: string) => void;
  isActive: (path: string) => boolean;
  navigate: (path: string) => void;
  hoveredHelpSection?: string | null;
}

export default function AccountySidebar({
  isCollapsed,
  toggleSidebarCollapse,
  sidebarOpen,
  setSidebarOpen,
  hasEaisybillAccess,
  kpis,
  unreadTicketCount,
  canAccess,
  pathname,
  user,
  signOut,
  setCmdOpen,
  theme,
  setTheme,
  allClients,
  expandedPayroll,
  togglePayrollClient,
  payrollSearch,
  setPayrollSearch,
  showAllPayroll,
  setShowAllPayroll,
  expandedSections,
  toggleSection,
  isActive,
  navigate,
  hoveredHelpSection = null,
}: AccountySidebarProps) {
  const [expandedSubSections, setExpandedSubSections] = React.useState<Set<string>>(new Set());
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;

  const isPathActive = React.useCallback((to: string, exact?: boolean) => {
    const cleanTo = to.split('?')[0];
    const itemParams = new URLSearchParams(to.split('?')[1] || '');
    const itemTab = itemParams.get('tab');
    
    const queryParams = new URLSearchParams(window.location.search);
    const currentTab = queryParams.get('tab');
    
    if (itemTab) {
      return pathname.startsWith(cleanTo) && currentTab === itemTab;
    }
    if (to === '/eaisybooks') {
      return pathname === '/eaisybooks' && !currentTab;
    }
    return exact ? pathname === cleanTo : isActive(cleanTo);
  }, [pathname, isActive]);

  const toggleSubSection = (key: string) => {
    setExpandedSubSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const subGroups = React.useMemo(() => [
    {
      id: 'office',
      label: 'Iroda & Beállítások',
      icon: Settings,
      items: [
        { to: '/eaisybooks/settings', icon: Settings, label: 'Beállítások', id: 'settings' },
        { to: '/eaisybooks/profile/settings', icon: User, label: 'Profilbeállítások' },
        { to: '/eaisybooks/admin/permissions', icon: Shield, label: 'Jogosultságkezelő' },
        { to: '/eaisybooks/admin/accountants', icon: Users, label: 'Könyvelők kezelése' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'professional',
      label: 'Szakmai Törzsadatok',
      icon: BookOpen,
      items: [
        { to: '/eaisybooks/admin/templates', icon: FileText, label: 'Sablonok' },
        { to: '/eaisybooks/admin/job-codes', icon: BookOpen, label: 'Jogviszonykódok' },
        { to: '/eaisybooks/admin/tax-parameters', icon: Calculator, label: 'Adómértékek' },
        { to: '/eaisybooks/admin/legal-updates', icon: Scale, label: 'Jogszabály-frissítések' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'security',
      label: 'Biztonság & GDPR',
      icon: ShieldCheck,
      items: [
        { to: '/eaisybooks/admin/audit', icon: ShieldCheck, label: 'Audit napló' },
        { to: '/eaisybooks/admin/gdpr', icon: ShieldCheck, label: 'GDPR' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    },
    {
      id: 'support',
      label: 'Támogatás & AI',
      icon: HelpCircle,
      items: [
        { to: '/eaisybooks/ai-assistant', icon: Sparkles, label: 'AI Asszisztens' },
        { to: '/eaisybooks/tickets', icon: TicketCheck, label: 'Hibajegyek', badge: unreadTicketCount },
        { to: '/eaisybooks/help', icon: HelpCircle, label: 'Segítség' },
      ].filter(item => {
        const module = PATH_TO_MODULE[item.to];
        return !module || canAccess(module);
      })
    }
  ], [unreadTicketCount, canAccess]);

  React.useEffect(() => {
    const activeSubGroup = subGroups.find(g => g.items.some(i => isActive(i.to)));
    if (activeSubGroup) {
      setExpandedSubSections(prev => {
        if (prev.has(activeSubGroup.id)) return prev;
        const next = new Set(prev);
        next.add(activeSubGroup.id);
        return next;
      });
    }
  }, [pathname, subGroups]);

  const getUserInitials = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const clientMatch = pathname.match(/\/eaisybooks\/([a-f0-9-]{36})/i);
  const selectedClientId = clientMatch ? clientMatch[1] : null;
  const selectedClient = allClients?.find(c => c.companyId === selectedClientId);
  const { data: evSettings } = useEvClientSettings(selectedClientId || undefined);
  const isEv = pathname.split('/').includes('ev') || 
               !!evSettings || 
               (selectedClient?.name ? (
                 selectedClient.name.toUpperCase().includes('EV') || 
                 selectedClient.name.toUpperCase().includes('E.V.') ||
                 selectedClient.name.toLowerCase().includes('egyéni vállalkozó')
               ) : false);

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 z-50",
      isCollapsed ? "w-12" : "w-64",
      "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo Area */}
      <div 
        data-tour="app-mode-switcher"
        className={cn(
          "border-b border-border shrink-0",
          isCollapsed ? "p-2 py-4 flex justify-center" : "p-4"
        )}
      >
        <AppModeSwitcher
          activeMode="accounty"
          isCollapsed={isCollapsed}
          showToggle={hasEaisybillAccess === true}
        />
      </div>

      {/* Company Selector Dropdown — placed and styled exactly like eaisyBill */}
      {!isCollapsed && (
        <div className="p-3 border-b border-border shrink-0 flex items-center gap-2" data-tour="company-selector">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={selectedClientId || '_portfolio'}
            onValueChange={(val) => {
              if (val === '_portfolio') {
                navigate('/eaisybooks');
              } else {
                navigate(`/eaisybooks/${val}/${currentDateRange}/overview`);
              }
            }}
          >
            <SelectTrigger className="flex-1 h-9 text-sm font-medium bg-transparent border-border hover:bg-sidebar-foreground/5 text-sidebar-foreground [&>span]:text-left [&>span]:flex-1 focus:ring-1 focus:ring-primary/30">
              <SelectValue placeholder="Válassz céget">
                {selectedClientId ? selectedClient?.name : 'Teljes Portfólió'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="_portfolio" className="text-xs font-bold text-primary">
                Teljes Portfólió
              </SelectItem>
              {(allClients || []).map((client) => (
                <SelectItem key={client.companyId} value={client.companyId} className="text-xs">
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Navigation — Collapsible groups */}
      <nav className="flex-1 p-2 overflow-y-auto" data-sidebar-nav>
        {/* Search trigger */}
        {isCollapsed ? (
          <div className="flex justify-center mb-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCmdOpen(true)}
                  className="flex items-center justify-center rounded-md transition-colors w-8 h-8 hover:bg-primary/10 text-sidebar-foreground/60"
                >
                  <Search className="h-4 w-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Keresés... (Ctrl K)</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors h-8 hover:bg-primary/10 text-sidebar-foreground/60 mb-1"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1">Keresés...</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-sidebar-foreground/10 text-sidebar-foreground/50 rounded">Ctrl K</kbd>
          </button>
        )}



        {isCollapsed ? (
          selectedClientId ? (
            /* Client Context Collapsed Mode */
            <ul className="flex w-full min-w-0 flex-col gap-1 animate-in fade-in duration-300">
              {[
                { path: '/eaisybooks', name: 'Vissza a portfólióhoz', icon: ArrowLeft },
                { type: 'divider' as const },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/overview`, name: 'Áttekintés', icon: Briefcase, exact: true },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/profile`, name: 'Profil', icon: User },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/invoices`, name: 'Számlák', icon: FileText },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/missing-invoices`, name: 'Hiányzó számlák', icon: FileWarning },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/ev`, name: 'Egyéni Vállalkozás', icon: Coins },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/tao`, name: 'Társasági Adó', icon: Landmark },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll`, name: 'Bérszámfejtés', icon: Calculator },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll/filings`, name: 'NAV bevallások', icon: ClipboardList },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/prompts`, name: 'Könyvelési Szabályok', icon: Brain },
                { path: `/eaisybooks/${selectedClientId}/${currentDateRange}/settings#notifications`, name: 'Beállítások / Cégkapu', icon: Settings },
              ].map((item, idx) => {
                if ('type' in item) return <li key={`div-${idx}`} className="my-1 mx-2 h-px bg-border/50" />;
                const pathWithoutHash = item.path.split('#')[0];
                const active = item.exact ? pathname === pathWithoutHash : pathname.startsWith(pathWithoutHash);
                return (
                  <li key={item.path} className="relative flex justify-center">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          className={cn(
                            "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                            active ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.name}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          ) : (
            /* Collapsed mode: icon-only with tooltip */
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
                { path: '/eaisybooks/ai-assistant', name: 'AI Asszisztens', icon: Sparkles },
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
          )
        ) : selectedClientId ? (
          /* Client Context Expanded Mode */
          <div className="flex flex-col gap-1 px-1 animate-in fade-in duration-300">
            {/* Back to Portfolio */}
            <button
              onClick={() => navigate('/eaisybooks')}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-all duration-150 h-8 hover:bg-primary/10 hover:text-primary text-sidebar-foreground/70 mb-2 border border-border/40"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1 font-semibold text-xs">Vissza a portfólióhoz</span>
            </button>

            {/* Client Info Card */}
            <div className="p-3 mb-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 flex items-start gap-2.5">
              <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-sidebar-foreground truncate leading-tight">
                  {selectedClient?.name || 'Ügyfél betöltése...'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {selectedClient?.taxNumber || ''}
                </p>
                {selectedClient?.status && (
                  <span className={cn(
                    "inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full mt-1.5",
                    selectedClient.status === 'Rendben' ? 'bg-emerald-500/10 text-emerald-500' :
                    selectedClient.status === 'Feldolgozandó' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-rose-500/10 text-rose-500'
                  )}>
                    {selectedClient.status}
                  </span>
                )}
              </div>
            </div>

            <ul className="flex flex-col gap-1">
              {[
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/overview`, label: 'Áttekintés', icon: Briefcase, exact: true, id: 'portfolio' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/profile`, label: 'Profil', icon: User, id: 'profile' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/invoices`, label: 'Számlák', icon: FileText, id: 'invoices' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/missing-invoices`, label: 'Hiányzó számlák', icon: FileWarning, id: 'missing-invoices' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/ev`, label: 'Egyéni Vállalkozás', icon: Coins, id: 'ev' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/tao`, label: 'Társasági Adó', icon: Landmark, id: 'tao' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll`, label: 'Bérszámfejtés', icon: Calculator, id: 'payroll' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/payroll/filings`, label: 'NAV bevallások', icon: ClipboardList, id: 'filings' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/prompts`, label: 'Könyvelési Szabályok', icon: Brain, id: 'prompts' },
                { to: `/eaisybooks/${selectedClientId}/${currentDateRange}/settings#notifications`, label: 'Beállítások / Cégkapu', icon: Settings, id: 'settings' },
              ].map(item => {
                const pathWithoutHash = item.to.split('#')[0];
                const active = item.exact 
                  ? pathname === pathWithoutHash 
                  : item.to.endsWith('/payroll')
                    ? pathname.startsWith(pathWithoutHash) && !pathname.startsWith(pathWithoutHash + '/filings')
                    : pathname.startsWith(pathWithoutHash);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-all duration-200",
                        hoveredHelpSection === item.id
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/30 animate-help-glow transition-all duration-300"
                          : active
                            ? "bg-primary/15 font-semibold text-primary scale-[1.02] shadow-sm ring-1 ring-primary/20"
                            : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground/80"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          /* Expanded mode: Collapsible groups */
          <div className="flex flex-col gap-1">
            {/* Portfólió csoport */}
            {(() => {
              const groupKey = 'portfolio';
              const isOpen = expandedSections.has(groupKey);
              const allPortfolioItems = [
                { to: '/eaisybooks', icon: Briefcase, label: 'Portfólió', exact: true, id: 'portfolio' },
                { to: '/eaisybooks/missing-invoices', icon: FileWarning, label: 'Hiányzó számlák', badge: kpis?.missingItems, id: 'missing-invoices' },
                { to: '/eaisybooks/tax-calendar', icon: Calendar, label: 'Naptár & Határidők', id: 'calendar' },
                { to: '/eaisybooks/reports', icon: BarChart2, label: 'Riportok', id: 'reports' },
                { to: '/eaisybooks/approval-queue', icon: MailCheck, label: 'Jóváhagyó rendszer', id: 'approval-queue' },
                { to: '/eaisybooks/alerts', icon: AlertTriangle, label: 'Riasztások', id: 'alerts' },
                { to: '/eaisybooks/onboarding', icon: Rocket, label: 'Onboarding', id: 'onboarding' },
              ];
              const items = allPortfolioItems.filter(item => {
                const cleanPath = item.to.split('?')[0];
                const module = PATH_TO_MODULE[cleanPath];
                return !module || canAccess(module);
              });
              const groupHasActive = items.some(i => isPathActive(i.to, i.exact));
              return (
                <div>
                  <button
                    onClick={() => toggleSection(groupKey)}
                    className={cn(
                      "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                      !isOpen && groupHasActive
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-sidebar-foreground/70 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Briefcase className={cn("h-4 w-4 shrink-0 transition-colors", !isOpen && groupHasActive ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary")} />
                    <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">Portfólió</span>
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? 'rotate-90' : '', !isOpen && groupHasActive ? 'text-primary' : 'text-muted-foreground')} />
                    {!isOpen && groupHasActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />}
                  </button>
                  {isOpen && (
                    <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                      {items.map(item => {
                        const active = isPathActive(item.to, item.exact);
                        return (
                          <li key={item.to}>
                            <Link
                              to={item.to}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-9 text-left text-sm transition-all duration-200",
                                hoveredHelpSection === item.id
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/30 animate-help-glow transition-all duration-300"
                                  : active
                                    ? "bg-primary/15 font-semibold text-primary scale-[1.02] shadow-sm ring-1 ring-primary/20"
                                    : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate flex-1">{item.label}</span>
                              {item.badge && item.badge > 0 ? (
                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-5 text-center tabular-nums">{item.badge}</span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* Adminisztráció csoport */}
            {(() => {
              const groupKey = 'admin';
              const isOpen = expandedSections.has(groupKey);
              const visibleSubGroups = subGroups.filter(g => g.items.length > 0);
              const groupHasActive = visibleSubGroups.some(g => g.items.some(i => isActive(i.to)));

              if (visibleSubGroups.length === 0) return null;

              return (
                <div>
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
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded-md px-2 py-1 pl-10 text-left text-sm transition-all duration-200",
                                          hoveredHelpSection === (item as any).id
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/30 animate-help-glow transition-all duration-300"
                                            : active
                                              ? "bg-primary/10 font-semibold text-primary scale-[1.02] shadow-sm ring-1 ring-primary/20"
                                              : "hover:bg-primary/5 hover:text-primary text-sidebar-foreground/80"
                                        )}
                                      >
                                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate flex-1">{item.label}</span>
                                        {(item as any).badge && (item as any).badge > 0 ? (
                                           <span className={cn(
                                             "h-4.5 min-w-4.5 px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground",
                                             item.to.includes('tickets') && "animate-pulse shadow-[0_0_8px_rgba(20,212,184,0.5)]"
                                           )}>
                                             {(item as any).badge > 9 ? '9+' : (item as any).badge}
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
        )}
      </nav>

      {/* User Profile Footer */}
      <div className="mt-auto border-t border-border shrink-0">
        {isCollapsed ? (
          <div className="p-2 space-y-2 flex flex-col items-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 hover:bg-primary/10 hover:text-primary">
                  <div className="relative h-4 w-4">
                    <Sun className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                    <Moon className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{theme === 'dark' ? 'Világos mód' : 'Sötét mód'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" asChild className="w-8 h-8 p-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                  <Link to="/eaisybooks/profile/settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Beállítások</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={async () => { await signOut(); navigate('/auth?app=eaisybooks'); }} className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Kilépés</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.name || 'Felhasználó'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              >
                <div className="relative h-4 w-4">
                  <Sun className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-out' : 'animate-rotate-in'}`} />
                  <Moon className={`h-4 w-4 absolute transition-all ${theme === 'dark' ? 'animate-rotate-in' : 'animate-rotate-out'}`} />
                </div>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" asChild className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <Link to="/eaisybooks/profile/settings">
                      <Settings className="h-5 w-5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Beállítások</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={async () => { await signOut(); navigate('/auth?app=eaisybooks'); }} className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Kilépés</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Sidebar Toggle */}
        <div className={cn("p-2 border-t border-border shrink-0", isCollapsed ? 'flex justify-center' : '')}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebarCollapse}
            className={cn(
              "h-7 hover:bg-primary/10 hover:text-primary",
              isCollapsed ? "w-7" : "w-full"
            )}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4 shrink-0" /> : <PanelLeft className="h-4 w-4 shrink-0 rotate-180" />}
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
