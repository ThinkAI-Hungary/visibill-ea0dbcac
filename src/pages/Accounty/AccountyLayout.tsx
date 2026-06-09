import React, { useEffect, useState, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AccountyRoleProvider } from './AccountyRoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FeedbackFab } from '@/components/FeedbackFab';
import { GlobalDatePicker } from '@/components/GlobalDatePicker';
import { useAccountyKpis, useAccountyClients } from '@/hooks/useAccountyData';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  MailCheck,
  Calculator,
  FileText,
  TrendingUp,
  Building2,
  Users,
  X,
  Menu,
  PanelLeft,
  TicketCheck,
  ShieldCheck,
  BookOpen,
  Scale,
  Sparkles,
  Rocket,
  ChevronUp,
  Landmark,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useUnreadTicketCount } from '@/hooks/useTickets';
import { AiAssistantChat as AiDrawerChat } from './AiAssistantPage';

export default function AccountyLayout() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { data: kpis } = useAccountyKpis();
  const { data: unreadTicketCount = 0 } = useUnreadTicketCount();

  // #16 Favicon badge — show missing items count in browser tab
  useEffect(() => {
    const count = kpis?.missingItems ?? 0;
    document.title = count > 0 ? `(${count}) Accounty — eaisybill` : 'Accounty — eaisybill';
    return () => { document.title = 'eaisybill'; };
  }, [kpis?.missingItems]);

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

  const isActive = (path: string) => {
    if (path === '/accounty') {
      return pathname === '/accounty' || pathname.startsWith('/accounty/client');
    }
    if (path === '/accounty/tao') {
      return pathname === '/accounty/tao';
    }
    return pathname.startsWith(path);
  };

  // #7 Command palette (Ctrl+K)
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const { data: allClients } = useAccountyClients();
  const [expandedPayroll, setExpandedPayroll] = useState<Set<string>>(new Set());
  const [payrollInitialized, setPayrollInitialized] = useState(false);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [showAllPayroll, setShowAllPayroll] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(['portfolio']));
  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        const sidebarCookie = cookies.find(c => c.trim().startsWith('sidebar:state='));
        if (sidebarCookie) {
          return sidebarCookie.split('=')[1]?.trim() === 'false';
        }
      }
      return localStorage.getItem('visibill:sidebar-collapsed') === 'true' || 
             localStorage.getItem('visibill:accounty-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        const maxAge = 60 * 60 * 24 * 7;
        document.cookie = `sidebar:state=${!next}; path=/; max-age=${maxAge}`;
        localStorage.setItem('visibill:accounty-sidebar-collapsed', String(next));
        localStorage.setItem('visibill:sidebar-collapsed', String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Auto-expand the active client's submenu on first render
  useEffect(() => {
    if (payrollInitialized || !allClients) return;
    const activeClient = allClients.find(c => location.pathname.startsWith(`/accounty/payroll/${c.companyId}`));
    if (activeClient) {
      setExpandedPayroll(new Set([activeClient.companyId]));
    }
    setPayrollInitialized(true);
  }, [allClients, location.pathname, payrollInitialized]);

  const togglePayrollClient = (companyId: string) => {
    setExpandedPayroll(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const cmdPages = [
    { name: 'Portfólió', path: '/accounty', icon: Briefcase },
    { name: 'Hiányzó számlák', path: '/accounty/missing-invoices', icon: FileWarning },
    { name: 'Adó naptár', path: '/accounty/tax-calendar', icon: Calendar },
    { name: 'Riportok', path: '/accounty/reports', icon: BarChart2 },
    { name: 'Jóváhagyó rendszer', path: '/accounty/approval-queue', icon: MailCheck },
    { name: 'Riasztások', path: '/accounty/alerts', icon: AlertTriangle },
    { name: 'NAV határidők', path: '/accounty/nav-deadlines', icon: Clock },
    { name: 'Bérszámfejtés portfólió', path: '/accounty/payroll-portfolio', icon: Calculator },
    { name: 'Onboarding', path: '/accounty/onboarding', icon: Rocket },
    { name: 'Beállítások', path: '/accounty/settings', icon: Settings },
    { name: 'Felhasználói beállítások', path: '/accounty/profile/settings', icon: User },
    { name: 'Segítség', path: '/accounty/help', icon: HelpCircle },
    { name: 'AI Asszisztens', path: '/accounty/ai-assistant', icon: Sparkles },
    { name: 'Audit napló', path: '/accounty/admin/audit', icon: ShieldCheck },
    { name: 'GDPR', path: '/accounty/admin/gdpr', icon: ShieldCheck },
    { name: 'Sablonok', path: '/accounty/admin/templates', icon: FileText },
    { name: 'Jogviszonykódok', path: '/accounty/admin/job-codes', icon: BookOpen },
    { name: 'Adómértékek', path: '/accounty/admin/tax-parameters', icon: Calculator },
    { name: 'Jogszabály-frissítések', path: '/accounty/admin/legal-updates', icon: Scale },
    { name: 'TAO Portfólió', path: '/accounty/tao', icon: Landmark },
    { name: 'TAO Naptár', path: '/accounty/tao/calendar', icon: Calendar },
    { name: 'TAO Adózói Körök', path: '/accounty/tao/taxpayer-types', icon: Users },
  ];

  const filteredPages = cmdQuery ? cmdPages.filter(p => p.name.toLowerCase().includes(cmdQuery.toLowerCase())) : cmdPages;
  const filteredClients = cmdQuery && allClients ? allClients.filter(c => c.name.toLowerCase().includes(cmdQuery.toLowerCase())).slice(0, 5) : [];


  return (
    <>
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 z-50",
        isCollapsed ? "w-12" : "w-64",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo Area */}
        <div className={cn(
          "border-b border-primary/30 shrink-0",
          isCollapsed ? "p-2 py-4 flex justify-center" : "p-4"
        )}>
          {isCollapsed ? (
            <div className="flex flex-col items-center justify-center gap-2 select-none">
              <Link to="/" className="text-2xl tracking-tight hover:opacity-80 transition-opacity" title="Vissza az eaisybillbe">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-primary">ai</span>
              </Link>
              <div className="w-4 h-px bg-muted-foreground/30 rounded-full" />
              <Link to="/accounty" className="text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity" title="Accounty">
                A
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/" className="text-2xl tracking-tight select-none hover:opacity-80 transition-opacity" title="Vissza az eaisybillbe">
                <span className="font-medium text-foreground/80">e</span>
                <span className="font-bold text-primary">ai</span>
                <span className="font-medium text-foreground/80">sy</span>
                <span className="font-medium text-primary">bill</span>
              </Link>
              <span className="text-xl font-light text-muted-foreground">|</span>
              <Link to="/accounty" className="relative text-2xl font-black bg-gradient-to-br from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity">
                Accounty
                <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-red-500 via-red-600 to-red-700" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation — Collapsible groups */}
        <nav className="flex-1 p-2 overflow-y-auto">
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
            /* Collapsed mode: icon-only with tooltip */
            <ul className="flex w-full min-w-0 flex-col gap-1">
              {[
                { path: '/accounty', name: 'Portfólió', icon: Briefcase },
                { path: '/accounty/missing-invoices', name: 'Hiányzó számlák', icon: FileWarning, badge: kpis?.missingItems },
                { path: '/accounty/tax-calendar', name: 'Adó naptár', icon: Calendar },
                { path: '/accounty/reports', name: 'Riportok', icon: BarChart2 },
                { path: '/accounty/approval-queue', name: 'Jóváhagyás', icon: MailCheck },
                { path: '/accounty/alerts', name: 'Riasztások', icon: AlertTriangle },
                { path: '/accounty/nav-deadlines', name: 'NAV határidők', icon: Clock },
                { path: '/accounty/payroll-portfolio', name: 'Bérszámfejtés', icon: Calculator },
                { path: '/accounty/onboarding', name: 'Onboarding', icon: Rocket },
                { path: '/accounty/tao', name: 'TAO Portfólió', icon: Landmark },
                { path: '/accounty/tao/calendar', name: 'TAO Naptár', icon: Calendar },
                { path: '/accounty/tao/taxpayer-types', name: 'Adózói Körök', icon: Users },
                { path: '/accounty/settings', name: 'Beállítások', icon: Settings },
                { path: '/accounty/tickets', name: 'Hibajegyek', icon: TicketCheck, badge: unreadTicketCount },
                { path: '/accounty/help', name: 'Segítség', icon: HelpCircle },
                { path: '/accounty/ai-assistant', name: 'AI Asszisztens', icon: Sparkles },
                { path: '/accounty/admin/audit', name: 'Audit', icon: ShieldCheck },
              ].map((item) => (
                <li key={item.path} className="relative flex justify-center">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          "relative flex items-center justify-center rounded-md transition-all duration-200 w-8 h-8",
                          isActive(item.path) ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {'badge' in item && (item as any).badge > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                            {(item as any).badge > 9 ? '9+' : (item as any).badge}
                          </span>
                        ) : null}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          ) : (
            /* Expanded mode: Collapsible groups */
            <div className="flex flex-col gap-0.5">
              {/* Portfólió csoport */}
              {(() => {
                const groupKey = 'portfolio';
                const isOpen = expandedSections.has(groupKey);
                const items = [
                  { to: '/accounty', icon: Briefcase, label: 'Portfólió', exact: true },
                  { to: '/accounty/missing-invoices', icon: FileWarning, label: 'Hiányzó számlák', badge: kpis?.missingItems },
                  { to: '/accounty/tax-calendar', icon: Calendar, label: 'Adó naptár' },
                  { to: '/accounty/reports', icon: BarChart2, label: 'Riportok' },
                  { to: '/accounty/approval-queue', icon: MailCheck, label: 'Jóváhagyó rendszer' },
                  { to: '/accounty/alerts', icon: AlertTriangle, label: 'Riasztások' },
                  { to: '/accounty/nav-deadlines', icon: Clock, label: 'NAV határidők' },
                  { to: '/accounty/onboarding', icon: Rocket, label: 'Onboarding' },
                ];
                const groupHasActive = items.some(i => i.exact ? pathname === i.to : isActive(i.to));
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
                          const active = item.exact ? pathname === item.to : isActive(item.to);
                          return (
                            <li key={item.to}>
                              <Link
                                to={item.to}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-sm transition-colors",
                                  active ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
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

              {/* Bérszámfejtés csoport */}
              {(() => {
                const groupKey = 'payroll';
                const isOpen = expandedSections.has(groupKey);
                const groupHasActive = pathname.includes('/accounty/payroll');
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
                      <Calculator className={cn("h-4 w-4 shrink-0 transition-colors", !isOpen && groupHasActive ? "text-primary" : "text-muted-foreground group-hover/trigger:text-primary")} />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">Bérszámfejtés</span>
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? 'rotate-90' : '', !isOpen && groupHasActive ? 'text-primary' : 'text-muted-foreground')} />
                      {!isOpen && groupHasActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-primary" />}
                    </button>
                    {isOpen && (
                      <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                        <li>
                          <Link
                            to="/accounty/payroll-portfolio"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-sm transition-colors",
                              isActive('/accounty/payroll-portfolio') ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                            )}
                          >
                            <BarChart2 className="h-4 w-4 shrink-0" />
                            <span className="truncate">Áttekintés</span>
                          </Link>
                        </li>
                        {(() => {
                          const filtered = allClients
                            ? (payrollSearch
                                ? allClients.filter((c: any) => c.name.toLowerCase().includes(payrollSearch.toLowerCase()))
                                : allClients
                              ).slice(0, showAllPayroll ? undefined : 5)
                            : [];
                          return (
                            <>
                              {allClients && allClients.length > 3 && (
                                <li className="px-4 mt-1 mb-0.5">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="Ügyfél..."
                                      value={payrollSearch}
                                      onChange={e => setPayrollSearch(e.target.value)}
                                      className="w-full text-[11px] pl-6 pr-2 py-1 bg-sidebar-foreground/5 rounded border-0 outline-none focus:ring-1 focus:ring-primary/30 text-sidebar-foreground placeholder:text-sidebar-foreground/30"
                                    />
                                  </div>
                                </li>
                              )}
                              {filtered.map((client: any) => {
                                const basePath = `/accounty/payroll/${client.companyId}`;
                                const isExpanded = expandedPayroll.has(client.companyId);
                                const isPayrollActive = pathname.startsWith(basePath);
                                return (
                                  <li key={client.id}>
                                    <button
                                      onClick={() => togglePayrollClient(client.companyId)}
                                      className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-xs transition-colors",
                                        isPayrollActive ? "text-primary font-medium" : "text-sidebar-foreground/70 hover:text-primary"
                                      )}
                                    >
                                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate flex-1">{client.name}</span>
                                      <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", isExpanded ? 'rotate-90' : '')} />
                                    </button>
                                    {isExpanded && (
                                      <ul className="ml-4 flex flex-col gap-0.5">
                                        {[
                                          { to: `${basePath}/employees`, icon: Users, label: 'Foglalkoztatottak' },
                                          { to: `${basePath}/reports`, icon: TrendingUp, label: 'Riportok' },
                                          { to: `${basePath}/filings`, icon: FileText, label: 'NAV bevallások' },
                                          { to: `${basePath}/portal`, icon: Building2, label: 'Ügyfélportál' },
                                          { to: `${basePath}/tax-params`, icon: Settings, label: 'Paraméterek' },
                                        ].map(sub => (
                                          <li key={sub.to}>
                                            <Link
                                              to={sub.to}
                                              className={cn(
                                                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                                                isActive(sub.to) ? "font-semibold text-primary" : "text-sidebar-foreground/60 hover:text-primary"
                                              )}
                                            >
                                              <sub.icon className="h-3.5 w-3.5 shrink-0" />
                                              <span className="truncate">{sub.label}</span>
                                            </Link>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                              {!showAllPayroll && allClients && allClients.length > 5 && !payrollSearch && (
                                <li>
                                  <button
                                    onClick={() => setShowAllPayroll(true)}
                                    className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-sidebar-foreground/50 hover:text-primary transition-colors"
                                  >
                                    + {allClients.length - 5} további cég
                                  </button>
                                </li>
                              )}
                            </>
                          );
                        })()}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* TAO / KIVA csoport */}
              {(() => {
                const groupKey = 'tao';
                const isOpen = expandedSections.has(groupKey);
                const items = [
                  { to: '/accounty/tao', icon: Landmark, label: 'TAO Portfólió', exact: true },
                  { to: '/accounty/tao/calendar', icon: Calendar, label: 'TAO Naptár' },
                  { to: '/accounty/tao/taxpayer-types', icon: Users, label: 'Adózói Körök' },
                ];
                const groupHasActive = pathname === '/accounty/tao' || pathname.startsWith('/accounty/tao/') || (pathname.includes('/tao') && pathname.includes('/client/'));
                return (
                  <div>
                    <button
                      onClick={() => toggleSection(groupKey)}
                      className={cn(
                        "relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors select-none group/trigger",
                        !isOpen && groupHasActive
                          ? "bg-emerald-500/8 text-emerald-600 font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-emerald-500/10 hover:text-emerald-600"
                      )}
                    >
                      <Landmark className={cn("h-4 w-4 shrink-0 transition-colors", !isOpen && groupHasActive ? "text-emerald-600" : "text-muted-foreground group-hover/trigger:text-emerald-600")} />
                      <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider">TAO / KIVA</span>
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? 'rotate-90' : '', !isOpen && groupHasActive ? 'text-emerald-600' : 'text-muted-foreground')} />
                      {!isOpen && groupHasActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-md bg-emerald-500" />}
                    </button>
                    {isOpen && (
                      <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                        {items.map(item => {
                          const active = item.exact ? pathname === item.to : isActive(item.to);
                          return (
                            <li key={item.to}>
                              <Link
                                to={item.to}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-sm transition-colors",
                                  active ? "bg-emerald-500/15 font-medium text-emerald-600" : "hover:bg-emerald-500/10 hover:text-emerald-600 text-sidebar-foreground"
                                )}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{item.label}</span>
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
                const items = [
                  { to: '/accounty/settings', icon: Settings, label: 'Beállítások' },
                  { to: '/accounty/tickets', icon: TicketCheck, label: 'Hibajegyek', badge: unreadTicketCount },
                  { to: '/accounty/help', icon: HelpCircle, label: 'Segítség' },
                  { to: '/accounty/ai-assistant', icon: Sparkles, label: 'AI Asszisztens' },
                  { to: '/accounty/profile/settings', icon: User, label: 'Profilbeállítások' },
                  { to: '/accounty/admin/audit', icon: ShieldCheck, label: 'Audit napló' },
                  { to: '/accounty/admin/gdpr', icon: ShieldCheck, label: 'GDPR' },
                  { to: '/accounty/admin/templates', icon: FileText, label: 'Sablonok' },
                  { to: '/accounty/admin/job-codes', icon: BookOpen, label: 'Jogviszonykódok' },
                  { to: '/accounty/admin/tax-parameters', icon: Calculator, label: 'Adómértékek' },
                  { to: '/accounty/admin/legal-updates', icon: Scale, label: 'Jogszabály-frissítések' },
                ];
                const groupHasActive = items.some(i => isActive(i.to));
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
                      <ul className="mt-0.5 flex flex-col gap-0.5 pb-1">
                        {items.map(item => {
                          const active = isActive(item.to);
                          return (
                            <li key={item.to}>
                              <Link
                                to={item.to}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-sm transition-colors",
                                  active ? "bg-primary/15 font-medium text-primary" : "hover:bg-primary/10 hover:text-primary text-sidebar-foreground"
                                )}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="truncate flex-1">{item.label}</span>
                                {item.badge && item.badge > 0 ? (
                                  <span className="h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
              })()}
            </div>
          )}
        </nav>

        {/* User Profile Footer — matching eaisybill sidebar style */}
        <div className="mt-auto border-t border-border">
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
                    <Link to="/accounty/profile/settings">
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Beállítások</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={async () => { await signOut(); navigate('/auth'); }} className="w-8 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
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
                      <Link to="/accounty/profile/settings">
                        <Settings className="h-5 w-5" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Beállítások</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={async () => { await signOut(); navigate('/auth'); }} className="w-full aspect-square justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Kilépés</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Sidebar Toggle */}
          <div className={cn("p-2 border-t border-border", isCollapsed ? 'flex justify-center' : '')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebarCollapse}
              className={cn(
                "h-7 hover:bg-primary/10 hover:text-primary",
                isCollapsed ? "w-7" : "w-full"
              )}
            >
              <PanelLeft className="h-4 w-4 shrink-0" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Date Range Picker + Notifications bar */}
        <div className="flex items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 relative z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 ml-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <GlobalDatePicker />
          </div>
          <div className="flex items-center pr-4 lg:pr-6">
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
                <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
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

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <AccountyRoleProvider>
            <Outlet />
          </AccountyRoleProvider>


          {/* AI Assistant Drawer */}
          {aiDrawerOpen && (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] bg-background/80 backdrop-blur-xl border-l border-border/50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">AI Asszisztens</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to="/accounty/ai-assistant"
                    onClick={() => setAiDrawerOpen(false)}
                    className="text-xs text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                  >
                    Teljes nézet
                  </Link>
                  <button onClick={() => setAiDrawerOpen(false)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <AiDrawerChat />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>

      {/* Command Palette */}
      <Dialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(''); }}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden [&>button]:hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              placeholder="Keresés oldal vagy ügyfél..."
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCmdOpen(false);
              }}
            />
            <button
              onClick={() => { setCmdOpen(false); setCmdQuery(''); }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-2">
            {filteredPages.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Oldalak</p>
                {filteredPages.map((p) => (
                  <button
                    key={p.path}
                    onClick={() => { navigate(p.path); setCmdOpen(false); setCmdQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                  >
                    <p.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {filteredClients.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ügyfelek</p>
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { navigate(`/accounty/client/${c.id}`); setCmdOpen(false); setCmdQuery(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                  >
                    <Briefcase className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-foreground font-medium">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{c.taxNumber}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {filteredPages.length === 0 && filteredClients.length === 0 && cmdQuery && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nincs találat: "{cmdQuery}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <FeedbackFab onAiOpen={() => setAiDrawerOpen(true)} aiDrawerOpen={aiDrawerOpen} onAiClose={() => setAiDrawerOpen(false)} />
    </>
  );
}
